// Battle 6×6 with the rules of Teamfight Tactics: the camera stands behind the player's half and looks down at about 50°,
// the board is a hex grid (7 columns × 4 rows per side), the player's squad is at the bottom.
// TFT rules: every unit always stands in one hex and steps hex to hex (two units never share a hex), ranges are counted
// in hexes, a unit attacks the closest enemy and keeps it until it dies or gets out of range, each unit has its own mana
// (from its attacks and from the damage it takes) and casts its ability when the mana is full, assassins run for the
// enemy back line at the start, armor reduces damage as 100 / (100 + armor). Combat lasts 30 s, then 15 s of overtime
// with doubled damage. On top of TFT: the archetype triangle (wall > assassin > sniper > wall).

const TEAM_SIZE = 6,
  HEX = 1 / Math.sqrt(3), // corner radius of a pointy-top hex whose width is 1
  ROW_STEP = 1.5 * HEX,
  BATTLE_TIME = 45,
  FINAL_TIME = 15, // overtime: the last 15 s, damage ×2
  BODY = 0.36, // body radius in hexes, used for drawing only
  TEAM_COLORS = ["#62e26f", "#ff5a4a"];

// TFT-style units. range: hexes; attackSpeed: attacks per second; step: seconds per hex; mana: start / max.
const TFT_SPECS = {
  tomato: { role: "Страж", max: 950, ad: 70, attackSpeed: 0.6, armor: 55, range: 2, step: 0.65, manaStart: 30, mana: 90 },
  pepper: { role: "Стрелок", max: 600, ad: 78, attackSpeed: 0.75, armor: 20, range: 4, step: 0.6, manaStart: 20, mana: 70 },
  carrot: { role: "Ассасин", max: 650, ad: 72, attackSpeed: 0.85, armor: 30, range: 1, step: 0.45, manaStart: 0, mana: 60 },
  corn: { role: "Пушкарь", max: 650, ad: 66, attackSpeed: 0.8, armor: 30, range: 3, step: 0.6, manaStart: 20, mana: 70 },
  zucchini: { role: "Страж", max: 1000, ad: 58, attackSpeed: 0.65, armor: 60, range: 1, step: 0.65, manaStart: 20, mana: 90 },
  beet: { role: "Воин", max: 820, ad: 68, attackSpeed: 0.75, armor: 40, range: 1, step: 0.55, manaStart: 0, mana: 70 },
};
const TFT_ABILITIES = {
  tomato: "Щит отряда: союзники в 2 клетках 4 с получают половину урона",
  pepper: "Огненный шар: 2,4× урона по цели и половина этого врагам рядом",
  carrot: "Удар из тени: 2,2× урона по цели",
  beet: "Вихрь: 1,6× урона всем врагам в соседних клетках",
  corn: "Залп: выстрел из кукурузной пушки на 2,5× урона",
  zucchini: "Оглушающий удар: 2× урона булавой, цель 1,5 с не действует",
};
const TFT_NAMES = { pepper: "Перец", tomato: "Помидор", carrot: "Морковь", beet: "Свёкла", corn: "Кукуруза", zucchini: "Кабачок" };
const TFT_ARCHETYPES = { tomato: "wall", pepper: "sniper", carrot: "assassin" };
const TFT_BONUS = { wall: { sniper: 0.82, assassin: 1.35 }, sniper: { wall: 1.35, assassin: 0.82 }, assassin: { sniper: 1.35, wall: 0.82 } };
// The beet, the corn and the zucchini have no archetype yet, so the counter triangle treats it as neutral (×1 both ways).
const CHARACTERS = ["pepper", "tomato", "carrot", "beet", "corn", "zucchini"];

// Board size: 7 columns × 4 rows per side as in TFT on a wide screen; a tall phone screen gets 6 columns and as many
// rows as fit its height (see initPage), so the board fills the screen instead of a strip in the middle.
let COLS, ROWS_PER_SIDE, ROWS, BOARD_W, BOARD_D;
function setBoard(cols, rowsPerSide) {
  COLS = cols;
  ROWS_PER_SIDE = rowsPerSide;
  ROWS = rowsPerSide * 2;
  BOARD_W = COLS + 0.5;
  BOARD_D = 2 * HEX + (ROWS - 1) * ROW_STEP;
}
setBoard(7, 4);

// ---------- Board geometry (ground units: one hex is 1 wide; odd rows are shifted right) ----------
function hexCenter(col, row) {
  return { x: 0.5 + col + (row % 2) * 0.5, y: HEX + row * ROW_STEP };
}
function onBoard(col, row) {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS;
}
function cube(col, row) {
  const q = col - (row - (row & 1)) / 2;
  return { q, r: row };
}
function hexDist(a, b) {
  const A = cube(a.col, a.row),
    B = cube(b.col, b.row),
    dq = A.q - B.q,
    dr = A.r - B.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
function neighbors(col, row) {
  const odd = row & 1,
    d = odd
      ? [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]]
      : [[1, 0], [-1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]];
  return d.map(([dc, dr]) => ({ col: col + dc, row: row + dr })).filter((h) => onBoard(h.col, h.row));
}
// Rows 0..3 belong to the enemy (far side), rows 4..7 to the player (near side).
function ownRows(team) {
  return Array.from({ length: ROWS_PER_SIDE }, (_, i) => (team === 0 ? ROWS_PER_SIDE + i : i));
}
function hexAt(x, y) {
  let best = null,
    bestD = Infinity;
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++) {
      const c = hexCenter(col, row),
        d = Math.hypot(c.x - x, c.y - y);
      if (d < bestD) {
        bestD = d;
        best = { col, row };
      }
    }
  return best;
}
// Nearest free hex of the team's half; `skip` is the fighter being placed.
function freeHexNear(team, x, y, skip) {
  let best = null,
    bestD = Infinity;
  for (const row of ownRows(team))
    for (let col = 0; col < COLS; col++) {
      if (F.some((q) => q !== skip && q.team === team && q.col === col && q.row === row)) continue;
      const c = hexCenter(col, row),
        d = Math.hypot(c.x - x, c.y - y);
      if (d < bestD) {
        bestD = d;
        best = { col, row };
      }
    }
  return best;
}
function placeOnHex(f, col, row) {
  const c = hexCenter(col, row);
  f.col = col;
  f.row = row;
  f.x = c.x;
  f.y = c.y;
}

// ---------- State ----------
// Fallen fighters: the body fades out while smoke or sparks fly up (as in the 3×3 battle).
let deaths = [];
let F = [],
  shots = [],
  floaters = [],
  blasts = [],
  time = BATTLE_TIME,
  battleStarted = false,
  running = false,
  result = null,
  rate = 1;
let lineup = ["tomato", "tomato", "carrot", "carrot", "pepper", "pepper"];

function makeFighter(team, character, index) {
  const stats = { ...TFT_SPECS[character] };
  return { team, character, index, stats, hp: stats.max, max: stats.max, mana: stats.manaStart, x: 0, y: 0, col: 0, row: 0, target: null, cool: 0, cast: 0, hit: 0, walk: 0, moving: false, move: null, hunt: null, pending: null, shield: 0, dealt: 0 };
}
function radiusOf() {
  return BODY;
}
function alive(team) {
  return F.filter((f) => f.team === team && f.hp > 0);
}
function occupied(col, row, skip) {
  return F.some((q) => q !== skip && q.hp > 0 && q.col === col && q.row === row);
}
function inRange(f, t) {
  return !!t && t.hp > 0 && hexDist(f, t) <= f.stats.range;
}
function archetypeMultiplier(a, b) {
  return TFT_BONUS[TFT_ARCHETYPES[a?.character]]?.[TFT_ARCHETYPES[b?.character]] ?? 1;
}

