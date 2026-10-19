// Desynchronise attacks without changing their nominal average interval.
function attackReactionDelay(f) {
  return 0.08 + Math.random() * Math.min(0.28, f.stats.attackInterval * 0.3);
}
function nextAttackInterval(f) {
  return Math.max(0.44, f.stats.attackInterval * (0.88 + Math.random() * 0.24));
}

// Front-only sprites need a readable horizontal angle before engaging.
// The side a fighter takes next to its target is chosen once per target, so pairs never swap places mid-duel.
function slotSide(f, t, unit) {
  if (f.slotTarget !== t) {
    f.slotTarget = t;
    f.slotSide = Math.abs(f.x - t.x) > 0.5 * unit ? Math.sign(f.x - t.x) : f.team ? 1 : -1;
  }
  return f.slotSide;
}
// A shooter caught too close backs off until it is almost at its preferred distance again; separate
// thresholds to start and stop, so it does not flip between backing off and stepping in every frame.
function shooterBacking(f, t, range) {
  const unit = combatUnit(),
    preferred = Math.min(f.stats.preferredRange * rangeMultiplier() * unit, range),
    gap = attackDistance(f, t);
  if (f.backingFrom !== t) {
    f.backingFrom = t;
    f.backing = false;
  }
  if (!f.backing && gap < Math.max(f.stats.minimumRange * unit, preferred - 8 * unit)) f.backing = true;
  else if (f.backing && gap >= preferred - 1 * unit) f.backing = false;
  return f.backing;
}
// Every fighter near its target takes a slot level with it on its own side, at its preferred distance,
// so duels read as face to face instead of diagonal piles.
function engageSlotDirection(f, t, d, range) {
  const unit = combatUnit();
  if (d >= range + combatRadius(f) + combatRadius(t) + 60 * unit) return null;
  // A shooter caught too close backs straight off first; the slot only fine-tunes position afterwards.
  if (f.stats.preferredRange > 0 && shooterBacking(f, t, range)) return null;
  const gap = f.stats.preferredRange > 0 ? Math.min(f.stats.preferredRange * rangeMultiplier() * unit, range) : 2 * unit,
    side = slotSide(f, t, unit),
    // Allies on the same side of the same target spread into rows above and below it.
    mates = F.filter((q) => q.hp > 0 && q.team === f.team && q.target === t && q.slotTarget === t && q.slotSide === side),
    row = [0, 1, -1, 2][Math.max(0, mates.indexOf(f))] || 0,
    reach = combatRadius(f) + combatRadius(t) + gap,
    // Shooters line up in rows; melee mates take places on an arc around the target so each can still reach it.
    angle = f.stats.preferredRange > 0 ? 0 : row * 0.95,
    sx = t.x + side * reach * Math.cos(angle) - f.x,
    sy = t.y + (f.stats.preferredRange > 0 ? row * 2.2 * combatRadius(f) : reach * Math.sin(angle)) - f.y,
    sd = Math.hypot(sx, sy),
    tolerance = (f.stats.preferredRange > 0 ? 8 : 3) * unit;
  // Settle once close and only set off again when the slot drifts clearly away, so pushes from neighbours do not cause twitching.
  if (f.settledTarget !== t) f.slotSettled = false;
  f.settledTarget = t;
  if (sd <= tolerance) f.slotSettled = true;
  else if (sd > tolerance * 4) f.slotSettled = false;
  // A settled fighter that can no longer reach its target walks again at once.
  if (f.slotSettled && !inAttackRange(f, t)) f.slotSettled = false;
  if (f.slotSettled) return { move: false };
  // Moving away from the target counts as a retreat, so the fighter keeps facing it.
  return { move: true, x: sx / sd, y: sy / sd, retreat: sx * (t.x - f.x) + sy * (t.y - f.y) < 0 };
}
function lateralAlignment(f, t, dx, dy, d) {
  const unit = combatUnit();
  if (f.alignmentTarget !== t) {
    f.alignmentTarget = t;
    f.aligning = false;
    f.alignSide = 0;
  }
  const near = d <= f.stats.attackRange * rangeMultiplier() * unit + combatRadius(f) + combatRadius(t) + 40 * unit;
  const goal = Math.max((combatRadius(f) + combatRadius(t)) * 0.9, Math.abs(dy) * 0.8);
  if (!near || Math.abs(dy) < 8 * unit || Math.abs(dx) >= goal) {
    f.aligning = false;
    return 0;
  }
  if (!f.aligning && Math.abs(dx) < goal * 0.55) {
    f.aligning = true;
    // Preserve each pair's left/right order; exact ties use a stable fighter ID.
    f.alignSide = Math.abs(dx) > 0.5 * unit ? (dx > 0 ? -1 : 1) : F.indexOf(f) < F.indexOf(t) ? -1 : 1;
  }
  return f.aligning ? f.alignSide : 0;
}

// Full gait-cycle distance in screen pixels; independent of sprite frame count.
const WALK_HOLD = 0.2;
// Collision pushes are shown smoothed: the drawn figure follows its own steps at once, while the
// back-and-forth of bodies pressing into each other is averaged out over PUSH_SMOOTH seconds.
const PUSH_SMOOTH = 0.12;
function smoothPushes(dt) {
  const k = Math.exp(-dt / PUSH_SMOOTH);
  for (const f of F) {
    if (f.hp <= 0 || f.dash || !f.stepStart) {
      f.offX = (f.offX || 0) * k;
      f.offY = (f.offY || 0) * k;
      continue;
    }
    const px = f.x - f.stepStart.x - f.vx * dt,
      py = f.y - f.stepStart.y - f.vy * dt,
      cap = combatRadius(f) * 0.5;
    f.offX = Math.max(-cap, Math.min(cap, ((f.offX || 0) + px) * k));
    f.offY = Math.max(-cap, Math.min(cap, ((f.offY || 0) + py) * k));
  }
}
function walkCycleDistance(f) {
  const p = characterProfiles[f.character];
  return Math.max(0.001, (baseScale() * 1100 * (p.scale || 1) * p.strideLength) / p.visualHeight);
}
function advanceWalkCycle(f, dx, dy, dt) {
  const ownSpeed = Math.hypot(f.vx, f.vy);
  // Reject sideways/backward pushes and cap forward travel at self-propelled travel.
  const projected = ownSpeed > 0.001 ? (dx * f.vx + dy * f.vy) / ownSpeed : 0;
  const ownTravel = Math.min(Math.max(0, projected), ownSpeed * Math.max(0, dt));
  // The walk pose is kept for a moment after a step, so a fighter pressed back by a neighbour
  // does not flicker between walk and idle frames.
  f.walkHold = ownTravel > 0.001 ? WALK_HOLD : Math.max(0, (f.walkHold || 0) - dt);
  f.moving = f.hp > 0 && f.cast <= 0 && (ownTravel > 0.001 || f.walkHold > 0);
  if (ownTravel > 0.001) f.walk = ((f.walk || 0) + ownTravel / walkCycleDistance(f)) % 1;
  return ownTravel;
}
// Death uses particles only: no sprite pieces or juice.
function beginDeathEffect(f, kind = ["smoke", "sparks"][Math.floor(Math.random() * 2)]) {
  if (f.deathPlayed) return;
  if (kind !== "smoke" && kind !== "sparks") kind = "sparks";
  f.deathPlayed = true;
  f.pendingFire = null;
  f.melee = null;
  f.moving = false;
  const profile = characterProfiles[f.character],
    z = (baseScale() * 1100 * (profile.scale || 1)) / profile.visualHeight;
  const image = typeof mixedPose === "function" ? mixedPose(f) : null,
    flip = typeof mixedFlip === "function" ? mixedFlip(f) : f.facing || 1;
  const h = profile.visualHeight * z,
    e = { kind, x: f.x, y: f.y, z, h, image, flip, profile, age: 0, duration: 1.3, parts: [] };
  for (let i = 0; i < 55; i++) {
    const a = Math.random() * Math.PI * 2,
      v = h * (0.4 + Math.random() * 1.6);
    e.parts.push({
      x: f.x + (Math.random() - 0.5) * h * 0.55,
      y: f.y - h * (0.08 + Math.random() * 0.85),
      vx: kind === "smoke" ? (Math.random() - 0.5) * h * 0.4 : Math.cos(a) * v,
      vy: kind === "smoke" ? -h * (0.3 + Math.random() * 0.7) : Math.sin(a) * v - h * 0.4,
      size: h * (kind === "smoke" ? 0.025 + Math.random() * 0.055 : 0.012 + Math.random() * 0.02),
      tint: i % 3,
    });
  }
  deathEffects.push(e);
}
function advanceDeathEffects(dt) {
  for (const e of deathEffects) {
    e.age += dt;
    for (const p of e.parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-1.6 * dt);
      p.vy += (e.kind === "smoke" ? -e.h * 0.3 : e.h * 1.7) * dt;
    }
  }
  deathEffects = deathEffects.filter((e) => e.age < e.duration);
}
function drawDeathEffects() {
  for (const e of deathEffects) {
    g.save();
    const fade = Math.max(0, 1 - e.age / e.duration);
    // Fade the intact character briefly; never cut it into rectangular images.
    if (e.image && e.age < 0.25) {
      g.save();
      g.globalAlpha = Math.max(0, 1 - e.age / 0.25);
      g.translate(e.x, e.y);
      g.scale(e.flip, 1);
      g.drawImage(
        e.image,
        -e.profile.anchor.x * e.z,
        -e.profile.anchor.y * e.z,
        Math.max(e.profile.canvas.width, e.image.naturalWidth) * e.z,
        e.profile.canvas.height * e.z,
      );
      g.restore();
    }
    for (const p of e.parts) {
      g.save();
      g.translate(p.x, p.y);
      if (e.kind === "smoke") {
        g.globalAlpha = fade * 0.38;
        g.fillStyle = ["#77736d", "#8c8984", "#555451"][p.tint];
        g.beginPath();
        g.arc(0, 0, Math.max(0.5, p.size * (1 + e.age * 1.2)), 0, Math.PI * 2);
        g.fill();
      } else {
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = fade;
        g.rotate(Math.atan2(p.vy, p.vx));
        g.fillStyle = ["#fff4bd", "#ffc247", "#ff7329"][p.tint];
        g.fillRect(-p.size * 2, -p.size * 0.35, Math.max(1, p.size * 4), Math.max(0.7, p.size * 0.7));
      }
      g.restore();
    }
    g.restore();
  }
}

