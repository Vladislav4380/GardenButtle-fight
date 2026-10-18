// Desynchronise attacks without changing their nominal average interval.
function attackReactionDelay(f) {
  return 0.08 + Math.random() * Math.min(0.28, f.stats.attackInterval * 0.3);
}
function nextAttackInterval(f) {
  return Math.max(0.44, f.stats.attackInterval * (0.88 + Math.random() * 0.24));
}

// Front-only sprites need a readable horizontal angle before engaging.
function lateralAlignment(f, t, dx, dy, d) {
  const unit = combatUnit();
  if (f.alignmentTarget !== t) {
    f.alignmentTarget = t;
    f.aligning = false;
    f.alignSide = 0;
  }
  const near = d <= (f.stats.attackRange * rangeMultiplier() + f.stats.radius + t.stats.radius + 40) * unit;
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
function walkCycleDistance(f) {
  const p = characterProfiles[f.character];
  return Math.max(0.001, (baseScale() * 1100 * (p.scale || 1) * p.strideLength) / p.visualHeight);
}
function advanceWalkCycle(f, dx, dy, dt) {
  const ownSpeed = Math.hypot(f.vx, f.vy);
  // Reject sideways/backward pushes and cap forward travel at self-propelled travel.
  const projected = ownSpeed > 0.001 ? (dx * f.vx + dy * f.vy) / ownSpeed : 0;
  const ownTravel = Math.min(Math.max(0, projected), ownSpeed * Math.max(0, dt));
  f.moving = f.hp > 0 && f.cast <= 0 && ownTravel > 0.001;
  if (f.moving) f.walk = ((f.walk || 0) + ownTravel / walkCycleDistance(f)) % 1;
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
    power: 24,
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
    max: 640,
    power: 41,
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
    max: 500,
    power: 34,
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
const BATTLE_TIME = 60,
  SHIELD_TIME = 5,
  FINAL_TIME = 15,
  ENERGY_RATE = 0.5;
function combatUnit() {
  return layout === "mobile-horizontal" ? Math.min(W / 700, H / 390) : Math.min(W / 390, H / 700);
}
function combatRadius(f) {
  return (f.stats?.radius || 20) * combatUnit();
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
function inAttackRange(f, t) {
  return t && t.hp > 0 && attackDistance(f, t) <= f.stats.attackRange * rangeMultiplier() * combatUnit() + 0.1;
}
function clampFighter(f) {
  const r = combatRadius(f);
  f.x = Math.max(r, Math.min(W - r, f.x));
  f.y = Math.max(Math.max(r, baseScale() * 1150 + 10), Math.min(H - Math.max(12, r), f.y));
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
      radius: f.stats.radius,
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
  enemyThink = 2,
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
const F = [];
for (let i = 0; i < 3; i++) {
  F.push({ team: 0, lane: i, hp: 100, max: 100, cool: 0, state: "idle", hit: 0, cast: 0 });
  F.push({ team: 1, lane: i, hp: 100, max: 100, cool: 0, state: "idle", hit: 0, cast: 0 });
}
// Round, rating and the player's lineup survive page reloads; storage may be unavailable.
const PROGRESS_KEY = "gardenbattle.progress";
function loadProgress() {
  const base = { round: 1, rating: 1000, lineup: ["pepper", "tomato", "carrot"] };
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
    const lineup = Array.isArray(saved.lineup) && saved.lineup.length === 3 && saved.lineup.every((id) => COMBAT_SPECS[id]) ? saved.lineup : base.lineup;
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
function randomLineup() {
  return Array.from({ length: 3 }, () => ["pepper", "tomato", "carrot"][Math.floor(Math.random() * 3)]);
}
// The player picks their own lineup before the battle; the opponent's is random and visible during setup.
function assignTeamCharacters() {
  const enemy = randomLineup();
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
  for (const f of F) {
    const depth = f.team ? ENEMY_DEPTH[f.character] + (Math.random() - 0.5) * 0.12 : 0;
    if (layout === "mobile-vertical") {
      f.x = W * (0.2 + f.lane * 0.3);
      f.y = f.team === 0 ? H * 0.4 : H * (0.68 + depth * 0.24);
    } else if (layout === "mobile-horizontal") {
      f.x = f.team === 0 ? W * 0.22 : W * (0.58 + depth * 0.32);
      f.y = H * (0.36 + f.lane * 0.29);
    } else {
      f.x = f.team ? W * (0.58 + depth * 0.32) : W * 0.24;
      f.y = H * (0.34 + f.lane * 0.27) + (f.team ? 8 : -8);
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
function applyDamage(f, d) {
  if (f.hp <= 0 || d <= 0) return;
  f.hp = Math.max(0, f.hp - d);
  if (f.hp === 0) beginDeathEffect(f);
  f.hit = 0.22;
  burst(f.x, f.y - 45);
  // Jitter keeps simultaneous numbers apart; yellow = damage dealt by the player, red = damage taken.
  floaters.push({ x: f.x + (Math.random() - 0.5) * 28, y: f.y - 85 - Math.random() * 14, text: "-" + d, t: 0.8, color: f.team ? "#ffe36b" : "#ff472c" });
}
function hurt(f, d) {
  if (f.hp <= 0) return;
  // Final seconds: triple damage so stalled fights (tomato mirrors) still end.
  if (time < FINAL_TIME) d *= 3;
  // An active tomato shield halves every hit aimed at its allies; the tomato itself takes a quarter.
  const owner = shieldOwners[f.team];
  if (shields[f.team] > 0 && owner && owner.hp > 0 && owner !== f) {
    applyDamage(owner, Math.floor(d / 4));
    d -= Math.floor(d / 2);
  }
  applyDamage(f, d);
  sync();
}
function teamHealth(team) {
  return F.filter((f) => f.team === team).reduce((s, f) => s + Math.max(0, f.hp) / f.max, 0) / 3;
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
    x.disabled = battleStarted && (!auto || f.hp <= 0 || energy < FIGHTER_SKILLS[f.character].cost);
  });
}
// Skills spend energy only when they can act.
function skillTarget(f) {
  const foes = alive(1 - f.team);
  if (f.hp <= 0 || !foes.length) return null;
  if (f.character === "carrot")
    return foes.reduce((best, q) =>
      !best || q.stats.attackRange > best.stats.attackRange || (q.stats.attackRange === best.stats.attackRange && attackDistance(f, q) < attackDistance(f, best)) ? q : best,
    null);
  if (f.character === "tomato") return shields[f.team] > 0 ? null : f;
  return chooseCombatTarget(f);
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
  if (!auto || !f) return;
  const cost = FIGHTER_SKILLS[f.character].cost;
  if (energy < cost) return;
  if (useFighterSkill(f)) energy -= cost;
  sync();
}
function enemyAct() {
  const own = alive(1).sort(() => Math.random() - 0.5),
    foes = alive(0);
  for (const f of own) {
    const cost = FIGHTER_SKILLS[f.character].cost;
    if (enemyEnergy < cost) continue;
    const wants =
      f.character === "tomato" ? alive(1).some((q) => q.hp < q.max * 0.7) : f.character === "carrot" ? foes.some((q) => q.stats.attackRange > 50) : true;
    if (wants && useFighterSkill(f)) {
      enemyEnergy -= cost;
      return;
    }
  }
}
function renderSkillBar() {
  const bar = document.querySelector(".skills");
  if (!bar) return;
  bar.innerHTML = [0, 1, 2]
    .map((lane) => {
      const f = laneFighter(lane),
        skill = FIGHTER_SKILLS[f.character];
      return `<button class="skill skill-${f.character}" data-lane="${lane}"><span class="cost">${skill.cost}</span><img src="/assets/characters/${f.character}/sprites/front/idle.png" alt=""><strong>${FIGHTER_NAMES[f.character]}<em>${battleStarted ? skill.name : "Сменить ↻"}</em></strong></button>`;
    })
    .join("");
  document.querySelectorAll(".skill").forEach((x) => (x.onclick = () => act(+x.dataset.lane)));
  sync();
}
function updateHeader() {
  const small = document.querySelector(".round small");
  if (small) small.textContent = "РАУНД " + progress.round;
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
    selectedFighter = null;
    positionDrag = null;
    document.querySelector("#positionHint").hidden = true;
    renderSkillBar();
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
    (win ? "★".repeat(stars) + "☆".repeat(3 - stars) + " " : "") +
    reason +
    (timeout ? (win ? "У вашего отряда осталось больше здоровья" : loss ? "У соперника осталось больше здоровья" : "Здоровья у отрядов поровну") : win ? "Отряд противника побеждён" : loss ? "Ваш отряд побеждён" : "Оба отряда побеждены") +
    ` · рейтинг ${delta >= 0 ? "+" : ""}${delta}`;
  result.hidden = false;
  updateHeader();
  document.querySelector("#auto").classList.remove("active");
  document.querySelector("#auto").textContent = "Новый бой";
  sync();
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
    f.cast = 0.42;
    f.cool = nextAttackInterval(f);
    hurt(t, Math.max(1, Math.round(f.stats.power * 1.8 - t.stats.defense)));
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
  enemyThink -= dt;
  if (auto && enemyThink <= 0) {
    enemyThink = 1 + Math.random() * 1.5;
    enemyAct();
  }
  for (const team of [0, 1]) shields[team] = shieldOwners[team]?.hp > 0 ? Math.max(0, shields[team] - dt) : 0;
  for (const f of F) {
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
    const t = chooseCombatTarget(f);
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
      if (gap < Math.max(f.stats.minimumRange * unit, preferred - tolerance)) {
        nx = -nx;
        ny = -ny;
        move = true;
        retreat = true;
      } else if (gap > preferred + tolerance) move = true;
    } else move = gap > 0;
    const lateral = lateralAlignment(f, t, dx, dy, d);
    if (lateral) {
      const lx = lateral + (retreat ? nx : 0),
        ly = retreat ? ny : 0,
        len = Math.hypot(lx, ly);
      nx = lx / len;
      ny = ly / len;
      move = true;
    }
    if (f.cast > 0) move = false;
    if (move) {
      f.vx = nx * f.stats.moveSpeed * speedMultiplier() * unit;
      f.vy = ny * f.stats.moveSpeed * speedMultiplier() * unit;
      f.retreating = retreat;
      const lookX = retreat || f.aligning ? dx / d : nx,
        lookY = retreat || f.aligning ? dy / d : ny;
      f.back = lookY < 0;
      if (Math.abs(lookX) > 0.001) f.facing = lookX >= 0 ? 1 : -1;
      else if (f.aligning) f.facing = -f.alignSide;
    }
    if (!move) {
      f.back = dy < 0;
      if (Math.abs(dx) > 0.1) f.facing = dx >= 0 ? 1 : -1;
    }
    const engagement = !f.aligning && inAttackRange(f, t);
    if (engagement && (!f.attackEngaged || f.attackTarget !== t)) f.cool = Math.max(f.cool, attackReactionDelay(f));
    f.attackEngaged = engagement;
    f.attackTarget = engagement ? t : null;
    if (engagement && f.cool <= 0 && f.cast <= 0) {
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
        if (inAttackRange(f, hit.target)) hurt(hit.target, hit.dmg);
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
        for (const q of alive(s.to.team)) if (q !== s.to && Math.hypot(q.x - s.to.x, q.y - s.to.y) <= radius) hurt(q, Math.round(s.dmg / 2));
      }
      hurt(s.to, s.dmg);
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
  g.clearRect(0, 0, W, H);
  if (!battleStarted) drawHalves();
  if (selectedFighter && !battleStarted) {
    g.strokeStyle = "#ffe167";
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(selectedFighter.x, selectedFighter.y + 3, baseScale() * 350, baseScale() * 95, 0, 0, 7);
    g.stroke();
  }
  if (battleStarted) drawTargetLines();
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
// Ground arrows from each fighter to its current target, in the team colour, so pairs read at a glance.
function drawTargetLines() {
  g.save();
  g.lineCap = "round";
  for (const f of F) {
    const t = f.target;
    if (f.hp <= 0 || !t || t.hp <= 0) continue;
    const dx = t.x - f.x,
      dy = t.y - f.y,
      d = Math.hypot(dx, dy),
      rf = combatRadius(f),
      rt = combatRadius(t) + 6;
    if (d < rf + rt + 8) continue;
    const ux = dx / d,
      uy = dy / d,
      x0 = f.x + ux * rf,
      y0 = f.y + uy * rf,
      x1 = t.x - ux * rt,
      y1 = t.y - uy * rt,
      col = f.team ? "255,75,48" : "72,170,255";
    g.setLineDash([]);
    g.strokeStyle = "rgba(0,0,0,0.35)";
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    g.strokeStyle = `rgba(${col},0.95)`;
    g.fillStyle = `rgba(${col},1)`;
    g.lineWidth = 4;
    g.setLineDash([9, 6]);
    g.lineDashOffset = -performance.now() / 40;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    g.setLineDash([]);
    g.beginPath();
    g.moveTo(x1 + ux * 4, y1 + uy * 4);
    g.lineTo(x1 - ux * 13 - uy * 8, y1 - uy * 13 + ux * 8);
    g.lineTo(x1 - ux * 13 + uy * 8, y1 - uy * 13 - ux * 8);
    g.fill();
  }
  g.restore();
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
document.querySelector("#restartMotion").onclick = () => {
  assignTeamCharacters();
  place();
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
  enemyThink = 2;
  for (const f of F) {
    f.hp = f.max;
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
updateHeader();