// Default placement: guards and carrots in front, peppers behind; the enemy lineup and spots are random.
function defaultSpots(team, chars) {
  const n = ROWS_PER_SIDE,
    front = team === 0 ? [n, n + 1] : [n - 1, n - 2],
    back = team === 0 ? [2 * n - 2, 2 * n - 1] : [1, 0],
    used = new Set(),
    spots = [];
  for (const c of chars) {
    const rows = c === "pepper" ? back : front;
    let spot = null;
    for (let tries = 0; tries < 60 && !spot; tries++) {
      const row = rows[Math.floor(Math.random() * rows.length)],
        col = Math.floor(Math.random() * COLS);
      if (!used.has(col + ":" + row)) spot = { col, row };
    }
    if (!spot)
      for (const row of ownRows(team)) for (let col = 0; col < COLS && !spot; col++) if (!used.has(col + ":" + row)) spot = { col, row };
    used.add(spot.col + ":" + spot.row);
    spots.push(spot);
  }
  return spots;
}
function newBattle(keepPlayerSpots) {
  const old = keepPlayerSpots ? F.filter((f) => f.team === 0).map((f) => ({ col: f.homeCol ?? f.col, row: f.homeRow ?? f.row })) : null;
  const enemy = Array.from({ length: TEAM_SIZE }, () => CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]);
  F = [];
  const mine = old || defaultSpots(0, lineup),
    theirs = defaultSpots(1, enemy);
  lineup.forEach((c, i) => {
    const f = makeFighter(0, c, i);
    placeOnHex(f, mine[i].col, mine[i].row);
    F.push(f);
  });
  enemy.forEach((c, i) => {
    const f = makeFighter(1, c, i);
    placeOnHex(f, theirs[i].col, theirs[i].row);
    F.push(f);
  });
  shots = [];
  floaters = [];
  blasts = [];
  deaths = [];
  time = BATTLE_TIME;
  battleStarted = false;
  running = false;
  result = null;
}
function setLineupSlot(i, character) {
  if (battleStarted) return;
  lineup[i] = character;
  const f = F.find((q) => q.team === 0 && q.index === i);
  if (!f) return;
  const fresh = makeFighter(0, character, i);
  placeOnHex(fresh, f.col, f.row);
  F[F.indexOf(f)] = fresh;
}
function startBattle() {
  if (battleStarted) return;
  battleStarted = running = true;
  applyTraits(0);
  applyTraits(1);
  for (const f of F) {
    f.homeCol = f.col;
    f.homeRow = f.row;
    f.cool = 0.2 + Math.random() * 0.3;
  }
  // Assassins set off for the enemy back line at once.
  for (const f of F) if (f.character === "carrot") startHunt(f);
}

// ---------- Synergies (TFT traits) ----------
// Every hero has two tags: its class (role in battle) and the part of the plant that is eaten. Like in TFT a tag counts
// DIFFERENT heroes: two tomatoes are one Guard. With enough different heroes of a tag its bonus switches on for the
// battle, so a lineup of varied heroes beats six copies of the strongest one.
const HERO_TAGS = {
  tomato: ["guard", "fruit"],
  zucchini: ["guard", "fruit"],
  pepper: ["shooter", "fruit"],
  corn: ["shooter", "grain"],
  carrot: ["fighter", "root"],
  beet: ["fighter", "root"],
};
const TRAITS = {
  guard: { icon: "🛡️", name: "Стражи", tiers: [2], text: "все союзники +20 брони" },
  shooter: { icon: "🏹", name: "Стрелки", tiers: [2], text: "стрелки бьют на 1 клетку дальше" },
  fighter: { icon: "⚔️", name: "Бойцы", tiers: [2], text: "бойцы атакуют на 30% чаще" },
  fruit: { icon: "🍎", name: "Плоды", tiers: [2, 3], text: "при 2 плоды лечатся на 15% нанесённого урона, при 3 — на 30%" },
  root: { icon: "🥕", name: "Корнеплоды", tiers: [2], text: "корнеплоды +25% здоровья" },
  grain: { icon: "🌾", name: "Зерно", tiers: [2], text: "снаряды зерна пробивают половину брони" },
};
// Tag → { count of different heroes, reached tier (0 = off) } for a team's lineup.
function teamTraits(chars) {
  const out = {};
  for (const id of Object.keys(TRAITS)) {
    const count = new Set(chars.filter((c) => HERO_TAGS[c]?.includes(id))).size,
      tier = TRAITS[id].tiers.filter((n) => count >= n).length;
    out[id] = { count, tier };
  }
  return out;
}
// The bonuses are applied once, at the start of the battle.
function applyTraits(team) {
  const own = F.filter((f) => f.team === team),
    t = teamTraits(own.map((f) => f.character)),
    has = (f, id) => HERO_TAGS[f.character]?.includes(id);
  for (const f of own) {
    if (t.guard.tier) f.stats.armor += 20;
    if (t.shooter.tier && has(f, "shooter")) f.stats.range += 1;
    if (t.fighter.tier && has(f, "fighter")) f.stats.attackSpeed *= 1.3;
    if (t.fruit.tier && has(f, "fruit")) f.lifesteal = t.fruit.tier >= 2 ? 0.3 : 0.15;
    if (t.root.tier && has(f, "root")) {
      f.max = f.hp = Math.round(f.max * 1.25);
    }
    if (t.grain.tier && has(f, "grain")) f.pierce = 0.5;
  }
  return t;
}

// ---------- Targets ----------
// The closest enemy in hexes; ties go to the one nearer in plain distance.
function closestFoe(f) {
  return alive(1 - f.team).reduce((b, q) => {
    if (!b) return q;
    const d = hexDist(f, q) - hexDist(f, b);
    return d < 0 || (d === 0 && Math.hypot(q.x - f.x, q.y - f.y) < Math.hypot(b.x - f.x, b.y - f.y)) ? q : b;
  }, null);
}
// A unit keeps its target until it dies or gets out of range; then it takes the closest enemy.
function chooseTarget(f) {
  if (f.hunt) {
    const h = f.hunt;
    // The run ends when the quarry is reached (a normal fight from then on), dies, or no free way leads to it.
    if (h.hp > 0 && !inRange(f, h) && routeTo(f, h)) return (f.target = h);
    f.hunt = null;
    if (h.hp > 0 && inRange(f, h)) return (f.target = h);
  }
  if (!(f.target && f.target.hp > 0 && inRange(f, f.target))) f.target = closestFoe(f);
  return f.target;
}

