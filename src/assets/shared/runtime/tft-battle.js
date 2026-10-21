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
  pepper: { role: "Стрелок", max: 690, ad: 78, attackSpeed: 0.75, armor: 20, range: 4, step: 0.6, manaStart: 20, mana: 70 },
  carrot: { role: "Ассасин", max: 720, ad: 80, attackSpeed: 0.95, armor: 30, range: 1, step: 0.45, manaStart: 0, mana: 60 },
  corn: { role: "Пушкарь", max: 720, ad: 74, attackSpeed: 0.8, armor: 30, range: 3, step: 0.6, manaStart: 20, mana: 70 },
  zucchini: { role: "Страж", max: 1000, ad: 58, attackSpeed: 0.65, armor: 60, range: 1, step: 0.65, manaStart: 20, mana: 90 },
  beet: { role: "Воин", max: 820, ad: 64, attackSpeed: 0.75, armor: 40, range: 1, step: 0.55, manaStart: 0, mana: 70 },
  potato: { role: "Рыцарь", max: 880, ad: 60, attackSpeed: 0.6, armor: 60, range: 1, step: 0.7, manaStart: 0, mana: 80 },
  walnut: { role: "Страж", max: 1000, ad: 56, attackSpeed: 0.6, armor: 70, range: 1, step: 0.75, manaStart: 30, mana: 90 },
  peach: { role: "Воин", max: 720, ad: 70, attackSpeed: 0.8, armor: 35, range: 1, step: 0.5, manaStart: 0, mana: 60 },
  onion: { role: "Лучник", max: 580, ad: 74, attackSpeed: 0.85, armor: 20, range: 4, step: 0.6, manaStart: 20, mana: 70 },
  eggplant: { role: "Маг", max: 700, ad: 80, attackSpeed: 0.7, armor: 20, range: 4, step: 0.6, manaStart: 20, mana: 70 },
  cucumber: { role: "Берсерк", max: 760, ad: 60, attackSpeed: 0.8, armor: 40, range: 1, step: 0.55, manaStart: 0, mana: 70 },
};
const TFT_ABILITIES = {
  tomato: "Щит отряда: союзники в 2 клетках 4 с получают половину урона",
  pepper: "Огненный шар: 2,4× урона по цели и половина этого врагам рядом",
  carrot: "Удар из тени: 2,8× урона по цели",
  beet: "Вихрь: 1,6× урона всем врагам в соседних клетках",
  corn: "Залп: выстрел из кукурузной пушки на 2,5× урона",
  zucchini: "Оглушающий удар: 2× урона булавой, цель 1,5 с не действует",
  potato: "Крепость: 4 с получает половину урона и восстанавливает 10% здоровья",
  walnut: "Скорлупа: себе и союзникам в соседних клетках 4 с половину урона",
  peach: "Сладкий сок: лечит себя и союзников в соседних клетках на 70",
  onion: "Залп стрел: 1,6× урона по цели и стрела каждому из двух ближайших к ней врагов",
  eggplant: "Тёмная сфера: 2,4× урона по цели, цель 1,5 с не действует",
  cucumber: "Колючая ярость: 1,8× урона дубиной, потом 4 с атакует на 50% чаще",
};
const TFT_NAMES = {
  pepper: "Перец",
  tomato: "Помидор",
  carrot: "Морковь",
  beet: "Свёкла",
  corn: "Кукуруза",
  zucchini: "Кабачок",
  potato: "Картофель",
  walnut: "Орех",
  peach: "Персик",
  onion: "Лук",
  eggplant: "Баклажан",
  cucumber: "Огурец",
};
const TFT_ARCHETYPES = { tomato: "wall", pepper: "sniper", carrot: "assassin" };
const TFT_BONUS = { wall: { sniper: 0.82, assassin: 1.35 }, sniper: { wall: 1.35, assassin: 0.82 }, assassin: { sniper: 1.35, wall: 0.82 } };
// Heroes without an archetype are neutral in the counter triangle (×1 both ways).
const CHARACTERS = ["pepper", "tomato", "carrot", "beet", "corn", "zucchini", "potato", "walnut", "peach", "onion", "eggplant", "cucumber"];

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
  impacts = [],
  trails = [],
  time = BATTLE_TIME,
  battleStarted = false,
  running = false,
  result = null,
  rate = 1.5; // the game runs one and a half times faster than real time
// The starting squad has all six heroes, so a new player sees every synergy switched on.
let lineup = ["tomato", "zucchini", "carrot", "beet", "pepper", "corn"];
// A match is MATCH_ROUNDS battles against one opponent; before every round after the first each side may replace up
// to MATCH_SWAPS heroes.
const MATCH_ROUNDS = 3,
  MATCH_SWAPS = 2;
// Sound cues of the battle (battle-sfx.js on the page); silent where there is no page, as in the tests.
const sfx = (name, opts) => globalThis.BattleSfx?.play(name, opts);

function makeFighter(team, character, index) {
  const stats = { ...TFT_SPECS[character] };
  return { team, character, index, stats, hp: stats.max, max: stats.max, mana: stats.manaStart, x: 0, y: 0, col: 0, row: 0, target: null, cool: 0, cast: 0, hit: 0, walk: 0, moving: false, move: null, hunt: null, pending: null, shield: 0, rage: 0, dealt: 0 };
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
    // Shooters stand at the back, everyone else in front.
    const rows = HERO_TAGS[c]?.includes("shooter") ? back : front;
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
// A random enemy squad that has at least 3 synergies switched on, so it plays like a thought-out squad.
function enemyLineup() {
  let best = null;
  for (let tries = 0; tries < 200; tries++) {
    const pick = Array.from({ length: TEAM_SIZE }, () => CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]),
      on = Object.values(teamTraits(pick)).filter((t) => t.tier).length;
    if (on >= 3) return pick;
    if (!best || on > best.on) best = { pick, on };
  }
  return best.pick;
}
// Between two rounds both sides keep the spots their heroes stood on (keepSpots); a new enemy hero takes the old one's.
function newBattle(keepSpots, enemy = enemyLineup()) {
  const spotsOf = (team) => F.filter((f) => f.team === team).map((f) => ({ col: f.homeCol ?? f.col, row: f.homeRow ?? f.row })),
    old = keepSpots ? spotsOf(0) : null,
    oldTheirs = keepSpots ? spotsOf(1) : null;
  F = [];
  const mine = old || defaultSpots(0, lineup),
    theirs = oldTheirs?.length === enemy.length ? oldTheirs : defaultSpots(1, enemy);
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
  impacts = [];
  trails = [];
  deaths = [];
  time = BATTLE_TIME;
  battleStarted = false;
  running = false;
  result = null;
}
// The enemy after a lost round: up to MATCH_SWAPS heroes replaced, keeping the squad with the most synergies on.
function enemyAdjust(enemy) {
  const on = (pick) => Object.values(teamTraits(pick)).filter((t) => t.tier).length;
  let best = enemy;
  for (let tries = 0; tries < 200; tries++) {
    const pick = [...enemy];
    for (let n = 0; n < MATCH_SWAPS; n++) pick[Math.floor(Math.random() * TEAM_SIZE)] = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    if (pick.some((c, i) => c !== enemy[i]) && (best === enemy || on(pick) > on(best))) best = pick;
  }
  return best;
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
  // The new five: the potato and the onion grow under the ground, the peach and the eggplant are fruits, the walnut is a seed.
  potato: ["guard", "root"],
  walnut: ["guard", "grain"],
  peach: ["fighter", "fruit"],
  onion: ["shooter", "root"],
  eggplant: ["shooter", "fruit"],
  // The cucumber is botanically a fruit, like the zucchini.
  cucumber: ["fighter", "fruit"],
};
// Drawn group badges instead of emoji: a round coloured token with a simple sign, the same on every phone.
// Their size comes from the page CSS (.ti), so buttons, cards and lists can show them at different sizes.
const badge = (bg, rim, sign) =>
  `<svg class="ti" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="${bg}" stroke="${rim}" stroke-width="2"/>${sign}</svg>`;
