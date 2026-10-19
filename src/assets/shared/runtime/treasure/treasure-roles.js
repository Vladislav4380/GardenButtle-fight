// Treasure battle: the generic role engine. The start role (set by the start spot) never changes during the battle;
// the vegetable's contract (treasure-vegetables.js) picks how that role is carried out.
// decide(): a few times a second, picks the fighter's current task (intent) and keeps it for a minimum time.
// plan(): every frame, turns the task into a movement goal, an engage target and an attack policy.
var TB = globalThis.TB || (globalThis.TB = {});
TB.roles = (() => {
  const HOLD = 1.2; // minimum time a task is kept unless the treasure is in urgent danger

  const V = (f) => TB.vegetables.VEGETABLES[f.character];
  const alive = (w, team) => w.fighters.filter((q) => q.team === team && q.hp > 0);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // The leading attacker a support follows: the living ally of the attack role closest to the enemy treasure.
  function leadOf(w, f) {
    const goal = w.treasures[1 - f.team],
      leads = alive(w, f.team).filter((q) => q !== f && q.role === "attack");
    return leads.length ? leads.reduce((b, q) => (dist(q, goal) < dist(b, goal) ? q : b)) : null;
  }
  // Is there a free lane to the enemy treasure? No enemy body close to the straight line.
  function laneFree(w, f) {
    const goal = w.treasures[1 - f.team],
      dx = goal.x - f.x,
      dy = goal.y - f.y,
      d = Math.max(0.001, Math.hypot(dx, dy));
    return alive(w, 1 - f.team).every((q) => {
      const s = ((q.x - f.x) * dx + (q.y - f.y) * dy) / d,
        l = Math.abs(((q.x - f.x) * dy - (q.y - f.y) * dx) / d);
      return s < 0 || s > d || l > 2.5 * w.B;
    });
  }

  // Task chosen from the role, the vegetable's behaviours, the team's assignment and the stalemate rule.
  function candidate(f, w) {
    const veg = V(f),
      role = veg.roles[f.role],
      st = TB.team.state(w, f.team);
    if (typeof role.plan === "function") return role.plan({ f, w, TB });
    if (f.rescue && f.rescue.hp > 0) return { mode: "rescue", target: f.rescue };
    const attackWith = () => ({ mode: "advance", style: veg.roles.attack.advance });
    if (f.role === "attack") return attackWith();
    if (f.role !== "attack" && st.breakout) return attackWith();
    if (f.duty && f.duty.hp > 0) return { mode: role.respond, target: f.duty };
    if (f.role === "defense") return { mode: "guard" };
    // Support without a threat helps the attack.
    const lead = leadOf(w, f);
    if (role.idle === "breakthrough") return lead && !laneFree(w, f) ? { mode: "escort", lead } : { mode: "advance", style: "weave" };
    if (!lead) return attackWith();
    return { mode: role.idle === "fireSupport" ? "fireSupport" : "escort", lead };
  }
  const same = (a, b) => a && b && a.mode === b.mode && a.target === b.target && a.lead === b.lead && a.style === b.style;
  function decide(f, w) {
    const next = candidate(f, w);
    f.intentHold = Math.max(0, f.intentHold || 0);
    if (same(f.intent, next)) return;
    const lost = !f.intent || (f.intent.target && f.intent.target.hp <= 0) || (f.intent.lead && f.intent.lead.hp <= 0),
      // Answering a new threat is not delayed (the team already filters threats with enter/leave thresholds);
      // the hold stops flipping back and forth between calmer tasks.
      urgent = next.mode === "rescue" || (next.target && (!f.intent || !f.intent.target || (TB.team.threatOf(w, f.team, next.target)?.eta ?? 9) < TB.team.URGENT));
    if (!lost && !urgent && f.intentHold > 0) return;
    f.intent = next;
    f.intentHold = HOLD;
  }

  // Point between the intruder and the treasure, kept inside the fighter's leash.
  function blockPoint(w, f, enemy) {
    const tr = w.treasures[f.team],
      dx = enemy.x - tr.x,
      dy = enemy.y - tr.y,
      d = Math.max(0.001, Math.hypot(dx, dy)),
      gap = TB.nav.radius(w, f) + TB.nav.radius(w, enemy) + 0.4 * w.B,
      s = Math.min(TB.team.leash(w, f), Math.max(TB.geometry.captureRadius(w) * 0.5, d - gap));
    return { x: tr.x + (dx / d) * s, y: tr.y + (dy / d) * s };
  }
  // Ranged cover spot: on the intruder's line to the treasure, at shooting distance from it, never farther from the
  // treasure than the leash, so a retreat never opens the way to the capture zone.
  function coverPoint(w, f, enemy) {
    const tr = w.treasures[f.team],
      dx = enemy.x - tr.x,
      dy = enemy.y - tr.y,
      d = Math.max(0.001, Math.hypot(dx, dy)),
      want = Math.min(f.stats.preferredRange, f.stats.attackRange) * w.unit + TB.nav.radius(w, f) + TB.nav.radius(w, enemy),
      s = Math.max(0, Math.min(TB.team.leash(w, f), d - want));
    return { x: tr.x + (dx / d) * s, y: tr.y + (dy / d) * s };
  }
  function behind(w, f, lead, back) {
    const fw = TB.geometry.forward(w, f.team),
      side = (f.slot % 2 ? 1 : -1) * 1.2 * w.B;
    return { x: lead.x - fw.x * back - fw.y * side, y: lead.y - fw.y * back + fw.x * side };
  }

  // Per frame: what to do with the current task.
  // goal: where to walk; engage: whom to close in on; attack: which enemies in range to hit first;
  // pathing: how to get round bodies; stopToShoot: stand still for shots; retreat: how a shooter backs off.
  function plan(f, w) {
    const it = f.intent || { mode: f.role === "attack" ? "advance" : "guard" },
      veg = V(f),
      home = w.treasures[f.team],
      goal = w.treasures[1 - f.team],
      ranged = f.stats.preferredRange > 0,
      pathing = veg.traits.pathing;
    switch (it.mode) {
      case "guard":
        // Hold the start spot; hit what comes in range, the one closest to the treasure first.
        return { goal: f.post, attack: "home", pathing, retreat: veg.roles.defense.respond === "cover" ? "home" : "none", stopToShoot: true };
      case "rescue": {
        // An enemy holds the capture zone: close in and attack it, whatever the role and the leash.
        const t = it.target;
        if (!t || t.hp <= 0) return { goal: f.post, attack: "home", pathing, retreat: "none", stopToShoot: true };
        return { engage: t, contact: !ranged && pathing === "push", focus: t, attack: "focus", pathing, retreat: ranged ? "away" : "none", stopToShoot: ranged };
      }
      case "block": {
        // Heavy: stand in the intruder's way, hit it and push it back with mass.
        const t = it.target;
        if (!t || t.hp <= 0) return { goal: f.post, attack: "home", pathing, retreat: "none", stopToShoot: true };
        const p = blockPoint(w, f, t);
        // Once the intruder is close to the blocking spot, step into body contact and hold it there.
        if (dist(t, p) < 3 * w.B || dist(t, home) < dist(f, home)) return { engage: t, contact: true, focus: t, attack: "focus", pathing: "push", retreat: "none" };
        return { goal: p, focus: t, attack: "home", pathing: "push", retreat: "none" };
      }
      case "intercept": {
        // Mobile: run at the intruder, but never farther than the leash; outside it, wait at the leash edge.
        const t = it.target;
        if (!t || t.hp <= 0) return { goal: f.post, attack: "home", pathing };
        if (dist(t, home) > TB.team.leash(w, f)) return { goal: blockPoint(w, f, t), focus: t, attack: "home", pathing };
        return { engage: t, focus: t, attack: "focus", pathing };
      }
      case "cover": {
        const t = it.target;
        if (!t || t.hp <= 0) return { goal: f.post, attack: "home", pathing, retreat: "home", stopToShoot: true };
        const p = coverPoint(w, f, t),
          inRange = TB.nav.inRange(w, f, t);
        return { goal: inRange ? null : p, focus: t, attack: "focus", pathing, retreat: "home", stopToShoot: true };
      }
      case "escort": {
        const lead = it.lead;
        if (!lead || lead.hp <= 0) return { goal, attack: "ahead", pathing, stopToShoot: ranged };
        return { goal: behind(w, f, lead, 2.4 * w.B), attack: "lead", lead, pathing, stopToShoot: ranged, retreat: ranged ? "away" : "none" };
      }
      case "fireSupport": {
        const lead = it.lead;
        if (!lead || lead.hp <= 0) return { goal, attack: "ahead", pathing, stopToShoot: true, retreat: "away" };
        return { goal: behind(w, f, lead, f.stats.preferredRange * 0.8 * w.unit), attack: "lead", lead, pathing, stopToShoot: true, retreat: "away" };
      }
      case "advance":
      default: {
        // Attack styles: push (heavy) hits whoever blocks the way and keeps walking; weave (mobile) goes round and
        // fights only when stuck or held in contact; shootAndGo (ranged) stops to clear the way and walks on.
        const style = it.style || veg.roles.attack.advance;
        if (style === "push") return { goal, attack: "blockers", pathing: "push", stopToShoot: true, keepWalking: true, retreat: "none" };
        if (style === "weave") return { goal, attack: "contact", pathing: "weave", retreat: "none" };
        return { goal, attack: "ahead", pathing: "steer", stopToShoot: true, retreat: "away" };
      }
    }
  }
  return { HOLD, decide, plan, leadOf, laneFree, blockPoint, coverPoint };
})();
