// Treasure battle: target choice and navigation. Bodies never pass through each other (the physics solver keeps
// them apart); steering goes round bodies when there is room and gives up on a spot that stays blocked.
var TB = globalThis.TB || (globalThis.TB = {});
TB.nav = (() => {
  // Collision follows the drawn body, without transparent margins.
  const BODY_WIDTH = { pepper: 0.27, tomato: 0.3, carrot: 0.28 };
  function radius(w, f) {
    const p = w.profiles[f.character];
    return w.scale * 1100 * (p?.scale || 1) * (BODY_WIDTH[f.character] || 0.27);
  }
  const alive = (w, team) => w.fighters.filter((q) => q.team === team && q.hp > 0);
  const gapTo = (w, f, t) => Math.hypot(t.x - f.x, t.y - f.y) - radius(w, f) - radius(w, t);
  const range = (w, f) => f.stats.attackRange * w.unit;
  const inRange = (w, f, t) => !!t && t.hp > 0 && gapTo(w, f, t) <= range(w, f) + 0.1;

  // Playable box for the foot point of one fighter.
  function bounds(w, f) {
    const r = radius(w, f),
      m = 22 * w.unit;
    return { left: r + m, right: w.W - r - m, top: Math.max(r, w.headroom) + m * 0.5, bottom: w.H - Math.max(12, r) - m };
  }
  function clamp(w, f) {
    const b = bounds(w, f);
    f.x = Math.max(b.left, Math.min(b.right, f.x));
    f.y = Math.max(b.top, Math.min(b.bottom, f.y));
  }
  // Steering away from the frame: zero in the open field, growing to 1 at the boundary.
  function wallPush(w, f) {
    const b = bounds(w, f),
      zone = 60 * w.unit,
      k = (gap) => Math.max(0, 1 - gap / zone);
    return { x: k(f.x - b.left) - k(b.right - f.x), y: k(f.y - b.top) - k(b.bottom - f.y) };
  }
  const norm = (x, y) => {
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  };

  // Walk toward a goal, going round bodies in the way. pathing: "push" goes round allies only (enemies are pushed),
  // "weave" gives enemies a wide berth and looks further ahead, "steer" goes round everything.
  // loose: the goal follows a moving ally, so arrival is judged more loosely to avoid stop-and-go.
  function steer(w, f, goal, pathing, dt, loose = false) {
    const dx = goal.x - f.x,
      dy = goal.y - f.y,
      d = Math.hypot(dx, dy),
      B = w.B;
    // Arrive with hysteresis; a spot that stays blocked counts as reached once close enough.
    const settled = f.arrivedAt && Math.hypot(f.arrivedAt.x - goal.x, f.arrivedAt.y - goal.y) < (loose ? 1.5 : 0.5) * B,
      arrive = settled ? (loose ? 2.2 : 1.1) * B : (f.stuckFor || 0) >= 1.8 && d < 2.5 * B ? 2.5 * B : (loose ? 0.8 : 0.35) * B;
    trackProgress(w, f, d, dt);
    if (d <= arrive) {
      if (!settled) f.arrivedAt = { x: goal.x, y: goal.y };
      f.stuckFor = 0;
      return null;
    }
    f.arrivedAt = null;
    let dir = { x: dx / d, y: dy / d };
    const look = (pathing === "weave" ? 5 : 3.5) * B,
      rf = radius(w, f);
    let blocker = null,
      bs = Infinity,
      bl = 0;
    for (const q of w.fighters) {
      if (q === f || q.hp <= 0) continue;
      const enemy = q.team !== f.team;
      if (pathing === "push" && enemy) continue;
      const rx = q.x - f.x,
        ry = q.y - f.y,
        s = rx * dir.x + ry * dir.y,
        l = dir.x * ry - dir.y * rx,
        clear = rf + radius(w, q) + (enemy && pathing === "weave" ? 1.2 : 0.3) * B;
      if (s <= 0 || s > Math.min(look, d + radius(w, q)) || Math.abs(l) >= clear) continue;
      if (s < bs) {
        bs = s;
        bl = l;
        blocker = q;
      }
    }
    f.detourHold = Math.max(0, (f.detourHold || 0) - dt);
    if (blocker) {
      // The side is chosen once per blocker and kept for a moment, so the fighter does not wobble left-right.
      if (f.detourFrom !== blocker || f.detourHold <= 0) {
        if (f.detourFrom !== blocker) {
          f.detourSide = Math.abs(bl) > 0.2 * B ? (bl > 0 ? -1 : 1) : roomySide(w, f, dir);
          f.detourHold = 0.8;
        }
        f.detourFrom = blocker;
      }
      const strength = 1 - bs / look,
        a = Math.min(1.3, 0.35 + 0.95 * strength),
        px = -dir.y * f.detourSide,
        py = dir.x * f.detourSide;
      dir = norm(dir.x * Math.cos(a) + px * Math.sin(a), dir.y * Math.cos(a) + py * Math.sin(a));
    } else if (f.detourHold <= 0) f.detourFrom = null;
    if (pathing === "weave") {
      // Keep away from enemy bodies to slip through gaps instead of bumping into them.
      let ax = 0,
        ay = 0;
      for (const q of alive(w, 1 - f.team)) {
        const ex = f.x - q.x,
          ey = f.y - q.y,
          e = Math.hypot(ex, ey),
          reach = rf + radius(w, q) + 1.6 * B;
        if (e < reach && e > 0.001) {
          ax += (ex / e) * (1 - e / reach);
          ay += (ey / e) * (1 - e / reach);
        }
      }
      // Only the sideways part: slipping past, never backing off.
      const gx = dx / d,
        gy = dy / d,
        side = ax * -gy + ay * gx;
      dir = norm(dir.x - gy * side * 0.8, dir.y + gx * side * 0.8);
    }
    const wall = wallPush(w, f);
    if (wall.x || wall.y) dir = norm(dir.x + wall.x * 1.6, dir.y + wall.y * 1.6);
    return dir;
  }
  function roomySide(w, f, dir) {
    // Prefer the side with more free space to the frame; ties go toward the middle of the field.
    const b = bounds(w, f),
      room = (s) => {
        const px = -dir.y * s,
          py = dir.x * s;
        const tx = px > 0 ? (b.right - f.x) / px : px < 0 ? (b.left - f.x) / px : Infinity,
          ty = py > 0 ? (b.bottom - f.y) / py : py < 0 ? (b.top - f.y) / py : Infinity;
        return Math.min(tx, ty);
      };
    return room(1) >= room(-1) ? 1 : -1;
  }
  // A fighter that keeps trying but does not get closer is stuck: it switches detour side and its role may react.
  function trackProgress(w, f, d, dt) {
    f.progressT = (f.progressT || 0) + dt;
    if (f.progressD === undefined) f.progressD = d;
    if (f.progressT < 0.6) return;
    const gained = f.progressD - d;
    f.stuckFor = gained < 0.25 * w.B && f.cast <= 0 ? (f.stuckFor || 0) + f.progressT : 0;
    if (f.stuckFor >= 1.2 && f.detourFrom) {
      f.detourSide = -(f.detourSide || 1);
      f.detourHold = 1.2;
    }
    f.progressT = 0;
    f.progressD = d;
  }

  // Close in on a target and hold a fighting distance, with separate thresholds to start and stop moving.
  // retreat: "away" backs straight off, "home" backs toward the own treasure, "none" stands its ground.
  // contact: close in to body contact whatever the weapon (used to hold an intruder).
  function engage(w, f, t, retreat, dt, contact = false) {
    const gap = gapTo(w, f, t),
      r = contact ? 0.35 * w.B : range(w, f),
      ranged = !contact && f.stats.preferredRange > 0,
      preferred = ranged ? Math.min(f.stats.preferredRange * w.unit, r) : r * 0.4,
      minimum = ranged ? f.stats.minimumRange * w.unit : -Infinity,
      tol = (ranged ? 8 : 3) * w.unit;
    if (f.engageTarget !== t) {
      f.engageTarget = t;
      f.engageState = "approach";
    }
    if (f.engageState === "approach" && gap <= preferred + tol) f.engageState = "hold";
    else if (f.engageState === "hold" && gap > (ranged ? r - tol * 0.5 : r * 0.9)) f.engageState = "approach";
    else if (f.engageState === "hold" && gap < minimum && retreat !== "none") f.engageState = "retreat";
    else if (f.engageState === "retreat" && gap >= preferred - tol) f.engageState = "hold";
    if (f.engageState === "approach") return { dir: steer(w, f, t, "push", dt) || null, retreat: false };
    if (f.engageState === "retreat") {
      let dx = f.x - t.x,
        dy = f.y - t.y;
      if (retreat === "home") {
        const home = w.treasures[f.team];
        dx = home.x - f.x + dx * 0.5;
        dy = home.y - f.y + dy * 0.5;
      }
      let dir = norm(dx, dy);
      const wall = wallPush(w, f);
      if (wall.x || wall.y) dir = norm(dir.x + wall.x * 1.6, dir.y + wall.y * 1.6);
      return { dir, retreat: true };
    }
    return { dir: null, retreat: false };
  }

  // Which enemy in range to hit. The target stays fixed until the current swing is over.
  // policy: "focus" — the task's target first; "home" — the one closest to the own treasure;
  // "blockers" — the ones in the way to the goal; "contact" — only if stuck or held in contact;
  // "ahead" — the ones between the fighter and its goal, else anyone shooting at it; "lead" — near the ally it follows.
  function pickTarget(w, f, order) {
    if ((f.cast > 0 || f.pendingFire || f.melee) && f.target && f.target.hp > 0) return f.target;
    if (order.focus && inRange(w, f, order.focus)) return order.focus;
    const cands = alive(w, 1 - f.team).filter((q) => inRange(w, f, q));
    if (!cands.length) return null;
    const home = w.treasures[f.team],
      goal = w.treasures[1 - f.team],
      d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    let pool = cands,
      score;
    switch (order.attack) {
      case "contact":
        pool = cands.filter((q) => (f.stuckFor || 0) >= 1.2 || gapTo(w, f, q) < 0.4 * w.B);
        score = (q) => gapTo(w, f, q);
        break;
      case "blockers":
      case "ahead": {
        const ahead = cands.filter((q) => d(q, goal) < d(f, goal) + w.B);
        pool = ahead.length || order.attack === "ahead" ? ahead : [];
        if (!pool.length) pool = cands.filter((q) => q.target === f);
        score = (q) => gapTo(w, f, q);
        break;
      }
      case "lead":
        score = (q) => (order.lead ? d(q, order.lead) : gapTo(w, f, q));
        break;
      default:
        score = (q) => d(q, home);
    }
    if (!pool.length) return null;
    const best = pool.reduce((b, q) => (score(q) < score(b) ? q : b));
    // Keep the previous target unless the new one is clearly better.
    if (f.target && f.target !== best && pool.includes(f.target) && score(f.target) - score(best) < 1.5 * w.B) return f.target;
    return best;
  }
  return { BODY_WIDTH, radius, gapTo, range, inRange, bounds, clamp, wallPush, steer, engage, pickTarget };
})();