// ---------- Assassin run ----------
// At the start the assassin runs for the enemy farthest from it (the back line), faster than its normal step and
// around the enemy squad, through free hexes only. When no way is left, it fights the first enemy it reached.
const HUNT_STEP = 0.6;
function startHunt(f) {
  const foes = alive(1 - f.team);
  if (!foes.length) return;
  f.hunt = foes.reduce((b, q) => (hexDist(f, q) > hexDist(f, b) ? q : b));
  f.target = f.hunt;
  say(f, "Рывок в тыл");
}
// ---------- Movement: one hex at a time ----------
// Breadth-first search over free hexes to the nearest hex from which the target is in range; returns the first step.
function routeTo(f, t) {
  const start = { col: f.col, row: f.row },
    key = (h) => h.col + ":" + h.row,
    seen = new Map([[key(start), null]]),
    queue = [start];
  while (queue.length) {
    const h = queue.shift();
    if (h !== start && hexDist(h, t) <= f.stats.range) {
      let cur = h;
      while (seen.get(key(cur)) !== start && seen.get(key(cur))) cur = seen.get(key(cur));
      return cur;
    }
    for (const n of neighbors(h.col, h.row)) {
      if (seen.has(key(n)) || occupied(n.col, n.row, f)) continue;
      seen.set(key(n), h);
      queue.push(n);
    }
  }
  return null;
}
function nextStep(f, t) {
  const way = routeTo(f, t);
  if (way) return way;
  // No free way in reach: step to the free neighbour closest to the target, if it is closer than where we stand.
  const near = neighbors(f.col, f.row).filter((n) => !occupied(n.col, n.row, f));
  const best = near.reduce((b, n) => (!b || hexDist(n, t) < hexDist(b, t) ? n : b), null);
  return best && hexDist(best, t) < hexDist(f, t) ? best : null;
}
function startMove(f, h) {
  const c = hexCenter(h.col, h.row);
  // The hex is taken at once, so nobody else steps into it.
  f.move = { fromX: f.x, fromY: f.y, toX: c.x, toY: c.y, t: 0, dur: f.stats.step * (f.hunt ? HUNT_STEP : 1) };
  f.col = h.col;
  f.row = h.row;
}
function stepMove(f, dt) {
  const m = f.move;
  m.t = Math.min(m.dur, m.t + dt);
  const k = m.t / m.dur,
    x = m.fromX + (m.toX - m.fromX) * k,
    y = m.fromY + (m.toY - m.fromY) * k;
  // One walk cycle every 0.6 hex: the sheet frames move the legs little, a slower cycle looked sluggish.
  f.walk += Math.hypot(x - f.x, y - f.y) / 0.6;
  f.x = x;
  f.y = y;
  f.moving = true;
  if (k >= 1) f.move = null;
}

// ---------- Damage and mana ----------
function gainMana(f, n) {
  if (f.hp > 0 && f.cast <= 0) f.mana = Math.min(f.stats.mana, f.mana + n);
}
function applyDamage(f, d, src) {
  if (f.hp <= 0 || d <= 0) return;
  const dealt = Math.min(f.hp, d);
  f.hp = Math.max(0, f.hp - d);
  if (src) src.dealt += dealt;
  f.hit = 0.14;
  floaters.push({ x: f.x + (Math.random() - 0.5) * 0.3, y: f.y, text: "-" + d, t: 0.8, color: f.team ? "#ffe36b" : "#ff472c" });
  if (f.hp === 0) startDeath(f);
}
// Particles are kept in fighter heights, so they scale with the board on any screen.
function startDeath(f) {
  const kind = Math.random() < 0.5 ? "smoke" : "sparks",
    parts = Array.from({ length: 40 }, (_, i) => {
      const a = Math.random() * Math.PI * 2,
        v = 0.4 + Math.random() * 1.4;
      return {
        x: (Math.random() - 0.5) * 0.5,
        y: -(0.08 + Math.random() * 0.85),
        vx: kind === "smoke" ? (Math.random() - 0.5) * 0.4 : Math.cos(a) * v,
        vy: kind === "smoke" ? -(0.3 + Math.random() * 0.7) : Math.sin(a) * v - 0.4,
        size: kind === "smoke" ? 0.025 + Math.random() * 0.055 : 0.012 + Math.random() * 0.02,
        tint: i % 3,
      };
    });
  deaths.push({ f, x: f.x, y: f.y, kind, parts, age: 0, life: 1.3, pose: f.pose });
}
function stepDeaths(dt) {
  for (const e of deaths) {
    e.age += dt;
    for (const q of e.parts) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (e.kind === "sparks") q.vy += 1.6 * dt;
    }
  }
  deaths = deaths.filter((e) => e.age < e.life);
}
function drawDeaths(g) {
  for (const e of deaths) {
    const p = project(e.x, e.y),
      h = fighterHeight(p.s),
      fade = Math.max(0, 1 - e.age / e.life);
    // The intact body fades out during the first quarter second.
    if (e.pose && e.age < 0.25) {
      const { fr, flip, tint } = e.pose,
        z = (h * 1.05) / sheetFrames[e.f.character].height;
      g.save();
      g.globalAlpha = 1 - e.age / 0.25;
      g.translate(p.x, p.y);
      g.scale(flip, 1);
      g.drawImage(tint ? sheetEnemyTint(fr.canvas) : fr.canvas, -fr.ax * z, -fr.ay * z, fr.canvas.width * z, fr.canvas.height * z);
      g.restore();
    }
    for (const q of e.parts) {
      g.save();
      if (e.kind === "smoke") {
        g.globalAlpha = fade * 0.4;
        g.fillStyle = ["#77736d", "#8c8984", "#555451"][q.tint];
        g.beginPath();
        g.arc(p.x + q.x * h, p.y + q.y * h, Math.max(0.5, q.size * h * (1 + e.age * 1.2)), 0, 7);
      } else {
        g.globalAlpha = fade;
        g.fillStyle = ["#ffe36b", "#ff9a2e", "#fff6c8"][q.tint];
        g.beginPath();
        g.arc(p.x + q.x * h, p.y + q.y * h, Math.max(0.5, q.size * h), 0, 7);
      }
      g.fill();
      g.restore();
    }
  }
}
// raw: physical damage before armor. Mana from damage taken follows TFT: 1% of the raw damage + 7% of the damage taken.
function hurt(f, raw, src) {
  if (f.hp <= 0) return;
  // Grain shots ignore part of the armor (Grain synergy).
  let d = raw * archetypeMultiplier(src, f) * (100 / (100 + f.stats.armor * (1 - (src?.pierce || 0))));
  if (time < FINAL_TIME) d *= 2;
  if (f.shield > 0) d /= 2;
  d = Math.max(1, Math.round(d));
  applyDamage(f, d, src);
  gainMana(f, Math.min(42.5, raw * 0.01 + d * 0.07));
  // Fruit synergy: the attacker heals by part of the damage it dealt.
  if (src?.lifesteal && src.hp > 0) src.hp = Math.min(src.max, src.hp + d * src.lifesteal);
}
function teamHealth(team) {
  return F.filter((f) => f.team === team).reduce((s, f) => s + Math.max(0, f.hp) / f.max, 0) / TEAM_SIZE;
}