const TRAIT_ICONS = {
  guard: badge("#2f6fb3", "#bfe0ff", '<path d="M16 6l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V9z" fill="#e8f3ff" stroke="#16406b" stroke-width="1.5"/>'),
  shooter: badge(
    "#7a4a1d",
    "#f3c98b",
    '<path d="M10 7c9 3 12 9 9 18" fill="none" stroke="#f3e2c0" stroke-width="2.2"/><path d="M10 7l9 18" stroke="#c9b08a" stroke-width="1"/><path d="M8 24L23 9" stroke="#fff" stroke-width="2"/><path d="M23 9l-5 1 4 4z" fill="#fff"/>',
  ),
  fighter: badge(
    "#7b2b2b",
    "#ffb0a0",
    '<path d="M9 9l14 14M23 9L9 23" stroke="#eef2f6" stroke-width="3" stroke-linecap="round"/><path d="M8 20l4 4M24 20l-4 4" stroke="#d9a441" stroke-width="3" stroke-linecap="round"/>',
  ),
  fruit: badge("#3d6b25", "#c8f0a0", '<circle cx="16" cy="18" r="8" fill="#e8322a"/><path d="M16 10c0-3 2-4 4-4-1 2-2 3-4 4z" fill="#7bd14a"/><circle cx="13" cy="15" r="2" fill="#ff9a8a"/>'),
  root: badge("#5a3a1e", "#ffc27a", '<path d="M11 12l10 0-5 15z" fill="#f08a1c"/><path d="M16 12c-2-4-5-5-6-5 2 2 3 3 5 5M16 12c2-4 5-5 6-5-2 2-3 3-5 5M16 12v-6" stroke="#6fc23a" stroke-width="2" fill="none"/>'),
  grain: badge("#6b5a16", "#ffe27a", '<path d="M16 27V9" stroke="#e6c04a" stroke-width="1.6"/><g fill="#ffd34a"><ellipse cx="13" cy="12" rx="2.4" ry="3.6"/><ellipse cx="19" cy="12" rx="2.4" ry="3.6"/><ellipse cx="13" cy="18" rx="2.4" ry="3.6"/><ellipse cx="19" cy="18" rx="2.4" ry="3.6"/><ellipse cx="16" cy="7" rx="2.2" ry="3.2"/></g>'),
};
const TRAITS = {
  guard: { icon: TRAIT_ICONS.guard, name: "Стражи", tiers: [2, 4], text: "все союзники +12 брони, при 4 — +24" },
  shooter: { icon: TRAIT_ICONS.shooter, name: "Стрелки", tiers: [2, 4], text: "стрелки бьют на 10% сильнее, при 4 — на 30%" },
  fighter: { icon: TRAIT_ICONS.fighter, name: "Бойцы", tiers: [2, 3], text: "бойцы атакуют на 25% чаще, при 3 — на 45%" },
  fruit: { icon: TRAIT_ICONS.fruit, name: "Плоды", tiers: [2, 4], text: "плоды лечатся на 15% нанесённого урона, при 4 — на 30%" },
  root: { icon: TRAIT_ICONS.root, name: "Корнеплоды", tiers: [2, 4], text: "корнеплоды +15% здоровья, при 4 — +30%" },
  grain: { icon: TRAIT_ICONS.grain, name: "Зёрна", tiers: [2], text: "зёрна пробивают половину брони" },
};
// The icon is read at drawing time: the painted badges replace the vector ones once their picture is loaded.
for (const id of Object.keys(TRAITS)) Object.defineProperty(TRAITS[id], "icon", { get: () => TRAIT_ICONS[id] });
// Painted badges: one row of 112 px cells in the order below, cleaned by tools/cut-sheets.cjs.
// The same badges as canvases, for drawing over the heroes on the board.
const BADGE_CANVAS = {};
async function loadBadges() {
  const image = await loadImage("/assets/shared/badges/badges.png");
  ["guard", "shooter", "fighter", "fruit", "root", "grain"].forEach((id, i) => {
    const cell = document.createElement("canvas");
    cell.width = cell.height = 112;
    cell.getContext("2d").drawImage(image, i * 112, 0, 112, 112, 0, 0, 112, 112);
    TRAIT_ICONS[id] = `<img class="ti" src="${cell.toDataURL()}" alt="">`;
    BADGE_CANVAS[id] = cell;
  });
}
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
// Synergy multipliers by tier (index = tier).
const SHOOTER_DAMAGE = [1, 1.1, 1.3],
  FIGHTER_SPEED = [1, 1.25, 1.45];
