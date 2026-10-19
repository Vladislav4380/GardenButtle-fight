// Treasure battle: the simulation step. Headless: no drawing and no page elements, so it also runs in checks.
// Both teams plan from the same snapshot, move together, and all damage of a step is applied at once,
// so the order of fighters in the array gives no team an advantage.
var TB = globalThis.TB || (globalThis.TB = {});
TB.sim = (() => {
  const SHIELD_TIME = 5,
    ENERGY_RATE = 0.5,
    SKILL_THINK = 0.4,
    CAST = 0.42,
    TURN_HOLD = 0.5,
    DASH_TIME = 1.2,
    DASH_REACH = 8; // in B
  const N = () => TB.nav;
  const alive = (w, team) => w.fighters.filter((f) => f.team === team && f.hp > 0);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function createWorld(profiles) {
    return {
      W: 0,
      H: 0,
      profiles,
      fighters: [],
      treasures: [null, null],
      zones: [null, null],
      match: TB.match.create(),
      teamState: [],
      energy: [2, 2],
      skillThink: [0.5, 0.5],
      shields: [0, 0],
      shieldOwners: [null, null],
      shots: [],
      damage: [],
      hooks: {},
      started: false,
    };
  }
  // Field size, figure scale and the size unit B. When the half field is shorter than 9 B the figures shrink,
  // otherwise the zones would not fit.
  function layout(w, W, H) {
    w.W = W;
    w.H = H;
    // Teams always stand left and right, also on a portrait screen (Vlad, 2026-10-18).
    w.orient = "landscape";
    w.unit = w.orient === "landscape" ? Math.min(W / 700, H / 390) : Math.min(W / 390, H / 700);
    let scale = w.orient === "landscape" ? 0.85 * Math.min((W * 0.18) / 1100, (H * 0.25) / 1100) : 0.85 * Math.min(W / 4600, (H * 0.23) / 1100);
    for (let k = 0; k < 30; k++) {
      w.scale = scale;
      w.B = Math.max(...TB.vegetables.IDS.map((id) => N().radius(w, { character: id })));
      w.headroom = scale * 1150 + 10;
      const m = 22 * w.unit;
      w.field = { left: w.B + m, right: W - w.B - m, top: Math.max(w.B, w.headroom) + m * 0.5, bottom: H - Math.max(12, w.B) - m };
      if (TB.geometry.length(w) / 2 >= 9 * w.B && TB.geometry.breadth(w) >= 9 * w.B) break;
      scale *= 0.95;
    }
  }
  function makeFighters(w, lineup) {
    w.fighters = [];
    for (const team of [0, 1])
      for (let slot = 0; slot < 3; slot++) w.fighters.push({ team, slot, lane: slot, character: lineup[team][slot], hp: 1, max: 1, x: 0, y: 0, facing: team ? -1 : 1 });
    for (const f of w.fighters) resetFighter(f);
  }
  function resetFighter(f) {
    const v = TB.vegetables.VEGETABLES[f.character];
    f.stats = { ...v.stats };
    f.max = f.hp = f.stats.max;
    Object.assign(f, {
      vx: 0,
      vy: 0,
      cool: 0,
      cast: 0,
      hit: 0,
      walk: 0,
      moving: false,
      retreating: false,
      target: null,
      intent: null,
      intentHold: 0,
      duty: null,
      dash: null,
      melee: null,
      pendingFire: null,
      turnHold: 0,
      dealt: 0,
      taken: 0,
      deathPlayed: false,
      stuckFor: 0,
      progressT: 0,
      progressD: undefined,
      detourFrom: null,
      detourHold: 0,
      arrivedAt: null,
      engageTarget: null,
      attackEngaged: false,
      attackTarget: null,
      facing: f.team ? -1 : 1,
    });
  }
  // Battle start: the start spot becomes the guard post and fixes the role for the whole battle.
  function start(w) {
    w.started = true;
    w.match = TB.match.create();
    w.teamState = [];
    w.energy = [2, 2];
    w.skillThink = [0.5, 0.5];
    w.shields = [0, 0];
    w.shieldOwners = [null, null];
    w.shots = [];
    w.damage = [];
    for (const f of w.fighters) {
      resetFighter(f);
      f.role = TB.setup.startRole(w, f);
      f.post = { x: f.x, y: f.y };
    }
  }

  function turnToward(f, x, y, dt) {
    f.turnHold = Math.max(0, (f.turnHold || 0) - dt);
    if (f.turnHold > 0) return;
    const len = Math.hypot(x, y) || 1,
      facing = x > 0.25 * len ? 1 : x < -0.25 * len ? -1 : f.facing || 1;
    if (facing !== f.facing) f.turnHold = TURN_HOLD;
    f.facing = facing;
  }
  function walkCycleDistance(w, f) {
    const p = w.profiles[f.character];
    return Math.max(0.001, (w.scale * 1100 * (p.scale || 1) * p.strideLength) / p.visualHeight);
  }
  // Steps follow only the fighter's own travel: pushes from others never start the walk cycle.
  function advanceWalkCycle(w, f, dx, dy, dt) {
    const own = Math.hypot(f.vx, f.vy),
      projected = own > 0.001 ? (dx * f.vx + dy * f.vy) / own : 0,
      travel = Math.min(Math.max(0, projected), own * Math.max(0, dt));
    f.moving = f.hp > 0 && f.cast <= 0 && travel > 0.001;
    if (f.moving) f.walk = ((f.walk || 0) + travel / walkCycleDistance(w, f)) % 1;
    return travel;
  }
  const attackReactionDelay = (f) => 0.08 + Math.random() * Math.min(0.28, f.stats.attackInterval * 0.3);
  const nextAttackInterval = (f) => Math.max(0.44, f.stats.attackInterval * (0.88 + Math.random() * 0.24));
  const blow = (f, t, mult) => Math.max(1, Math.round(f.stats.power * mult - t.stats.defense));

  function hurt(w, f, d, src) {
    if (f.hp > 0 && d > 0) w.damage.push({ f, d, src });
  }
  // All damage of the step at once. An active tomato shield halves hits on allies; the tomato takes a quarter.
  function applyDamage(w) {
    const list = w.damage;
    w.damage = [];
    const deal = (f, d, src) => {
      if (f.hp <= 0 || d <= 0) return;
      const dealt = Math.min(f.hp, d);
      f.hp -= dealt;
      f.taken += dealt;
      if (src) src.dealt += dealt;
      f.hit = 0.14;
      f.hitAt = w.match.time;
      w.match.lastDamage = w.match.time;
      w.hooks.onHit?.(f, d);
    };
    for (const { f, d: raw, src } of list) {
      let d = raw;
      const owner = w.shieldOwners[f.team];
      if (w.shields[f.team] > 0 && owner && owner.hp > 0 && owner !== f) {
        deal(owner, Math.floor(d / 4), src);
        d -= Math.floor(d / 2);
      }
      deal(f, d, src);
    }
    for (const f of w.fighters)
      if (f.hp <= 0 && !f.deathPlayed) {
        f.hp = 0;
        f.deathPlayed = true;
        f.pendingFire = null;
        f.melee = null;
        f.dash = null;
        f.moving = false;
        w.hooks.onDeath?.(f);
      }
  }
  function socket(w, f) {
    return w.hooks.socket ? w.hooks.socket(f) : { x: f.x, y: f.y - w.scale * 600 };
  }
  function fire(w, f, t) {
    if (f.hp <= 0 || !N().inRange(w, f, t) || f.cast > 0) return;
    f.cast = CAST;
    f.target = t;
    if (f.stats.preferredRange <= 0) f.melee = { target: t, t: 0.2, dmg: blow(f, t, 1) };
    else f.pendingFire = { to: t, t: 0.16 };
  }
  function spawnShot(w, f, t, big) {
    const p = socket(w, f);
    w.shots.push({ x: p.x, y: p.y, to: t, from: f, kind: f.character, big: !!big, dmg: blow(f, t, big ? 2.4 : 1), trail: [], spin: Math.random() * 7 });
  }

  // Skills fire by themselves for both teams under the same rules; one skill per team per think.
  function skillWish(w, f) {
    const team = f.team,
      foes = alive(w, 1 - team),
      mates = alive(w, team),
      R = TB.geometry.captureRadius(w),
      goal = w.treasures[1 - team];
    if (!foes.length) return null;
    const id = TB.vegetables.VEGETABLES[f.character].skill.id;
    if (id === "shield") {
      if (w.shields[team] > 0) return null;
      const pressed = mates.filter((q) => foes.some((e) => N().inRange(w, e, q) && (e.target === q || N().gapTo(w, e, q) < 0.5 * w.B)));
      const runner = mates.some((q) => q.role === "attack" && dist(q, goal) < R + 3 * w.B && foes.some((e) => N().inRange(w, e, q)));
      return pressed.length >= 2 || pressed.some((q) => q.hp < q.max * 0.75) || runner ? f : null;
    }
    if (id === "fireball") {
      const t = f.target && f.target.hp > 0 && N().gapTo(w, f, f.target) <= N().range(w, f) * 1.5 ? f.target : null;
      if (!t) return null;
      const threat = (TB.team.threatOf(w, team, t)?.level || 0) >= 1,
        crowd = foes.filter((q) => q !== t && dist(q, t) <= 90 * w.unit).length;
      return threat || crowd >= 1 || w.energy[team] >= 8 ? t : null;
    }
    if (id === "dash") {
      const reach = DASH_REACH * w.B;
      // Defence: catch an intruder the carrot would not reach in time on foot.
      if (f.duty && f.duty.hp > 0 && dist(f, f.duty) <= reach) {
        const th = TB.team.threatOf(w, team, f.duty);
        if (th && TB.team.arrival(w, f, f.duty, w.treasures[team]) > th.eta * 0.8) return f.duty;
      }
      // Attack: jump the last guard standing by the enemy treasure.
      if (f.intent?.mode === "advance") {
        const guard = foes.filter((e) => dist(e, goal) < R + 3 * w.B && dist(f, e) <= reach && dist(f, goal) > R);
        if (guard.length) return guard.reduce((b, e) => (dist(f, e) < dist(f, b) ? e : b));
      }
    }
    return null;
  }
  function useSkill(w, f, t) {
    const skill = TB.vegetables.VEGETABLES[f.character].skill;
    w.hooks.onSkill?.(f, skill);
    if (skill.id === "fireball") {
      f.cast = CAST;
      f.target = t;
      spawnShot(w, f, t, true);
    } else if (skill.id === "dash") {
      f.dash = { target: t, t: DASH_TIME };
      f.pendingFire = null;
      f.melee = null;
    } else {
      w.shields[f.team] = SHIELD_TIME;
      w.shieldOwners[f.team] = f;
    }
  }
  function teamSkills(w, team) {
    // Danger to the own treasure goes first, then the attack.
    const rank = (f) => (f.duty ? 0 : f.role === "defense" ? 1 : f.role === "support" ? 2 : 3);
    for (const f of alive(w, team).sort((a, b) => rank(a) - rank(b))) {
      const cost = TB.vegetables.VEGETABLES[f.character].skill.cost;
      if (w.energy[team] < cost || f.dash || f.cast > 0) continue;
      const t = skillWish(w, f);
      if (!t) continue;
      useSkill(w, f, t);
      w.energy[team] -= cost;
      return;
    }
  }
  // Carrot dash: runs fast at its target and hits on arrival; gives up if it cannot get there in time.
  function planDash(w, f, dt) {
    const t = f.dash.target;
    f.dash.t -= dt;
    if (!t || t.hp <= 0 || f.dash.t <= 0) {
      f.dash = null;
      return false;
    }
    if (N().inRange(w, f, t)) {
      f.dash = null;
      f.target = t;
      f.cast = CAST;
      f.cool = nextAttackInterval(f);
      hurt(w, t, blow(f, t, 1.8), f);
      w.hooks.onBurst?.(t.x, t.y - 45, "rgba(255,150,40,A)");
      return true;
    }
    const dx = t.x - f.x,
      dy = t.y - f.y,
      d = Math.max(0.001, Math.hypot(dx, dy)),
      speed = f.stats.moveSpeed * 5 * w.unit;
    f.vx = (dx / d) * speed;
    f.vy = (dy / d) * speed;
    if (Math.abs(dx) > 0.1) f.facing = dx >= 0 ? 1 : -1;
    w.hooks.onDust?.(f);
    return true;
  }

  // Holding: an enemy in body contact that is fighting this fighter slows it down by its grip (tomato holds hardest).
  function grip(w, f) {
    let g = 0;
    for (const q of alive(w, 1 - f.team))
      if ((q.target === f || q.intent?.target === f) && N().gapTo(w, q, f) < 0.35 * w.B) g = Math.max(g, TB.vegetables.VEGETABLES[q.character].traits.grip || 0);
    return g;
  }
  // One fighter's frame: the role engine says what to do, navigation says how, then attack.
  function act(w, f, dt) {
    const order = TB.roles.plan(f, w),
      t = N().pickTarget(w, f, order);
    let dir = null,
      retreat = false;
    if (order.engage) {
      const e = N().engage(w, f, order.engage, order.retreat || "away", dt, !!order.contact);
      dir = e.dir;
      retreat = e.retreat;
    } else if (
      t &&
      f.stats.preferredRange > 0 &&
      order.retreat &&
      order.retreat !== "none" &&
      (N().gapTo(w, f, t) < f.stats.minimumRange * w.unit || (f.engageTarget === t && f.engageState === "retreat"))
    ) {
      // A shooter caught too close backs off (toward its treasure for defenders) until it has room again.
      const e = N().engage(w, f, t, order.retreat, dt);
      dir = e.dir;
      retreat = e.retreat;
    } else if (order.goal) dir = N().steer(w, f, order.goal, order.pathing, dt, !!order.lead);
    // Shooters stand while they have a target in range; others (and a pushing attacker) only stop for the shot itself.
    if (order.stopToShoot && t && !retreat && ((f.stats.preferredRange > 0 && !order.keepWalking) || f.cool <= 0.25 || f.cast > 0)) dir = null;
    if (f.cast > 0) dir = null;
    const speed = f.stats.moveSpeed * w.unit * (1 - grip(w, f));
    if (dir) {
      f.vx = dir.x * speed;
      f.vy = dir.y * speed;
      f.retreating = retreat;
    }
    // Face the enemy being fought, also while backing off; otherwise face the way of travel.
    const look = t || (order.focus && N().gapTo(w, f, order.focus) < N().range(w, f) + 3 * w.B ? order.focus : null);
    if (look) turnToward(f, look.x - f.x, look.y - f.y, dt);
    else if (dir && !retreat) turnToward(f, dir.x, dir.y, dt);
    if (!t) {
      f.attackEngaged = false;
      return;
    }
    if (!f.attackEngaged || f.attackTarget !== t) f.cool = Math.max(f.cool, attackReactionDelay(f));
    f.attackEngaged = true;
    f.attackTarget = t;
    const dx = t.x - f.x,
      d = Math.max(0.001, dist(f, t)),
      away = Math.abs(dx) > 0.25 * d && Math.sign(dx) !== f.facing;
    // Never strike with the back to the target: turn first (respecting the turn pause), then attack.
    if (away && f.turnHold <= 0) {
      f.facing = Math.sign(dx);
      f.turnHold = TURN_HOLD;
    }
    if (f.cool <= 0 && f.cast <= 0 && !(Math.abs(dx) > 0.25 * d && Math.sign(dx) !== f.facing)) {
      fire(w, f, t);
      f.cool = nextAttackInterval(f);
    }
  }

  function separate(w, dt) {
    const unit = w.unit,
      living = w.fighters.filter((f) => f.hp > 0),
      heroes = living.map((f, i) => ({
        id: String(i),
        team: f.team ? "red" : "blue",
        hp: f.hp,
        mass: f.stats.mass,
        moveSpeed: f.stats.moveSpeed,
        radius: N().radius(w, f) / unit,
        position: { x: f.x / unit, y: f.y / unit },
      })),
      opts = { heroes, width: w.W / unit, height: w.H / unit, orientation: w.orient };
    FigurePhysics.resolveOverlaps(opts, dt * 1000);
    for (let pass = 0; pass < 5; pass++) {
      heroes.forEach((h, i) => {
        living[i].x = h.position.x * unit;
        living[i].y = h.position.y * unit;
        N().clamp(w, living[i]);
        h.position.x = living[i].x / unit;
        h.position.y = living[i].y / unit;
      });
      if (pass < 4) FigurePhysics.resolveOverlaps(opts, 0);
    }
  }

  function step(w, dt) {
    const m = w.match;
    if (!w.started || m.over) return;
    m.time += dt;
    for (const team of [0, 1]) {
      w.energy[team] = Math.min(10, w.energy[team] + dt * ENERGY_RATE);
      w.shields[team] = w.shieldOwners[team]?.hp > 0 ? Math.max(0, w.shields[team] - dt) : 0;
    }
    TB.team.update(w, dt);
    for (const team of [0, 1]) {
      w.skillThink[team] -= dt;
      if (w.skillThink[team] <= 0) {
        w.skillThink[team] = SKILL_THINK;
        teamSkills(w, team);
      }
    }
    for (const f of w.fighters) {
      f.stepStart = { x: f.x, y: f.y };
      f.vx = f.vy = 0;
      f.retreating = false;
      f.cool -= dt;
      f.hit = Math.max(0, f.hit - dt);
      f.cast = Math.max(0, f.cast - dt);
      f.intentHold = Math.max(0, (f.intentHold || 0) - dt);
    }
    // Plan from one snapshot, then move together.
    for (const f of w.fighters) {
      if (f.hp <= 0) continue;
      if (f.dash && planDash(w, f, dt)) continue;
      act(w, f, dt);
    }
    for (const f of w.fighters)
      if (f.hp > 0) {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        N().clamp(w, f);
      }
    separate(w, dt);
    for (const f of w.fighters) {
      if (f.hp <= 0) continue;
      advanceWalkCycle(w, f, f.x - f.stepStart.x, f.y - f.stepStart.y, dt);
      if (f.pendingFire) {
        f.pendingFire.t -= dt;
        if (f.pendingFire.t <= 0) {
          const shot = f.pendingFire;
          f.pendingFire = null;
          if (N().inRange(w, f, shot.to)) spawnShot(w, f, shot.to, false);
        }
      }
      if (f.melee) {
        f.melee.t -= dt;
        if (f.melee.t <= 0) {
          const hit = f.melee;
          f.melee = null;
          if (N().inRange(w, f, hit.target)) hurt(w, hit.target, hit.dmg, f);
        }
      }
    }
    for (const s of w.shots) {
      if (!s.to || s.to.hp <= 0) {
        s.dead = true;
        continue;
      }
      s.trail.push({ x: s.x, y: s.y, t: 0.22 });
      if (s.trail.length > 8) s.trail.shift();
      const dx = s.to.x - s.x,
        dy = s.to.y - w.scale * 500 - s.y,
        d = Math.hypot(dx, dy),
        stepLen = 340 * dt;
      if (d <= Math.max(N().radius(w, s.to), stepLen)) {
        s.dead = true;
        w.hooks.onImpact?.(s);
        if (s.big) {
          const r = 90 * w.unit;
          for (const q of alive(w, s.to.team)) if (q !== s.to && dist(q, s.to) <= r) hurt(w, q, Math.round(s.dmg / 2), s.from);
        }
        hurt(w, s.to, s.dmg, s.from);
        continue;
      }
      s.x += (dx / d) * stepLen;
      s.y += (dy / d) * stepLen;
      s.spin += dt * 13;
      for (const q of s.trail) q.t -= dt;
    }
    w.shots = w.shots.filter((s) => !s.dead);
    applyDamage(w);
    const result = TB.match.check(w, dt);
    if (result) finish(w, result);
  }
  // Result: no new attacks, projectiles and pending hits are cleared, survivors go idle.
  function finish(w, result) {
    const m = w.match;
    m.over = true;
    m.result = result;
    w.shots = [];
    w.damage = [];
    w.shields = [0, 0];
    for (const f of w.fighters) {
      f.pendingFire = null;
      f.melee = null;
      f.dash = null;
      f.cast = 0;
      f.hit = 0;
      f.moving = false;
      f.retreating = false;
      f.vx = f.vy = 0;
    }
    w.hooks.onFinish?.(result);
  }
  return { SHIELD_TIME, ENERGY_RATE, CAST, createWorld, layout, makeFighters, resetFighter, start, step, finish, turnToward, advanceWalkCycle, walkCycleDistance, skillWish, alive };
})();