// ---------- Attacks and abilities ----------
function attack(f, t, mult = 1, big = false) {
  if (!big) gainMana(f, 10);
  f.cast = 0.42;
  f.cool = 1 / f.stats.attackSpeed;
  f.pending = { to: t, mult, big, t: f.stats.range <= 1 ? 0.2 : 0.16 };
}
function releasePending(f, dt) {
  const p = f.pending;
  if (!p) return;
  p.t -= dt;
  if (p.t > 0) return;
  f.pending = null;
  if (f.hp <= 0 || p.to.hp <= 0) return;
  if (f.stats.range <= 1) {
    // Melee: the beet's whirl hits every enemy next to it, any other blow hits the target if it is still there.
    if (p.whirl) for (const q of alive(1 - f.team)) hexDist(f, q) <= 1 && hurt(q, f.stats.ad * p.mult, f);
    else if (hexDist(f, p.to) <= f.stats.range) {
      hurt(p.to, f.stats.ad * p.mult, f);
      // The zucchini's mace stuns: the target neither moves nor attacks for a moment.
      if (p.stun && p.to.hp > 0) p.to.stun = p.stun;
    }
    return;
  }
  // The shot leaves from the weapon in front of the body, not from its centre: otherwise a shot fired down the
  // board (toward the camera) seemed to come out of the shooter's back.
  const dx = p.to.x - f.x,
    dy = p.to.y - f.y,
    d = Math.hypot(dx, dy) || 1;
  shots.push({ x: f.x + (dx / d) * 0.45, y: f.y + (dy / d) * 0.45, to: p.to, from: f, kind: f.character, big: p.big, raw: f.stats.ad * p.mult, speed: f.character === "pepper" ? 6.8 : 11 });
}
// Full mana: the unit casts its ability instead of the next attack; mana starts again from zero.
function castAbility(f, t) {
  f.mana = 0;
  if (f.character === "tomato") {
    for (const q of alive(f.team)) if (hexDist(f, q) <= 2) q.shield = 4;
    f.cast = 0.42;
    f.cool = 1 / f.stats.attackSpeed;
    say(f, "Щит отряда");
    return;
  }
  if (f.character === "pepper") {
    attack(f, t, 2.4, true);
    say(f, "Огненный шар");
    return;
  }
  if (f.character === "zucchini") {
    attack(f, t, 2, true);
    f.pending.stun = 1.5;
    say(f, "Оглушающий удар");
    return;
  }
  if (f.character === "corn") {
    attack(f, t, 2.5, true);
    say(f, "Залп");
    return;
  }
  if (f.character === "beet") {
    attack(f, t, 1.6, true);
    f.pending.whirl = true;
    say(f, "Вихрь");
    return;
  }
  attack(f, t, 2.2, true);
  say(f, "Удар из тени");
}
function say(f, text) {
  floaters.push({ x: f.x, y: f.y, lift: 1.35, text, t: 1.2, color: "#fff4c2", size: 0.9 });
}

// ---------- Simulation ----------
function step(dt) {
  if (!running || result) return;
  time = Math.max(0, time - dt);
  for (const f of F) {
    if (f.hp <= 0) continue;
    f.cool -= dt;
    f.cast = Math.max(0, f.cast - dt);
    f.hit = Math.max(0, f.hit - dt);
    f.shield = Math.max(0, f.shield - dt);
    f.moving = false;
    releasePending(f, dt);
  }
  for (const f of F) {
    if (f.hp <= 0) continue;
    if (f.move) {
      stepMove(f, dt);
      continue;
    }
    if (f.stun > 0) {
      f.stun -= dt;
      continue;
    }
    const t = chooseTarget(f);
    if (!t) continue;
    if (inRange(f, t)) {
      if (f.cool <= 0 && f.cast <= 0 && !f.pending) f.mana >= f.stats.mana ? castAbility(f, t) : attack(f, t);
    } else if (f.cast <= 0) {
      const h = nextStep(f, t);
      if (h) startMove(f, h);
    }
  }
  updateShots(dt);
  for (const p of floaters) p.t -= dt;
  floaters = floaters.filter((p) => p.t > 0);
  for (const b of blasts) b.t -= dt;
  blasts = blasts.filter((b) => b.t > 0);
  if (!alive(0).length || !alive(1).length || time <= 0) finish();
}
function updateShots(dt) {
  for (const s of shots) {
    const dx = s.to.x - s.x,
      dy = s.to.y - s.y,
      d = Math.hypot(dx, dy),
      move = s.speed * dt;
    if (s.to.hp <= 0) {
      s.dead = true;
      continue;
    }
    if (d <= Math.max(BODY, move)) {
      s.dead = true;
      if (s.big && s.kind === "pepper") {
        blasts.push({ x: s.to.x, y: s.to.y, t: 0.45, life: 0.45, r: 1.2 });
        for (const q of alive(s.to.team)) if (q !== s.to && hexDist(q, s.to) <= 1) hurt(q, s.raw / 2, s.from);
      }
      hurt(s.to, s.raw, s.from);
      continue;
    }
    s.x += (dx / d) * move;
    s.y += (dy / d) * move;
  }
  shots = shots.filter((s) => !s.dead);
}
function finish() {
  running = false;
  const lead = teamHealth(0) - teamHealth(1),
    outcome = !alive(1).length && alive(0).length ? "win" : !alive(0).length && alive(1).length ? "loss" : lead > 0.02 ? "win" : lead < -0.02 ? "loss" : "draw";
  result = { outcome, lead };
  shots = [];
  if (typeof onBattleEnd === "function") onBattleEnd(result);
}
let onBattleEnd = null;

// ---------- Rendering ----------
const view = { W: 0, H: 0, cx: 0, y0: 0, y1: 0, cell: 1 };
// Perspective: the far edge of the board is narrower and its rows are shorter.
// On a phone the far edge narrows less, so the far rows also reach the sides of the screen.
const NEAR = 1;
let FAR = 0.74;
function depthScale(t) {
  return FAR + (NEAR - FAR) * t;
}
function project(x, y) {
  const t = Math.max(-0.2, Math.min(1.2, y / BOARD_D)),
    s = depthScale(t),
    // Screen depth grows with the scale so near rows are taller than far ones.
    k = (FAR * t + ((NEAR - FAR) * t * t) / 2) / ((FAR + NEAR) / 2);
  return { x: view.cx + (x - BOARD_W / 2) * view.cell * s, y: view.y0 + (view.y1 - view.y0) * k, s };
}
function unproject(px, py) {
  const Y = ((py - view.y0) / (view.y1 - view.y0)) * ((FAR + NEAR) / 2),
    a = (NEAR - FAR) / 2,
    t = a > 0 ? (-FAR + Math.sqrt(FAR * FAR + 4 * a * Y)) / (2 * a) : Y / FAR,
    s = depthScale(t);
  return { x: BOARD_W / 2 + (px - view.cx) / (view.cell * s), y: t * BOARD_D };
}
const PHONE_TILT = 0.85;
function layoutView(W, H, top, bottom) {
  view.W = W;
  view.H = H;
  if (FAR > 0.8) {
    // Phone board: full width, the rows were chosen to fill the height, the camera looks down steeply.
    // Normally full width; if the screen was turned during a battle, the deep board shrinks to fit the height.
    const cell = Math.min((W * 0.98) / BOARD_W, (H - top - bottom) / (BOARD_D * 0.62)),
      tilt = Math.min(1, (H - top - bottom) / (BOARD_D * cell));
    view.cell = cell;
    view.cx = W / 2;
    view.y0 = top;
    view.y1 = top + BOARD_D * tilt * cell;
    return;
  }
  const availH = H - top - bottom,
    // The board is seen at about 50° (depth on screen ~0.62 of its width); on a tall phone screen the camera
    // looks down more steeply so the board fills the height instead of leaving empty space.
    wide = (W * 0.98) / BOARD_W,
    tilt = Math.max(0.62, Math.min(1, (availH * 0.9) / (BOARD_D * wide))),
    cell = Math.max(1, Math.min(wide, (availH * 0.9) / (BOARD_D * tilt)));
  view.cell = cell;
  view.cx = W / 2;
  const boardH = BOARD_D * tilt * cell;
  view.y0 = top + (availH - boardH) * 0.55;
  view.y1 = view.y0 + boardH;
}

