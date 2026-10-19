// Treasure battle: placing the treasure and the heroes before the battle. The start spot sets the hero's role.
var TB = globalThis.TB || (globalThis.TB = {});
TB.setup = (() => {
  const Geo = () => TB.geometry;

  function defaultTreasure(w, team) {
    const b = Geo().treasureBounds(w);
    return Geo().toWorld(w, team, b.u0 + (b.u1 - b.u0) * 0.2, (b.v0 + b.v1) / 2);
  }
  function placeTreasure(w, team, x, y) {
    const p = Geo().clampTreasure(w, team, x, y);
    w.treasures[team] = p;
    w.zones[team] = Geo().computeZones(w, team, p);
    return p;
  }
  const startRole = (w, f) => Geo().roleAt(w, w.zones[f.team], f.x, f.y);
  const maxDefenders = () => TB.match.MAX_DEFENDERS;
  function defenders(w, team, except) {
    return w.fighters.filter((q) => q.team === team && q !== except && startRole(w, q) === "defense").length;
  }
  // A spot is allowed inside the own deploy area; a third hero may not start in the defence zone.
  function allowed(w, f, x, y) {
    if (!Geo().inDeploy(w, f.team, x, y)) return false;
    return Geo().roleAt(w, w.zones[f.team], x, y) !== "defense" || defenders(w, f.team, f) < maxDefenders(w);
  }
  function tooManyDefenders(w, team) {
    return defenders(w, team) > maxDefenders(w);
  }
  // Default spot for a role: defenders stand just in front of the treasure, the others at their zone's centre.
  function roleSpot(w, team, role, index = 0, count = 1) {
    const z = w.zones[team],
      across = (index - (count - 1) / 2) * 2.6 * w.B;
    let u, v;
    if (role === "defense") {
      u = z.center.u + z.defenseRadius * 0.55;
      v = z.center.v + across;
    } else {
      const c = Geo().toLocal(w, team, z.inner[role].x, z.inner[role].y);
      u = c.u;
      v = c.v + across;
    }
    v = Math.max(w.B, Math.min(z.breadth - w.B, v));
    let p = Geo().toWorld(w, team, u, v);
    // The default must fall inside its own zone; walk toward the zone's inner point until it does.
    for (let k = 0; k < 10 && Geo().roleAt(w, z, p.x, p.y) !== role; k++) {
      const c = z.inner[role];
      p = { x: p.x + (c.x - p.x) * 0.3, y: p.y + (c.y - p.y) * 0.3 };
    }
    return p;
  }
  function placeByRoles(w, team, roles) {
    const mine = w.fighters.filter((f) => f.team === team).sort((a, b) => a.slot - b.slot);
    mine.forEach((f, i) => {
      const same = roles.filter((r) => r === roles[i]),
        index = roles.slice(0, i).filter((r) => r === roles[i]).length,
        p = roleSpot(w, team, roles[i], index, same.length);
      f.x = p.x;
      f.y = p.y;
    });
  }
  // Opponent: random treasure spot, random lineup and a random allowed role pattern, placed at random spots of each zone.
  const PATTERNS = [
    ["defense", "support", "attack"],
    ["defense", "attack", "attack"],
    ["support", "attack", "attack"],
    ["defense", "support", "support"],
    ["defense", "defense", "attack"],
    ["support", "support", "attack"],
  ];
  // depth: how far forward the treasure may go, as a share of the allowed range (the opponent keeps it back).
  function randomEnemy(w, rng = Math.random, depth = 0.6) {
    const team = 1,
      b = Geo().treasureBounds(w);
    placeTreasure(w, team, ...Object.values(Geo().toWorld(w, team, b.u0 + rng() * depth * (b.u1 - b.u0), b.v0 + rng() * (b.v1 - b.v0))));
    const mine = w.fighters.filter((f) => f.team === team),
      ids = TB.vegetables.IDS,
      pattern = PATTERNS[Math.floor(rng() * PATTERNS.length)].slice().sort(() => rng() - 0.5);
    for (const f of mine) f.character = ids[Math.floor(rng() * ids.length)];
    const placed = [];
    mine.forEach((f, i) => {
      const role = pattern[i],
        points = Geo().zonePoints(w, w.zones[team], role).filter((p) => placed.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > 2.6 * w.B));
      const p = points.length ? points[Math.floor(rng() * points.length)] : roleSpot(w, team, role);
      f.x = p.x;
      f.y = p.y;
      placed.push(p);
    });
    return pattern;
  }
  return { defaultTreasure, placeTreasure, startRole, allowed, tooManyDefenders, maxDefenders, roleSpot, placeByRoles, randomEnemy, PATTERNS };
})();
