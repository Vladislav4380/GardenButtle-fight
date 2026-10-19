// Treasure battle: field geometry, capture zones and deploy zones.
// All sizes are given in B, the body radius of the widest fighter, so proportions stay the same on every screen.
var TB = globalThis.TB || (globalThis.TB = {});
TB.geometry = (() => {
  const CAPTURE = 2.1, // capture radius around a treasure
    CLEARANCE = 1, // free ring between the capture zone, the field edge and the deploy front line
    FRONT = 1, // gap between the deploy front line and the middle of the field
    SHARES = { defense: 0.3, attack: 0.3, support: 0.4 },
    ROLE_IDS = ["defense", "support", "attack"];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  // w: { orient: "landscape" | "portrait", field: { left, right, top, bottom }, B }.
  // Team frame: u is depth from the team's own back edge toward the enemy, v runs across the field.
  // Landscape: the player is on the left. Portrait: the player is at the bottom.
  function toLocal(w, team, x, y) {
    const f = w.field;
    if (w.orient === "landscape") return { u: team === 0 ? x - f.left : f.right - x, v: y - f.top };
    return { u: team === 0 ? f.bottom - y : y - f.top, v: x - f.left };
  }
  function toWorld(w, team, u, v) {
    const f = w.field;
    if (w.orient === "landscape") return { x: team === 0 ? f.left + u : f.right - u, y: f.top + v };
    return { x: f.left + v, y: team === 0 ? f.bottom - u : f.top + u };
  }
  // Unit vector pointing from the team's own side toward the enemy.
  function forward(w, team) {
    if (w.orient === "landscape") return { x: team === 0 ? 1 : -1, y: 0 };
    return { x: 0, y: team === 0 ? -1 : 1 };
  }
  const length = (w) => (w.orient === "landscape" ? w.field.right - w.field.left : w.field.bottom - w.field.top);
  const breadth = (w) => (w.orient === "landscape" ? w.field.bottom - w.field.top : w.field.right - w.field.left);
  const frontLine = (w) => length(w) / 2 - FRONT * w.B;
  const captureRadius = (w) => CAPTURE * w.B;
  // Where the treasure centre may stand, in the team frame: the whole capture zone plus a free ring stays inside
  // the deploy area, so the field edge never cuts it, there is always a way round it, and no enemy can start inside it.
  function treasureBounds(w) {
    const m = (CAPTURE + CLEARANCE) * w.B;
    return { u0: m, u1: Math.max(m, frontLine(w) - m), v0: m, v1: Math.max(m, breadth(w) - m) };
  }
  function clampTreasure(w, team, x, y) {
    const p = toLocal(w, team, x, y),
      b = treasureBounds(w);
    return toWorld(w, team, clamp(p.u, b.u0, b.u1), clamp(p.v, b.v0, b.v1));
  }
  function treasureValid(w, team, t) {
    const p = toLocal(w, team, t.x, t.y),
      b = treasureBounds(w),
      e = 0.01;
    return p.u >= b.u0 - e && p.u <= b.u1 + e && p.v >= b.v0 - e && p.v <= b.v1 + e;
  }
  // Only the foot point counts: weapons, projectiles and sprite edges never capture.
  function inCapture(w, treasure, x, y) {
    return Math.hypot(x - treasure.x, y - treasure.y) <= captureRadius(w);
  }
  // Deploy zones of one team, checked in this order: defence disc around the treasure (30% of the deploy area,
  // the part cut off by the field edge does not count), then the front band (30%), then support (the remaining 40%).
  // Every point belongs to exactly one zone; zones are recomputed whenever the treasure moves.
  function computeZones(w, team, treasure) {
    const L = frontLine(w),
      Bd = breadth(w),
      step = Math.max(2, w.B / 6),
      t = toLocal(w, team, treasure.x, treasure.y),
      dist = [],
      us = [];
    for (let u = step / 2; u < L; u += step)
      for (let v = step / 2; v < Bd; v += step) {
        dist.push(Math.hypot(u - t.u, v - t.v));
        us.push(u);
      }
    const n = dist.length,
      sorted = Float64Array.from(dist).sort(),
      defenseRadius = sorted[Math.min(n - 1, Math.floor(SHARES.defense * n))],
      rest = us.filter((u, i) => dist[i] > defenseRadius).sort((a, b) => b - a),
      attackFrom = rest[Math.min(rest.length - 1, Math.floor(SHARES.attack * n))] ?? L;
    const z = { team, treasure: { x: treasure.x, y: treasure.y }, center: t, defenseRadius, attackFrom, frontLine: L, breadth: Bd, step };
    // Shares, and for labels and default spots the point of each zone farthest from its borders
    // (the support zone wraps round the defence disc, so its plain centroid can fall outside it).
    const count = { defense: 0, support: 0, attack: 0 },
      best = { defense: [-1, t.u, t.v], support: [-1, t.u, t.v], attack: [-1, t.u, t.v] };
    for (let u = step / 2; u < L; u += step)
      for (let v = step / 2; v < Bd; v += step) {
        const role = roleAtLocal(z, u, v),
          d = Math.hypot(u - t.u, v - t.v),
          edge = Math.min(u, L - u, v, Bd - v),
          room = Math.min(edge, Math.abs(d - defenseRadius), role === "defense" ? Infinity : Math.abs(u - attackFrom));
        count[role]++;
        if (room > best[role][0]) best[role] = [room, u, v];
      }
    z.share = {};
    z.inner = {};
    for (const id of ROLE_IDS) {
      z.share[id] = count[id] / n;
      z.inner[id] = toWorld(w, team, best[id][1], best[id][2]);
    }
    return z;
  }
  function roleAtLocal(z, u, v) {
    if (Math.hypot(u - z.center.u, v - z.center.v) <= z.defenseRadius) return "defense";
    return u > z.attackFrom ? "attack" : "support";
  }
  function roleAt(w, z, x, y) {
    const p = toLocal(w, z.team, x, y);
    return roleAtLocal(z, p.u, p.v);
  }
  // Deploy area: own half up to the front line.
  function clampDeploy(w, team, x, y) {
    const p = toLocal(w, team, x, y);
    return toWorld(w, team, clamp(p.u, 0, frontLine(w)), clamp(p.v, 0, breadth(w)));
  }
  function inDeploy(w, team, x, y) {
    const p = toLocal(w, team, x, y),
      e = 0.01;
    return p.u >= -e && p.u <= frontLine(w) + e && p.v >= -e && p.v <= breadth(w) + e;
  }
  // Sample points of one role zone (used by the opponent's setup and by checks).
  function zonePoints(w, z, role, step = w.B / 2) {
    const out = [];
    for (let u = step / 2; u < z.frontLine; u += step)
      for (let v = step / 2; v < z.breadth; v += step) if (roleAtLocal(z, u, v) === role) out.push(toWorld(w, z.team, u, v));
    return out;
  }
  return {
    CAPTURE,
    CLEARANCE,
    FRONT,
    SHARES,
    ROLE_IDS,
    toLocal,
    toWorld,
    forward,
    length,
    breadth,
    frontLine,
    captureRadius,
    treasureBounds,
    clampTreasure,
    treasureValid,
    inCapture,
    computeZones,
    roleAt,
    roleAtLocal,
    clampDeploy,
    inDeploy,
    zonePoints,
  };
})();
