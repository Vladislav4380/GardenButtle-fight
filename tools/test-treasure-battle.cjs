// Checks for the treasure battle (scenes/treasure): placement, behaviour and match mechanics, run headless.
const fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = process.argv[2] || path.resolve(__dirname, "..");
const runtime = root + "/src/assets/shared/runtime/";
const MODULES = ["geometry", "vegetables", "match", "setup", "team", "roles", "navigation", "sim"];
const profiles = Object.fromEntries(["pepper", "carrot", "tomato"].map((id) => [id, JSON.parse(fs.readFileSync(root + "/src/assets/characters/" + id + "/manifest.json", "utf8"))]));

// Deterministic random numbers, so a failure can be reproduced.
let seed = 7;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function context() {
  const ctx = vm.createContext({ console, Math: Object.create(Math, { random: { value: rng } }) });
  vm.runInContext(fs.readFileSync(runtime + "figure-physics.js", "utf8") + "\nglobalThis.FigurePhysics = FigurePhysics;", ctx);
  for (const m of MODULES) vm.runInContext(fs.readFileSync(runtime + "treasure/treasure-" + m + ".js", "utf8"), ctx, { filename: m });
  return ctx.TB;
}
const TB = context();
// A world of the landscape scene size with the given lineups and roles, both treasures at their default spots.
function world(lineups, roles, size = [900, 420]) {
  const w = TB.sim.createWorld(profiles);
  TB.sim.layout(w, ...size);
  TB.sim.makeFighters(w, lineups);
  for (const team of [0, 1]) {
    const t = TB.setup.defaultTreasure(w, team);
    TB.setup.placeTreasure(w, team, t.x, t.y);
    TB.setup.placeByRoles(w, team, roles[team]);
  }
  return w;
}
const fighter = (w, team, slot) => w.fighters.find((f) => f.team === team && f.slot === slot);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function run(w, seconds, each) {
  for (let t = 0; t < seconds && !w.match.over; t += 1 / 60) {
    TB.sim.step(w, 1 / 60);
    each?.(w);
  }
  return w.match.result;
}
// Park a fighter far from the action: it stays alive but cannot reach anything.
function park(w, f) {
  f.x = TB.geometry.toWorld(w, f.team, 2 * w.B, 2 * w.B).x;
  f.y = TB.geometry.toWorld(w, f.team, 2 * w.B, 2 * w.B).y;
  f.stats.moveSpeed = 0;
  f.stats.attackRange = 0;
}

// ---- Placement ----
for (const size of [
  [900, 420],
  [388, 536],
]) {
  const w = world([["tomato", "pepper", "carrot"], ["tomato", "pepper", "carrot"]], [["attack", "support", "defense"], ["attack", "support", "defense"]], size);
  const R = TB.geometry.captureRadius(w),
    f = w.field;
  for (let i = 0; i < 400; i++) {
    const t = TB.setup.placeTreasure(w, 0, rng() * w.W * 1.2 - w.W * 0.1, rng() * w.H * 1.2 - w.H * 0.1),
      l = TB.geometry.toLocal(w, 0, t.x, t.y);
    assert(t.x - R >= f.left - 1e-6 && t.x + R <= f.right + 1e-6 && t.y - R >= f.top - 1e-6 && t.y + R <= f.bottom + 1e-6, "capture zone inside the field");
    assert(Math.min(t.x - R - f.left, f.right - t.x - R, t.y - R - f.top, f.bottom - t.y - R) >= w.B - 1e-6, "free ring round the capture zone");
    assert(l.u + R <= TB.geometry.frontLine(w) - w.B + 1e-6, "capture zone behind the deploy front line");
    assert(w.zones[0].defenseRadius >= R, "the capture zone lies inside the defence zone");
  }
  console.log("PASS: treasure and its whole capture zone stay inside the field", size.join("x"));
  const a = TB.setup.placeTreasure(w, 0, ...Object.values(TB.geometry.toWorld(w, 0, 4 * w.B, 4 * w.B))),
    za = w.zones[0],
    b = TB.setup.placeTreasure(w, 0, ...Object.values(TB.geometry.toWorld(w, 0, 8 * w.B, TB.geometry.breadth(w) - 4 * w.B))),
    zb = w.zones[0];
  assert.notEqual(za, zb);
  assert.equal(TB.geometry.roleAt(w, za, a.x, a.y), "defense");
  assert.equal(TB.geometry.roleAt(w, zb, b.x, b.y), "defense");
  assert.notEqual(TB.geometry.roleAt(w, zb, a.x, a.y), "defense", "moving the treasure moves the defence zone");
  console.log("PASS: moving the treasure updates the defence zone");
  for (const z of [za, zb]) {
    for (const [role, share] of Object.entries(TB.geometry.SHARES)) assert(Math.abs(z.share[role] - share) < 0.03, `${role} share ${z.share[role]}`);
    for (let i = 0; i < 2000; i++) {
      const p = TB.geometry.toWorld(w, 0, rng() * z.frontLine, rng() * z.breadth),
        role = TB.geometry.roleAt(w, z, p.x, p.y);
      assert(TB.geometry.ROLE_IDS.includes(role), "every start spot has exactly one role");
    }
  }
  console.log("PASS: deploy zones 30/40/30, every spot belongs to exactly one zone");
}
for (const id of TB.vegetables.IDS)
  for (const role of TB.geometry.ROLE_IDS) {
    const r = TB.vegetables.VEGETABLES[id].roles[role];
    assert(r.short && r.text && TB.vegetables.roleText(id, role).includes(TB.vegetables.ROLE_NAMES[role]), `${id} ${role} has a description`);
  }