// Base profiles from the schematic battle; tomato range and carrot targeting are customized.
const COMBAT_SPECS = {
  tomato: {
    role: "Страж",
    max: 900,
    power: 28,
    defense: 10,
    attackInterval: 1.15,
    moveSpeed: 38,
    mass: 3,
    attackRange: 100,
    preferredRange: 80,
    minimumRange: 30,
    radius: 23,
  },
  pepper: {
    role: "Стрелок",
    max: 570,
    power: 37,
    defense: 6,
    attackInterval: 0.95,
    moveSpeed: 55,
    mass: 1.7,
    attackRange: 125,
    preferredRange: 100,
    minimumRange: 35,
    radius: 20,
  },
  carrot: {
    role: "Быстрый боец",
    max: 580,
    power: 37,
    defense: 6,
    attackInterval: 0.8,
    moveSpeed: 78,
    mass: 1.2,
    attackRange: 27,
    preferredRange: 0,
    minimumRange: 0,
    radius: 19,
  },
};
// One active skill per fighter: the button belongs to that fighter and goes dark when it dies.
const FIGHTER_SKILLS = {
  pepper: { name: "Огненный шар", cost: 4 },
  carrot: { name: "Рывок к стрелку", cost: 3 },
  tomato: { name: "Щит отряда", cost: 4 },
};
const FIGHTER_NAMES = { pepper: "Перец", tomato: "Помидор", carrot: "Морковь" };
// Team strategy, chosen before the battle. The battle itself is automatic: the strategy decides targets,
// whether the team waits or advances, and when each skill fires.
const STRATEGIES = {
  defense: { name: "Защита", text: "ждём врага на месте; кто стоит, получает на 45% меньше урона. Все бьют ближнего к помидору, морковь охраняет стрелков." },
  attack: { name: "Атака", text: "все бьют самого слабого врага по очереди и сразу тратят умения, но в атаке получают на 15% больше урона." },
  hunt: { name: "Охота", text: "морковь на 30% быстрее и сразу рвётся к стрелкам, перцы бьют её цель, помидор прикрывает рывок щитом." },
};
const STRATEGY_IDS = Object.keys(STRATEGIES);
// Tuning of the strategy bonuses (checked by simulation).
const STRATEGY_TUNE = { digIn: 0.55, huntSpeed: 1.3, huntDashCost: 3, reckless: 1.15 };
function skillCost(f) {
  return f.character === "carrot" && strategy[f.team] === "hunt" ? STRATEGY_TUNE.huntDashCost : FIGHTER_SKILLS[f.character].cost;
}
function moveBonus(f) {
  return f.character === "carrot" && strategy[f.team] === "hunt" ? STRATEGY_TUNE.huntSpeed : 1;
}
const BATTLE_TIME = 60,
  SHIELD_TIME = 5,
  FINAL_TIME = 15,
  ENERGY_RATE = 0.5;
function combatUnit() {
  return layout === "mobile-horizontal" ? Math.min(W / 700, H / 390) : Math.min(W / 390, H / 700);
}
// Collision follows the drawn body, so neighbours stand side by side instead of overlapping sprites.
const BODY_WIDTH = { pepper: 0.27, tomato: 0.3, carrot: 0.28 };
function combatRadius(f) {
  const body = baseScale() * 1100 * (characterProfiles[f.character]?.scale || 1) * (BODY_WIDTH[f.character] || 0.27);
  return Math.max((f.stats?.radius || 20) * combatUnit(), body);
}
function rangeMultiplier() {
  return +document.querySelector("#attackRange").value / 100;
}
function speedMultiplier() {
  return +document.querySelector("#moveSpeed").value / 100;
}
function attackDistance(f, t) {
  return Math.hypot(t.x - f.x, t.y - f.y) - combatRadius(f) - combatRadius(t);
}
function chooseCombatTarget(f) {
  return alive(1 - f.team).reduce((best, q) => {
    if (!best) return q;
    if (f.character === "pepper" && q.hp !== best.hp) return q.hp > best.hp ? q : best;
    return Math.hypot(q.x - f.x, q.y - f.y) < Math.hypot(best.x - f.x, best.y - f.y) ? q : best;
  }, null);
}
function nearestTo(from, foes) {
  return foes.reduce((b, q) => (!b || Math.hypot(q.x - from.x, q.y - from.y) < Math.hypot(b.x - from.x, b.y - from.y) ? q : b), null);
}
function longestRange(f, foes) {
  return foes.reduce(
    (b, q) => (!b || q.stats.attackRange > b.stats.attackRange || (q.stats.attackRange === b.stats.attackRange && attackDistance(f, q) < attackDistance(f, b)) ? q : b),
    null,
  );
}
// An enemy that has reached one of our shooters (used by the defence).
function threatToShooters(team) {
  const shooters = alive(team).filter((q) => q.character === "pepper"),
    unit = combatUnit();
  let best = null,
    bestGap = 60 * unit;
  for (const q of alive(1 - team))
    for (const s of shooters) {
      const gap = attackDistance(q, s);
      if (gap < bestGap) {
        best = q;
        bestGap = gap;
      }
    }
  return best;
}
// First target under the team strategy; afterwards the fighter keeps it until it falls.
function strategyTarget(f) {
  const foes = alive(1 - f.team),
    mates = alive(f.team),
    plan = strategy[f.team];
  if (!foes.length) return null;
  if (plan === "attack") return foes.reduce((b, q) => (!b || q.hp < b.hp || (q.hp === b.hp && attackDistance(f, q) < attackDistance(f, b)) ? q : b), null);
  if (plan === "hunt") {
    if (f.character === "carrot") return longestRange(f, foes);
    if (f.character === "pepper") {
      const lead = mates.find((q) => q.character === "carrot" && q.target && q.target.hp > 0);
      return lead ? lead.target : longestRange(f, foes);
    }
  }
  if (plan === "defense") {
    const tank = mates.find((q) => q.character === "tomato"),
      shooter = mates.find((q) => q.character === "pepper");
    // Everyone but the guarding carrot hits whoever comes closest to the front.
    const front = tank || mates.reduce((b, q) => (!b || Math.abs(q.x - W / 2) < Math.abs(b.x - W / 2) ? q : b), null);
    if (f.character === "carrot" && shooter) return nearestTo(shooter, foes);
    return nearestTo(front, foes);
  }
  return chooseCombatTarget(f);
}
function inAttackRange(f, t) {
  return t && t.hp > 0 && attackDistance(f, t) <= f.stats.attackRange * rangeMultiplier() * combatUnit() + 0.1;
}
// Playable box: fighters keep a margin from the screen frame so nobody is squeezed against it.
function fieldBounds(f) {
  const r = combatRadius(f),
    m = 22 * combatUnit();
  return {
    left: r + m,
    right: W - r - m,
    top: Math.max(r, baseScale() * 1150 + 10) + m * 0.5,
    bottom: H - Math.max(12, r) - m,
  };
}
function clampFighter(f) {
  const b = fieldBounds(f);
  f.x = Math.max(b.left, Math.min(b.right, f.x));
  f.y = Math.max(b.top, Math.min(b.bottom, f.y));
}
// Steering away from the frame: zero in the open field, growing to 1 at the boundary.
function wallPush(f) {
  const b = fieldBounds(f),
    zone = 60 * combatUnit(),
    k = (gap) => Math.max(0, 1 - gap / zone);
  return { x: k(f.x - b.left) - k(b.right - f.x), y: k(f.y - b.top) - k(b.bottom - f.y) };
}
// A fighter near the frame with an enemy in contact sidesteps along the wall toward open ground.
function escapeDirection(f) {
  const wall = wallPush(f);
  if (Math.hypot(wall.x, wall.y) < 0.35) return null;
  const close = alive(1 - f.team).filter((q) => Math.hypot(q.x - f.x, q.y - f.y) < combatRadius(f) + combatRadius(q) + 14 * combatUnit());
  if (!close.length) return null;
  let ax = 0,
    ay = 0;
  for (const q of close) {
    const d = Math.max(0.001, Math.hypot(f.x - q.x, f.y - q.y));
    ax += (f.x - q.x) / d;
    ay += (f.y - q.y) / d;
  }
  // Two perpendiculars to the press; take the one that leads more toward the field centre.
  const cx = W / 2 - f.x,
    cy = (fieldBounds(f).top + fieldBounds(f).bottom) / 2 - f.y,
    side = -ay * cx + ax * cy >= 0 ? 1 : -1,
    ex = -ay * side + wall.x,
    ey = ax * side + wall.y,
    len = Math.hypot(ex, ey) || 1;
  return { x: ex / len, y: ey / len };
}
function resetCombatStats() {
  for (const f of F) {
    f.stats = { ...COMBAT_SPECS[f.character] };
    f.max = f.stats.max;
    f.hp = f.max;
    f.vx = 0;
    f.vy = 0;
  }
  renderCombatSettings();
}
function renderCombatSettings() {
  const host = document.querySelector("#fighterStats");
  if (!host) return;
  host.innerHTML = F.map(
    (f, i) =>
      `<fieldset><legend>${f.team ? "Красные" : "Синие"} · ${{ pepper: "Перец", tomato: "Помидор", carrot: "Морковь" }[f.character]} · ${f.stats.role}</legend>${[
        ["attackRange", "Дальность", 0, 350, 1],
        ["attackInterval", "Интервал, с", 0.45, 5, 0.05],
        ["moveSpeed", "Скорость", 1, 150, 1],
        ["mass", "Масса", 0.1, 10, 0.1],
      ]
        .map(
          ([key, label, min, max, step]) =>
            `<label>${label}<input type="number" data-fighter="${i}" data-stat="${key}" aria-label="${f.team ? "Красные" : "Синие"} ${f.character} ${label}" min="${min}" max="${max}" step="${step}" value="${f.stats[key]}"></label>`,
        )
        .join(
          "",
        )}<small>Давление: <output data-momentum="${i}">${(f.stats.mass * f.stats.moveSpeed).toFixed(1)}</output> · масса × скорость</small></fieldset>`,
  ).join("");
  host.onchange = (e) => {
    const i = Number(e.target.dataset.fighter),
      key = e.target.dataset.stat;
    if (!key || !F[i]) return;
    const n = Number(e.target.value),
      min = Number(e.target.min),
      max = Number(e.target.max);
    if (!Number.isFinite(n)) return;
    F[i].stats[key] = Math.max(min, Math.min(max, n));
    e.target.value = F[i].stats[key];
    host.querySelector(`[data-momentum="${i}"]`).textContent = (F[i].stats.mass * F[i].stats.moveSpeed * speedMultiplier()).toFixed(1);
  };
}
function separateFighters(dt = 0) {
  const unit = combatUnit();
  if (!unit) return;
  const living = F.filter((f) => f.hp > 0),
    heroes = living.map((f) => ({
      id: String(F.indexOf(f)),
      team: f.team === 0 ? "blue" : "red",
      hp: f.hp,
      mass: f.stats.mass,
      moveSpeed: f.stats.moveSpeed * speedMultiplier(),
      radius: combatRadius(f) / unit,
      position: { x: f.x / unit, y: f.y / unit },
    }));
  FigurePhysics.resolveOverlaps(
    { heroes, width: W / unit, height: H / unit, orientation: layout === "mobile-horizontal" ? "landscape" : "portrait" },
    dt * 1000,
  );
  heroes.forEach((h, i) => {
    living[i].x = h.position.x * unit;
    living[i].y = h.position.y * unit;
    clampFighter(living[i]);
  });
  // The sprite's head imposes a higher top boundary than the abstract circles.
  // Re-solve at that boundary without another pressure step.
  for (let pass = 0; pass < 4; pass++) {
    heroes.forEach((h, i) => {
      h.position.x = living[i].x / unit;
      h.position.y = living[i].y / unit;
    });
    FigurePhysics.resolveOverlaps({ heroes, width: W / unit, height: H / unit, orientation: layout === "mobile-horizontal" ? "landscape" : "portrait" }, 0);
    heroes.forEach((h, i) => {
      living[i].x = h.position.x * unit;
      living[i].y = h.position.y * unit;
      clampFighter(living[i]);
    });
  }
}