function applyTraits(team) {
  const own = F.filter((f) => f.team === team && f.hp > 0),
    t = teamTraits(own.map((f) => f.character)),
    has = (f, id) => HERO_TAGS[f.character]?.includes(id);
  for (const f of own) {
    if (t.guard.tier) f.stats.armor += 12 * t.guard.tier;
    if (t.shooter.tier && has(f, "shooter")) f.stats.ad *= SHOOTER_DAMAGE[t.shooter.tier];
    if (t.fighter.tier && has(f, "fighter")) f.stats.attackSpeed *= FIGHTER_SPEED[t.fighter.tier];
    if (t.fruit.tier && has(f, "fruit")) f.lifesteal = t.fruit.tier >= 2 ? 0.3 : 0.15;
    if (t.grain.tier && has(f, "grain")) f.pierce = 0.5;
    if (t.root.tier && has(f, "root")) {
      f.max = f.hp = Math.round(f.max * (t.root.tier >= 2 ? 1.3 : 1.15));
    }
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
  // The leap reaches JUMP_RANGE hexes: the assassin lands next to the farthest enemy it can reach, on that enemy's far
  // side if there is room. So where it stands matters: from the back it may reach only the front line.
  let quarry = null,
    spot = null;
  for (const q of [...foes].sort((a, b) => hexDist(f, b) - hexDist(f, a))) {
    spot = neighbors(q.col, q.row)
      .filter((n) => !occupied(n.col, n.row, f) && hexDist(n, f) <= JUMP_RANGE)
      .reduce((b, n) => (!b || hexDist(n, f) > hexDist(b, f) ? n : b), null);
    if (spot) {
      quarry = q;
      break;
    }
  }
  if (!quarry) quarry = foes.reduce((b, q) => (hexDist(f, q) > hexDist(f, b) ? q : b));
  f.target = quarry;
  if (spot) {
    const c = hexCenter(spot.col, spot.row);
    dust(f.x, f.y, 6);
    f.move = { fromX: f.x, fromY: f.y, toX: c.x, toY: c.y, t: 0, dur: JUMP_TIME, jump: true };
    f.col = spot.col;
    f.row = spot.row;
    say(f, "Прыжок в тыл");
    return;
  }
  // Nowhere to land: run round the enemy squad instead.
  f.hunt = quarry;
  say(f, "Рывок в тыл");
}
const JUMP_RANGE = 4,
  JUMP_TIME = 0.8,
  JUMP_HEIGHT = 2.2;
// Fighters' quick runs: the peach sprints to a far target, the beet charges on its first approach, the cucumber in
// its fury runs as well as it hits. Each leaves a trail of dust or fire.
function sprintOf(f, t) {
  if (f.character === "cucumber" && f.rage > 0) return { k: 0.5, trail: "fire" };
  if (f.character === "peach" && hexDist(f, t) >= 3) return { k: 0.5, trail: "dust" };
  if (f.character === "beet" && !f.charged) return { k: 0.6, trail: "dust" };
  if (f.hunt) return { k: 1, trail: "dust" };
  return null;
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
// Every hero leaves a light mark of its own when it walks: the shooters a few motes (pepper embers, eggplant magic,
// onion leaves, corn pollen), the guards a puff of dust at each heavy step. Fewer and smaller than the sprint trails.
const WALK_MARK = { pepper: "ember", eggplant: "magic", onion: "leaf", corn: "pollen", tomato: "stomp", zucchini: "stomp", potato: "stomp", walnut: "stomp" };
function startMove(f, h, sprint) {
  const c = hexCenter(h.col, h.row);
  // The hex is taken at once, so nobody else steps into it.
  f.move = { fromX: f.x, fromY: f.y, toX: c.x, toY: c.y, t: 0, dur: f.stats.step * (f.hunt ? HUNT_STEP : 1) * (sprint ? sprint.k : 1), trail: sprint?.trail };
  sfx(sprint ? "dash" : "step", { who: f.character });
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
  // The leap: up and down in a low arc, a puff of dust on landing.
  f.lift = m.jump && k < 1 ? Math.sin(Math.PI * k) : 0;
  if (m.trail && (m.puff = (m.puff || 0) - dt) <= 0) {
    m.puff = 0.035;
    trails.push({ x, y, kind: m.trail, t: m.trail === "fire" ? 0.45 : 0.6, life: m.trail === "fire" ? 0.45 : 0.6, seed: Math.random() });
  }
  const mark = !m.trail && !m.jump && WALK_MARK[f.character];
  if (mark && mark !== "stomp" && (m.puff = (m.puff || 0) - dt) <= 0) {
    m.puff = 0.09;
    trails.push({ x: x + (Math.random() - 0.5) * 0.25, y, kind: "mote", mote: mark, t: 0.6, life: 0.6, seed: Math.random() });
  }
  if (mark === "stomp" && k >= 1) dust(x, y, 3);
  // The leap leaves a streak of light along its arc, at the height of the body.
  if (m.jump && k < 1 && (m.puff = (m.puff || 0) - dt) <= 0) {
    m.puff = 0.02;
    trails.push({ x, y, lift: f.lift, kind: "air", t: 0.35, life: 0.35, seed: Math.random() });
  }
  if (k >= 1) {
    if (m.jump) dust(x, y, 8);
    f.move = null;
  }
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
      drawSheetFrame(g, fr, z, tint);
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
  // The cucumber's fury: attacks half as often again while it lasts.
  f.cool = 1 / (f.stats.attackSpeed * (f.rage > 0 ? 1.5 : 1));
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
    if (p.whirl) for (const q of alive(1 - f.team)) hexDist(f, q) <= 1 && (impact(q, f, true), hurt(q, f.stats.ad * p.mult, f));
    else if (hexDist(f, p.to) <= f.stats.range) {
      impact(p.to, f, p.big);
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
  const x = f.x + (dx / d) * 0.45,
    y = f.y + (dy / d) * 0.45,
    speed = f.character === "pepper" || f.character === "eggplant" ? 6.8 : 11;
  shots.push({ x, y, to: p.to, from: f, kind: f.character, big: p.big, raw: f.stats.ad * p.mult, speed, stun: p.stun });
  if (WEAPON[f.character] === "arrow") sfx("shoot", { kind: "arrow", who: f.character });
  // The onion's volley: one more arrow at each of the two enemies closest to its target.
  if (p.volley)
    alive(1 - f.team)
      .filter((q) => q !== p.to)
      .sort((a, b) => hexDist(a, p.to) - hexDist(b, p.to))
      .slice(0, 2)
      .forEach((q) => shots.push({ x, y, to: q, from: f, kind: f.character, raw: f.stats.ad, speed }));
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
  if (f.character === "potato" || f.character === "walnut" || f.character === "peach") {
    // Defensive casts: no blow, only the effect around the caster.
    const near = alive(f.team).filter((q) => q === f || hexDist(f, q) <= 1);
    if (f.character === "potato") {
      f.shield = 4;
      f.hp = Math.min(f.max, f.hp + f.max * 0.1);
      say(f, "Крепость");
    } else if (f.character === "walnut") {
      for (const q of near) q.shield = 4;
      say(f, "Скорлупа");
    } else {
      for (const q of near) q.hp = Math.min(q.max, q.hp + 70);
      say(f, "Сладкий сок");
    }
    f.cast = 0.42;
    f.cool = 1 / f.stats.attackSpeed;
    return;
  }
  if (f.character === "onion") {
    attack(f, t, 1.6, true);
    f.pending.volley = true;
    say(f, "Залп стрел");
    return;
  }
  if (f.character === "cucumber") {
    attack(f, t, 1.8, true);
    f.rage = 4;
    say(f, "Колючая ярость");
    return;
  }
  if (f.character === "eggplant") {
    attack(f, t, 2.4, true);
    f.pending.stun = 1.5;
    say(f, "Тёмная сфера");
    return;
  }
  attack(f, t, 2.8, true);
  say(f, "Удар из тени");
}
function say(f, text) {
  floaters.push({ x: f.x, y: f.y, lift: 1.35, text, t: 1.2, color: "#fff4c2", size: 0.9 });
}

// ---------- Simulation ----------
function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function step(dt) {
  if (!running || result) return;
  time = Math.max(0, time - dt);
  for (const f of F) {
    if (f.hp <= 0) continue;
    f.cool -= dt;
    f.cast = Math.max(0, f.cast - dt);
    f.hit = Math.max(0, f.hit - dt);
    f.shield = Math.max(0, f.shield - dt);
    f.rage = Math.max(0, (f.rage || 0) - dt);
    f.moving = false;
    releasePending(f, dt);
  }
  // A fresh random order every frame: otherwise the first team in F always moved and struck first.
  for (const f of shuffled(F)) {
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
      f.charged = true;
      if (f.cool <= 0 && f.cast <= 0 && !f.pending) f.mana >= f.stats.mana ? castAbility(f, t) : attack(f, t);
    } else if (f.cast <= 0) {
      const h = nextStep(f, t);
      if (h) startMove(f, h, sprintOf(f, t));
    }
  }
  updateShots(dt);
  for (const p of floaters) p.t -= dt;
  floaters = floaters.filter((p) => p.t > 0);
  for (const b of blasts) b.t -= dt;
  blasts = blasts.filter((b) => b.t > 0);
  for (const e of impacts) e.t -= dt;
  impacts = impacts.filter((e) => e.t > 0);
  for (const e of trails) e.t -= dt;
  trails = trails.filter((e) => e.t > 0);
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
      impact(s.to, s.from, s.big);
      hurt(s.to, s.raw, s.from);
      if (s.stun && s.to.hp > 0) s.to.stun = s.stun;
      continue;
    }
    // The last positions make the streak drawn behind the shot.
    (s.path ||= []).push({ x: s.x, y: s.y });
    if (s.path.length > SHOT_TRAIL) s.path.shift();
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
  // Above the far row only its heroes' heads and bars stand out: about 0.6 of a cell, not a fixed share of the screen,
  // so the board takes all the height it can.
  const HEAD = 0.6,
    wide = (W * 0.98) / BOARD_W,
    // The board is seen at about 50° (depth on screen ~0.62 of its width); on a tall screen the camera looks down
    // more steeply so the board fills the height instead of leaving empty space.
    tilt = Math.max(0.62, Math.min(1, (H - top - bottom - HEAD * wide) / (BOARD_D * wide))),
    cell = Math.max(1, Math.min(wide, (H - top - bottom) / (BOARD_D * tilt + HEAD))),
    boardH = BOARD_D * tilt * cell,
    spare = H - top - bottom - HEAD * cell - boardH;
  view.cell = cell;
  view.cx = W / 2;
  view.y0 = top + HEAD * cell + spare * 0.5;
  view.y1 = view.y0 + boardH;
}

const sprites = Object.fromEntries(CHARACTERS.map((id) => [id, {}]));
// Heroes drawn from one generated sheet (rows = directions, columns = poses); see sheet-sprites.js.
const sheetFrames = {};
let spritesReady = null;
function loadSprites() {
  spritesReady = Promise.all([
    // Without the badge picture the vector badges stay.
    loadBadges().catch(() => {}),
    ...CHARACTERS.map(async (id) => {
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
  ]);
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
  // The leap rises about two body heights; at the top the hero looks a little bigger, as if closer to the camera.
  g.translate(p.x, p.y - (f.lift || 0) * fighterHeight(p.s) * JUMP_HEIGHT);
  g.scale(dir.flip * (1 + (f.lift || 0) * 0.15), 1 + (f.lift || 0) * 0.15);
  if (f.hit) g.filter = "brightness(1.35)";
  if (!f.moving && f.cast <= 0) g.scale(1, 1 + 0.004 * Math.sin((performance.now() / 1000) * 2 + f.index));
  // Enemies are tinted purple: rings and health bars alone did not tell the teams apart in a crowd.
  drawSheetFrame(g, fr, z, f.team === 1);
  g.restore();
  // Remembered for the death effect.
  f.pose = { fr, flip: dir.flip, tint: f.team === 1 };
}
function drawGroundMarks(g, f, p) {
  g.save();
  g.globalAlpha = 0.35;
  g.fillStyle = "#000";
  g.beginPath();
  // In the air the shadow shrinks under the leaping hero.
  const air = 1 - (f.lift || 0) * 0.6;
  g.ellipse(p.x, p.y, radiusOf(f) * view.cell * p.s * 1.1 * air, radiusOf(f) * view.cell * p.s * 0.45 * air, 0, 0, 7);
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
    y = p.y - fighterHeight(p.s) * ((characterProfiles[f.character]?.scale || 1) * 1.02 + (f.lift || 0) * JUMP_HEIGHT) - h,
    badge = BADGE_CANVAS[HERO_TAGS[f.character]?.[0]];
  // During placement the role badge (guard, shooter, fighter) stands over the hero instead of the bars, so the
  // front and the back line are planned at a glance; the bars come with the battle.
  if (!battleStarted && badge) {
    const size = Math.max(26, view.cell * 0.46 * p.s);
    // A soft glow round the badge, so it reads over a busy board.
    g.save();
    g.shadowColor = "rgba(255,225,130,0.85)";
    g.shadowBlur = size * 0.4;
    g.drawImage(badge, p.x - size / 2, y + h - size * 0.8, size, size);
    g.restore();
    return;
  }
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
// A streak behind every shot, so a small arrow or tomato is easy to follow on a phone: a glowing line that thins
// and fades toward its tail, in the shot's own colour.
const SHOT_TRAIL = 9,
  TRAIL_COLOR = { onion: "255,244,200", tomato: "255,110,80", corn: "255,222,90", eggplant: "205,110,255", pepper: "255,160,50" };
function drawShotTrail(g, s) {
  if (!s.path || s.path.length < 2) return;
  const pts = [...s.path, { x: s.x, y: s.y }].map((q) => {
      const p = project(q.x, q.y);
      return { x: p.x, y: p.y - fighterHeight(p.s) * 0.55, s: p.s };
    }),
    rgb = TRAIL_COLOR[s.kind] || TRAIL_COLOR.pepper,
    w = view.cell * (s.big ? 0.16 : 0.1);
  g.save();
  g.globalCompositeOperation = "lighter";
  g.lineCap = "round";
  for (let i = 1; i < pts.length; i++) {
    const k = i / (pts.length - 1);
    g.strokeStyle = `rgba(${rgb},${(0.75 * k).toFixed(2)})`;
    g.lineWidth = Math.max(1.5, w * pts[i].s * (0.25 + 0.75 * k));
    g.beginPath();
    g.moveTo(pts[i - 1].x, pts[i - 1].y);
    g.lineTo(pts[i].x, pts[i].y);
    g.stroke();
  }
  g.restore();
}
function drawShots(g) {
  for (const s of shots) {
    drawShotTrail(g, s);
    const p = project(s.x, s.y),
      y = p.y - fighterHeight(p.s) * 0.55;
    if (s.kind === "onion") {
      // An arrow along its flight: a light shaft with a dark edge, so it shows on the brown ground.
      const a = Math.atan2(project(s.to.x, s.to.y).y - p.y, project(s.to.x, s.to.y).x - p.x),
        l = view.cell * 0.36 * p.s,
        lw = Math.max(2, view.cell * 0.045);
      g.save();
      g.translate(p.x, y);
      g.rotate(a);
      g.lineCap = "round";
      g.strokeStyle = "#2a1a0c";
      g.lineWidth = lw + 2;
      g.beginPath();
      g.moveTo(-l, 0);
      g.lineTo(l * 0.6, 0);
      g.stroke();
      g.strokeStyle = "#f3dca0";
      g.lineWidth = lw;
      g.stroke();
      // Fletching at the tail.
      g.fillStyle = "#e8f4ff";
      g.beginPath();
      g.moveTo(-l, 0);
      g.lineTo(-l * 0.7, -l * 0.2);
      g.lineTo(-l * 0.55, 0);
      g.lineTo(-l * 0.7, l * 0.2);
      g.fill();
      g.fillStyle = "#f2f4f7";
      g.strokeStyle = "#2a1a0c";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(l * 1.05, 0);
      g.lineTo(l * 0.5, -l * 0.24);
      g.lineTo(l * 0.5, l * 0.24);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    } else if (s.kind === "eggplant") {
      const r = view.cell * (s.big ? 0.2 : 0.11) * p.s,
        q = g.createRadialGradient(p.x, y, 0, p.x, y, r * 2);
      q.addColorStop(0, "#fbe6ff");
      q.addColorStop(0.35, "#c04bff");
      q.addColorStop(1, "#7a1bd000");
      g.fillStyle = q;
      g.beginPath();
      g.arc(p.x, y, r * 2, 0, 7);
      g.fill();
    } else if (s.kind === "corn") {
      // A corn kernel: small yellow oval.
      g.fillStyle = "#ffd23a";
      g.strokeStyle = "#b8860b";
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(p.x, y, view.cell * (s.big ? 0.11 : 0.07) * p.s, view.cell * (s.big ? 0.08 : 0.05) * p.s, 0, 0, 7);
      g.fill();
      g.stroke();
    } else if (s.kind === "tomato") {
      // A cherry tomato: bigger than before, with a dark edge and a shine so it reads against the ground.
      const r = view.cell * 0.12 * p.s;
      g.fillStyle = "#e3241a";
      g.strokeStyle = "#4a0c06";
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(p.x, y, r, 0, 7);
      g.fill();
      g.stroke();
      g.fillStyle = "#ffd0c0";
      g.beginPath();
      g.arc(p.x - r * 0.35, y - r * 0.35, r * 0.28, 0, 7);
      g.fill();
      g.fillStyle = "#3f8a22";
      g.beginPath();
      g.arc(p.x, y - r * 0.85, r * 0.38, 0, 7);
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
// A puff of dust on the ground: a few trail pieces at one spot.
function dust(x, y, n) {
  for (let i = 0; i < n; i++) trails.push({ x: x + (Math.random() - 0.5) * 0.5, y: y + (Math.random() - 0.5) * 0.3, kind: "dust", t: 0.55, life: 0.55, seed: Math.random() });
}
// Trails on the ground behind running fighters: dust clouds that swell and fade, or small flames that rise.
function drawTrails(g) {
  for (const e of trails) {
    const p = project(e.x, e.y),
      k = 1 - e.t / e.life,
      a = e.t / e.life,
      size = view.cell * p.s;
    g.save();
    if (e.kind === "mote") {
      // A small walking mark at waist height: embers and magic rise, leaves and pollen drift down.
      const h = fighterHeight(p.s),
        up = e.mote === "ember" || e.mote === "magic",
        y = p.y - h * 0.4 + (up ? -1 : 1) * k * h * 0.3,
        x = p.x + Math.sin(e.seed * 6.28 + k * 4) * size * 0.06,
        r = size * (e.mote === "leaf" ? 0.05 : 0.035) * (0.6 + a * 0.4),
        color = { ember: "255,140,40", magic: "190,110,255", leaf: "120,200,70", pollen: "255,225,90" }[e.mote];
      g.fillStyle = `rgba(${color},${(0.9 * a).toFixed(2)})`;
      g.shadowColor = `rgba(${color},0.8)`;
      g.shadowBlur = r * 3;
      g.beginPath();
      if (e.mote === "leaf") g.ellipse(x, y, r * 1.6, r * 0.7, e.seed * 6.28 + k * 3, 0, 7);
      else g.arc(x, y, r, 0, 7);
      g.fill();
    } else if (e.kind === "air") {
      // A glowing mote left in the air by the leaping assassin: bright, small, fading fast.
      const h = fighterHeight(p.s),
        y = p.y - e.lift * h * JUMP_HEIGHT - h * 0.5,
        r = size * 0.11 * a,
        q = g.createRadialGradient(p.x, y, 0, p.x, y, r * 2);
      q.addColorStop(0, `rgba(255,255,235,${(0.95 * a).toFixed(2)})`);
      q.addColorStop(0.45, `rgba(255,170,60,${(0.6 * a).toFixed(2)})`);
      q.addColorStop(1, "rgba(255,120,30,0)");
      g.fillStyle = q;
      g.beginPath();
      g.arc(p.x, y, r * 2, 0, 7);
      g.fill();
    } else if (e.kind === "fire") {
      const r = size * (0.12 - k * 0.06),
        y = p.y - size * k * 0.35,
        q = g.createRadialGradient(p.x, y, 0, p.x, y, r * 2);
      q.addColorStop(0, `rgba(255,240,160,${(0.9 * a).toFixed(2)})`);
      q.addColorStop(0.4, `rgba(255,120,20,${(0.7 * a).toFixed(2)})`);
      q.addColorStop(1, "rgba(255,60,0,0)");
      g.fillStyle = q;
      g.beginPath();
      g.arc(p.x + (e.seed - 0.5) * size * 0.15, y, r * 2, 0, 7);
      g.fill();
    } else {
      // Light, almost white dust, so it shows on the brown ground; it swells and drifts up a little.
      g.fillStyle = `rgba(${(225 + e.seed * 25) | 0},${(210 + e.seed * 25) | 0},${(175 + e.seed * 30) | 0},${(0.7 * a).toFixed(2)})`;
      g.beginPath();
      g.ellipse(p.x + (e.seed - 0.5) * size * 0.2, p.y - size * (0.06 + k * 0.12), size * (0.1 + k * 0.22), size * (0.07 + k * 0.12), 0, 0, 7);
      g.fill();
    }
    g.restore();
  }
}
// Hit effects: a short mark on the target, by weapon. Small and quick (a quarter second), so a crowded fight stays readable.
const WEAPON = {
  pepper: "fire",
  eggplant: "magic",
  tomato: "juice",
  onion: "arrow",
  corn: "kernel",
  carrot: "thrust",
  beet: "slash",
  peach: "slash",
  zucchini: "blunt",
  cucumber: "blunt",
  potato: "blunt",
  walnut: "blunt",
};
function impact(t, src, big) {
  const kind = WEAPON[src?.character] || "blunt",
    life = kind === "fire" || kind === "magic" ? 0.32 : 0.24;
  impacts.push({ x: t.x, y: t.y, kind, big, t: life, life, ang: Math.atan2(t.y - src.y, t.x - src.x), seed: Math.random() * 6.28 });
  sfx("hit", { kind, big, who: src?.character });
}
function drawImpacts(g) {
  for (const e of impacts) {
    const p = project(e.x, e.y),
      h = fighterHeight(p.s),
      k = 1 - e.t / e.life,
      a = e.t / e.life,
      r = h * (e.big ? 0.55 : 0.4),
      x = p.x,
      y = p.y - h * 0.45,
      // Screen direction of the blow: depth is squeezed by the camera tilt.
      dx = Math.cos(e.ang),
      dy = Math.sin(e.ang) * 0.6;
    g.save();
    g.lineCap = "round";
    if (e.kind === "fire" || e.kind === "magic" || e.kind === "kernel") {
      // A soft flash that swells and fades, with a few embers or motes.
      const [core, mid] = e.kind === "fire" ? ["255,250,220", "255,140,30"] : e.kind === "magic" ? ["245,225,255", "170,80,255"] : ["255,250,210", "255,215,70"],
        R = r * (e.kind === "kernel" ? 0.7 : 1) * (0.6 + k * 0.6),
        q = g.createRadialGradient(x, y, 0, x, y, R);
      q.addColorStop(0, `rgba(${core},${(0.9 * a).toFixed(2)})`);
      q.addColorStop(0.45, `rgba(${mid},${(0.6 * a).toFixed(2)})`);
      q.addColorStop(1, `rgba(${mid},0)`);
      g.fillStyle = q;
      g.beginPath();
      g.arc(x, y, R, 0, 7);
      g.fill();
      g.fillStyle = `rgba(${mid},${a.toFixed(2)})`;
      for (let i = 0; i < 5; i++) {
        const t = e.seed + i * 1.26,
          d = r * (0.4 + k * 0.9);
        g.beginPath();
        g.arc(x + Math.cos(t) * d, y + Math.sin(t) * d * 0.8, Math.max(1.5, r * 0.09 * (0.5 + a * 0.5)), 0, 7);
        g.fill();
      }
    } else if (e.kind === "juice") {
      // Tomato juice: a few red drops thrown back from the hit.
      g.fillStyle = `rgba(220,30,25,${(0.9 * a).toFixed(2)})`;
      for (let i = 0; i < 7; i++) {
        const t = Math.atan2(dy, dx) + (i - 3) * 0.6 + Math.sin(e.seed + i * 2.1) * 0.25,
          d = r * (0.25 + k * 0.85) * (0.6 + ((i * 37) % 10) / 15);
        g.beginPath();
        g.arc(x + Math.cos(t) * d, y + Math.sin(t) * d + k * k * r * 0.5, Math.max(2, r * 0.16 * (1 - k * 0.5)), 0, 7);
        g.fill();
      }
    } else if (e.kind === "slash") {
      // A blade: a bright crescent swept across the body, drawn quickly then fading.
      const sweep = Math.min(1, k * 3),
        tilt = e.seed > 3.14 ? 0.5 : -0.5,
        from = Math.PI + 0.3,
        to = from + (Math.PI - 0.6) * sweep;
      g.translate(x, y);
      g.rotate(tilt);
      g.fillStyle = `rgba(255,255,240,${(0.85 * a).toFixed(2)})`;
      g.beginPath();
      g.ellipse(0, 0, r * 1.1, r * 0.55, 0, from, to);
      g.ellipse(0, -r * 0.14, r * 0.95, r * 0.3, 0, to, from, true);
      g.fill();
    } else {
      // A thrust (spear, arrow) or a blunt blow (mace, club, hammer): short rays from the point of impact.
      const rays = e.kind === "blunt" ? 7 : 4,
        len = r * (e.kind === "blunt" ? 0.75 : 0.55) * (0.5 + k * 0.7);
      g.strokeStyle = e.kind === "blunt" ? `rgba(255,236,170,${(0.9 * a).toFixed(2)})` : `rgba(255,255,255,${(0.85 * a).toFixed(2)})`;
      g.lineWidth = Math.max(2, r * 0.1);
      for (let i = 0; i < rays; i++) {
        const t = e.kind === "blunt" ? e.seed + (i * 6.28) / rays : Math.atan2(-dy, -dx) + (i - (rays - 1) / 2) * 0.55,
          c = Math.cos(t),
          s = Math.sin(t);
        g.beginPath();
        g.moveTo(x + c * len * 0.35, y + s * len * 0.35);
        g.lineTo(x + c * len, y + s * len);
        g.stroke();
      }
      if (e.kind === "blunt") {
        // A small dust ring at the feet for the heavy blows.
        g.strokeStyle = `rgba(200,170,120,${(0.5 * a).toFixed(2)})`;
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(p.x, p.y, r * (0.6 + k), r * (0.25 + k * 0.35), 0, 0, 7);
        g.stroke();
      }
    }
    g.restore();
  }
}
function drawFloaters(g) {
  g.textAlign = "center";
  for (const f of floaters) {
    const p = project(f.x, f.y),
      rise = (0.8 - Math.min(0.8, f.t)) * view.cell * 0.6;
    g.globalAlpha = Math.min(1, f.t / 0.5);
    // Never below 14 px, so the numbers and ability names stay readable on a small phone board.
    g.font = `900 ${Math.round(Math.max(14, view.cell * 0.22) * (f.size || 1))}px system-ui`;
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
  drawTrails(g);
  for (const f of live) drawFighter(g, f);
  drawDeaths(g);
  drawShots(g);
  drawImpacts(g);
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
  // The buttons stand on the field over its bottom edge (a phone held upright, a big screen): the board keeps clear
  // of them. Sideways they are in a column of their own and take nothing from the field.
  function controlsHeight() {
    const box = document.querySelector(".bottom");
    return box && getComputedStyle(box).position === "absolute" ? box.getBoundingClientRect().height : 0;
  }
  function boardFor(w, h) {
    h -= controlsHeight();
    // The deep phone board for a phone held upright (decided by the screen, not by the field, whose height changes
    // with the panels around it); a phone turned sideways and any big screen get the TFT board.
    const upright = globalThis.innerHeight > globalThis.innerWidth && globalThis.innerWidth < 600;
    if (!upright) return { cols: 7, rows: 4, far: 0.74 };
    const cell = (w * 0.98) / 6.5,
      depth = (h - cell * 0.6 - 8) / (cell * PHONE_TILT),
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
    if (!battleStarted && F.length && (b.cols !== COLS || b.far !== FAR)) {
      // Keep both squads and the player's placement: each hero goes to the nearest free hex of the same place on the new board.
      const spots = F.map((f) => ({ f, u: (f.col + 0.5) / COLS, v: f.team ? f.row / ROWS_PER_SIDE : (f.row - ROWS_PER_SIDE) / ROWS_PER_SIDE }));
      useBoard(b);
      for (const f of F) f.col = f.row = -1;
      for (const { f, u, v } of spots) {
        const row = f.team ? Math.round(v * ROWS_PER_SIDE) : ROWS_PER_SIDE + Math.round(v * ROWS_PER_SIDE),
          c = hexCenter(Math.round(u * COLS - 0.5), Math.min(ROWS - 1, row)),
          spot = freeHexNear(f.team, c.x, c.y, f);
        placeOnHex(f, spot.col, spot.row);
      }
      renderSlots();
    }
    // Room above the board for the far row, whose bodies stand up over its edge.
    layoutView(r.width, r.height, FAR > 0.8 ? ((r.width * 0.98) / BOARD_W) * 0.6 : 4, 8 + controlsHeight());
  }
  // The player's synergies: active ones lit, each with its count of different heroes.
  function renderTraits() {
    const box = $("#traits");
    if (!box) return;
    const t = teamTraits(F.filter((f) => f.team === 0).map((f) => f.character));
    const mine = new Set(F.filter((f) => f.team === 0).map((f) => f.character));
    box.innerHTML =
      "<b>Синергии отряда</b>" +
      Object.entries(TRAITS)
        // Only the count ("Стражи 1/2"); a tap opens what the synergy gives.
        .map(
          ([id, tr]) =>
            `<button class="chip ${t[id].tier ? "on" : ""}" data-trait="${id}">${tr.icon} <b>${tr.name} ${t[id].count}/${tr.tiers[tr.tiers.length - 1]}</b>${t[id].tier ? " ✓" : ""}</button>`,
        )
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
      hp = Math.round(st.max * (t.root.tier && has("root") ? 1.15 : 1));
    showCard(
      `<h3>${f.team ? "Соперник: " : ""}${TFT_NAMES[f.character]}</h3>` +
        `<p>❤️ здоровье ${hp}${plus(t.root.tier && has("root"), "(+15% Корнеплоды)")} · ⚔️ урон ${st.ad} · 🕑 ударов в секунду ${
          Math.round(st.attackSpeed * (has("fighter") ? FIGHTER_SPEED[t.fighter.tier] : 1) * 100) / 100
        }${plus(t.fighter.tier && has("fighter"), `(+${Math.round((FIGHTER_SPEED[t.fighter.tier] - 1) * 100)}% Бойцы)`)}</p>` +
        `<p>🛡 броня ${st.armor + 12 * t.guard.tier}${plus(t.guard.tier, `(+${12 * t.guard.tier} Стражи)`)} · 🎯 дальность ${st.range} кл.${plus(
          t.shooter.tier && has("shooter"),
          `· урон +${Math.round((SHOOTER_DAMAGE[t.shooter.tier] - 1) * 100)}% (Стрелки)`,
        )}${t.fruit.tier && has("fruit") ? ` · 🩹 лечение ${t.fruit.tier >= 2 ? 30 : 15}% урона <span class="bonus">(Плоды)</span>` : ""}</p>` +
        `<p><b>Умение</b> (когда полна синяя полоска маны): ${TFT_ABILITIES[f.character]}</p>` +
        `<p><b>Синергии</b>${f.team ? " его отряда" : ""}:</p>` +
        (HERO_TAGS[f.character] || []).map((id) => `<p class="${t[id].tier ? "on" : ""}">${traitLine(id, t[id].count)}</p>`).join(""),
    );
  }
  // The squad is shown on the board itself; the "Изменить отряд" button opens the picker.
  function renderSlots() {
    renderTraits();
  }
  // ---------- Squad picker: a screen before the board to choose the six heroes and read about each in large type ----------
  let draft = [...lineup];
  // The idle frame facing the camera; empty until the sheet has loaded.
  function portraitUrl(c) {
    return sheetFrames[c]?.portrait || BLANK_PICTURE;
  }
  // Under a chosen hero: its role and kind as badges and words ("страж · плод"), so the squad's make-up is seen at once.
  const ONE = { guard: "страж", shooter: "стрелок", fighter: "боец", fruit: "плод", root: "корнеплод", grain: "зерно" };
  // A badge lit (gold glow) when that group's bonus is on in the squad being chosen (t: teamTraits of the draft).
  const badge = (id, t) => `<span class="tb${t?.[id].tier ? " on" : ""}">${TRAITS[id].icon}</span>`;
  // A second copy of a hero adds nothing to the groups: its badges stay dark and it says so.
  function groupsLine(c, t, repeat) {
    const tags = HERO_TAGS[c] || [];
    return `<em class="groups">${tags.map((id) => badge(id, repeat ? null : t)).join("")}<small>${
      repeat ? "повтор — не в счёт" : tags.map((id) => ONE[id] || TRAITS[id].name.toLowerCase()).join(" · ")
    }</small></em>`;
  }
  // ---------- The match: rounds, score and the heroes the player may still replace ----------
  // base: the squad at the start of the round; between rounds the picker may change at most MATCH_SWAPS of its places.
  let match = null;
  function newMatch() {
    match = { round: 1, wins: [0, 0], enemy: enemyLineup(), base: null, over: false };
    newBattle(false, match.enemy);
  }
  function nextRound() {
    if (match.over) {
      match = { round: 1, wins: [0, 0], enemy: enemyLineup(), base: null, over: false };
      return newBattle(true, match.enemy);
    }
    match.round++;
    // The opponent reworks its squad only after losing a round.
    if (result?.outcome === "win") match.enemy = enemyAdjust(match.enemy);
    match.base = [...lineup];
    newBattle(true, match.enemy);
  }
  const swapping = () => match && match.round > 1 && !match.over;
  // For each place of the list: is its hero one of the round's squad (each of those counted once)?
  function keptPlaces(list) {
    const left = [...(match?.base || [])];
    return list.map((c) => {
      const k = c ? left.indexOf(c) : -1;
      if (k >= 0) left[k] = null;
      return k >= 0;
    });
  }
  // The squad to fight with: heroes of the round's squad go back to their own places, the new ones fill the rest.
  function settle(list) {
    const out = Array(TEAM_SIZE).fill(null),
      fresh = [];
    for (const c of list) {
      const i = match.base.findIndex((b, k) => b === c && !out[k]);
      if (i >= 0) out[i] = c;
      else fresh.push(c);
    }
    return out.map((c) => c || fresh.shift());
  }
  function renderPicker() {
    const box = $("#picker");
    if (!box || box.hidden) return;
    const chosen = draft.filter(Boolean),
      mine = new Set(chosen),
      t = teamTraits(chosen),
      full = chosen.length === TEAM_SIZE,
      // Between rounds only MATCH_SWAPS heroes of the round's squad may leave it; the rest are locked once that is
      // used up, so the squad can always be filled again. A hero put back counts as kept, whatever place it took.
      kept = keptPlaces(draft),
      left = swapping() ? MATCH_SWAPS - (TEAM_SIZE - kept.filter(Boolean).length) : TEAM_SIZE,
      locked = (i) => swapping() && kept[i] && left <= 0,
      canAdd = () => draft.some((x) => !x);
    // Only the first copy of a hero counts for the groups.
    const repeat = (i) => draft.indexOf(draft[i]) < i;
    const squad = Array.from({ length: TEAM_SIZE }, (_, i) =>
      draft[i]
        ? `<button class="pick-slot${locked(i) ? " locked" : ""}${repeat(i) ? " repeat" : ""}" data-i="${i}"><img src="${portraitUrl(draft[i])}" alt=""><span>${TFT_NAMES[draft[i]]}</span>${groupsLine(draft[i], t, repeat(i))}${locked(i) ? "" : '<i class="x" aria-label="убрать">✕</i>'}</button>`
        : `<button class="pick-slot empty" data-i="${i}">пусто</button>`,
    ).join("");
    const traits = Object.entries(TRAITS)
      .map(
        ([id, tr]) =>
          `<div class="${t[id].tier ? "on" : ""}">${tr.icon} <b>${tr.name} ${t[id].count}/${tr.tiers[tr.tiers.length - 1]}</b><br><small>даёт: ${tr.text}</small></div>`,
      )
      .join("");
    const cards = CHARACTERS.map((c) => {
      const st = TFT_SPECS[c],
        // For each group of the hero: who else is in it and what the group gives, so the bonus is known in advance.
        // The first tag is the role, the second the kind: named as in the header above.
        // How far the squad is in each of the hero's groups ("2/4"), lit when the bonus is on; "+1" when taking this
        // hero would switch the bonus on ("включит") or raise it a step ("усилит").
        withHero = teamTraits([...chosen, c]),
        tags = (HERO_TAGS[c] || [])
          .map((id, i) => {
            const tr = TRAITS[id],
              count = `<span class="cnt${t[id].tier ? " on" : withHero[id].tier > t[id].tier && !full ? " next" : ""}">${t[id].count}/${tr.tiers[tr.tiers.length - 1]}${
                withHero[id].tier > t[id].tier && !full ? (t[id].tier ? " · +1 усилит" : " · +1 включит") : ""
              }</span>`;
            return `<span class="kind">${i ? "Вид" : "Роль"}:</span> ${badge(id, t)} <b>${tr.name}</b> ${count} — ${tr.text}`;
          })
          .join("<br>");
      return `<button class="hero-card ${mine.has(c) ? "in" : ""}" data-c="${c}"><img src="${portraitUrl(c)}" alt=""><div>
        <h4>${TFT_NAMES[c]}</h4><p class="tags">${tags}</p>
        <p>❤️ здоровье ${st.max} · ⚔️ урон ${st.ad} · 🛡 броня ${st.armor} · 🎯 дальность ${st.range} кл.</p>
        <p><b>Умение</b> (при полной мане): ${TFT_ABILITIES[c]}</p>
        <p class="add">${full ? "" : mine.has(c) ? "+ ещё один (группы не усилит)" : "+ добавить в отряд"}</p></div></button>`;
    }).join("");
    const head = swapping()
      ? `<h2>Раунд ${match.round} из ${MATCH_ROUNDS}: замена героев</h2>
      <p class="goal"><b>${left > 0 ? `Можно заменить ещё ${left} из ${MATCH_SWAPS}.` : "Замены на этот раунд использованы."}</b> Уберите героя сверху и выберите другого из списка —
      новый встанет на место убранного.</p>`
      : `<h2>Выбор отряда</h2>
      <p class="goal"><b>Собирай команду и усиливай героев!</b> Матч — ${MATCH_ROUNDS} раунда против одного соперника,
      между раундами можно заменить до ${MATCH_SWAPS} героев.<br>
      У каждого героя есть роль и вид. Объединяй двух разных героев одной группы, чтобы активировать её бонус.
      Один герой может усиливать сразу две группы. Повторные герои не учитываются.</p>`;
    box.innerHTML = `${head}
      <div class="pick-squad">${squad}</div><div class="pick-traits">${traits}</div><div class="pick-heroes">${cards}</div>
      <div class="pick-go"><button id="pickGo" ${full ? "" : "disabled"}>${full ? "Расставить отряд →" : "Выберите ещё " + (TEAM_SIZE - chosen.length)}</button></div>`;
    box.querySelectorAll(".pick-slot").forEach((b) => (b.onclick = () => locked(+b.dataset.i) || ((draft[+b.dataset.i] = null), renderPicker())));
    box.querySelectorAll(".hero-card").forEach(
      (b) =>
        (b.onclick = () => {
          if (canAdd()) (draft[draft.findIndex((x) => !x)] = b.dataset.c), renderPicker();
        }),
    );
    $("#pickGo").onclick = () => {
      if (!full) return;
      // Between rounds the new heroes take the places of the removed ones; otherwise a new match starts.
      if (swapping()) settle(draft).forEach((c, i) => c !== lineup[i] && setLineupSlot(i, c));
      else (lineup = [...draft]), newMatch();
      hideResult();
      box.hidden = true;
      renderSlots();
    };
  }
  function openPicker() {
    if (battleStarted && !result) return;
    // After a round the next one is set up first, so the swaps count from the squad that just fought.
    if (result && !resultShown) return;
    if (result) nextRound(), hideResult();
    draft = [...lineup];
    $("#picker").hidden = false;
    renderPicker();
  }
  function hud() {
    $("#timer").textContent = formatTime(time);
    $("#timer").style.color = battleStarted && time < FINAL_TIME ? "#ff5a3c" : "";
    $("#hp0").style.width = 100 * teamHealth(0) + "%";
    $("#hp1").style.width = 100 * teamHealth(1) + "%";
    $("#energy").textContent = battleStarted && !result && time < FINAL_TIME ? "Овертайм: урон ×2" : "";
    // While the last blows and falls play out the button waits, so a tap meant for the battle does not skip the result.
    $("#start").disabled = !!result && !resultShown;
    $("#start").textContent = !battleStarted
      ? "Начать бой"
      : result && !resultShown
        ? "…"
        : result
          ? match.over
          ? "Новый матч"
            : `Раунд ${match.round + 1} →`
          : running
            ? "Пауза"
            : "Продолжить";
    // Between rounds the squad button only swaps heroes, and says so.
    $("#team").textContent = match && !match.over && (swapping() || result) ? "⇄ Заменить героев" : "Изменить отряд";
    // ?sfx=debug: the last sounds, each with its file and the hero who made it, to find one by ear.
    // A tap on the list holds it (and the battle) still, to read which sound it was.
    if (sfxDebug && !sfxHeld)
      $("#sfxlog").innerHTML =
        "<b>нажмите — стоп</b><br>" + (globalThis.BattleSfx?.heard || []).map((h) => `${TFT_NAMES[h.who] || "—"}: ${h.file.split("/").pop()}`).reverse().join("<br>");
    $("#round").textContent = match ? `Раунд ${match.round}/${MATCH_ROUNDS} · ${match.wins[0]}:${match.wins[1]}` : "";
    // The hint goes away once the player has touched a hero.
    $("#hint").hidden = battleStarted || hintSeen;
  }
  // The result comes RESULT_DELAY ms after the last blow: the falls and the last numbers are seen first, then the
  // field dims and the panel rises in (see .result in the page's styles). The buttons are hidden while heroes fight
  // and come back under the result panel, across the whole screen; when the next round is set up they return to
  // their corner.
  const RESULT_DELAY = 1300;
  let resultShown = false,
    resultTimer = 0;
  function hideResult() {
    clearTimeout(resultTimer);
    resultShown = false;
    $("#after").hidden = true;
    $(".bottom").append($(".actions"));
    $(".bottom").hidden = false;
    $(".field").classList.remove("over");
  }
  onBattleEnd = (r) => {
    if (r.outcome === "win") match.wins[0]++;
    if (r.outcome === "loss") match.wins[1]++;
    match.over = match.round >= MATCH_ROUNDS;
    const [a, b] = match.wins,
      round = r.outcome === "win" ? "Раунд ваш!" : r.outcome === "loss" ? "Раунд проигран" : "Ничья в раунде";
    $(".field").classList.add("over");
    resultTimer = setTimeout(() => {
      resultShown = true;
      $("#after").append($(".actions"));
      $("#after").hidden = false;
    }, RESULT_DELAY);
    $("#resultText").textContent = match.over ? (a > b ? "Победа в матче!" : a < b ? "Матч проигран" : "Ничья в матче") : round;
    $("#resultDetail").textContent = match.over
      ? `Счёт ${a}:${b}`
      : `Счёт ${a}:${b} · перед раундом ${match.round + 1} можно заменить до ${MATCH_SWAPS} героев кнопкой «Заменить»`;
  };
  $("#start").onclick = () => {
    if (!battleStarted) startBattle(), ($(".bottom").hidden = true);
    else if (result) {
      if (!resultShown) return;
      nextRound();
      hideResult();
    } else running = !running;
    renderSlots();
  };
  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  let press = null,
    hintSeen = false;
  canvas.addEventListener("pointerdown", (e) => {
    const m = point(e);
    // Pick the fighter whose body is under the pointer (nearest to the camera first). A tap shows its card;
    // before the battle the player's own fighters can also be dragged.
    const hit = F.filter((f) => f.hp > 0)
      .sort((a, b) => b.y - a.y)
      .find((f) => {
        const p = project(f.x, f.y),
          h = fighterHeight(p.s);
        return Math.abs(m.x - p.x) < h * 0.45 && m.y < p.y + h * 0.3 && m.y > p.y - h * 1.1;
      });
    if (!hit) return;
    press = { f: hit, x: m.x, y: m.y, moved: false };
    hintSeen = true;
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
  // Some phones report the new size only after the turn has finished.
  addEventListener("orientationchange", () => setTimeout(resize, 250));
  resize();
  newMatch();
  renderSlots();
  // Now the panels around the field are filled in: count the phone board rows again for the real field height.
  const box1 = canvas.getBoundingClientRect(),
    b1 = boardFor(box1.width, box1.height);
  if (b1.rows !== ROWS_PER_SIDE || b1.cols !== COLS) {
    useBoard(b1);
    newBattle(false, match.enemy);
    renderSlots();
    resize();
  }
  // Slot pictures come from the sheets, which are known once the manifests are loaded.
  loadSprites().then(() => {
    renderSlots();
    renderPicker();
  });
  const sfxDebug = /[?&]sfx=debug\b/.test(location.search);
  let sfxHeld = false;
  if (sfxDebug) {
    const log = document.createElement("div");
    log.id = "sfxlog";
    log.className = "sfxlog";
    log.onclick = () => {
      sfxHeld = !sfxHeld;
      if (battleStarted && !result) running = !sfxHeld;
      log.firstElementChild.textContent = sfxHeld ? "стоп · нажмите — дальше" : "нажмите — стоп";
    };
    $(".field").append(log);
  }
  // The sound switch in the top bar.
  const soundButton = $("#sound");
  if (soundButton) {
    const show = () => ((soundButton.textContent = globalThis.BattleSfx?.muted ? "🔇" : "🔊"), (soundButton.ariaLabel = globalThis.BattleSfx?.muted ? "Включить звук" : "Выключить звук"));
    soundButton.onclick = () => (globalThis.BattleSfx?.toggle(), show());
    show();
  }
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