console.log("PASS: every vegetable has a role name and behaviour text for each role");
{
  const w = world([["tomato", "pepper", "carrot"], ["tomato", "pepper", "carrot"]], [["attack", "support", "defense"], ["attack", "support", "defense"]]);
  const widest = Math.max(...w.fighters.map((f) => TB.nav.radius(w, f)));
  assert(4 * widest <= 2 * TB.geometry.captureRadius(w), "two of the widest fighters fit one behind another");
  const t = w.treasures[0],
    a = fighter(w, 1, 0),
    b = fighter(w, 1, 1);
  a.x = t.x - widest;
  b.x = t.x + widest;
  a.y = b.y = t.y;
  assert(TB.geometry.inCapture(w, t, a.x, a.y) && TB.geometry.inCapture(w, t, b.x, b.y));
  console.log("PASS: the capture zone holds two fighters one behind another");
}

// ---- Behaviour ----
{
  // Fast carrot left as a defender: it intercepts, stays a defender and goes back to its post.
  const w = world([["tomato", "pepper", "carrot"], ["tomato", "pepper", "carrot"]], [["support", "support", "defense"], ["attack", "defense", "defense"]]);
  const guard = fighter(w, 0, 2),
    intruder = fighter(w, 1, 0);
  TB.sim.start(w);
  park(w, fighter(w, 0, 0));
  park(w, fighter(w, 0, 1));
  let intercepted = false;
  // The calm breaker (nobody hit for a while) is kept off here: this checks the return to the post.
  const calm = () => (w.match.lastDamage = w.match.time);
  run(w, 30, () => {
    calm();
    if (guard.duty === intruder && ["intercept", "block", "cover"].includes(guard.intent?.mode)) intercepted = true;
    if (intercepted && intruder.hp > 0 && dist(intruder, w.treasures[0]) < 4 * w.B) intruder.hp = 0;
  });
  assert(intercepted, "defender went out to intercept");
  assert.equal(guard.role, "defense", "start role is kept");
  if (!w.match.over) run(w, 8, calm);
  assert(dist(guard, guard.post) < 1.5 * w.B, "defender returned to its post: " + dist(guard, guard.post).toFixed(1));
  console.log("PASS: fast defender intercepts, keeps its role and returns to its post");
}
{
  // Slow, strong tomato sent to attack advances toward the enemy treasure.
  const w = world([["tomato", "pepper", "carrot"], ["tomato", "pepper", "carrot"]], [["attack", "defense", "defense"], ["defense", "defense", "support"]]);
  const tank = fighter(w, 0, 0),
    start = dist(tank, w.treasures[1]);
  TB.sim.start(w);
  run(w, 6);
  assert.equal(tank.role, "attack");
  assert.equal(tank.intent.mode, "advance");
  assert(dist(tank, w.treasures[1]) < start - 4 * w.B, "tomato advances " + ((start - dist(tank, w.treasures[1])) / w.B).toFixed(1) + " B");
  console.log("PASS: slow strong attacker advances on the enemy treasure");
}
{
  // Attacking carrot goes round a defender standing on its line and reaches the zone without killing it.
  const w = world([["carrot", "pepper", "tomato"], ["pepper", "tomato", "carrot"]], [["attack", "defense", "defense"], ["defense", "defense", "defense"]]);
  const runner = fighter(w, 0, 0),
    goal = w.treasures[1];
  TB.sim.start(w);
  for (const f of w.fighters) if (f !== runner) park(w, f);
  const blocker = fighter(w, 1, 1);
  Object.assign(blocker, { x: (runner.x + goal.x) / 2, y: (runner.y + goal.y) / 2 + 0.2 * w.B });
  blocker.post = { x: blocker.x, y: blocker.y };
  blocker.stats.mass = 50;
  const r = run(w, 20);
  assert(r && r.reason === "capture" && r.winner === 0 && blocker.hp > 0, "carrot went round the blocker: " + JSON.stringify(r && r.reason));
  console.log("PASS: attacker uses a free passage round a blocker");
}
{
  // Support reacts to a real threat when no defender can, without flipping back and forth.
  const w = world([["tomato", "pepper", "carrot"], ["carrot", "pepper", "tomato"]], [["attack", "support", "attack"], ["attack", "defense", "defense"]]);
  const support = fighter(w, 0, 1);
  TB.sim.start(w);
  let covered = false,
    changes = 0,
    last = null;
  run(w, 25, () => {
    const mode = support.intent?.mode;
    if (mode === "cover") covered = true;
    if (mode !== last) changes++;
    last = mode;
  });
  assert(covered, "support covered the treasure");
  assert(changes <= 8, "support changed its task " + changes + " times");
  console.log("PASS: support reacts to a threat without constant switching (" + changes + " task changes)");
}
{
  // Two free defenders, one intruder that is not about to capture: only one of them goes out.
  const w = world([["carrot", "pepper", "tomato"], ["tomato", "pepper", "carrot"]], [["defense", "defense", "support"], ["attack", "defense", "defense"]]);
  TB.sim.start(w);
  park(w, fighter(w, 0, 2));
  let both = 0,
    any = 0;
  run(w, 15, () => {
    const duty = w.fighters.filter((f) => f.team === 0 && f.hp > 0 && f.duty);
    if (duty.length) any++;
    if (duty.length > 1 && duty[0].duty === duty[1].duty && TB.team.threatOf(w, 0, duty[0].duty)?.eta > TB.team.URGENT) both++;
  });
  assert(any > 0, "a defender answered the intruder");
  assert.equal(both, 0, "no doubled interception without urgency");
  console.log("PASS: allies do not double an interception without need");
}

