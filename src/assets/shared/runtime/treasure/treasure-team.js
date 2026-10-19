// Treasure battle: team coordination. Each team looks at the situation a few times a second, rates the danger to
// its own treasure and decides who answers which intruder. It only uses what is visible now: positions and speeds.
var TB = globalThis.TB || (globalThis.TB = {});
TB.team = (() => {
  const THINK = 0.3,
    // Seconds until an intruder could reach the capture zone. Separate thresholds to enter and leave a reaction,
    // so the team does not flip between decisions; support reacts only to a real threat.
    DEFENSE_IN = 5.5,
    DEFENSE_OUT = 8,
    SUPPORT_IN = 3.5,
    SUPPORT_OUT = 5.5,
    URGENT = 1.5;

  const speed = (w, f) => Math.max(1, f.stats.moveSpeed * w.unit);
  const alive = (w, team) => w.fighters.filter((f) => f.team === team && f.hp > 0);
  function etaToZone(w, enemy, treasure) {
    return Math.max(0, Math.hypot(enemy.x - treasure.x, enemy.y - treasure.y) - TB.geometry.captureRadius(w)) / speed(w, enemy);
  }
  // Where a guard can meet the intruder: on its line to the treasure, about half way, never inside the capture zone.
  function interceptPoint(w, guard, enemy, treasure) {
    const dx = enemy.x - treasure.x,
      dy = enemy.y - treasure.y,
      d = Math.max(0.001, Math.hypot(dx, dy)),
      R = TB.geometry.captureRadius(w),
      s = Math.max(Math.min(R + w.B, d), Math.min(d - 2 * w.B, d * 0.5));
    return { x: treasure.x + (dx / d) * s, y: treasure.y + (dy / d) * s };
  }
  function arrival(w, guard, enemy, treasure) {
    const p = interceptPoint(w, guard, enemy, treasure);
    return Math.hypot(p.x - guard.x, p.y - guard.y) / speed(w, guard);
  }
  // How far from the treasure a fighter may follow an intruder before giving up and going back.
  function leash(w, f) {
    const z = w.zones[f.team],
      extra = TB.vegetables.VEGETABLES[f.character].traits.leash * w.B;
    return z.defenseRadius + extra + (f.role === "support" ? 2 * w.B : 0);
  }
  function state(w, team) {
    return (w.teamState[team] ||= { think: THINK * (0.5 + team * 0.5), level: new Map(), lastDist: new Map(), trend: new Map(), threats: [], guards: new Map(), quiet: 0, breakout: false });
  }
  function assess(w, team) {
    const st = state(w, team),
      tr = w.treasures[team],
      out = [];
    let approaching = false;
    const near = w.zones[team].defenseRadius;
    for (const e of alive(w, 1 - team)) {
      const eta = etaToZone(w, e, tr),
        prev = st.level.get(e) || 0,
        d = Math.hypot(e.x - tr.x, e.y - tr.y),
        last = st.lastDist.get(e),
        // Closing speed toward the treasure, as a share of the intruder's own speed (smoothed).
        closing = last === undefined ? 0 : (last - d) / THINK / speed(w, e),
        trend = (st.trend.get(e) || 0) * 0.5 + closing * 0.5;
      st.lastDist.set(e, d);
      st.trend.set(e, trend);
      if (trend > 0.2) approaching = true;
      // Only an enemy that is coming our way, or already close, is a threat; a guard standing at its own base is not.
      // To stop being a threat it has to turn clearly away or get far enough.
      const enter = trend > 0.25 || d < near + 1.5 * w.B,
        stay = trend > -0.15 || d < near + 3 * w.B,
        level = (prev ? stay : enter) ? (eta < SUPPORT_IN || (prev >= 2 && eta < SUPPORT_OUT) ? 2 : eta < DEFENSE_IN || (prev >= 1 && eta < DEFENSE_OUT) ? 1 : 0) : 0;
      st.level.set(e, level);
      if (level) out.push({ enemy: e, eta, level });
    }
    for (const e of st.level.keys()) if (e.hp <= 0) st.level.delete(e);
    return { threats: out.sort((a, b) => a.eta - b.eta), approaching };
  }
  const threatOf = (w, team, enemy) => state(w, team).threats.find((t) => t.enemy === enemy);

  function think(w, team) {
    const st = state(w, team),
      mine = alive(w, team),
      tr = w.treasures[team],
      { threats, approaching } = assess(w, team);
    st.threats = threats;
    // Stalemate breaker (see treasure-match.js).
    st.quiet = threats.length || approaching ? 0 : st.quiet + THINK;
    const onlyDefenders = mine.length > 0 && mine.every((f) => f.role === "defense");
    if (!st.breakout && st.quiet >= TB.match.QUIET_TIME && onlyDefenders) st.breakout = true;
    const m = w.match;
    if (!st.breakout && m.time >= TB.match.CALM_START && m.time - (m.lastDamage || 0) >= TB.match.CALM_TIME) st.breakout = true;
    // Keep assignments that still make sense: guard alive, intruder still a threat, still within the guard's leash.
    for (const [enemy, guards] of st.guards) {
      const th = threats.find((t) => t.enemy === enemy),
        kept = guards.filter((g) => g.hp > 0 && th && (g.role === "defense" || th.level >= 2) && Math.hypot(enemy.x - tr.x, enemy.y - tr.y) <= leash(w, g) + 2 * w.B);
      if (kept.length) st.guards.set(enemy, kept);
      else st.guards.delete(enemy);
    }
    const busy = new Set([...st.guards.values()].flat()),
      free = (f, roles) => !busy.has(f) && roles.includes(f.role) && !(st.breakout && f.role !== "attack");
    for (const th of threats) {
      if (st.guards.has(th.enemy)) continue;
      // Defenders answer first; support joins only a real threat or when no defender can get there in time.
      let pool = mine.filter((f) => free(f, ["defense"]) && Math.hypot(th.enemy.x - tr.x, th.enemy.y - tr.y) <= leash(w, f) + w.B);
      const inTime = pool.filter((f) => arrival(w, f, th.enemy, tr) <= th.eta + 0.5);
      if (th.level >= 2 && !inTime.length) pool = pool.concat(mine.filter((f) => free(f, ["support"])));
      if (!pool.length) continue;
      const guard = pool.reduce((b, f) => (arrival(w, f, th.enemy, tr) < arrival(w, b, th.enemy, tr) ? f : b));
      st.guards.set(th.enemy, [guard]);
      busy.add(guard);
    }
    // A second helper only when the first cannot make it and the intruder is about to capture.
    for (const th of threats) {
      const guards = st.guards.get(th.enemy);
      if (!guards || guards.length > 1 || th.eta > URGENT || arrival(w, guards[0], th.enemy, tr) <= th.eta) continue;
      const pool = mine.filter((f) => free(f, ["defense", "support"]));
      if (!pool.length) continue;
      const helper = pool.reduce((b, f) => (arrival(w, f, th.enemy, tr) < arrival(w, b, th.enemy, tr) ? f : b));
      if (arrival(w, helper, th.enemy, tr) < arrival(w, guards[0], th.enemy, tr)) {
        guards.push(helper);
        busy.add(helper);
      }
    }
    for (const f of mine) {
      let duty = null;
      for (const [enemy, guards] of st.guards) if (guards.includes(f)) duty = enemy;
      f.duty = duty;
    }
    // An enemy standing in the capture zone is knocked out by one fighter: the one that can hit it soonest
    // (time to walk into its own attack range), whatever the role. Each intruder gets its own fighter.
    const reach = (f, q) => Math.max(0, TB.nav.gapTo(w, f, q) - TB.nav.range(w, f)) / speed(w, f);
    for (const f of mine) f.rescue = null;
    for (const q of TB.match.takersOf(w, team)) {
      const pool = mine.filter((f) => !f.rescue);
      if (!pool.length) break;
      // Keep the fighter already on it unless another can hit clearly sooner.
      const best = pool.reduce((b, f) => (reach(f, q) < reach(b, q) ? f : b)),
        cur = pool.find((f) => f.intent?.mode === "rescue" && f.intent.target === q);
      (cur && reach(cur, q) <= reach(best, q) + 0.5 ? cur : best).rescue = q;
    }
    for (const f of mine) TB.roles.decide(f, w);
  }
  function update(w, dt) {
    for (const team of [0, 1]) {
      const st = state(w, team);
      st.think -= dt;
      if (st.think <= 0) {
        st.think += THINK;
        think(w, team);
      }
    }
  }
  // The most urgent real threat, for supports that cover the defence.
  function mainThreat(w, team, level = 1) {
    return state(w, team).threats.find((t) => t.level >= level && t.enemy.hp > 0) || null;
  }
  return { THINK, DEFENSE_IN, DEFENSE_OUT, SUPPORT_IN, SUPPORT_OUT, URGENT, state, think, update, etaToZone, interceptPoint, arrival, leash, threatOf, mainThreat };
})();