const sprites = { pepper: {}, tomato: {}, carrot: {}, beet: {}, corn: {}, zucchini: {} };
// Heroes drawn from one generated sheet (rows = directions, columns = poses); see sheet-sprites.js.
const sheetFrames = {};
let spritesReady = null;
function loadSprites() {
  spritesReady = Promise.all(
    CHARACTERS.map(async (id) => {
      const profile = characterProfiles[id] || (characterProfiles[id] = await (await fetch("/assets/characters/" + id + "/manifest.json")).json());
      if (profile.sheet) {
        sheetFrames[id] = await loadSheetFrames(id, profile);
        return;
      }
      // Only the front sprites, exactly as in the 3×3 battle.
      for (const viewName of ["front"])
        for (const [state, config] of Object.entries(profile.states))
          sprites[id][state + "/" + viewName] = config.files.map((file) => {
            const image = new Image();
            image.src = "/assets/characters/" + id + "/sprites/" + viewName + "/" + file;
            return image;
          });
    }),
  );
  return spritesReady;
}
function poseImage(f, viewName) {
  const state = f.cast > 0 ? "attack" : f.moving ? "walk" : "idle",
    frames = sprites[f.character][state + "/" + viewName] || sprites[f.character][state + "/front"] || [];
  if (!frames.length) return null;
  const index = state === "walk" ? Math.floor((f.walk % 1) * frames.length) : state === "attack" ? Math.min(frames.length - 1, Math.floor((1 - f.cast / 0.42) * frames.length)) : 0;
  return frames[index];
}
// On a narrow phone screen the hexes are small, so the fighters stand a bit taller than one hex.
function fighterHeight(s) {
  return view.cell * (view.W < 600 ? 1.15 : 1) * s;
}
function drawSheetFighter(g, f, p, frames) {
  const t = f.target && f.target.hp > 0 ? f.target : null,
    m = f.move,
    dx = m ? m.toX - m.fromX : t ? t.x - f.x : f.dirX ?? 0,
    dy = m ? m.toY - m.fromY : t ? t.y - f.y : f.dirY ?? (f.team ? 1 : -1),
    dir = steadyDirection(f, dx, dy);
  f.dirX = dx;
  f.dirY = dy;
  const state = f.cast > 0 ? "attack" : f.moving ? "walk" : "idle",
    list = frames[state + "/" + dir.row] || frames["idle/" + dir.row];
  if (!list?.length) return;
  const index = state === "walk" ? Math.floor((f.walk % 1) * list.length) : state === "attack" ? Math.min(list.length - 1, Math.floor((1 - f.cast / 0.42) * list.length)) : 0,
    fr = list[index],
    z = (fighterHeight(p.s) * 1.05) / frames.height;
  g.save();
  g.translate(p.x, p.y);
  g.scale(dir.flip, 1);
  if (f.hit) g.filter = "brightness(1.35)";
  if (!f.moving && f.cast <= 0) g.scale(1, 1 + 0.004 * Math.sin((performance.now() / 1000) * 2 + f.index));
  // Enemies are tinted purple: rings and health bars alone did not tell the teams apart in a crowd.
  g.drawImage(f.team === 1 ? sheetEnemyTint(fr.canvas) : fr.canvas, -fr.ax * z, -fr.ay * z, fr.canvas.width * z, fr.canvas.height * z);
  g.restore();
  // Remembered for the death effect.
  f.pose = { fr, flip: dir.flip, tint: f.team === 1 };
}
function drawGroundMarks(g, f, p) {
  g.save();
  g.globalAlpha = 0.35;
  g.fillStyle = "#000";
  g.beginPath();
  g.ellipse(p.x, p.y, radiusOf(f) * view.cell * p.s * 1.1, radiusOf(f) * view.cell * p.s * 0.45, 0, 0, 7);
  g.fill();
  // Only a shadow: the teams are told apart by the purple tint of the enemies.
  g.globalAlpha = 1;
  g.restore();
}
function drawFighter(g, f) {
  const p = project(f.x, f.y),
    profile = characterProfiles[f.character];
  if (!profile) return;
  if (sheetFrames[f.character]) {
    drawGroundMarks(g, f, p);
    drawSheetFighter(g, f, p, sheetFrames[f.character]);
    return;
  }
  const t = f.target && f.target.hp > 0 ? f.target : null,
    // The same front sprites as the 3×3 battle; they only turn left or right toward the target.
    image = poseImage(f, "front");
  if (!image || !image.complete || !image.naturalWidth) return;
  const h = fighterHeight(p.s) * (profile.scale || 1),
    z = h / profile.visualHeight,
    // Same placement as drawMixedFighter in combat-mix.js.
    drawH = profile.canvas.height * z,
    drawW = Math.max(profile.canvas.width, image.naturalWidth) * z,
    ax = profile.anchor.x * z,
    ay = profile.anchor.y * z,
    dirX = t ? Math.sign(t.x - f.x) || f.facing || 1 : f.facing || (f.index % 2 ? -1 : 1),
    // Pepper and carrot sprites face right, the tomato faces left.
    flip = dirX * (f.character === "tomato" ? -1 : 1);
  f.facing = dirX;
  g.save();
  g.globalAlpha = 0.35;
  g.fillStyle = "#000";
  g.beginPath();
  g.ellipse(p.x, p.y, radiusOf(f) * view.cell * p.s * 1.1, radiusOf(f) * view.cell * p.s * 0.45, 0, 0, 7);
  g.fill();
  // Only a shadow: the teams are told apart by the purple tint of the enemies.
  g.globalAlpha = 1;
  g.translate(p.x, p.y);
  g.scale(flip, 1);
  if (f.hit) g.filter = "brightness(1.35)";
  // The same small motions as in the 3×3 battle: carrot lunge, tomato recoil, idle breathing.
  const k = h / 300;
  if (f.character === "carrot" && f.cast > 0) {
    const phase = Math.sin((1 - f.cast / 0.42) * Math.PI);
    g.translate(phase * 8 * k, -phase * k);
    g.rotate(phase * 0.04);
  }
  if (f.character === "tomato" && f.cast > 0) g.translate(Math.sin((1 - f.cast / 0.42) * Math.PI) * 6 * k, 0);
  if (!f.moving && f.cast <= 0) g.scale(1, 1 + 0.004 * Math.sin((performance.now() / 1000) * 2 + f.index));
  const img = image;
  g.drawImage(img, -ax, -ay, drawW, drawH);
  g.restore();
}
function drawHealth(g, f) {
  const p = project(f.x, f.y),
    w = view.cell * 0.6 * p.s,
    h = Math.max(4, view.cell * 0.07),
    y = p.y - fighterHeight(p.s) * ((characterProfiles[f.character]?.scale || 1) * 1.02) - h;
  g.fillStyle = "#000b";
  g.fillRect(p.x - w / 2 - 1, y - 1, w + 2, h + 2);
  g.fillStyle = TEAM_COLORS[f.team];
  g.fillRect(p.x - w / 2, y, w * (f.hp / f.max), h);
  // Mana bar under the health bar, as in TFT: when it is full the unit casts its ability.
  const mh = Math.max(3, h * 0.6);
  g.fillStyle = "#000b";
  g.fillRect(p.x - w / 2 - 1, y + h + 1, w + 2, mh + 1);
  g.fillStyle = "#4fb6ff";
  g.fillRect(p.x - w / 2, y + h + 1.5, w * (f.mana / f.stats.mana), mh);
  if (f.shield > 0) {
    g.strokeStyle = "#ffd65a";
    g.lineWidth = 2;
    g.strokeRect(p.x - w / 2 - 2, y - 2, w + 4, h + mh + 5);
  }
}
function hexPath(g, col, row, inset = 0.94) {
  const c = hexCenter(col, row);
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3,
      q = project(c.x + Math.cos(a) * HEX * inset, c.y + Math.sin(a) * HEX * inset);
    i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y);
  }
  g.closePath();
}
// The ground is the garden arena of the 3×3 battle.
const arenaImage = typeof Image === "function" ? Object.assign(new Image(), { src: "/assets/shared/backgrounds/garden-arena.png" }) : null;
function drawBoard(g, dragHex) {
  const { W, H } = view;
  g.fillStyle = "#3b2a17";
  g.fillRect(0, 0, W, H);
  if (arenaImage?.complete && arenaImage.naturalWidth) {
    // Only the open ground: the picture is enlarged and shifted up so the fence and the houses at its top stay
    // above the screen and nobody walks over the fence. The point at 62% of the picture's height is the screen centre.
    const zoom = 1.6,
      k = Math.max(W / arenaImage.naturalWidth, H / arenaImage.naturalHeight) * zoom,
      w = arenaImage.naturalWidth * k,
      h = arenaImage.naturalHeight * k;
    g.drawImage(arenaImage, (W - w) / 2, Math.min(0, Math.max(H - h, H / 2 - h * 0.62)), w, h);
  }
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++) {
      hexPath(g, col, row);
      const mine = row >= ROWS_PER_SIDE;
      g.fillStyle = mine ? (!battleStarted ? "#9be08a33" : "#9be08a14") : "#ff8a7a14";
      if (dragHex && dragHex.col === col && dragHex.row === row) g.fillStyle = "#ffe36b88";
      g.fill();
      g.strokeStyle = "#fff4d266";
      g.lineWidth = Math.max(1, view.cell * 0.025);
      g.stroke();
    }
}
function drawShots(g) {
  for (const s of shots) {
    const p = project(s.x, s.y),
      y = p.y - fighterHeight(p.s) * 0.55;
    if (s.kind === "corn") {
      // A corn kernel: small yellow oval.
      g.fillStyle = "#ffd23a";
      g.strokeStyle = "#b8860b";
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(p.x, y, view.cell * (s.big ? 0.11 : 0.07) * p.s, view.cell * (s.big ? 0.08 : 0.05) * p.s, 0, 0, 7);
      g.fill();
      g.stroke();
    } else if (s.kind === "tomato") {
      g.fillStyle = "#e3241a";
      g.beginPath();
      g.arc(p.x, y, view.cell * 0.09 * p.s, 0, 7);
      g.fill();
      g.fillStyle = "#3f8a22";
      g.beginPath();
      g.arc(p.x, y - view.cell * 0.07 * p.s, view.cell * 0.035 * p.s, 0, 7);
      g.fill();
    } else {
      const r = view.cell * (s.big ? 0.2 : 0.1) * p.s,
        q = g.createRadialGradient(p.x, y, 0, p.x, y, r * 2);
      q.addColorStop(0, "#fffde0");
      q.addColorStop(0.35, "#ffb52e");
      q.addColorStop(1, "#ff3c0800");
      g.fillStyle = q;
      g.beginPath();
      g.arc(p.x, y, r * 2, 0, 7);
      g.fill();
    }
  }
  for (const b of blasts) {
    const p = project(b.x, b.y),
      a = b.t / b.life;
    g.strokeStyle = `rgba(255,120,30,${(0.9 * a).toFixed(2)})`;
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(p.x, p.y, b.r * view.cell * p.s * (1.2 - a * 0.2), b.r * view.cell * p.s * 0.55, 0, 0, 7);
    g.stroke();
  }
}
function drawFloaters(g) {
  g.textAlign = "center";
  for (const f of floaters) {
    const p = project(f.x, f.y),
      rise = (0.8 - Math.min(0.8, f.t)) * view.cell * 0.6;
    g.globalAlpha = Math.min(1, f.t / 0.5);
    g.font = `900 ${Math.round(view.cell * 0.22 * (f.size || 1))}px system-ui`;
    g.lineWidth = 3;
    g.strokeStyle = "#000b";
    const y = p.y - fighterHeight(p.s) * (f.lift || 1.15) - rise;
    g.strokeText(f.text, p.x, y);
    g.fillStyle = f.color;
    g.fillText(f.text, p.x, y);
  }
  g.globalAlpha = 1;
}
function render(g, dragHex) {
  drawBoard(g, dragHex);
  const live = F.filter((f) => f.hp > 0).sort((a, b) => a.y - b.y);
  for (const f of live) drawFighter(g, f);
  drawDeaths(g);
  drawShots(g);
  for (const f of live) drawHealth(g, f);
  drawFloaters(g);
}