const layout = document.documentElement.dataset.layout || "mobile-arena";

const c = document.querySelector("#cv"),
  g = c.getContext("2d"),
  arena = document.querySelector("#arena");
let W = 0,
  H = 0,
  last = performance.now(),
  energy = 2,
  enemyEnergy = 2,
  skillThink = [0.5, 0.5],
  engaged = [false, false],
  time = BATTLE_TIME,
  auto = false,
  rate = 1,
  shots = [],
  sparks = [],
  floaters = [],
  blasts = [],
  shields = [0, 0],
  shieldOwners = [null, null],
  deathEffects = [],
  battleEnding = false;
// Team size: 3 by default, ?team=5 in the address tries 5 on 5.
const TEAM_SIZE = Math.min(5, Math.max(1, +((globalThis.location?.search || "").match(/[?&]team=(\d)/) || [])[1] || 3));
const LANES = Array.from({ length: TEAM_SIZE }, (_, i) => i);
const F = [];
for (let i = 0; i < TEAM_SIZE; i++) {
  F.push({ team: 0, lane: i, hp: 100, max: 100, cool: 0, state: "idle", hit: 0, cast: 0 });
  F.push({ team: 1, lane: i, hp: 100, max: 100, cool: 0, state: "idle", hit: 0, cast: 0 });
}
// Round, rating and the player's lineup survive page reloads; storage may be unavailable.
const PROGRESS_KEY = "gardenbattle.progress";
function loadProgress() {
  const base = { round: 1, rating: 1000, lineup: LANES.map((i) => ["pepper", "tomato", "carrot"][i % 3]) };
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
    const lineup = Array.isArray(saved.lineup) && saved.lineup.length === TEAM_SIZE && saved.lineup.every((id) => COMBAT_SPECS[id]) ? saved.lineup : base.lineup;
    return { ...base, ...saved, lineup };
  } catch {
    return base;
  }
}
function saveProgress() {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {}
}
const progress = loadProgress();
let enemyRating = progress.rating;
const strategy = [STRATEGIES[progress.strategy] ? progress.strategy : "defense", "attack"];
function randomStrategy() {
  return STRATEGY_IDS[Math.floor(Math.random() * STRATEGY_IDS.length)];
}
function randomLineup() {
  return Array.from({ length: TEAM_SIZE }, () => ["pepper", "tomato", "carrot"][Math.floor(Math.random() * 3)]);
}
// The tuning panel is for development: shown only with ?debug in the address.
const setupHint = document.querySelector("#positionHint");
const motionSettings = document.querySelector(".motion-settings");
if (motionSettings && !/debug/.test(globalThis.location?.search || "")) motionSettings.hidden = true;
// The player picks their own lineup before the battle; the opponent's is random and visible during setup.
function assignTeamCharacters() {
  const enemy = randomLineup();
  strategy[1] = randomStrategy();
  for (const f of F) f.character = f.team ? enemy[f.lane] : progress.lineup[f.lane];
  enemyRating = Math.max(100, progress.rating + Math.round((Math.random() - 0.5) * 80));
  resetCombatStats();
}
assignTeamCharacters();
function resize() {
  let r = arena.getBoundingClientRect(),
    d = Math.min(2, devicePixelRatio || 1);
  W = r.width;
  H = r.height;
  c.width = W * d;
  c.height = H * d;
  g.setTransform(d, 0, 0, d, 0, 0);
  place();
}
// The opponent forms up by role: tank in front, shooter behind, fast fighter between.
const ENEMY_DEPTH = { tomato: 0.12, carrot: 0.4, pepper: 0.85 };
function place() {
  // Lanes share the same span whatever the team size.
  const step = (k) => (TEAM_SIZE > 1 ? (k * 2) / (TEAM_SIZE - 1) : 1);
  for (const f of F) {
    f.offX = f.offY = 0;
    const depth = f.team ? ENEMY_DEPTH[f.character] + (Math.random() - 0.5) * 0.12 : 0;
    if (layout === "mobile-vertical") {
      f.x = W * (0.2 + step(0.3) * f.lane);
      f.y = f.team === 0 ? H * 0.4 : H * (0.68 + depth * 0.24);
    } else if (layout === "mobile-horizontal") {
      f.x = f.team === 0 ? W * 0.22 : W * (0.58 + depth * 0.32);
      f.y = H * (0.36 + step(0.29) * f.lane);
    } else {
      f.x = f.team ? W * (0.58 + depth * 0.32) : W * 0.24;
      f.y = H * (0.34 + step(0.27) * f.lane) + (f.team ? 8 : -8);
    }
  }
}
// Before the battle each team may only stand on its own half of the field.
function halfLine() {
  return layout === "mobile-vertical" ? H * 0.62 : W * 0.5;
}
function keepOnOwnHalf(f) {
  const mid = halfLine(),
    pad = combatRadius(f);
  if (layout === "mobile-vertical") f.y = f.team === 0 ? Math.min(f.y, mid - pad) : Math.max(f.y, mid + pad);
  else f.x = f.team === 0 ? Math.min(f.x, mid - pad) : Math.max(f.x, mid + pad);
}
addEventListener("resize", resize);
resize();
function alive(team) {
  return F.filter((f) => f.team === team && f.hp > 0);
}
function glow(x, y, r, col, a) {
  let q = g.createRadialGradient(x, y, 0, x, y, r);
  q.addColorStop(0, col.replace("A", a));
  q.addColorStop(1, col.replace("A", "0"));
  g.fillStyle = q;
  g.beginPath();
  g.arc(x, y, r, 0, 7);
  g.fill();
}
function burst(x, y, col = "rgba(255,122,26,A)") {
  for (let i = 0; i < 22; i++) {
    let a = Math.random() * 7,
      v = 35 + Math.random() * 150;
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.25 + Math.random() * 0.35, max: 0.6, col });
  }
}
function baseScale() {
  // Five fighters per side need smaller figures to fit the same field.
  return (TEAM_SIZE > 3 ? 0.8 : 1) * baseScaleFull();
}
function baseScaleFull() {
  return layout === "mobile-horizontal"
    ? 0.85 * Math.min((W * 0.18) / 1100, (H * 0.25) / 1100)
    : layout === "mobile-vertical"
      ? 0.85 * Math.min(W / 4600, (H * 0.23) / 1100)
      : 0.85 * Math.min(W / 3900, (H * 0.24) / 1100);
}
function worldUnit() {
  return layout === "mobile-arena" ? W / 941 : Math.min(W / 941, H / 950);
}
function socket(f) {
  return mixedSocket(f);
}
function spawnProjectile(from, to, mult) {
  if (from.hp <= 0 || to.hp <= 0) return;
  const p = socket(from);
  shots.push({
    x: p.x,
    y: p.y,
    to,
    from,
    kind: from.character,
    dmg: Math.max(1, Math.round(from.stats.power * mult - to.stats.defense)),
    trail: [],
    spin: Math.random() * 7,
  });
}
function fire(from, to, mult = 1) {
  if (from.hp <= 0 || !inAttackRange(from, to) || from.cast > 0) return;
  from.cast = 0.42;
  if (from.character === "carrot") {
    from.melee = { target: to, t: 0.2, dmg: Math.max(1, Math.round(from.stats.power * mult - to.stats.defense)) };
    return;
  }
  from.pendingFire = { to, mult, t: 0.16 };
}
function applyDamage(f, d, src) {
  if (f.hp <= 0 || d <= 0) return;
  const dealt = Math.min(f.hp, d);
  f.hp = Math.max(0, f.hp - d);
  // Per-fighter battle summary for the result screen.
  f.taken = (f.taken || 0) + dealt;
  if (src) src.dealt = (src.dealt || 0) + dealt;
  if (f.hp === 0) {
    f.livedFor = BATTLE_TIME - time;
    beginDeathEffect(f);
  }
  f.hit = 0.14;
  burst(f.x, f.y - 45);
  // Jitter keeps simultaneous numbers apart; yellow = damage dealt by the player, red = damage taken.
  floaters.push({ x: f.x + (Math.random() - 0.5) * 28, y: f.y - 85 - Math.random() * 14, text: "-" + d, t: 0.8, color: f.team ? "#ffe36b" : "#ff472c" });
}
function hurt(f, d, src) {
  if (f.hp <= 0) return;
  // Final seconds: triple damage so stalled fights (tomato mirrors) still end.
  if (time < FINAL_TIME) d *= 3;
  // An active tomato shield halves every hit aimed at its allies; the tomato itself takes a quarter.
  const owner = shieldOwners[f.team];
  if (shields[f.team] > 0 && owner && owner.hp > 0 && owner !== f) {
    applyDamage(owner, Math.floor(d / 4), src);
    d -= Math.floor(d / 2);
  }
  // Defence digs in: a fighter that has stood still for half a second takes less damage.
  if (strategy[f.team] === "defense" && (f.stillFor || 0) >= 0.5) d = Math.max(1, Math.round(d * STRATEGY_TUNE.digIn));
  // Attack goes in without cover: its fighters take more damage.
  if (strategy[f.team] === "attack") d = Math.round(d * STRATEGY_TUNE.reckless);
  applyDamage(f, d, src);
  sync();
}
function teamHealth(team) {
  return F.filter((f) => f.team === team).reduce((s, f) => s + Math.max(0, f.hp) / f.max, 0) / TEAM_SIZE;
}
function laneFighter(lane) {
  return F.find((f) => f.team === 0 && f.lane === lane);
}
function sync() {
  redHp.style.width = 100 * teamHealth(0) + "%";
  blueHp.style.width = 100 * teamHealth(1) + "%";
  energyText.textContent = Math.floor(energy) + "/10";
  cells.innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="cell ${i < Math.floor(energy) ? "on" : ""}"></i>`).join("");
  document.querySelectorAll(".skill").forEach((x) => {
    const f = laneFighter(+x.dataset.lane);
    if (!f) return;
    x.classList.toggle("dead", battleStarted && f.hp <= 0);
    x.disabled = battleStarted && f.hp <= 0;
    x.classList.toggle("ready", battleStarted && energy >= skillCost(f));
  });
}
// Skills spend energy only when they can act.
function skillTarget(f) {
  const foes = alive(1 - f.team),
    plan = strategy[f.team];
  if (f.hp <= 0 || !foes.length) return null;
  if (f.character === "carrot") {
    if (plan === "attack") return strategyTarget(f);
    if (plan === "defense") return threatToShooters(f.team) || ((f.team ? enemyEnergy : energy) >= 8 ? longestRange(f, foes) : null);
    return longestRange(f, foes);
  }
  if (f.character === "tomato") return shields[f.team] > 0 ? null : f;
  return f.target && f.target.hp > 0 ? f.target : strategyTarget(f);
}
// When a skill is worth its energy under the team strategy.
function wantsSkill(f) {
  const plan = strategy[f.team],
    foes = alive(1 - f.team),
    mates = alive(f.team),
    final = time < FINAL_TIME,
    unit = combatUnit();
  if (f.character === "tomato") {
    if (shields[f.team] > 0) return false;
    const hurt = (k) => mates.filter((q) => q !== f && q.hp < q.max * k).length;
    if (plan === "attack") return final || hurt(0.6) >= 2;
    if (plan === "hunt") return mates.some((q) => q.character === "carrot" && q.dash) || hurt(0.5) >= 1;
    return hurt(0.8) >= 1 || foes.some((q) => mates.some((m) => attackDistance(q, m) < 20 * unit));
  }
  const t = skillTarget(f);
  if (!t) return false;
  if (f.character === "carrot") return plan !== "hunt" || t.stats.preferredRange > 0 || foes.length === 1;
  const crowd = foes.filter((q) => q !== t && Math.hypot(q.x - t.x, q.y - t.y) <= 90 * unit).length;
  return plan !== "defense" || crowd >= 1 || final || (f.team ? enemyEnergy : energy) >= 8;
}
// Each team spends its energy by itself, in the strategy's priority order; the player does not press anything.
const SKILL_ORDER = { defense: ["tomato", "pepper", "carrot"], attack: ["pepper", "carrot", "tomato"], hunt: ["carrot", "pepper", "tomato"] };
function teamSkills(team) {
  const order = SKILL_ORDER[strategy[team]],
    own = alive(team).sort((a, b) => order.indexOf(a.character) - order.indexOf(b.character));
  for (const f of own) {
    const cost = skillCost(f);
    if ((team ? enemyEnergy : energy) < cost || f.dash || !wantsSkill(f)) continue;
    if (useFighterSkill(f)) {
      if (team) enemyEnergy -= cost;
      else {
        energy -= cost;
        playerSkills++;
      }
    }
    return;
  }
}
function useFighterSkill(f) {
  const t = skillTarget(f);
  if (!t) return false;
  const unit = combatUnit();
  floaters.push({ x: f.x, y: f.y - baseScale() * 1150 - 22, text: FIGHTER_SKILLS[f.character].name, t: 1.2, color: f.team ? "#ffb4a3" : "#bfe6ff", size: 15 });
  if (f.character === "pepper") {
    // A large fireball with any range: double damage to the target, half of that to enemies around it.
    const p = socket(f);
    f.cast = 0.42;
    shots.push({ x: p.x, y: p.y, to: t, from: f, kind: "pepper", big: true, dmg: Math.max(1, Math.round(f.stats.power * 2.4 - t.stats.defense)), trail: [], spin: 0 });
  } else if (f.character === "carrot") {
    // Dash through the line to the enemy with the longest range and strike twice as hard.
    f.dash = { target: t, t: 1.2 };
    f.pendingFire = null;
    f.melee = null;
  } else {
    shields[f.team] = SHIELD_TIME;
    shieldOwners[f.team] = f;
    for (const q of alive(f.team)) burst(q.x, q.y - 45, "rgba(255,214,90,A)");
  }
  blasts.push({ x: f.x, y: f.y - baseScale() * 500, r: 0, max: 26 * unit, t: 0.3, life: 0.3, col: f.team ? "rgba(255,90,60,A)" : "rgba(90,180,255,A)" });
  return true;
}
function act(lane) {
  const f = laneFighter(lane);
  if (!battleStarted) {
    // Before the battle a tap swaps this slot's vegetable.
    if (!f) return;
    const order = ["pepper", "tomato", "carrot"];
    progress.lineup[lane] = order[(order.indexOf(progress.lineup[lane]) + 1) % 3];
    saveProgress();
    f.character = progress.lineup[lane];
    f.stats = { ...COMBAT_SPECS[f.character] };
    f.max = f.hp = f.stats.max;
    renderCombatSettings();
    renderSkillBar();
    updateHeader();
    return;
  }
  // In battle the skills fire by themselves under the chosen strategy.
}
function renderSkillBar() {
  const bar = document.querySelector(".skills");
  if (!bar) return;
  bar.classList.toggle("n5", TEAM_SIZE > 3);
  bar.style.gridTemplateColumns = "repeat(" + TEAM_SIZE + ",1fr)";
  bar.innerHTML = LANES
    .map((lane) => {
      const f = laneFighter(lane),
        skill = FIGHTER_SKILLS[f.character];
      return `<button class="skill skill-${f.character}" data-lane="${lane}"><span class="cost">${skillCost(f)}</span><img src="/assets/characters/${f.character}/sprites/front/idle.png" alt=""><strong>${FIGHTER_NAMES[f.character]}<em>${battleStarted ? skill.name : COMBAT_SPECS[f.character].role + " · сменить ↻"}</em></strong></button>`;
    })
    .join("");
  document.querySelectorAll(".skill").forEach((x) => (x.onclick = () => act(+x.dataset.lane)));
  sync();
}
// Strategy picker: before the battle it takes the energy panel's place; its description and the
// opponent's strategy go into the setup hint at the bottom of the field.
const strategyCss =
  "#strategyBar{display:flex;gap:4px;height:42px;align-items:stretch}" +
  "#strategyBar button{flex:1;min-width:0;padding:0 4px;border-radius:10px;border:1px solid #936c15;background:#1a140a;color:#ffe9b0;font:800 11px system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
  "#strategyBar button.on{background:linear-gradient(#ffc83b,#c87b06);color:#241300}" +
  ".position-hint b{color:#d9b8ff}" +
  ".skill.ready{box-shadow:inset 0 0 0 2px #4fe1ff,0 0 10px #26cfff88}";
if (typeof document.createElement === "function" && document.head) {
  const strategyStyle = document.createElement("style");
  strategyStyle.textContent = strategyCss;
  document.head.appendChild(strategyStyle);
}
function renderStrategyBar() {
  const actions = document.querySelector(".actions"),
    energyBox = document.querySelector(".energy");
  if (!actions || !energyBox || typeof document.createElement !== "function") return;
  let bar = document.querySelector("#strategyBar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "strategyBar";
    actions.insertBefore(bar, energyBox);
  }
  bar.hidden = battleStarted;
  bar.style.display = battleStarted ? "none" : "";
  energyBox.style.display = battleStarted ? "" : "none";
  if (battleStarted) return;
  bar.innerHTML = STRATEGY_IDS.map((id) => `<button data-id="${id}" class="${id === strategy[0] ? "on" : ""}">${STRATEGIES[id].name}</button>`).join("");
  bar.querySelectorAll("button").forEach(
    (b) =>
      (b.onclick = () => {
        strategy[0] = b.dataset.id;
        progress.strategy = strategy[0];
        saveProgress();
        renderStrategyBar();
      }),
  );
  if (setupHint) setupHint.innerHTML = `<b>Соперник: ${STRATEGIES[strategy[1]].name}.</b> ${STRATEGIES[strategy[0]].name}: ${STRATEGIES[strategy[0]].text} Значок у ног врага — кого боец атакует первым.`;
}
function updateHeader() {
  const small = document.querySelector(".round small");
  const finished = document.querySelector("#battleResult")?.hidden === false;
  if (small) small.textContent = "БОЙ " + (finished ? progress.round - 1 : progress.round);
  const names = document.querySelectorAll(".hero .name"),
    ratings = document.querySelectorAll(".hero .rating"),
    portraits = document.querySelectorAll(".hero .portrait img");
  if (names[0]) names[0].textContent = "Ваш отряд";
  if (names[1]) names[1].textContent = "Соперник";
  if (ratings[0]) ratings[0].textContent = "🏆 " + progress.rating;
  if (ratings[1]) ratings[1].textContent = "🏆 " + enemyRating;
  const lead = (team) => F.find((f) => f.team === team && f.lane === 0);
  if (portraits[0]) portraits[0].src = `/assets/characters/${lead(0).character}/sprites/front/idle.png`;
  if (portraits[1]) portraits[1].src = `/assets/characters/${lead(1).character}/sprites/front/idle.png`;
}
document.querySelector("#auto").onclick = () => {
  if (battleEnding) return;
  if (!alive(0).length || !alive(1).length || time <= 0) {
    document.querySelector("#restartMotion").click();
    return;
  }
  auto = !auto;
  if (auto && !battleStarted) {
    battleStarted = true;
    lastSetup = { rating: enemyRating, strategy: strategy[1], fighters: F.map((f) => ({ character: f.character, x: f.x, y: f.y })) };
    selectedFighter = null;
    positionDrag = null;
    document.querySelector("#positionHint").hidden = true;
    renderSkillBar();
    renderStrategyBar();
  }
  for (const f of F) f.moving = false;
  document.querySelector("#auto").classList.toggle("active", auto);
  document.querySelector("#auto").textContent = auto ? "Пауза" : "Продолжить";
  sync();
};
speed.onclick = () => {
  rate = rate === 1 ? 2 : 1;
  speed.textContent = `×${rate} ▶`;
};
function finishCombat() {
  auto = false;
  shots = [];
  sparks = [];
  floaters = [];
  for (const f of F) {
    f.pendingFire = null;
    f.melee = null;
    f.dash = null;
    f.cast = 0;
    f.hit = 0;
    f.moving = false;
    f.retreating = false;
    f.vx = 0;
    f.vy = 0;
    f.stepStart = null;
  }
  battleEnding = deathEffects.length > 0;
  if (battleEnding) {
    document.querySelector("#battleResult").hidden = true;
    document.querySelector("#auto").disabled = true;
    document.querySelector("#auto").textContent = "Завершение…";
    document.querySelector("#auto").classList.remove("active");
    sync();
  } else showBattleResult();
}
function showBattleResult() {
  battleEnding = false;
  document.querySelector("#auto").disabled = false;
  // When time runs out, the team with more remaining health wins.
  const timeout = time <= 0 && alive(0).length > 0 && alive(1).length > 0,
    lead = teamHealth(0) - teamHealth(1);
  const win = (alive(0).length > 0 && alive(1).length === 0) || (timeout && lead > 0.02),
    loss = (alive(0).length === 0 && alive(1).length > 0) || (timeout && lead < -0.02);
  const result = document.querySelector("#battleResult");
  result.dataset.outcome = win ? "win" : loss ? "loss" : "draw";
  const stars = win ? alive(0).length : 0,
    delta = win ? 10 + stars * 5 : loss ? -15 : 0;
  progress.rating = Math.max(0, progress.rating + delta);
  progress.round += 1;
  saveProgress();
  document.querySelector("#battleResultText").textContent = win ? "Вы победили" : loss ? "Вы проиграли" : "Ничья";
  const reason = timeout ? "Время вышло. " : "";
  document.querySelector("#battleResultDetail").textContent =
    (win ? "★".repeat(stars) + "☆".repeat(TEAM_SIZE - stars) + " (★ — выживший боец) " : "") +
    reason +
    (timeout ? (win ? "У вашего отряда осталось больше здоровья" : loss ? "У соперника осталось больше здоровья" : "Здоровья у отрядов поровну") : win ? "Отряд противника побеждён" : loss ? "Ваш отряд побеждён" : "Оба отряда побеждены") +
    ` · рейтинг ${delta >= 0 ? "+" : ""}${delta}`;
  renderBattleSummary(result);
  result.hidden = false;
  updateHeader();
  document.querySelector("#auto").classList.remove("active");
  document.querySelector("#auto").textContent = "Новый бой";
  sync();
}
function renderBattleSummary(result) {
  let box = result.querySelector(".battle-summary");
  if (!box) {
    box = document.createElement("div");
    box.className = "battle-summary";
    box.style.cssText = "display:grid;gap:3px;font-size:12px;color:#eef3e6;pointer-events:none;max-width:340px";
    // A solid backdrop keeps the text readable over live fighters.
    result.style.background = "radial-gradient(ellipse at center,#041009f2 0,#041009cc 55%,#04100955 85%)";
    result.querySelector("small")?.before(box);
    const again = document.createElement("button");
    again.className = "battle-rematch";
    again.textContent = "Реванш";
    again.style.cssText =
      "pointer-events:auto;margin-top:4px;padding:8px 22px;border:0;border-radius:10px;font:800 15px system-ui;color:#2a1600;background:linear-gradient(#ffd56b,#f0a531);box-shadow:0 3px 0 #9c5d10";
    again.onclick = () => {
      rematchNext = true;
      document.querySelector("#restartMotion").click();
    };
    result.querySelector("small")?.before(again);
    const hint = result.querySelector("small");
    if (hint) hint.textContent = "«Реванш» — тот же соперник, можно переставить бойцов. «Новый бой» — другой соперник.";
  }
  const lived = (f) => Math.round(f.hp > 0 ? BATTLE_TIME - time : f.livedFor ?? 0),
    foes = F.filter((f) => f.team === 1).sort((a, b) => (b.dealt || 0) - (a.dealt || 0));
  box.innerHTML =
    F.filter((f) => f.team === 0)
      .sort((a, b) => a.lane - b.lane)
      .map((f) => `<span>${FIGHTER_NAMES[f.character]}: нанёс ${f.dealt || 0}, получил ${f.taken || 0}, ${f.hp > 0 ? "выжил" : "продержался " + lived(f) + " с"}</span>`)
      .join("") +
    `<span style="color:#d9b8ff">Соперник: ${foes.map((f) => FIGHTER_NAMES[f.character] + " " + (f.dealt || 0)).join(", ")}</span>` +
    `<span style="color:#ffe294;font-weight:800">${battleHint(result.dataset.outcome, foes)}</span>`;
}
// One concrete tip after the battle: what hurt the player most and what to try in the rematch.
function battleHint(outcome, foes) {
  const total = foes.reduce((s, f) => s + (f.dealt || 0), 0) || 1,
    top = foes[0],
    share = Math.round((100 * (top.dealt || 0)) / total),
    mine = F.filter((f) => f.team === 0).map((f) => f.character);
  if (outcome === "win") return alive(0).length < TEAM_SIZE ? "Совет: победа без потерь даёт " + TEAM_SIZE + (TEAM_SIZE > 4 ? " звёзд" : " звезды") + " и больше рейтинга." : "Чистая победа!";
  const name = (id) => "«" + STRATEGIES[id].name + "»";
  if (top.character === "carrot")
    return `Их морковь нанесла ${share}% урона. Попробуйте ${name("defense")} и ${mine.includes("tomato") ? "поставьте помидор перед перцем" : "возьмите помидор"}.`;
  if (top.character === "pepper")
    return `Их перец нанёс ${share}% урона. Попробуйте ${name("hunt")}${mine.includes("carrot") ? "" : " и возьмите морковь"}: она бросится на стрелка.`;
  return `Их помидор нанёс ${share}% урона. Попробуйте ${name("attack")}: отряд выбивает бойцов по одному.`;
}
function formatTime(t) {
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
}
function update(dt) {
  if (battleEnding) {
    advanceDeathEffects(dt * rate);
    if (!deathEffects.length) showBattleResult();
    return;
  }
  if (!auto) return;
  dt *= rate;
  // Short physics steps keep contact pressure stable at both playback speeds.
  const count = Math.max(1, Math.ceil(dt / 0.016));
  for (let i = 0; i < count; i++) stepCombat(dt / count);
  advanceDeathEffects(dt);
  timer.textContent = formatTime(time);
  timer.style.color = time < FINAL_TIME ? "#ff5a3c" : "";
  sync();
  if (!alive(0).length || !alive(1).length || time <= 0) finishCombat();
}
const TURN_HOLD = 0.5;
// Turn only on a clear change of direction and not more often than every TURN_HOLD seconds, so fighters do not flicker left-right or front-back.
function turnToward(f, x, y, dt) {
  f.turnHold = Math.max(0, (f.turnHold || 0) - dt);
  if (f.turnHold > 0) return;
  const len = Math.hypot(x, y) || 1,
    facing = x > 0.25 * len ? 1 : x < -0.25 * len ? -1 : f.facing || 1,
    back = y < -0.35 * len ? true : y > 0.35 * len ? false : !!f.back;
  if (facing !== f.facing || back !== !!f.back) f.turnHold = TURN_HOLD;
  f.facing = facing;
  f.back = back;
}
// Carrot dash: runs fast toward its target and hits on arrival; gives up if it cannot get there in time.
function planDash(f, dt) {
  const t = f.dash.target;
  f.dash.t -= dt;
  if (!t || t.hp <= 0 || f.dash.t <= 0) {
    f.dash = null;
    return false;
  }
  if (attackDistance(f, t) <= f.stats.attackRange * rangeMultiplier() * combatUnit() + 0.1) {
    f.dash = null;
    f.target = t;
    f.cast = 0.42;
    f.cool = nextAttackInterval(f);
    hurt(t, Math.max(1, Math.round(f.stats.power * 1.8 - t.stats.defense)), f);
    burst(t.x, t.y - 45, "rgba(255,150,40,A)");
    return true;
  }
  const dx = t.x - f.x,
    dy = t.y - f.y,
    d = Math.max(0.001, Math.hypot(dx, dy)),
    speed = f.stats.moveSpeed * 5 * speedMultiplier() * combatUnit();
  f.vx = (dx / d) * speed;
  f.vy = (dy / d) * speed;
  f.back = dy < 0;
  if (Math.abs(dx) > 0.1) f.facing = dx >= 0 ? 1 : -1;
  sparks.push({ x: f.x + (Math.random() - 0.5) * 10, y: f.y - 4, vx: -f.vx * 0.15, vy: -20, t: 0.35, max: 0.35, col: "rgba(214,160,90,A)" });
  return true;
}
function stepCombat(dt) {
  if (!alive(0).length || !alive(1).length || time <= 0) return;
  const before = time;
  time = Math.max(0, time - dt);
  if (before >= FINAL_TIME && time < FINAL_TIME) floaters.push({ x: W / 2, y: H * 0.4, text: "Финал: урон ×3", t: 1.8, color: "#ff5a3c", size: 22 });
  energy = Math.min(10, energy + dt * ENERGY_RATE);
  enemyEnergy = Math.min(10, enemyEnergy + dt * ENERGY_RATE);
  for (const team of [0, 1]) {
    if (!engaged[team] && (BATTLE_TIME - time > 10 || alive(1 - team).some((q) => alive(team).some((m) => attackDistance(q, m) < 120 * combatUnit()))))
      engaged[team] = true;
    skillThink[team] -= dt;
    if (auto && skillThink[team] <= 0) {
      skillThink[team] = 0.4;
      teamSkills(team);
    }
  }
  for (const team of [0, 1]) shields[team] = shieldOwners[team]?.hp > 0 ? Math.max(0, shields[team] - dt) : 0;
  for (const f of F) {
    f.stillFor = f.moving ? 0 : (f.stillFor || 0) + dt;
    f.stepStart = { x: f.x, y: f.y };
    f.moving = false;
    f.retreating = false;
    f.vx = 0;
    f.vy = 0;
    f.cool -= dt;
    f.hit = Math.max(0, f.hit - dt);
    f.cast = Math.max(0, f.cast - dt);
  }
  // Plan from one snapshot, then integrate together: neither team moves first.
  for (const f of F) {
    if (f.hp <= 0) continue;
    if (f.dash && planDash(f, dt)) continue;
    // Once engaged, a fighter keeps its target until it falls; only a skill (carrot dash) can switch it.
    const t = f.target && f.target.hp > 0 ? f.target : strategyTarget(f);
    if (!t) continue;
    f.target = t;
    const dx = t.x - f.x,
      dy = t.y - f.y,
      d = Math.max(0.001, Math.hypot(dx, dy)),
      gap = attackDistance(f, t),
      unit = combatUnit(),
      range = f.stats.attackRange * rangeMultiplier() * unit;
    let nx = dx / d,
      ny = dy / d,
      move = false,
      retreat = false;
    if (f.stats.preferredRange > 0) {
      const preferred = Math.min(f.stats.preferredRange * rangeMultiplier() * unit, range),
        tolerance = 8 * unit;
      if (shooterBacking(f, t, range)) {
        nx = -nx;
        ny = -ny;
        move = true;
        retreat = true;
      } else if (gap > preferred + tolerance) move = true;
    } else move = gap > 0;
    // Defence waits on its own ground until the enemy comes close or 10 s pass.
    if (strategy[f.team] === "defense" && !engaged[f.team] && !retreat) move = false;
    const lateral = engaged[f.team] || strategy[f.team] !== "defense" ? lateralAlignment(f, t, dx, dy, d) : 0;
    if (lateral) {
      const lx = lateral + (retreat ? nx : 0),
        ly = retreat ? ny : 0,
        len = Math.hypot(lx, ly);
      nx = lx / len;
      ny = ly / len;
      move = true;
    }
    const slot = strategy[f.team] === "defense" && !engaged[f.team] ? null : engageSlotDirection(f, t, d, range);
    if (slot) {
      move = slot.move;
      retreat = !!slot.retreat;
      if (move) {
        nx = slot.x;
        ny = slot.y;
      }
    }
    const wall = wallPush(f);
    if (move && (wall.x || wall.y)) {
      const wx = nx + wall.x * 1.6,
        wy = ny + wall.y * 1.6,
        len = Math.hypot(wx, wy) || 1;
      nx = wx / len;
      ny = wy / len;
    }
    // Once a pinned fighter starts sidestepping it commits to that direction for a moment instead of re-deciding every frame.
    f.escapeT = Math.max(0, (f.escapeT || 0) - dt);
    let escape = f.cast > 0 ? null : f.escapeT > 0 ? f.escapeDir : escapeDirection(f);
    if (escape && f.escapeT <= 0) {
      f.escapeDir = escape;
      f.escapeT = 0.5;
    }
    if (escape) {
      nx = escape.x;
      ny = escape.y;
      move = true;
      retreat = true;
    }
    if (f.cast > 0) move = false;
    if (move) {
      f.vx = nx * f.stats.moveSpeed * moveBonus(f) * speedMultiplier() * unit;
      f.vy = ny * f.stats.moveSpeed * moveBonus(f) * speedMultiplier() * unit;
      f.retreating = retreat;
    }
    // In combat a fighter always looks at its target, also while stepping sideways or back; only the dash looks where it runs.
    if (Math.abs(dx) > 0.001 || !f.aligning) turnToward(f, dx, dy, dt);
    else turnToward(f, -f.alignSide, dy, dt);
    const engagement = !f.aligning && inAttackRange(f, t);
    if (engagement && (!f.attackEngaged || f.attackTarget !== t)) f.cool = Math.max(f.cool, attackReactionDelay(f));
    f.attackEngaged = engagement;
    f.attackTarget = engagement ? t : null;
    // A fighter never strikes with its back to the target: it first turns (respecting the turn pause), then attacks.
    const facingAway = Math.abs(dx) > 0.25 * d && Math.sign(dx) !== f.facing;
    if (facingAway && f.turnHold <= 0) {
      f.facing = Math.sign(dx);
      f.turnHold = TURN_HOLD;
    }
    if (engagement && f.cool <= 0 && f.cast <= 0 && !(Math.abs(dx) > 0.25 * d && Math.sign(dx) !== f.facing)) {
      fire(f, t);
      f.cool = nextAttackInterval(f);
    }
  }
  for (const f of F)
    if (f.hp > 0) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      clampFighter(f);
    }
  separateFighters(dt);
  smoothPushes(dt);
  for (const f of F) {
    if (f.hp <= 0) {
      f.pendingFire = null;
      f.melee = null;
      continue;
    }
    const dx = f.x - f.stepStart.x,
      dy = f.y - f.stepStart.y;
    advanceWalkCycle(f, dx, dy, dt);
    if (f.pendingFire) {
      f.pendingFire.t -= dt;
      if (f.pendingFire.t <= 0) {
        const shot = f.pendingFire;
        f.pendingFire = null;
        if (inAttackRange(f, shot.to)) spawnProjectile(f, shot.to, shot.mult);
      }
    }
    if (f.melee) {
      f.melee.t -= dt;
      if (f.melee.t <= 0) {
        const hit = f.melee;
        f.melee = null;
        if (inAttackRange(f, hit.target)) hurt(hit.target, hit.dmg, f);
      }
    }
  }
  for (const s of shots) {
    if (!s.to || s.to.hp <= 0) {
      s.dead = 1;
      continue;
    }
    s.trail.push({ x: s.x, y: s.y, t: 0.22 });
    if (s.trail.length > 8) s.trail.shift();
    const dx = s.to.x - s.x,
      dy = s.to.y - baseScale() * 500 - s.y,
      d = Math.hypot(dx, dy),
      step = 340 * dt;
    if (d <= Math.max(combatRadius(s.to), step)) {
      s.dead = 1;
      if (s.kind === "tomato") burst(s.x, s.y, "rgba(225,28,18,A)");
      if (s.big) {
        const radius = 90 * combatUnit();
        blasts.push({ x: s.x, y: s.y, r: 0, max: radius, t: 0.5, life: 0.5, col: "rgba(255,120,30,A)" });
        for (let i = 0; i < 3; i++) burst(s.x, s.y);
        for (const q of alive(s.to.team)) if (q !== s.to && Math.hypot(q.x - s.to.x, q.y - s.to.y) <= radius) hurt(q, Math.round(s.dmg / 2), s.from);
      }
      hurt(s.to, s.dmg, s.from);
      continue;
    }
    s.x += (dx / d) * step;
    s.y += (dy / d) * step;
    s.spin += dt * 13;
    for (const q of s.trail) q.t -= dt;
  }
  shots = shots.filter((s) => !s.dead);
  for (const p of sparks) {
    p.t -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-4 * dt);
    p.vy *= Math.exp(-4 * dt);
  }
  sparks = sparks.filter((p) => p.t > 0);
  for (const b of blasts) {
    b.t -= dt;
    b.r = b.max * (1 - Math.max(0, b.t) / b.life);
  }
  blasts = blasts.filter((b) => b.t > 0);
  for (const p of floaters) {
    p.t -= dt;
    p.y -= 35 * dt;
  }
  floaters = floaters.filter((p) => p.t > 0);
}

function drawTomatoShot(s) {
  const r = 6;
  g.save();
  g.translate(s.x, s.y);
  g.rotate(s.spin);
  let q = g.createRadialGradient(-r * 0.35, -r * 0.35, 1, 0, 0, r);
  q.addColorStop(0, "#ff7a5c");
  q.addColorStop(0.55, "#e3241a");
  q.addColorStop(1, "#9c1109");
  g.fillStyle = q;
  g.beginPath();
  g.ellipse(0, 0, r, r * 0.88, 0, 0, 7);
  g.fill();
  g.fillStyle = "#3f8a22";
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5,
      l = i % 2 ? r * 0.18 : r * 0.62;
    g.lineTo(Math.cos(a) * l, -r * 0.55 + Math.sin(a) * l * 0.5);
  }
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(255,255,255,.55)";
  g.beginPath();
  g.ellipse(-r * 0.4, -r * 0.15, r * 0.18, r * 0.1, -0.6, 0, 7);
  g.fill();
  g.restore();
}
function fighter(f) {
  drawMixedFighter(f);
}
function render() {
  // Draw everything at the smoothed position, then put the real one back.
  for (const f of F) {
    f.realX = f.x;
    f.realY = f.y;
    f.x -= f.offX || 0;
    f.y -= f.offY || 0;
  }
  try {
    renderScene();
  } finally {
    for (const f of F) {
      f.x = f.realX;
      f.y = f.realY;
    }
  }
}
function renderScene() {
  g.clearRect(0, 0, W, H);
  if (!battleStarted) drawHalves();
  if (selectedFighter && !battleStarted) {
    g.strokeStyle = "#ffe167";
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(selectedFighter.x, selectedFighter.y + 3, baseScale() * 350, baseScale() * 95, 0, 0, 7);
    g.stroke();
  }
  for (const f of [...F].sort((a, b) => a.y - b.y)) fighter(f);
  drawShields();
  drawDeathEffects();
  g.globalCompositeOperation = "lighter";
  for (const s of shots) {
    if (s.kind === "tomato") continue;
    const k = s.big ? 2.2 : 1;
    for (const q of s.trail) glow(q.x, q.y, 12 * k, "rgba(255,65,8,A)", Math.max(0, q.t / 0.22) * 0.4);
    glow(s.x, s.y, 18 * k, "rgba(255,60,8,A)", 0.9);
    glow(s.x, s.y, 11 * k, "rgba(255,210,55,A)", 1);
    glow(s.x, s.y, 5 * k, "rgba(255,255,225,A)", 1);
  }
  for (const b of blasts) {
    const a = Math.max(0, b.t / b.life);
    glow(b.x, b.y, Math.max(1, b.r), b.col, 0.55 * a);
    g.strokeStyle = b.col.replace("A", (0.9 * a).toFixed(2));
    g.lineWidth = 3;
    g.beginPath();
    g.arc(b.x, b.y, Math.max(1, b.r), 0, 7);
    g.stroke();
  }
  for (const p of sparks) glow(p.x, p.y, 8, p.col, Math.max(0, p.t / p.max));
  g.globalCompositeOperation = "source-over";
  for (const s of shots) if (s.kind === "tomato") drawTomatoShot(s);
  drawHealthBars();
  if (!battleStarted) drawTargetPreview();
  for (const p of floaters) {
    g.globalAlpha = Math.min(1, Math.max(0, p.t / 0.8));
    g.fillStyle = p.color || "#ff472c";
    g.font = `1000 ${p.size || 18}px system-ui`;
    g.textAlign = "center";
    g.lineWidth = 3;
    g.strokeStyle = "#000a";
    g.strokeText(p.text, p.x, p.y);
    g.fillText(p.text, p.x, p.y);
  }
  g.globalAlpha = 1;
}
// Before the battle: tint each team's half and mark the border players may not cross.
function drawHalves() {
  const mid = halfLine(),
    vertical = layout === "mobile-vertical";
  g.save();
  g.fillStyle = "#48aaff14";
  if (vertical) g.fillRect(0, 0, W, mid);
  else g.fillRect(0, 0, mid, H);
  g.fillStyle = "#ff4b3010";
  if (vertical) g.fillRect(0, mid, W, H - mid);
  else g.fillRect(mid, 0, W - mid, H);
  g.setLineDash([8, 8]);
  g.strokeStyle = "#fff6";
  g.lineWidth = 2;
  g.beginPath();
  if (vertical) {
    g.moveTo(0, mid);
    g.lineTo(W, mid);
  } else {
    g.moveTo(mid, 0);
    g.lineTo(mid, H);
  }
  g.stroke();
  g.restore();
}
function drawShields() {
  for (const team of [0, 1]) {
    if (shields[team] <= 0) continue;
    const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 120);
    for (const f of alive(team)) {
      const h = baseScale() * 1150 * (characterProfiles[f.character]?.scale || 1);
      g.save();
      g.globalAlpha = Math.min(1, shields[team]) * 0.55 * pulse;
      g.strokeStyle = "#ffd65a";
      g.fillStyle = "#ffd65a22";
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(f.x, f.y - h * 0.45, h * 0.42, h * 0.6, 0, 0, 7);
      g.fill();
      g.stroke();
      g.restore();
    }
  }
}
// Health bars without names; bars that would overlap are stacked upward.
// Before the battle each enemy shows small portrait badges at its feet of the player's fighters that will attack it first,
// so moving a fighter visibly changes who fights whom. The selected fighter's badge is highlighted.
function drawTargetPreview() {
  const r = Math.max(9, Math.min(14, baseScale() * 160)),
    badges = new Map();
  for (const f of F) {
    if (f.team !== 0 || f.hp <= 0) continue;
    const t = chooseCombatTarget(f);
    if (!t) continue;
    if (!badges.has(t)) badges.set(t, []);
    badges.get(t).push(f);
  }
  for (const [t, list] of badges) {
    const top = t.y + r + 6;
    list.forEach((f, i) => {
      const x = t.x + (i - (list.length - 1) / 2) * (r * 2 + 3),
        on = f === selectedFighter,
        image = mixedSprites[f.character]?.["idle/front"]?.[0];
      g.save();
      g.beginPath();
      g.arc(x, top, on ? r * 1.25 : r, 0, 7);
      g.fillStyle = "#0b1710e6";
      g.fill();
      g.clip();
      if (image?.complete && image.naturalWidth) {
        // Head and chest of the idle frame, taken around the profile anchor.
        const a = characterProfiles[f.character].anchor,
          k = on ? r * 1.25 : r;
        g.drawImage(image, a.x - 400, 170, 800, 800, x - k, top - k, k * 2, k * 2);
      }
      g.restore();
      g.strokeStyle = on ? "#ffe167" : "#9fd0ff";
      g.lineWidth = on ? 2.5 : 1.5;
      g.beginPath();
      g.arc(x, top, on ? r * 1.25 : r, 0, 7);
      g.stroke();
    });
  }
}
function drawHealthBars() {
  const w = Math.max(24, Math.min(44, baseScale() * 540)),
    placed = [];
  for (const f of F.filter((q) => q.hp > 0).sort((a, b) => b.y - a.y)) {
    const p = characterProfiles[f.character];
    let x = f.x - w / 2,
      y = f.y - baseScale() * 1150 * (p?.scale || 1);
    for (let k = 0; k < 6; k++) {
      const clash = placed.find((r) => Math.abs(r.x - x) < w + 2 && Math.abs(r.y - y) < 9);
      if (!clash) break;
      y = clash.y - 10;
    }
    placed.push({ x, y });
    g.fillStyle = "#050806cc";
    g.fillRect(x, y, w, 7);
    g.fillStyle = f.team ? "#ff3e2e" : "#44a4ff";
    g.fillRect(x + 1, y + 1, ((w - 2) * f.hp) / f.max, 5);
    if (shields[f.team] > 0) {
      g.strokeStyle = "#ffd65a";
      g.lineWidth = 1.5;
      g.strokeRect(x - 1, y - 1, w + 2, 9);
    }
  }
}
function frame(n) {
  let dt = Math.min(0.04, (n - last) / 1000);
  last = n;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
mixedReady.then(() => {
  sync();
  requestAnimationFrame(frame);
});
function physicalRadius() {
  return layout === "mobile-horizontal" ? Math.min(W * 0.04, H * 0.09) : layout === "mobile-vertical" ? Math.min(W * 0.06, H * 0.07) : W * 0.065;
}
document.querySelector("#attackRange").oninput = (e) => (document.querySelector("#rangeValue").textContent = e.target.value + "%");
document.querySelector("#moveSpeed").oninput = (e) => {
  document.querySelector("#speedValue").textContent = e.target.value + "%";
  renderCombatSettings();
};
let lastSetup = null,
  rematchNext = false,
  playerSkills = 0;
document.querySelector("#restartMotion").onclick = () => {
  const rematch = rematchNext && lastSetup;
  rematchNext = false;
  assignTeamCharacters();
  place();
  // Rematch: same opponent lineup and positions; your fighters return to where they started.
  if (rematch) {
    F.forEach((f, i) => {
      const saved = lastSetup.fighters[i];
      if (f.team) f.character = saved.character;
      f.x = saved.x;
      f.y = saved.y;
    });
    enemyRating = lastSetup.rating;
    strategy[1] = lastSetup.strategy;
    resetCombatStats();
  }
  shots = [];
  sparks = [];
  floaters = [];
  blasts = [];
  shields = [0, 0];
  shieldOwners = [null, null];
  deathEffects = [];
  battleEnding = false;
  document.querySelector("#auto").disabled = false;
  time = BATTLE_TIME;
  timer.textContent = formatTime(time);
  timer.style.color = "";
  energy = 2;
  enemyEnergy = 2;
  skillThink = [0.5, 0.5];
  engaged = [false, false];
  playerSkills = 0;
  for (const f of F) {
    f.hp = f.max;
    f.dealt = 0;
    f.taken = 0;
    f.livedFor = null;
    f.target = null;
    f.slotTarget = null;
    f.lock = 0;
    f.slotSettled = false;
    f.escapeT = 0;
    f.stillFor = 0;
    f.attackEngaged = false;
    f.attackTarget = null;
    f.alignmentTarget = null;
    f.aligning = false;
    f.alignSide = 0;
    f.deathPlayed = false;
    f.melee = null;
    f.pendingFire = null;
    f.dash = null;
    f.stepStart = null;
    f.cast = 0;
    f.hit = 0;
    f.cool = 0;
    f.moving = false;
    f.back = false;
    f.walk = 0;
    f.facing = f.team === 0 ? 1 : -1;
  }
  auto = false;
  battleStarted = false;
  selectedFighter = null;
  positionDrag = null;
  document.querySelector("#positionHint").hidden = false;
  document.querySelector("#battleResult").hidden = true;
  document.querySelector("#auto").classList.remove("active");
  document.querySelector("#auto").textContent = "Начать бой";
  renderSkillBar();
  renderStrategyBar();
  updateHeader();
};
document.querySelector("#shuffleTeams").onclick = () => document.querySelector("#restartMotion").click();
let battleStarted = false,
  selectedFighter = null,
  positionDrag = null;
function positionAt(e) {
  let r = c.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
}
function boundPosition(f) {
  clampFighter(f);
  if (!battleStarted) keepOnOwnHalf(f);
  separateFighters();
}
c.addEventListener("pointerdown", (e) => {
  if (battleStarted) return;
  e.preventDefault();
  let p = positionAt(e),
    h = baseScale() * 1100,
    hit = F.filter((f) => f.team === 0 && f.hp > 0 && Math.abs(p.x - f.x) < Math.max(24, h * 0.42) && p.y >= f.y - h - 8 && p.y <= f.y + 15).sort(
      (a, b) => Math.hypot(p.x - a.x, p.y - (a.y - h * 0.5)) - Math.hypot(p.x - b.x, p.y - (b.y - h * 0.5)),
    )[0];
  if (hit) {
    selectedFighter = hit;
    positionDrag = { f: hit, ox: p.x - hit.x, oy: p.y - hit.y };
    c.setPointerCapture(e.pointerId);
  } else if (selectedFighter) {
    selectedFighter.x = p.x;
    selectedFighter.y = p.y;
    boundPosition(selectedFighter);
    selectedFighter = null;
  }
});
c.addEventListener("pointermove", (e) => {
  if (battleStarted || !positionDrag) return;
  e.preventDefault();
  let p = positionAt(e),
    f = positionDrag.f;
  f.x = p.x - positionDrag.ox;
  f.y = p.y - positionDrag.oy;
  boundPosition(f);
});
c.addEventListener("pointerup", () => (positionDrag = null));
c.addEventListener("pointercancel", () => (positionDrag = null));

document.querySelector("#restartBattle").onclick = () => document.querySelector("#restartMotion").click();
timer.textContent = formatTime(time);
renderSkillBar();
renderStrategyBar();
updateHeader();