// ---- Mechanics ----
{
  // Random setups: bodies never pass through each other, both teams use skills, every battle ends by capture or wipe.
  let overlaps = 0,
    skills = [0, 0],
    ended = 0;
  const N = 60;
  for (let n = 0; n < N; n++) {
    const ids = TB.vegetables.IDS,
      pick = () => [0, 1, 2].map(() => ids[Math.floor(rng() * 3)]);
    const w = world([pick(), pick()], [["defense", "support", "attack"], ["defense", "support", "attack"]]);
    TB.setup.randomEnemy(w, rng);
    TB.sim.start(w);
    w.hooks.onSkill = (f) => skills[f.team]++;
    run(w, 240, () => {
      const living = w.fighters.filter((f) => f.hp > 0);
      for (let i = 0; i < living.length; i++)
        for (let j = i + 1; j < living.length; j++)
          if (dist(living[i], living[j]) < TB.nav.radius(w, living[i]) + TB.nav.radius(w, living[j]) - 3) overlaps++;
    });
    if (w.match.over && ["capture", "wipe", "capture-both", "wipe-both"].includes(w.match.result.reason)) ended++;
  }
  assert.equal(overlaps, 0, "bodies overlapped");
  assert(skills[0] > 0 && skills[1] > 0, "skills fire by themselves for both teams " + skills);
  assert.equal(ended, N, "every battle ends by capture or wipe");
  console.log(`PASS: no passing through bodies, automatic skills on both sides (${skills}), ${N}/${N} battles ended without a timer`);
}
{
  const w = world([["tomato", "pepper", "carrot"], ["tomato", "pepper", "carrot"]], [["defense", "support", "attack"], ["defense", "support", "attack"]]);
  TB.sim.start(w);
  const t = w.treasures[1],
    R = TB.geometry.captureRadius(w),
    f = fighter(w, 0, 2);
  // A projectile inside the zone does not capture.
  w.shots.push({ x: t.x, y: t.y, to: null, trail: [], dmg: 0 });
  assert.equal(TB.match.check(w), null, "a projectile cannot capture");
  // The sprite reaching into the zone does not capture; the foot point does.
  f.x = t.x;
  f.y = t.y + R + 2;
  assert.equal(TB.match.check(w), null, "foot outside the zone: no capture even if the image overlaps");
  f.y = t.y + R - 2;
  // Defenders of team 1 are moved away so the zone is not contested.
  for (const q of w.fighters) if (q.team === 1) Object.assign(q, { x: t.x, y: t.y + R * 3 });
  assert.equal(TB.match.check(w, 2.9), null, "standing in the zone less than the hold time does not capture yet");
  const r = TB.match.check(w, 0.2);
  assert(r && r.winner === 0 && r.reason === "capture", "holding the zone for the hold time captures");
  console.log("PASS: only a living fighter's foot point captures, after holding the zone " + TB.match.CAPTURE_TIME + " s");
}
{
  const w = world([["tomato", "pepper", "carrot"], ["tomato", "pepper", "carrot"]], [["defense", "support", "attack"], ["defense", "support", "attack"]]);
  TB.sim.start(w);
  const t = w.treasures[1],
    R = TB.geometry.captureRadius(w),
    f = fighter(w, 0, 2),
    d = fighter(w, 1, 0);
  for (const q of w.fighters) if (q.team === 1) Object.assign(q, { x: t.x, y: t.y + R * 3 });
  Object.assign(f, { x: t.x, y: t.y + R * 0.5 });
  TB.match.check(w, 2);
  // Hit a moment ago: the bar fills at the slowed speed only.
  const S = TB.match.SLOWED;
  f.hitAt = w.match.time;
  assert.equal(TB.match.check(w, 0.5), null, "an intruder under attack does not capture yet");
  assert(Math.abs(w.match.progress[1] - (2 + 0.5 * S)) < 1e-6 && w.match.contested[1], "the bar is slowed while the intruder is hit");
  // Targeted by an enemy in reach: also under attack.
  f.hitAt = undefined;
  Object.assign(d, { x: f.x + TB.nav.radius(w, f) + TB.nav.radius(w, d) + 2, y: f.y, target: f });
  assert.equal(TB.match.check(w, 2), null, "an intruder attacked in melee reach does not capture quickly");
  assert(Math.abs(w.match.progress[1] - (2 + 2.5 * S)) < 1e-6, "the bar is slowed while the intruder is attacked");
  d.target = null;
  Object.assign(f, { x: t.x, y: t.y + R * 3 });
  TB.match.check(w, 1.5);
  assert(Math.abs(w.match.progress[1] - (0.5 + 2.5 * S)) < 1e-6, "the bar drains when the zone is empty");
  console.log("PASS: an intruder under attack slows the capture bar to " + S + "; an empty zone drains it");
}
{
  const w = world([["tomato", "pepper", "carrot"], ["tomato", "pepper", "carrot"]], [["defense", "support", "attack"], ["defense", "support", "attack"]]);
  TB.sim.start(w);
  const t = w.treasures[1],
    f = fighter(w, 0, 2);
  Object.assign(f, { x: t.x, y: t.y });
  TB.team.think(w, 1);
  const team = w.fighters.filter((q) => q.team === 1 && q.hp > 0),
    on = team.filter((q) => q.intent && q.intent.mode === "rescue" && q.intent.target === f),
    soonest = team.reduce((b, q) => {
      const r = (x) => Math.max(0, TB.nav.gapTo(w, x, f) - TB.nav.range(w, x)) / (x.stats.moveSpeed * w.unit);
      return r(q) < r(b) ? q : b;
    });
  assert(on.length === 1 && on[0] === soonest, "only the fighter that can hit the intruder soonest goes for it");
  console.log("PASS: an enemy in the capture zone is attacked by the one fighter that can reach it soonest (" + on[0].character + ", " + on[0].role + ")");
}
{
  const w = world([["tomato", "pepper", "carrot"], ["tomato", "pepper", "carrot"]], [["defense", "support", "attack"], ["defense", "support", "attack"]]);
  TB.sim.start(w);
  const a = fighter(w, 0, 2),
    b = fighter(w, 1, 2);
  // Both sides hold the other zone with no defenders in it: progress is set to just below the hold time.
  for (const q of w.fighters) if (q !== a && q !== b) q.hp = 0;
  Object.assign(a, { x: w.treasures[1].x, y: w.treasures[1].y });
  Object.assign(b, { x: w.treasures[0].x, y: w.treasures[0].y });
  w.match.progress = [TB.match.CAPTURE_TIME - 0.01, TB.match.CAPTURE_TIME - 0.01];
  TB.sim.step(w, 1 / 60);
  assert(w.match.over && w.match.result.winner === null && w.match.result.reason === "capture-both", "simultaneous capture is a draw");
  assert.equal(w.shots.length, 0, "projectiles are cleared at the end");
  assert(w.fighters.every((f) => !f.pendingFire && !f.melee && !f.dash && !f.moving), "survivors stop and pending hits are cleared");
  console.log("PASS: simultaneous capture is a draw; the end clears projectiles and pending hits");
  // Restart clears the previous battle.
  TB.sim.start(w);
  assert(!w.match.over && w.match.result === null && w.match.time === 0 && w.shots.length === 0);
  assert(w.fighters.every((f) => f.hp === f.max && !f.intent && !f.target && !f.duty && f.dealt === 0));
  assert.deepEqual([...w.energy], [2, 2]);
  console.log("PASS: a new start clears the previous battle");
}
{
  const w = world([["tomato", "pepper", "carrot"], ["tomato", "pepper", "carrot"]], [["defense", "support", "attack"], ["defense", "support", "attack"]]);
  TB.sim.start(w);
  for (const f of w.fighters) if (f.team === 1) f.hp = 0;
  TB.sim.step(w, 1 / 60);
  assert(w.match.over && w.match.result.winner === 0 && w.match.result.reason === "wipe", "wiping out a squad ends the match");
  console.log("PASS: wiping out a squad ends the match and hands over its treasure");
}
{
  // Only defenders left on both sides: nobody comes, then after the quiet time they go on the attack.
  const w = world([["tomato", "pepper", "carrot"], ["tomato", "pepper", "carrot"]], [["defense", "defense", "support"], ["defense", "defense", "support"]]);
  TB.sim.start(w);
  fighter(w, 0, 2).hp = 0;
  fighter(w, 1, 2).hp = 0;
  fighter(w, 0, 2).deathPlayed = fighter(w, 1, 2).deathPlayed = true;
  assert(TB.setup.tooManyDefenders(w, 0) === false);
  const r = run(w, 240);
  assert(TB.team.state(w, 0).breakout || TB.team.state(w, 1).breakout, "defenders went on the attack");
  assert(r && ["capture", "wipe", "capture-both", "wipe-both"].includes(r.reason), "no endless defensive stalemate");
  console.log("PASS: two lone defences do not stand forever (" + r.reason + " after " + Math.round(w.match.time) + " s)");
}
{
  const w = world([["tomato", "pepper", "carrot"], ["tomato", "pepper", "carrot"]], [["defense", "defense", "support"], ["defense", "support", "attack"]]);
  const third = fighter(w, 0, 2),
    spot = w.treasures[0];
  assert.equal(TB.setup.allowed(w, third, spot.x + 0.5 * w.B, spot.y), false, "a third defender is refused");
  console.log("PASS: at most two heroes may start in the defence zone");
}