// ---------- Page ----------
function formatTime(t) {
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
}
function initPage() {
  const canvas = document.querySelector("#cv");
  if (!canvas) return;
  // A tall phone screen: 6 columns and as many rows as fit the height (the board fills the screen to the edges);
  // a wide screen: the TFT board, 7 × 4 per side. Chosen again when the phone is turned, while nobody fights yet.
  function boardFor(w, h) {
    if (h <= w * 1.3) return { cols: 7, rows: 4, far: 0.74 };
    const cell = (w * 0.98) / 6.5,
      depth = (h - cell * 0.9 - 10) / (cell * PHONE_TILT),
      rows = Math.floor((depth - 2 * HEX) / ROW_STEP) + 1;
    return { cols: 6, rows: Math.max(4, Math.min(7, Math.floor(rows / 2))), far: 0.88 };
  }
  function useBoard(b) {
    FAR = b.far;
    setBoard(b.cols, b.rows);
  }
  const box0 = canvas.getBoundingClientRect();
  useBoard(boardFor(box0.width, box0.height));
  const g = canvas.getContext("2d"),
    $ = (s) => document.querySelector(s),
    dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  let drag = null;
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (r.width < 50 || r.height < 50) return;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The phone was turned before the battle: take the board that fits the new shape and set the squads again.
    const b = boardFor(r.width, r.height);
    if (!battleStarted && F.length && (b.cols !== COLS || b.rows !== ROWS_PER_SIDE)) {
      useBoard(b);
      newBattle(false);
      renderSlots();
    }
    // Room above the board for the far row, whose bodies stand up over its edge.
    layoutView(r.width, r.height, FAR > 0.8 ? ((r.width * 0.98) / BOARD_W) * 0.9 : r.height * 0.13, 10);
  }
  // The player's synergies: active ones lit, the others show how many different heroes are still missing.
  function renderTraits() {
    const box = $("#traits");
    if (!box) return;
    const t = teamTraits(F.filter((f) => f.team === 0).map((f) => f.character));
    const mine = new Set(F.filter((f) => f.team === 0).map((f) => f.character));
    // A strip above the board, apart from the hero buttons: each synergy in words, with who is missing.
    box.innerHTML =
      "<b>Синергии отряда</b>" +
      Object.entries(TRAITS)
        .map(([id, tr]) => `<button class="chip ${t[id].tier ? "on" : ""}" data-trait="${id}">${tr.icon} <b>${tr.name} ${t[id].count}/${tr.tiers[tr.tiers.length - 1]}</b>: ${traitStatus(id, mine)}</button>`)
        .join("");
    box.querySelectorAll(".chip").forEach((b) => (b.onclick = () => showTrait(b.dataset.trait, mine)));
  }
  // A small card over the field: a synergy or a hero; a tap anywhere on it closes it.
  function showCard(html) {
    const card = $("#info");
    card.innerHTML = html + '<div class="close">нажмите, чтобы закрыть</div>';
    card.hidden = false;
    card.onclick = () => (card.hidden = true);
  }
  // "включено", "нужен кабачок", "нужны морковь и свёкла", or "пока недоступно" when the game has too few heroes of the group.
  const FEMININE = new Set(["carrot", "beet", "corn"]);
  function traitStatus(id, mine) {
    const tr = TRAITS[id],
      members = CHARACTERS.filter((c) => HERO_TAGS[c]?.includes(id)),
      missing = members.filter((c) => !mine.has(c)),
      count = members.length - missing.length,
      tier = tr.tiers.filter((n) => count >= n).length,
      next = tr.tiers[tier],
      names = (list) => list.map((c) => TFT_NAMES[c].toLowerCase()).join(" и ");
    if (next === undefined) return "включено";
    if (members.length < next) return tier ? "включено" : "пока недоступно: в игре мало таких героев";
    const need = missing.slice(0, next - count),
      word = need.length > 1 ? "нужны" : FEMININE.has(need[0]) ? "нужна" : "нужен",
      text = `${word} ${names(need)}${missing.length > need.length ? " (или другой из группы)" : ""}`;
    return tier ? `включено; для ${next} ${text}` : text;
  }
  function traitLine(id, count) {
    const tr = TRAITS[id],
      tiers = tr.tiers.join(" или ");
    return `${tr.icon} <b>${tr.name}</b> ${count}/${tr.tiers[tr.tiers.length - 1]} — нужно ${tiers} разных: ${tr.text}`;
  }
  function showTrait(id, mine) {
    const members = CHARACTERS.filter((c) => HERO_TAGS[c]?.includes(id)),
      count = members.filter((c) => mine.has(c)).length;
    showCard(
      `<h3>${TRAITS[id].icon} ${TRAITS[id].name}</h3><p>${traitLine(id, count)}</p><p>Герои группы: ${members
        .map((c) => (mine.has(c) ? `<b>${TFT_NAMES[c]} ✓</b>` : TFT_NAMES[c]))
        .join(", ")}</p>`,
    );
  }
  function showHero(f) {
    const st = TFT_SPECS[f.character],
      mine = new Set(F.filter((q) => q.team === f.team).map((q) => q.character)),
      t = teamTraits([...mine]),
      has = (id) => HERO_TAGS[f.character]?.includes(id),
      // What the active synergies add to this hero, shown next to the base value (applied when the battle starts).
      plus = (on, text) => (on ? ` <span class="bonus">${text}</span>` : ""),
      hp = Math.round(st.max * (t.root.tier && has("root") ? 1.25 : 1));
    showCard(
      `<h3>${f.team ? "Соперник: " : ""}${TFT_NAMES[f.character]} · ${st.role}</h3>` +
        `<p>❤️ здоровье ${hp}${plus(t.root.tier && has("root"), "(+25% Корнеплоды)")} · ⚔️ урон ${st.ad} · 🕑 ударов в секунду ${
          Math.round(st.attackSpeed * (t.fighter.tier && has("fighter") ? 1.3 : 1) * 100) / 100
        }${plus(t.fighter.tier && has("fighter"), "(+30% Бойцы)")}</p>` +
        `<p>🛡 броня ${st.armor + (t.guard.tier ? 20 : 0)}${plus(t.guard.tier, "(+20 Стражи)")} · 🎯 дальность ${st.range + (t.shooter.tier && has("shooter") ? 1 : 0)} кл.${plus(
          t.shooter.tier && has("shooter"),
          "(+1 Стрелки)",
        )}${t.fruit.tier && has("fruit") ? ` · 🩹 лечение ${t.fruit.tier >= 2 ? 30 : 15}% урона <span class="bonus">(Плоды)</span>` : ""}</p>` +
        `<p><b>Умение</b> (когда полна синяя полоска маны): ${TFT_ABILITIES[f.character]}</p>` +
        `<p><b>Синергии</b>${f.team ? " его отряда" : ""}:</p>` +
        (HERO_TAGS[f.character] || []).map((id) => `<p class="${t[id].tier ? "on" : ""}">${traitLine(id, t[id].count)}</p>`).join(""),
    );
  }
  function renderSlots() {
    renderTraits();
    $("#slots").innerHTML = lineup
      .map((c, i) => {
        // The cut-out idle frame facing the camera (no white sheet background); the old front sprite until it loads.
        const frame = sheetFrames[c]?.["idle/front"]?.[0],
          pic = `<img src="${frame ? (frame.url ||= frame.canvas.toDataURL()) : `/assets/characters/${c}/sprites/front/idle.png`}" alt="">`;
        // The hero's two synergy tags as icons, so the lineup can be built toward a synergy.
        const tags = (HERO_TAGS[c] || []).map((id) => `<i title="${TRAITS[id].name}">${TRAITS[id].icon}</i>`).join("");
        return `<button class="slot" data-i="${i}" ${battleStarted ? "disabled" : ""}><span class="tags">${tags}</span>${pic}<span>${TFT_NAMES[c]}</span></button>`;
      })
      .join("");
    // A tap on a hero button opens the squad picker.
    document.querySelectorAll(".slot").forEach((b) => (b.onclick = openPicker));
  }
  // ---------- Squad picker: a screen before the board to choose the six heroes and read about each in large type ----------
  let draft = [...lineup];
  function portraitUrl(c) {
    const frame = sheetFrames[c]?.["idle/front"]?.[0];
    return frame ? (frame.url ||= frame.canvas.toDataURL()) : `/assets/characters/${c}/sprites/front/idle.png`;
  }
  function renderPicker() {
    const box = $("#picker");
    if (!box || box.hidden) return;
    const chosen = draft.filter(Boolean),
      mine = new Set(chosen),
      t = teamTraits(chosen),
      full = chosen.length === TEAM_SIZE;
    const squad = Array.from({ length: TEAM_SIZE }, (_, i) =>
      draft[i]
        ? `<button class="pick-slot" data-i="${i}"><img src="${portraitUrl(draft[i])}" alt=""><span>${TFT_NAMES[draft[i]]}</span><small>убрать ✕</small></button>`
        : `<button class="pick-slot empty" data-i="${i}">пусто</button>`,
    ).join("");
    const traits = Object.entries(TRAITS)
      .map(
        ([id, tr]) =>
          `<div class="${t[id].tier ? "on" : ""}">${tr.icon} <b>${tr.name} ${t[id].count}/${tr.tiers[tr.tiers.length - 1]}</b>: ${traitStatus(id, mine)}<br><small>даёт: ${tr.text}</small></div>`,
      )
      .join("");
    const cards = CHARACTERS.map((c) => {
      const st = TFT_SPECS[c],
        // For each group of the hero: who else is in it and what the group gives, so the bonus is known in advance.
        tags = (HERO_TAGS[c] || [])
          .map((id) => {
            const others = CHARACTERS.filter((o) => o !== c && HERO_TAGS[o]?.includes(id)).map((o) => TFT_NAMES[o].toLowerCase());
            return `${TRAITS[id].icon} <b>${TRAITS[id].name}</b>${others.length ? " (вместе с: " + others.join(", ") + ")" : " (других героев группы пока нет)"} — ${TRAITS[id].text}`;
          })
          .join("<br>");
      return `<button class="hero-card ${mine.has(c) ? "in" : ""}" data-c="${c}"><img src="${portraitUrl(c)}" alt=""><div>
        <h4>${TFT_NAMES[c]} <span>${st.role}</span></h4><p class="tags">${tags}</p>
        <p>❤️ здоровье ${st.max} · ⚔️ урон ${st.ad} · 🛡 броня ${st.armor} · 🎯 дальность ${st.range} кл.</p>
        <p><b>Умение</b> (при полной мане): ${TFT_ABILITIES[c]}</p>
        <p class="add">${full ? "отряд полон — уберите героя сверху" : mine.has(c) ? "+ ещё один" : "+ добавить в отряд"}</p></div></button>`;
    }).join("");
    box.innerHTML = `<h2>Выбор отряда</h2>
      <p class="goal"><b>Цель:</b> уничтожить отряд соперника. После старта бой идёт сам — побеждают состав и расстановка.
      Разные герои одной группы включают синергии: 🛡️ стражи держат фронт, 🏹 стрелки бьют издалека, ⚔️ бойцы бегут в тыл.
      Двое одинаковых героев — это двойная сила самих героев, но в синергии такой герой считается один раз.</p>
      <div class="pick-squad">${squad}</div><div class="pick-traits">${traits}</div><div class="pick-heroes">${cards}</div>
      <div class="pick-go"><button id="pickGo" ${full ? "" : "disabled"}>${full ? "К расстановке →" : "Выберите ещё " + (TEAM_SIZE - chosen.length)}</button></div>`;
    box.querySelectorAll(".pick-slot").forEach((b) => (b.onclick = () => ((draft[+b.dataset.i] = null), renderPicker())));
    box.querySelectorAll(".hero-card").forEach(
      (b) =>
        (b.onclick = () => {
          const i = draft.findIndex((x) => !x);
          if (i >= 0) (draft[i] = b.dataset.c), renderPicker();
        }),
    );
    $("#pickGo").onclick = () => {
      if (!full) return;
      lineup = [...draft];
      newBattle(false);
      $("#result").hidden = true;
      box.hidden = true;
      renderSlots();
    };
  }
  function openPicker() {
    if (battleStarted && !result) return;
    draft = [...lineup];
    $("#picker").hidden = false;
    renderPicker();
  }
  function hud() {
    $("#timer").textContent = formatTime(time);
    $("#timer").style.color = battleStarted && time < FINAL_TIME ? "#ff5a3c" : "";
    $("#hp0").style.width = 100 * teamHealth(0) + "%";
    $("#hp1").style.width = 100 * teamHealth(1) + "%";
    $("#energy").textContent = battleStarted && time < FINAL_TIME ? "Овертайм: урон ×2" : "";
    $("#start").textContent = !battleStarted ? "Начать бой" : result ? "Новый бой" : running ? "Пауза" : "Продолжить";
    $("#hint").hidden = battleStarted;
    // The synergy strip helps to build the squad; in the battle it only takes room from the board.
    $("#traits").hidden = battleStarted;
  }
  onBattleEnd = (r) => {
    $("#result").hidden = false;
    $("#resultText").textContent = r.outcome === "win" ? "Победа!" : r.outcome === "loss" ? "Поражение" : "Ничья";
    $("#resultDetail").textContent = `Живы: ваши ${alive(0).length} из ${TEAM_SIZE}, соперник ${alive(1).length} из ${TEAM_SIZE}`;
  };
  $("#start").onclick = () => {
    if (!battleStarted) startBattle();
    else if (result) {
      newBattle(true);
      $("#result").hidden = true;
    } else running = !running;
    renderSlots();
  };
  $("#reset").onclick = () => {
    newBattle(false);
    $("#result").hidden = true;
    renderSlots();
  };
  $("#speed").onclick = () => {
    rate = rate === 1 ? 2 : 1;
    $("#speed").textContent = "×" + rate;
  };
  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  let press = null;
  canvas.addEventListener("pointerdown", (e) => {
    const m = point(e);
    // Pick the fighter whose body is under the pointer (nearest to the camera first). A tap shows its card;
    // before the battle the player's own fighters can also be dragged.
    const hit = F.filter((f) => f.hp > 0)
      .sort((a, b) => b.y - a.y)
      .find((f) => {
        const p = project(f.x, f.y),
          h = fighterHeight(p.s);
        return Math.abs(m.x - p.x) < h * 0.35 && m.y < p.y + h * 0.15 && m.y > p.y - h;
      });
    if (!hit) return;
    press = { f: hit, x: m.x, y: m.y, moved: false };
    if (battleStarted || hit.team !== 0) return;
    const p = project(hit.x, hit.y);
    drag = { f: hit, dx: p.x - m.x, dy: p.y - m.y, from: { col: hit.col, row: hit.row } };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (press && Math.hypot(point(e).x - press.x, point(e).y - press.y) > 8) press.moved = true;
    if (!drag) return;
    const m = point(e),
      q = unproject(m.x + drag.dx, m.y + drag.dy);
    drag.f.x = Math.max(0, Math.min(BOARD_W, q.x));
    drag.f.y = Math.max(0, Math.min(BOARD_D, q.y));
  });
  canvas.addEventListener("pointerup", () => {
    const tap = press && !press.moved ? press.f : null;
    press = null;
    if (tap) {
      // A tap without moving: put the fighter back on its hex and show its card.
      if (drag) placeOnHex(drag.f, drag.from.col, drag.from.row);
      drag = null;
      showHero(tap);
      return;
    }
    if (!drag) return;
    const f = drag.f,
      spot = hexAt(f.x, f.y),
      own = ownRows(0).includes(spot.row),
      other = own && F.find((q) => q !== f && q.team === 0 && q.col === spot.col && q.row === spot.row);
    if (!own) placeOnHex(f, drag.from.col, drag.from.row);
    else {
      // Dropping on a mate swaps the two.
      if (other) placeOnHex(other, drag.from.col, drag.from.row);
      placeOnHex(f, spot.col, spot.row);
    }
    drag = null;
  });
  addEventListener("resize", resize);
  resize();
  newBattle(false);
  renderSlots();
  // Slot pictures come from the sheets, which are known once the manifests are loaded.
  loadSprites().then(() => {
    renderSlots();
    renderPicker();
  });
  // The page starts on the squad picker.
  if ($("#team")) $("#team").onclick = openPicker;
  openPicker();
  let last = performance.now(),
    acc = 0;
  function frame(now) {
    // The layout may settle after the first frame (iframe, fonts): follow the canvas size.
    const box = canvas.getBoundingClientRect();
    if (Math.round(box.width) !== Math.round(view.W) || Math.round(box.height) !== Math.round(view.H)) resize();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt * rate;
    while (acc >= 1 / 60) {
      step(1 / 60);
      acc -= 1 / 60;
    }
    // Death effects play on even when the battle has just ended.
    stepDeaths(dt * rate);
    const dragHex = drag && ownRows(0).includes(hexAt(drag.f.x, drag.f.y).row) ? hexAt(drag.f.x, drag.f.y) : null;
    render(g, dragHex);
    hud();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
if (typeof document !== "undefined" && document.querySelector?.("#cv")) initPage();
