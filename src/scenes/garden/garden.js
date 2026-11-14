// The garden, test. An open ground that goes on as far as one scrolls; everything on it is a separate object the
// player places and moves himself: beds, the armory (barn), the seed tent (shop), the market tent (bazaar), the well
// and camp decorations. On the beds the army grows: a crop is sown by sliding its icon over empty beds and gathered
// by sliding the sickle over ripe ones; the seed is a fighter of that crop from the barn (1 sown → 2 gathered).
// The player's avatar and his helpers do the work, walking round the objects. No server: kept in this browser.
// Concept: D:\HomeProjects\GardenBattle\Doc\Огород — концепция модуля.md; look: art/garden/concepts/war-garden-2.png.
(() => {
  const $ = (s) => document.querySelector(s);
  const canvas = $("#map");
  let g = canvas.getContext("2d");

  // ---------- Rules ----------
  // grow: game minutes from sowing to ripe; yield: fighters gathered from one bed.
  // Each crop: grow time (minutes), fighters per seed, and the price of one seed at the bazaar. A seed is used up by
  // one sowing. Time and yield belong to the crop, not to when it was opened; any bed gives about as many fighters an
  // hour. Seed prices (chosen here) make a grown fighter cost 30–37 gold, against about 100 at the bazaar.
  // boost: how many more fighters the harvest fertilizer gives on this crop (shown on the seed's card).
  const CROPS = {
    tomato: { name: "Помидор", words: "страж · плод", grow: 15, yield: 2, seed: 60, boost: 1 },
    carrot: { name: "Морковь", words: "боец · корнеплод", grow: 20, yield: 2, seed: 70, boost: 1 },
    potato: { name: "Картофель", words: "страж · корнеплод", grow: 30, yield: 3, seed: 90, boost: 1 },
    peach: { name: "Персик", words: "боец · плод", grow: 45, yield: 3, seed: 110, boost: 1 },
    onion: { name: "Лук", words: "стрелок · корнеплод", grow: 60, yield: 4, seed: 120, boost: 2 },
    corn: { name: "Кукуруза", words: "стрелок · зерно", grow: 90, yield: 5, seed: 150, boost: 2 },
    // The other heroes of the battle: opened only in the laboratory (locked). Time and yield follow the same rule:
    // about as many fighters an hour as any other crop. No growing pictures yet: drawn as their mark (emoji).
    pepper: { name: "Перец", words: "стрелок · плод", grow: 30, yield: 3, seed: 90, boost: 1, locked: true, emoji: "🫑" },
    beet: { name: "Свёкла", words: "боец · корнеплод", grow: 20, yield: 2, seed: 70, boost: 1, locked: true, emoji: "🟣" },
    zucchini: { name: "Кабачок", words: "страж · плод", grow: 45, yield: 3, seed: 110, boost: 1, locked: true, emoji: "🥒" },
    walnut: { name: "Орех", words: "страж · зерно", grow: 90, yield: 5, seed: 150, boost: 2, locked: true, emoji: "🌰" },
    eggplant: { name: "Баклажан", words: "стрелок · плод", grow: 60, yield: 4, seed: 120, boost: 2, locked: true, emoji: "🍆" },
    cucumber: { name: "Огурец", words: "боец · плод", grow: 20, yield: 2, seed: 70, boost: 1, locked: true, emoji: "🥒" },
    cabbage: { name: "Капуста", words: "страж · зелень", grow: 45, yield: 3, seed: 110, boost: 1, locked: true, emoji: "🥬" },
    grape: { name: "Виноград", words: "страж · плод", grow: 60, yield: 4, seed: 120, boost: 2, locked: true, emoji: "🍇" },
    pineapple: { name: "Ананас", words: "страж · плод", grow: 90, yield: 5, seed: 150, boost: 2, locked: true, emoji: "🍍" },
    banana: { name: "Банан", words: "боец · плод", grow: 60, yield: 4, seed: 120, boost: 2, locked: true, emoji: "🍌" },
    cherry: { name: "Вишня", words: "боец · плод", grow: 30, yield: 3, seed: 90, boost: 1, locked: true, emoji: "🍒" },
    parsley: { name: "Петрушка", words: "боец · зелень", grow: 15, yield: 2, seed: 60, boost: 1, locked: true, emoji: "🌿" },
    dill: { name: "Укроп", words: "боец · зелень", grow: 15, yield: 2, seed: 60, boost: 1, locked: true, emoji: "🌱" },
  };
  const STARTERS = Object.keys(CROPS).filter((id) => !CROPS[id].locked);
  const START_GOLD = 3000,
    START_STOCK = 3,
    START_SEEDS = 2, // seeds of each starting crop
    MINUTE = 60000,
    SAVE_KEY = "garden-test-v13";

  // ---------- Objects ----------
  // Every kind of object: its picture (assets/garden/obj, cut from art/garden/objects-sheet.png by
  // tools/cut-objects.cjs; all drawn at one scale, so a picture's pixels are world pixels), its footprint on the
  // ground (a box round the middle of its bottom: half width, depth up from the bottom), and, for what can be bought,
  // a price. "unique" ones come with the garden and stand one at a time: razed, one is bought again from the drawer.
  // "fixed" ones (beds and buildings) stay where they were put: they cannot be moved, only razed (and a new one bought
  // and placed); the rest (crates,
  // racks, dummies, plants…) can be picked up and moved at will.
  const KINDS = {
    bed: { name: "Грядка", pic: "bed-empty", foot: [172, 150], price: 50, fixed: true },
    armory: { name: "Амбар", pic: "armory", foot: [150, 130], price: 200, unique: true, fixed: true, opens: "barn" },
    "market-tent": { name: "Базар", pic: "market-tent", foot: [140, 110], price: 150, unique: true, fixed: true, opens: "bazaar" },
    well: { name: "Колодец", pic: "well", foot: [80, 70], price: 100, fixed: true },
    // Studies new crops (their seeds then come to the bazaar); from garden level 3. The study itself is still to come.
    laboratory: { name: "Лаборатория", pic: "laboratory", foot: [165, 110], price: 500, unique: true, fixed: true, level: 3, opens: "lab" },
    "trade-stall": { name: "Прилавок", pic: "trade-stall", foot: [105, 80], price: 120, fixed: true },
    palisade: { name: "Частокол", pic: "palisade", foot: [135, 30], price: 10 },
    "palisade-corner": { name: "Угол частокола", pic: "palisade-corner", foot: [65, 50], price: 10 },
    gate: { name: "Ворота", pic: "gate", foot: [115, 30], price: 30 },
    "banner-stand": { name: "Знамя на камнях", pic: "banner-stand", foot: [45, 30], price: 25 },
    banner: { name: "Знамя", pic: "banner", foot: [20, 14], price: 20 },
    dummy: { name: "Чучело-мишень", pic: "dummy", foot: [25, 18], price: 30 },
    "spear-rack": { name: "Стойка с копьями", pic: "spear-rack", foot: [60, 45], price: 40 },
    "shield-rack": { name: "Стойка со щитами", pic: "shield-rack", foot: [85, 45], price: 40 },
    "crates-barrels": { name: "Ящики", pic: "crates-barrels", foot: [62, 40], price: 15 },
    barrels: { name: "Бочки", pic: "barrels", foot: [58, 30], price: 10 },
    "hay-sacks": { name: "Сено и мешки", pic: "hay-sacks", foot: [105, 40], price: 15 },
    "rocks-big": { name: "Большие камни", pic: "rocks-big", foot: [75, 40], price: 5 },
    "rocks-small": { name: "Камни", pic: "rocks-small", foot: [52, 26], price: 5 },
    "rock-moss": { name: "Камень со мхом", pic: "rock-moss", foot: [62, 26], price: 5 },
    bush: { name: "Куст", pic: "bush", foot: [52, 30], price: 5 },
    "bush-berries": { name: "Куст с ягодами", pic: "bush-berries", foot: [48, 28], price: 5 },
    "bush-white": { name: "Куст с цветами", pic: "bush-white", foot: [50, 28], price: 5 },
    "bush-yellow": { name: "Жёлтые цветы", pic: "bush-yellow", foot: [46, 26], price: 5 },
    fern: { name: "Папоротник", pic: "fern", foot: [40, 22], price: 5 },
    fern2: { name: "Папоротник-2", pic: "fern2", foot: [46, 24], price: 5 },
    stump: { name: "Пень", pic: "stump", foot: [48, 26], price: 5 },
    logs: { name: "Брёвна", pic: "logs", foot: [58, 32], price: 10 },
    // No picture yet: drawn by code (a pole, a crossbar and a mark). Birds do not land on beds near it.
    scarecrow: { name: "Пугало", emoji: "🧑‍🌾", foot: [30, 20], price: 15, size: [110, 170] },
    // No pictures yet either: drawn by code as a coloured board with a mark and a name.
    "order-board": { name: "Доска заказов", emoji: "📋", box: "#7a5530", foot: [70, 30], price: 30, unique: true, size: [150, 150], opens: "orders" },
    // The gardener's dwelling, better with the gardener's glory: one on the plot, a new one replaces the old.
    "home-1": { name: "Палатка", emoji: "⛺", box: "#8a6d3b", foot: [90, 60], price: 0, dwelling: 1, size: [190, 160] },
    "home-2": { name: "Шалаш", emoji: "🛖", box: "#6f5a2e", foot: [100, 70], price: 0, dwelling: 2, size: [210, 180] },
    "home-3": { name: "Бревенчатый дом", emoji: "🏠", box: "#7a4a24", foot: [120, 80], price: 0, dwelling: 3, size: [240, 200] },
    "home-4": { name: "Каменный дом", emoji: "🏡", box: "#6b6b70", foot: [130, 90], price: 0, dwelling: 4, size: [260, 220] },
    "home-5": { name: "Замок", emoji: "🏰", box: "#5a5f7a", foot: [150, 110], price: 0, dwelling: 5, size: [300, 260] },
    greenhouse: { name: "Теплица", emoji: "🌱", box: "#5f8f8a", foot: [130, 100], price: 800, fixed: true, max: 2, size: [280, 220] },
  };
  // All prices are in tens of gold (decided 14.11.2026: the economy ×10, so earnings show in hundreds and thousands).
  for (const k of Object.values(KINDS)) if (k.price) k.price *= 10;
  // The paths left round every object, wide enough for a person.
  const GAP = 34;

  // Where the first beds stand: the top left corner of the clearing, under the buildings.
  const BEDS_X = -1500,
    BEDS_Y = -1240;

  // ---------- Saved state ----------
  // objects: [{ kind, x, y, flip?, crop?, at? }], x, y the middle of the bottom in world pixels.
  // time: game time in ms, which runs `speed` times faster than real time (×60 for the test) and also runs while the
  // page is closed; real: the real time it was last brought up to date.
  function fresh() {
    const objects = [],
      ids = STARTERS,
      stage = [1.2, 0.8, 0.3, 1.1, null, 0.6, 0.9, null];
    // Eight beds, two columns of four, with paths between them, most of them growing, two waiting for seed.
    for (let k = 0; k < 8; k++) {
      const id = ids[k % ids.length],
        grown = stage[k];
      objects.push({ kind: "bed", x: BEDS_X + (k % 2) * 410, y: BEDS_Y + Math.floor(k / 2) * 190, crop: grown == null ? null : id, at: grown == null ? 0 : -grown * CROPS[id].grow * MINUTE });
    }
    // The camp round them; the player moves all of it as he likes.
    // The buildings stand in a row under the palisade at the top; the beds begin below them, by the top left corner,
    // and the player spreads them right and down as he likes.
    for (const [kind, x, y, flip] of [
      ["armory", -1500, -1560],
      ["banner-stand", -1220, -1600],
      ["market-tent", -480, -1560],
      ["well", -110, -1580],
      ["spear-rack", -1780, -1300],
      ["shield-rack", -1770, -1050],
      ["dummy", -1790, -820],
      ["crates-barrels", -720, -1270],
      ["hay-sacks", -720, -1050],
    ])
      objects.push({ kind, x, y, flip: !!flip });
    return { scale: 10, gold: START_GOLD, seeds: Object.fromEntries(ids.map((id) => [id, START_SEEDS])), barn: Object.fromEntries(ids.map((id) => [id, START_STOCK])), objects, time: 0, real: Date.now(), speed: 1, xp: 0, level: 1, quests: [] };
  }
  let state;
  try {
    state = JSON.parse(localStorage.getItem(SAVE_KEY)) || fresh();
  } catch {
    state = fresh();
  }
  state.xp ??= 0;
  state.level ??= 1;
  state.quests ??= [];
  // A save from an older version may name kinds of objects or crops that are no more, or lack new crops: those
  // objects are dropped, such beds are emptied, the barn gets the new crops, such tasks are let go. Without this one
  // unknown name would stop the game on its first frame.
  function mend() {
    state.objects = (state.objects || []).filter((o) => KINDS[o.kind]);
    for (const o of state.objects) if (o.kind === "bed" && o.crop && !CROPS[o.crop]) (o.crop = null), (o.at = 0);
    state.barn ||= {};
    for (const id of Object.keys(CROPS)) state.barn[id] ??= 0;
    for (const id of Object.keys(state.barn)) if (!CROPS[id]) delete state.barn[id];
    // Seeds came in with the bazaar (14.11.2026): an older save gets the starting ones.
    state.seeds ||= Object.fromEntries(STARTERS.map((id) => [id, START_SEEDS]));
    for (const id of Object.keys(CROPS)) state.seeds[id] ??= 0;
    state.items ||= { yield: 0, grow: 0 };
    state.lab ||= { opened: [], research: null, make: null };
    state.orders ||= [];
    if (!state.objects.some((o) => o.kind === "order-board")) {
      const barn = state.objects.find((o) => o.kind === "armory");
      state.objects.push({ kind: "order-board", x: barn ? barn.x + 300 : -1200, y: barn ? barn.y + 10 : -1550 });
    }
    // Gnomes are bought now (14.11.2026); a new garden, or an older save, starts with one water carrier.
    state.gnomes ||= ["water"];
    state.bag ||= { gold: 0, water: 0, weed: 0, pest: 0 };
    state.quests = state.quests.filter((q) => CROPS[q.crop]);
    if (!Number.isFinite(state.gold)) state.gold = START_GOLD;
    // A save from before the ×10 economy: its gold ×10 too.
    if (state.scale !== 10) (state.gold *= 10), (state.scale = 10), state.quests.forEach((q) => (q.gold *= 10));
  }
  mend();
  const beds = () => state.objects.filter((o) => o.kind === "bed");
  // Game time follows the real clock, including while the page was closed or in the background.
  function tick() {
    const now = Date.now();
    state.time += Math.max(0, now - state.real) * state.speed;
    state.real = now;
  }
  function save() {
    tick();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      // The barn for the battle: opened from the garden, its squad picker offers only the fighters grown here.
      localStorage.setItem("garden-barn", JSON.stringify(state.barn));
    } catch {}
  }
  const left = (bed) => CROPS[bed.crop].grow * MINUTE - (state.time - bed.at);
  const ripe = (bed) => bed.crop && left(bed) <= 0;
  const growth = (b) => (state.time - b.at) / (CROPS[b.crop].grow * MINUTE);
  // Fertilizers (sold by the game at the bazaar), one portion a bed a sowing each:
  //   for the harvest — the bed gives CROPS[crop].boost more fighters;
  //   for growth — the bed grows twice as fast for the rest of its time.
  const FERTS = {
    yield: { name: "Удобрение для урожая", emoji: "🧪", price: 20 },
    grow: { name: "Удобрение для роста", emoji: "⚡", price: 20 },
  };
  function fertilize(b, kind) {
    if (!b.crop || ripe(b) || !(state.items[kind] > 0)) return false;
    if (kind === "yield") {
      if (b.boost) return false;
      b.boost = CROPS[b.crop].boost;
    } else {
      if (b.fast) return false;
      b.at -= left(b) / 2;
      b.fast = true;
    }
    state.items[kind]--;
    return true;
  }
  const GREEN_R = 600; // a greenhouse speeds up the beds this near it
  // Watering: a watered bed grows 1.25 times faster for the rest of its time (once a sowing): what is left shrinks.
  const WET = 1.25;
  function water(b) {
    if (!b.crop || ripe(b) || b.wet) return false;
    const rest = left(b);
    b.at -= rest - rest / WET;
    b.wet = true;
    return true;
  }
  function clock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000 / state.speed)),
      h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60);
    return h ? `${h} ч ${m} мин` : m ? `${m}:${String(s % 60).padStart(2, "0")}` : `${s} с`;
  }

  // ---------- Pictures ----------
  const pic = {};
  for (const name of [...new Set(Object.values(KINDS).filter((k) => k.pic).map((k) => k.pic)), ...STARTERS.flatMap((id) => [1, 2, 3].map((n) => `w-${id}-${n}`)), "tile-dirt", "tile-grass", "tile-grass2", "tile-dirt-stones", "tile-path", "tree", "bush-round"]) {
    pic[name] = new Image();
    pic[name].src = `/assets/garden/obj/${name}.png`;
  }
  // The basket of the harvest, without the round gold badge it was drawn on (cut by tools/cut-basket.cjs).
  pic["icon-basket"] = new Image();
  pic["icon-basket"].src = "/assets/garden/icon-basket.png";
  // The ground: the dirt tile, its rounded rim cut off, laid mirrored (as it is, flipped across, flipped down, both),
  // so neighbouring tiles always meet edge to the same edge and no seam shows.
  let ground = null,
    groundTile = null;
  pic["tile-dirt"].onload = () => {
    const t = pic["tile-dirt"],
      m = 10,
      s = Math.min(t.naturalWidth, t.naturalHeight) - 2 * m,
      k = 2.6,
      c = document.createElement("canvas"),
      cg = c.getContext("2d");
    c.width = c.height = Math.round(s * k * 2);
    const d = s * k;
    for (const [fx, fy] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      cg.save();
      cg.translate(fx < 0 ? 2 * d : 0, fy < 0 ? 2 * d : 0);
      cg.scale(fx, fy);
      cg.drawImage(t, m, m, s, s, 0, 0, d, d);
      cg.restore();
    }
    ground = g.createPattern(c, "repeat");
    groundTile = c;
  };
  // Each crop's portrait: the standing figure facing the camera, cut from the hero's sprite sheet.
  const face = {},
    faceUrl = {};
  const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  for (const id of Object.keys(CROPS))
    fetch(`/assets/characters/${id}/manifest.json`)
      .then((r) => r.json())
      .then((m) => {
        const sh = m.sheet,
          img = new Image();
        if (!sh?.portrait) {
          // A hero drawn as separate pictures (no sheet): its front idle picture is the portrait.
          img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.naturalWidth / 4;
            c.height = img.naturalHeight / 4;
            c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
            face[id] = c;
            faceUrl[id] = c.toDataURL();
            if (panel) panel();
          };
          img.src = `/assets/characters/${id}/sprites/front/idle.png`;
          return;
        }
        img.onload = () => {
          const c = document.createElement("canvas"),
            b = sh.portrait;
          c.width = b.w;
          c.height = b.h;
          c.getContext("2d").drawImage(img, sh.columns.indexOf("idle") * sh.cell.w + b.x, sh.rows.indexOf("front") * sh.cell.h + b.y, b.w, b.h, 0, 0, b.w, b.h);
          face[id] = c;
          faceUrl[id] = c.toDataURL();
          if (panel) panel();
          renderQuests();
        };
        img.src = `/assets/characters/${id}/${sh.file}`;
      });
  const faceImg = (id) => `<img class="face" src="${faceUrl[id] || BLANK}" alt="">`;

  // ---------- Footprints ----------
  // An object's ground box [left, top, right, bottom] in world pixels; `pad` widens it on every side.
  function footOf(o, pad = 0, x = o.x, y = o.y) {
    const [hw, d] = KINDS[o.kind].foot;
    return [x - hw - pad, y - d - pad, x + hw + pad, y + pad];
  }
  const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  // Can an object stand at x, y: a path of GAP left between it and every other object.
  // Nor on the land's own trees, bushes, stones and palisade, nor out in the forest.
  function fits(o, x, y) {
    const box = footOf(o, GAP / 2, x, y);
    if (box[0] < LAND.x0 || box[2] > LAND.x1 || box[1] < LAND.y0 || box[3] > LAND.y1) return false;
    if (scenery.some((q) => !q.forest && overlap(box, sceneryFoot(q, GAP / 2)))) return false;
    // Nor under the crown of a tree or a big bush (the forest's ragged edge included): it would stand hidden in it.
    if (crowns().some((c) => overlap(box, c))) return false;
    if (state.weeds?.some((w) => overlap(box, [w.x - 30, w.y - 20, w.x + 30, w.y]))) return false;
    return state.objects.every((q) => q === o || q === ghost?.moving || !overlap(box, footOf(q, GAP / 2)));
  }
  // The ground of a plant, stone or piece of palisade of the land: about its trunk or base, scaled with it.
  const SCENERY_FOOT = { tree: [55, 45], "bush-round": [55, 34], palisade: [135, 30], gate: [115, 30], "rocks-big": [70, 36], "rock-moss": [60, 24], logs: [55, 30] };
  // The ground under the crowns of the trees and big bushes, as boxes: the middle of each picture as drawn, from its
  // foot up to near its top (the crown's round corners are left out). Worked out once.
  const CROWN = { tree: [325, 359], "bush-round": [212, 159] };
  let crownBoxes = null;
  function crowns() {
    return (crownBoxes ||= scenery
      .filter((o) => CROWN[o.pic])
      .map((o) => {
        const [w, h] = CROWN[o.pic];
        return [o.x - 0.36 * w * o.k, o.y - 0.85 * h * o.k, o.x + 0.36 * w * o.k, o.y + 6];
      }));
  }
  function sceneryFoot(o, pad = 0) {
    const [hw, d] = SCENERY_FOOT[o.pic] || [40, 24];
    return [o.x - hw * o.k - pad, o.y - d * o.k - pad, o.x + hw * o.k + pad, o.y + pad];
  }

  // ---------- People: the gardener (the player's avatar) and his helpers ----------
  // Their sheets are cut like a hero's (tools/cut-sheets.cjs gardener gnome): rows are directions facing right,
  // columns are idle, four walk frames and two work frames. They are only a sight: the beds change at once, they
  // follow. The gardener walks to each bed sown or gathered and works it; the helpers, on their own, go from one
  // growing bed to another and water it. They find their way round the objects on a grid of CELL pixels.
  const SPEED = 140,
    WORK_TIME = 1.1,
    CELL = 20;
  const sheets = {};
  for (const id of ["gardener", "gnome"])
    fetch(`/assets/characters/${id}/manifest.json`)
      .then((r) => r.json())
      .then((m) => {
        const img = new Image();
        img.onload = () => (sheets[id] = { img, sheet: m.sheet });
        img.src = `/assets/characters/${id}/${m.sheet.file}`;
      });
  // height: of the figure in world pixels; home: where one stands when there is nothing to do.
  const walker = (sheet, home, height) => ({ sheet, home, height, x: home[0], y: home[1], dx: 0, dy: 1, jobs: [], doing: null, t: 0, rest: 0, aim: null, path: [] });
  // Gnome helpers are specialists, bought for good, as many of a kind as one likes (each next one dearer): the
  // water carrier waters growing beds, the weeder pulls weeds, the watchman drives pests off. New tasks — new kinds.
  const GNOMES = {
    water: { name: "Водонос", emoji: "💧", text: "поливает растущие грядки", price: 1000 },
    weed: { name: "Полольщик", emoji: "🌿", text: "вырывает сорняки", price: 1000 },
    guard: { name: "Сторож", emoji: "🛡️", text: "прогоняет вредителей", price: 1500 },
  };
  const gnomePrice = (role) => GNOMES[role].price * 2 ** state.gnomes.filter((r) => r === role).length;
  const avatar = walker("gardener", [-1500, -1450], 150),
    walkers = [avatar];
  function addGnome(role) {
    const i = walkers.length - 1,
      w = walker("gnome", [-1780 + (i % 6) * 160, -930 + Math.floor(i / 6) * 120], 110);
    w.role = role;
    w.rest = -2 * i;
    walkers.push(w);
  }
  state.gnomes.forEach(addGnome);
  // The walkable grid over the whole clearing, CELL pixels a cell: 1 where an object's footprint (a little narrower
  // than the GAP round it) is. Built again only when something was placed or moved.
  let nav = null;
  const layoutKey = () => state.objects.map((o) => `${o.kind}${o.x},${o.y}`).join("|");
  function navGrid() {
    const key = layoutKey();
    if (nav?.key === key) return nav;
    const x0 = Math.floor((WORLD.x0 - 200) / CELL),
      y0 = Math.floor((WORLD.y0 - 200) / CELL),
      w = Math.ceil((WORLD.x1 - WORLD.x0 + 400) / CELL),
      h = Math.ceil((WORLD.y1 - WORLD.y0 + 400) / CELL),
      cells = new Uint8Array(w * h);
    // The forest round the clearing is no place to walk.
    for (let gy = 0; gy < h; gy++)
      for (let gx = 0; gx < w; gx++) {
        const x = (gx + x0) * CELL,
          y = (gy + y0) * CELL;
        if (x < LAND.x0 || x > LAND.x1 || y < LAND.y0 || y > LAND.y1) cells[gy * w + gx] = 1;
      }
    const boxes = [...state.objects.map((o) => footOf(o, GAP / 2 - 12)), ...scenery.filter((o) => !o.forest).map((o) => sceneryFoot(o, 4))];
    for (const [l, t, r, b] of boxes) {
      for (let cy = Math.ceil(t / CELL); cy * CELL < b; cy++)
        for (let cx = Math.ceil(l / CELL); cx * CELL < r; cx++) {
          const gx = cx - x0,
            gy = cy - y0;
          if (gx >= 0 && gy >= 0 && gx < w && gy < h) cells[gy * w + gx] = 1;
        }
    }
    return (nav = { key, x0, y0, w, h, cells });
  }
  // The way to a point round the objects: A* on the grid (a binary heap of open cells); a straight line if none.
  function findPath(px0, py0, px1, py1) {
    const { x0, y0, w, h, cells } = navGrid(),
      clampX = (x) => Math.max(0, Math.min(w - 1, x)),
      clampY = (y) => Math.max(0, Math.min(h - 1, y)),
      sx = clampX(Math.round(px0 / CELL) - x0),
      sy = clampY(Math.round(py0 / CELL) - y0),
      tx = clampX(Math.round(px1 / CELL) - x0),
      ty = clampY(Math.round(py1 / CELL) - y0),
      start = sy * w + sx,
      goal = ty * w + tx,
      cost = new Float32Array(w * h).fill(Infinity),
      from = new Int32Array(w * h).fill(-1),
      heap = [],
      push = (f, k) => {
        heap.push([f, k]);
        for (let i = heap.length - 1; i > 0; ) {
          const p = (i - 1) >> 1;
          if (heap[p][0] <= heap[i][0]) break;
          [heap[p], heap[i]] = [heap[i], heap[p]];
          i = p;
        }
      },
      pop = () => {
        const top = heap[0],
          last = heap.pop();
        if (heap.length) {
          heap[0] = last;
          for (let i = 0; ; ) {
            const l = 2 * i + 1,
              r = l + 1;
            let m = i;
            if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
            if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
            if (m === i) break;
            [heap[m], heap[i]] = [heap[i], heap[m]];
            i = m;
          }
        }
        return top;
      },
      free = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !cells[y * w + x];
    cost[start] = 0;
    push(0, start);
    let steps = 0;
    while (heap.length && steps++ < 30000) {
      const [, k] = pop();
      if (k === goal) break;
      const x = k % w,
        y = (k - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx,
          ny = y + dy,
          nk = ny * w + nx;
        if (nk !== goal && !free(nx, ny)) continue;
        // No cutting a corner of an object.
        if (dx && dy && (!free(x + dx, y) || !free(x, y + dy))) continue;
        const c = cost[k] + (dx && dy ? 1.414 : 1);
        if (c >= cost[nk]) continue;
        cost[nk] = c;
        from[nk] = k;
        push(c + Math.hypot(tx - nx, ty - ny), nk);
      }
    }
    if (from[goal] < 0) return [[px1, py1]];
    const path = [];
    for (let k = goal; k >= 0 && k !== start; k = from[k]) path.push([((k % w) + x0) * CELL, (Math.floor(k / w) + y0) * CELL]);
    path.reverse();
    path[path.length - 1] = [px1, py1];
    return path;
  }
  // Where one stands to work a bed: on the path round it, on whichever side is free and near, facing the bed. From
  // below one works with one's back to us, from above facing us, from a side in profile, from a corner three-quarter
  // (the sheets have all five views). fx, fy: the way one faces there.
  function workSpots(b) {
    const [hw, d] = KINDS.bed.foot,
      m = GAP / 2,
      list = [];
    for (const k of [-0.5, 0, 0.5]) list.push({ x: b.x + k * hw, y: b.y + m, fx: -k * 0.8 || 0.3, fy: -1 }, { x: b.x + k * hw, y: b.y - d - m, fx: -k * 0.8 || 0.3, fy: 1 });
    for (const s of [-1, 1]) {
      list.push({ x: b.x + s * (hw + m), y: b.y - d / 2, fx: -s, fy: 0 });
      list.push({ x: b.x + s * (hw + m), y: b.y + m, fx: -s, fy: -1 }, { x: b.x + s * (hw + m), y: b.y - d - m, fx: -s, fy: 1 });
    }
    const { x0, y0, w, h, cells } = navGrid();
    return list.filter((p) => {
      const gx = Math.round(p.x / CELL) - x0,
        gy = Math.round(p.y / CELL) - y0;
      return gx >= 0 && gy >= 0 && gx < w && gy < h && !cells[gy * w + gx];
    });
  }
  // One of the two free spots nearest to the walker (so they do not always come to the same side).
  function pickSpot(b, w) {
    const free = workSpots(b).sort((p, q) => Math.hypot(p.x - w.x, p.y - w.y) - Math.hypot(q.x - w.x, q.y - w.y));
    return free[Math.floor(Math.random() * Math.min(2, free.length))] || { x: b.x, y: b.y + GAP / 2, fx: 0.4, fy: -1 };
  }
  const workSpot = (b, w) => (b.stroll ? b.stroll : b.target ? [b.x, b.y + 30] : ((w.spot = pickSpot(b, w)), [w.spot.x, w.spot.y]));
  function job(b) {
    if (avatar.jobs.includes(b)) return;
    // What the player asks comes before what he found to do himself.
    if (!avatar.given) (avatar.jobs = []), (avatar.aim = null);
    avatar.given = true;
    avatar.jobs.push(b);
  }
  // Someone with nothing to do finds something after a short rest: a helper waters a growing bed nobody is at; the
  // gardener hoes an empty bed or looks over another. With no bed to go to, they stroll somewhere near.
  function findWork(w) {
    if (w.jobs.length || w.rest < 2 + Math.random() * 3) return;
    const busy = new Set(walkers.flatMap((o) => [o.doing, ...o.jobs]).map((j) => j?.target || j));
    // The weeder and the watchman go to a weed or a pest (a job with a target and a place to stand).
    if (w.role === "weed" || w.role === "guard") {
      const targets = w.role === "weed" ? state.weeds.map((t) => ({ target: t, x: t.x, y: t.y })) : state.pests.map((t) => ({ target: t, at: pestPlace(t) })).filter((j) => j.at).map((j) => ({ target: j.target, x: j.at[0], y: j.at[1] + 90 }));
      const free = targets.filter((j) => !busy.has(j.target));
      if (free.length) return w.jobs.push(free[0]);
      return w.jobs.push({ stroll: [w.home[0] + (Math.random() - 0.5) * 300, w.home[1] + (Math.random() - 0.5) * 200] });
    }
    const open = beds().filter((b) => !busy.has(b)),
      list = w === avatar ? [...open.filter((b) => !b.crop), ...open] : open.filter((b) => b.crop && !ripe(b) && !b.wet);
    if (list.length) return w.jobs.push(list[Math.floor(Math.random() * Math.min(list.length, w === avatar ? 3 : list.length))]);
    w.jobs.push({ stroll: [w.home[0] + (Math.random() - 0.5) * 300, w.home[1] + (Math.random() - 0.5) * 200] });
  }
  function step(w, dt) {
    if (w.doing) {
      w.t += dt;
      if (w.t >= WORK_TIME * (w === avatar ? 1 : 2)) {
        gnomeDone(w, w.doing);
        w.doing = null;
      }
      return;
    }
    findWork(w);
    const next = w.jobs[0];
    if (!next && w === avatar) avatar.given = false;
    // A new aim: the next bed, or home after a rest.
    const aim = next || (w.rest > 4 ? "home" : null);
    if (aim !== w.aim) {
      w.aim = aim;
      const [x1, y1] = !aim ? [w.x, w.y] : aim === "home" ? w.home : workSpot(next, w);
      w.path = aim ? findPath(w.x, w.y, x1, y1) : [];
    }
    while (w.path.length && Math.hypot(w.path[0][0] - w.x, w.path[0][1] - w.y) <= 2) w.path.shift();
    const [tx, ty] = w.path[0] || [w.x, w.y],
      ddx = tx - w.x,
      ddy = ty - w.y,
      d = Math.hypot(ddx, ddy);
    if (d > 2) {
      const k = Math.min(1, (SPEED * (w === avatar ? 1 : 0.75) * dt) / d);
      w.x += ddx * k;
      w.y += ddy * k;
      w.dx = ddx;
      w.dy = ddy;
      w.walking = true;
      w.t += dt;
      return;
    }
    w.walking = false;
    if (next?.stroll) (w.jobs.shift(), (w.aim = null), (w.rest = 0));
    else if (next) {
      w.jobs.shift();
      w.aim = null;
      w.doing = next;
      w.t = 0;
      w.rest = 0;
      // Facing the bed while working it, from the side one came to.
      w.dx = w.spot?.fx ?? 0.4;
      w.dy = w.spot?.fy ?? -1;
    } else w.rest += dt;
  }
  // A gnome's work done: the water carrier waters, the weeder and the watchman put what they got in the bag by the barn.
  function gnomeDone(w, job) {
    if (w.role === "water" && job.crop && water(job)) state.bag.water++;
    if (w.role === "weed" && state.weeds.includes(job.target)) state.weeds.splice(state.weeds.indexOf(job.target), 1), (state.bag.gold += 10), state.bag.weed++;
    if (w.role === "guard" && state.pests.includes(job.target)) {
      const k = PESTS[job.target.kind];
      state.pests.splice(state.pests.indexOf(job.target), 1);
      state.bag.gold += k.gold[0];
      state.bag.pest++;
    }
  }
  function drawWalker(w) {
    const s = sheets[w.sheet];
    if (!s) return;
    const { img, sheet } = s,
      ang = (Math.atan2(w.dy, Math.abs(w.dx)) * 180) / Math.PI,
      row = ang > 67.5 ? "front" : ang > 22.5 ? "front34" : ang > -22.5 ? "side" : ang > -67.5 ? "back34" : "back",
      flip = w.dx < -0.01,
      col = w.doing ? 5 + (Math.floor(w.t * 5) % 2) : w.walking ? 1 + (Math.floor(w.t * 8) % 4) : 0,
      k = w.height / sheet.height,
      cw = sheet.cell.w * k,
      ch = sheet.cell.h * k;
    if (w.role) {
      g.font = "40px system-ui";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(GNOMES[w.role].emoji, w.x, w.y - w.height - 18);
    }
    g.save();
    g.translate(w.x, w.y);
    if (flip) g.scale(-1, 1);
    // A soft shadow under the feet.
    g.fillStyle = "#0005";
    g.beginPath();
    g.ellipse(0, 0, cw * 0.22, cw * 0.08, 0, 0, Math.PI * 2);
    g.fill();
    g.drawImage(img, col * sheet.cell.w, sheet.rows.indexOf(row) * sheet.cell.h, sheet.cell.w, sheet.cell.h, -sheet.feet.x * k, -sheet.feet.y * k, cw, ch);
    g.restore();
  }

  // ---------- The world: its bounds, the forest round it, grass and wild plants on the ground ----------
  // The garden is a clearing of WORLD pixels each way (several phone screens; most of it in view on a big monitor),
  // closed by a palisade along the top and bottom and a forest all round. Nothing of this can be moved: it is the
  // land itself, laid out the same way every time (a fixed seed).
  const WORLD = { x0: -2000, x1: 2000, y0: -1900, y1: 2100 },
    FOREST = 520,
    // The ground one can build and walk on: the clearing inside the palisade and the first trees.
    LAND = { x0: WORLD.x0 + 70, x1: WORLD.x1 - 70, y0: WORLD.y0 + 60, y1: WORLD.y1 - 40 };
  function seeded(seed) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = seeded(7);
  // The middle where the garden stands at first: kept clear of wild plants.
  // Wild plants and lone trees keep to a band along the forest; the clearing inside it is the player's to build on.
  const clear = (x, y, m = 0) => x > WORLD.x0 + 380 - m && x < WORLD.x1 - 380 + m && y > WORLD.y0 + 330 - m && y < WORLD.y1 - 330 + m;
  // The top left corner where the garden stands at first (buildings, beds, racks): no wild plants there.
  const startArea = (x, y, m = 0) => x > -1900 - m && x < -40 + m && y > -1760 - m && y < -480 + m;
  // Patches of grass and of stony ground over the bare earth: soft round blots of the sheet's tiles.
  const patches = [];
  for (let i = 0; i < 260; i++) {
    const x = WORLD.x0 + rnd() * (WORLD.x1 - WORLD.x0),
      y = WORLD.y0 + rnd() * (WORLD.y1 - WORLD.y0),
      kind = rnd() < 0.8 ? (rnd() < 0.5 ? "tile-grass" : "tile-grass2") : "tile-dirt-stones";
    patches.push({ x, y, kind, r: (clear(x, y) ? 90 : 160) + rnd() * 200, sx: 1 + rnd() * 0.6, a: rnd() * Math.PI });
  }
  // Wild plants and stones, and the forest: trees in a band round the clearing, thickest away from it.
  const scenery = [];
  const wild = ["bush", "bush-round", "fern", "fern2", "rocks-small", "rock-moss", "stump", "bush-yellow", "bush-white", "bush-berries"];
  // Wild plants in clumps of three to five, thicker towards the forest, none in the middle.
  for (let i = 0; i < 140; i++) {
    const cx = WORLD.x0 + 150 + rnd() * (WORLD.x1 - WORLD.x0 - 300),
      cy = WORLD.y0 + 220 + rnd() * (WORLD.y1 - WORLD.y0 - 360);
    if (clear(cx, cy, -60) || startArea(cx, cy, 120)) continue;
    const n = 3 + Math.floor(rnd() * 3),
      kinds = [wild[Math.floor(rnd() * wild.length)], wild[Math.floor(rnd() * wild.length)]];
    for (let j = 0; j < n; j++) scenery.push({ pic: kinds[j % 2], x: cx + (rnd() - 0.5) * 160, y: cy + (rnd() - 0.5) * 90, k: 0.75 + rnd() * 0.45, flip: rnd() < 0.5 });
  }
  // A few lone trees on the clearing, smaller than the forest's.
  for (let i = 0; i < 70; i++) {
    const x = WORLD.x0 + 200 + rnd() * (WORLD.x1 - WORLD.x0 - 400),
      y = WORLD.y0 + 260 + rnd() * (WORLD.y1 - WORLD.y0 - 520);
    if (clear(x, y, -120) || startArea(x, y, 220)) continue;
    scenery.push({ pic: "tree", x, y, k: 0.75 + rnd() * 0.3, flip: rnd() < 0.5, tint: Math.floor(rnd() * 3) });
  }
  // The forest: rows of trees just outside the clearing on every side, the outer rows packed tighter.
  for (let row = 0; row < 4; row++) {
    const step = 150 - row * 15,
      out = 40 + row * 120;
    for (let x = WORLD.x0 - FOREST; x <= WORLD.x1 + FOREST; x += step) {
      for (const y of [WORLD.y0 - out + 60, WORLD.y1 + out + 40]) scenery.push({ pic: rnd() < 0.85 ? "tree" : "bush-round", x: x + (rnd() - 0.5) * 70, y: y + (rnd() - 0.5) * 50, k: 1.1 + rnd() * 0.5, flip: rnd() < 0.5, forest: true, tint: Math.floor(rnd() * 3) });
    }
    for (let y = WORLD.y0 - FOREST; y <= WORLD.y1 + FOREST; y += step * 0.75) {
      for (const x of [WORLD.x0 - out - 70, WORLD.x1 + out + 70]) scenery.push({ pic: rnd() < 0.85 ? "tree" : "bush-round", x: x + (rnd() - 0.5) * 60, y: y + (rnd() - 0.5) * 40, k: 1.1 + rnd() * 0.5, flip: rnd() < 0.5, forest: true, tint: Math.floor(rnd() * 3) });
    }
  }
  // A palisade along the top and the bottom of the clearing, with a gate in the middle of each.
  for (const y of [WORLD.y0 + 40, WORLD.y1 - 10])
    for (let x = WORLD.x0 + 140; x <= WORLD.x1 - 140; x += 270) scenery.push({ pic: Math.abs(x) < 140 ? "gate" : "palisade", x, y, k: 1, flip: false });
  // Back to front, as they are drawn.
  scenery.sort((a, b) => a.y - b.y);
  // Three shades of each tree, made once, so the forest is not one tree copied: as it is, darker and bluer, warmer.
  const TINTS = ["none", "brightness(0.82) hue-rotate(12deg) saturate(0.9)", "brightness(0.95) hue-rotate(-14deg) saturate(1.1)"],
    tinted = {};
  function shade(name, tint) {
    const key = name + tint;
    if (tinted[key]) return tinted[key];
    const img = pic[name];
    if (!img?.complete || !img.naturalWidth) return null;
    if (!tint) return (tinted[key] = img);
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const cg = c.getContext("2d");
    cg.filter = TINTS[tint];
    cg.drawImage(img, 0, 0);
    return (tinted[key] = c);
  }
  // A picture as it stands on the ground, made once: a soft dark oval where it touches the ground (cw wide), the
  // sun's shadow a little to the right and down (the sun is up on the left), and the picture itself, in a canvas a
  // margin M larger on every side. Shadows are costly to draw every frame; baked like this they cost nothing.
  const M = 40,
    lit = {};
  function litSprite(key, img, cw, sun = true, filter = "none") {
    if (lit[key]) return lit[key];
    const iw = img.width || img.naturalWidth,
      ih = img.height || img.naturalHeight;
    if (!iw) return null;
    const c = document.createElement("canvas");
    c.width = iw + 2 * M;
    c.height = ih + 2 * M;
    const cg = c.getContext("2d"),
      cx = M + iw / 2,
      cy = M + ih - 6;
    const gr = cg.createRadialGradient(cx, cy, 0, cx, cy, cw / 2);
    gr.addColorStop(0, "rgba(30,20,5,0.35)");
    gr.addColorStop(1, "rgba(30,20,5,0)");
    cg.save();
    cg.translate(cx, cy);
    cg.scale(1, 0.28);
    cg.fillStyle = gr;
    cg.beginPath();
    cg.arc(0, 0, cw / 2, 0, Math.PI * 2);
    cg.fill();
    cg.restore();
    cg.filter = filter;
    if (sun) {
      cg.shadowColor = "rgba(40,25,5,0.32)";
      cg.shadowBlur = 14;
      cg.shadowOffsetX = 12;
      cg.shadowOffsetY = 8;
    }
    cg.drawImage(img, M, M);
    return (lit[key] = c);
  }
  function drawScenery(o) {
    const base = shade(o.pic, o.tint || 0);
    if (!base) return;
    // The forest's trees darker, so the clearing stands in light; they cast no sun shadow (unseen in a mass).
    const img = litSprite(`s:${o.pic}:${o.tint || 0}:${!!o.forest}`, base, base.width * 0.72, !o.forest, o.forest ? "brightness(0.85)" : "none");
    if (!img) return;
    const k = o.k;
    g.save();
    g.translate(o.x, o.y);
    if (o.flip) g.scale(-1, 1);
    g.drawImage(img, -img.width * k / 2, (-img.height + M + 6) * k, img.width * k, img.height * k);
    g.restore();
  }
  // Grass and stony patches over the earth.
  function drawPatches() {
    for (const p of patches) {
      const b = blot(p.kind);
      if (!b) continue;
      g.save();
      g.translate(p.x, p.y);
      g.scale(p.sx, 0.62);
      g.rotate(p.a);
      g.drawImage(b, -p.r, -p.r, 2 * p.r, 2 * p.r);
      g.restore();
    }
  }
  // The trodden ground of the garden, worked out from where things stand: blots of path texture under and round each
  // bed, and along a line from each building's door to the nearest bed.
  function drawPaths() {
    const b = blot("tile-path");
    if (!b) return;
    const spot = (x, y, r) => g.drawImage(b, x - r, y - r * 0.62, 2 * r, 2 * r * 0.62);
    const list = beds();
    for (const o of list) for (let dx = -180; dx <= 180; dx += 90) spot(o.x + dx, o.y - 60, 120);
    for (const o of state.objects) {
      if (o.kind === "bed" || !KINDS[o.kind].unique) continue;
      let near = null;
      for (const q of list) if (!near || Math.hypot(q.x - o.x, q.y - o.y) < Math.hypot(near.x - o.x, near.y - o.y)) near = q;
      if (!near) continue;
      const x0 = o.x,
        y0 = o.y + 10,
        x1 = near.x,
        y1 = near.y - 70,
        n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 40);
      for (let i = 0; i <= n; i++) spot(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, 62);
    }
  }
  // A soft round blot of a tile, made once per tile: the tile repeated over a disc that fades out at its rim.
  const blots = {};
  function blot(kind) {
    if (blots[kind]) return blots[kind];
    const t = pic[kind];
    if (!t?.complete || !t.naturalWidth) return null;
    const S = 256,
      c = document.createElement("canvas"),
      cg = c.getContext("2d"),
      m = 10;
    c.width = c.height = S;
    for (let y = 0; y < S; y += t.naturalHeight - 2 * m) for (let x = 0; x < S; x += t.naturalWidth - 2 * m) cg.drawImage(t, m, m, t.naturalWidth - 2 * m, t.naturalHeight - 2 * m, x, y, t.naturalWidth - 2 * m, t.naturalHeight - 2 * m);
    const fade = cg.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S / 2);
    fade.addColorStop(0, "#000");
    fade.addColorStop(1, "#0000");
    cg.globalCompositeOperation = "destination-in";
    cg.fillStyle = fade;
    cg.fillRect(0, 0, S, S);
    return (blots[kind] = c);
  }
  // The ground, drawn once into chunks of CHUNK world pixels at GROUND_K of their size (earth, paths, patches and the
  // forest floor beyond the clearing) and kept; drawn again only when the layout changes (the paths follow the beds).
  // At full size: at a lower one the ground looked blurred beside the sharp objects standing on it.
  const CHUNK = 1024,
    GROUND_K = 1,
    chunks = new Map(); // "ix,iy" -> { c: canvas, key: the paths' layout it was drawn for }
  let chunkKey = "",
    keepChunks = 16,
    builtThisFrame = 0;
  function groundChunk(ix, iy) {
    const key = `${ix},${iy}`,
      have = chunks.get(key);
    if (have) {
      chunks.delete(key);
      chunks.set(key, have);
      // Drawn for an older layout of the paths: still shown while chunks are drawn anew, two a frame at most, so a
      // moved bed does not freeze the screen while the whole view is drawn again.
      if (have.key === chunkKey || builtThisFrame >= 2) return have.c;
    } else if (builtThisFrame >= 2) return null;
    // Not before every picture of the ground is loaded, or the chunk would be kept without it.
    if (!ground || ![...new Set(["tile-path", "tile-grass", "tile-grass2", "tile-dirt-stones", ...scenery.map((o) => o.pic)])].every((n) => pic[n].complete && pic[n].naturalWidth)) return null;
    const c = document.createElement("canvas"),
      size = Math.round(CHUNK * GROUND_K);
    c.width = c.height = size;
    const cg = c.getContext("2d"),
      wx = ix * CHUNK,
      wy = iy * CHUNK;
    cg.scale(GROUND_K, GROUND_K);
    cg.translate(-wx, -wy);
    cg.fillStyle = cg.createPattern(groundTile, "repeat");
    cg.fillRect(wx, wy, CHUNK, CHUNK);
    const draw0 = g;
    g = cg; // the helpers below draw on `g`
    try {
      drawPaths(true);
      drawPatches(true);
    } finally {
      g = draw0;
    }
    // Beyond the clearing: the forest floor, dark under the trees.
    cg.fillStyle = "#33461f";
    const fx0 = WORLD.x0 - 60,
      fy0 = WORLD.y0 - 80,
      fx1 = WORLD.x1 + 60,
      fy1 = WORLD.y1 + 60;
    if (wx < fx0) cg.fillRect(wx, wy, fx0 - wx, CHUNK);
    if (wx + CHUNK > fx1) cg.fillRect(fx1, wy, wx + CHUNK - fx1, CHUNK);
    if (wy < fy0) cg.fillRect(wx, wy, CHUNK, fy0 - wy);
    if (wy + CHUNK > fy1) cg.fillRect(wx, fy1, CHUNK, wy + CHUNK - fy1);
    // The land's own plants, stones, palisade and forest belong to the ground too: they never move, and the forest's
    // hundreds of trees would be far too many to draw every frame. Each is drawn into every chunk it reaches.
    g = cg;
    try {
      for (const o of scenery) {
        const r = 230 * o.k;
        if (o.x + r > wx && o.x - r < wx + CHUNK && o.y + 40 > wy && o.y - 560 * o.k < wy + CHUNK) drawScenery(o);
      }
    } finally {
      g = draw0;
    }
    builtThisFrame++;
    chunks.set(key, { c, key: chunkKey });
    // Only so many are kept: those on the screen and a few round them.
    while (chunks.size > keepChunks) chunks.delete(chunks.keys().next().value);
    return c;
  }
  function drawGround() {
    // The ground changes only with the paths, and they follow only the beds and the main buildings.
    chunkKey = state.objects
      .filter((o) => o.kind === "bed" || KINDS[o.kind].unique)
      .map((o) => `${o.x},${o.y}`)
      .join("|");
    builtThisFrame = 0;
    const [x0, y0] = toWorld(0, 0),
      [x1, y1] = toWorld(W, H);
    keepChunks = (Math.ceil((x1 - x0) / CHUNK) + 2) * (Math.ceil((y1 - y0) / CHUNK) + 2);
    for (let iy = Math.floor(y0 / CHUNK); iy * CHUNK < y1; iy++)
      for (let ix = Math.floor(x0 / CHUNK); ix * CHUNK < x1; ix++) {
        const c = groundChunk(ix, iy);
        if (c) g.drawImage(c, ix * CHUNK, iy * CHUNK, CHUNK + 1, CHUNK + 1);
      }
  }
  // Is a world box on the screen (with a margin)?
  function inView(l, t, r, b) {
    const [x0, y0] = toWorld(0, 0),
      [x1, y1] = toWorld(W, H);
    return r > x0 && l < x1 && b > y0 && t < y1;
  }

  // ---------- The view: pan with a finger, zoom with two fingers or the wheel ----------
  let W = 0,
    H = 0,
    dpr = 1;
  const cam = { x: 0, y: 0, zoom: 1 };
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  function fit() {
    resize();
    // Far enough to see the garden and the land round it at a glance: about 1530 world pixels across; pinch to come
    // closer.
    cam.zoom = Math.min(1.2, W / 1530);
    // On loading: as far to the top left as the view goes (clampCam stops it at the forest's edge), where the garden
    // starts and grows right and down from.
    cam.x = -Infinity;
    cam.y = -Infinity;
    clampCam();
  }
  const toScreen = (x, y) => [(x - cam.x) * cam.zoom + W / 2, (y - cam.y) * cam.zoom + H / 2];
  const toWorld = (sx, sy) => [(sx - W / 2) / cam.zoom + cam.x, (sy - H / 2) / cam.zoom + cam.y];
  // The view stays over the clearing and the first trees of the forest round it; zooming out stops when it holds
  // all of that.
  function clampCam() {
    const ex = 260,
      ey = 300,
      spanX = WORLD.x1 - WORLD.x0 + 2 * ex,
      spanY = WORLD.y1 - WORLD.y0 + 2 * ey;
    cam.zoom = Math.min(1.6, Math.max(W / spanX, H / spanY, cam.zoom));
    const hw = W / 2 / cam.zoom,
      hh = H / 2 / cam.zoom;
    cam.x = Math.max(WORLD.x0 - ex + hw, Math.min(WORLD.x1 + ex - hw, cam.x));
    cam.y = Math.max(WORLD.y0 - ey + hh, Math.min(WORLD.y1 + ey - hh, cam.y));
  }

  // ---------- What is under a point ----------
  // The size an object is drawn at: its picture's own size (the sheet's scale is the world's).
  function drawBox(o) {
    // Every stage of a bed is drawn in the empty bed's box, so a bed keeps its shape as it grows.
    const img = pic[o.kind === "bed" ? "bed-empty" : picOf(o)],
      [w, h] = KINDS[o.kind].size || [img?.naturalWidth || 100, img?.naturalHeight || 100];
    return [o.x - w / 2, o.y - h + footPad(o), w, h];
  }
  // The picture's bottom edge stands a little below the footprint's front (its own soft shadow).
  const footPad = (o) => (o.kind === "bed" ? 10 : 8);
  // The topmost object whose picture is under a screen point (beds by their footprint, which is their picture).
  function objectAt(sx, sy) {
    const [x, y] = toWorld(sx, sy);
    return [...state.objects]
      .sort((a, b) => b.y - a.y)
      .find((o) => {
        const [l, t, w, h] = drawBox(o);
        return x >= l && x < l + w && y >= t && y < t + h;
      });
  }
  const bedUnder = (sx, sy) => {
    const [x, y] = toWorld(sx, sy);
    return beds().find((b) => {
      const [l, t, r, bt] = footOf(b);
      return x >= l && x < r && y >= t && y < bt;
    });
  };

  // ---------- Drawing ----------
  // ghost: an object being placed or moved, { kind, x, y, moving: the object it was picked up from }.
  let ghost = null;
  // tool: what the finger is sliding over the beds: {kind: "seed", crop} or {kind: "sickle"}, with its screen point.
  let tool = null;
  // A bed's picture: empty soil; seedlings for the first half of the growth; then grown plants (tomatoes for the
  // tomato), pale until ripe.
  // A bed is always the same empty bed; what grows on it is drawn over it (see drawWarriors).
  function picOf(o) {
    return o.kind === "bed" ? "bed-empty" : KINDS[o.kind].pic;
  }
  // The army growing on a bed: its warriors in a row on the soil, as many as it will give. First only their helmets show above
  // little mounds, from half the growth they are half out of the ground, ripe they stand with their weapons.
  // Pictures: assets/garden/obj/w-<crop>-<1..3>.png, cut from art/garden/warriors-sheet.png by tools/cut-objects.cjs.
  const WARRIOR_K = 0.46;
  function drawWarriors(o, now) {
    if (!o.crop) return;
    const stage = ripe(o) ? 3 : growth(o) < 0.5 ? 1 : 2,
      img = pic[`w-${o.crop}-${stage}`];
    if (CROPS[o.crop].emoji) {
      // No pictures yet: the crop's mark, small while it grows, bobbing when ripe.
      const n = CROPS[o.crop].yield + (o.boost || 0);
      g.font = `${[0, 50, 72, 96][stage]}px system-ui`;
      g.textAlign = "center";
      g.textBaseline = "alphabetic";
      for (let i = 0; i < n; i++) g.fillText(CROPS[o.crop].emoji, o.x + (i - (n - 1) / 2) * (300 / n), o.y - 50 + (stage === 3 ? Math.sin(now / 260 + i) * 3 : 0));
      return;
    }
    if (!img?.complete || !img.naturalWidth) return;
    const w = img.naturalWidth * WARRIOR_K,
      h = img.naturalHeight * WARRIOR_K;
    // As many as the bed will give: what is gathered is what was seen growing.
    const n = CROPS[o.crop].yield;
    for (let i = 0; i < n; i++) {
      const dx = (i - (n - 1) / 2) * (n > 2 ? 112 : 130);
      // Ripe warriors shift from foot to foot a little, each in his own time.
      const bob = stage === 3 ? Math.sin(now / 260 + i * 1.7 + o.x) * 2 : 0;
      g.drawImage(img, o.x + dx - w / 2, o.y - 44 - h + bob, w, h);
    }
  }
  // A picture's outline filled with one colour (for the haze round the object in hand), made once per picture and colour.
  const sils = new WeakMap();
  function silhouette(img, color) {
    const byColor = sils.get(img) || (sils.set(img, {}), sils.get(img));
    if (byColor[color]) return byColor[color];
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const cg = c.getContext("2d");
    cg.drawImage(img, 0, 0);
    cg.globalCompositeOperation = "source-in";
    cg.fillStyle = `rgb(${color})`;
    cg.fillRect(0, 0, c.width, c.height);
    return (byColor[color] = c);
  }
  // The soil of a growing bed: dry — lighter, with cracks; watered — dark and damp.
  function drawSoil(b, l, t, w, h) {
    const x = l + w * 0.1,
      y = t + h * 0.18,
      sw = w * 0.8,
      sh = h * 0.56;
    if (b.wet) {
      g.fillStyle = "rgba(30,18,6,0.28)";
      g.fillRect(x, y, sw, sh);
      return;
    }
    g.fillStyle = "rgba(240,212,160,0.32)";
    g.fillRect(x, y, sw, sh);
    g.strokeStyle = "rgba(70,45,20,0.55)";
    g.lineWidth = 2.5;
    // Cracks in the same places on a bed every time (from its position).
    let seed = Math.abs(b.x * 7 + b.y * 13);
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 6; i++) {
      let cx = x + rnd() * sw,
        cy = y + rnd() * sh;
      g.beginPath();
      g.moveTo(cx, cy);
      for (let k = 0; k < 3; k++) (cx += (rnd() - 0.5) * 50), (cy += (rnd() - 0.5) * 22), g.lineTo(cx, cy);
      g.stroke();
    }
  }
  // An object with no picture yet, drawn by code: a wooden pole with a crossbar and its mark on top.
  function drawStandIn(o, alpha, glow, now) {
    const k = KINDS[o.kind],
      [w, h] = k.size;
    g.save();
    g.globalAlpha = alpha;
    if (glow) {
      g.shadowColor = `rgba(${glow},${0.8 + 0.2 * Math.sin(now / 220)})`;
      g.shadowBlur = 24;
    }
    if (k.box) {
      // A board: a coloured block standing on its footprint, the mark and the name on it.
      g.fillStyle = "#00000040";
      g.beginPath();
      g.ellipse(o.x, o.y, w * 0.55, w * 0.14, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = k.box;
      g.strokeStyle = "#2a1a0a";
      g.lineWidth = 6;
      g.beginPath();
      g.roundRect(o.x - w / 2, o.y - h, w, h - 6, 18);
      g.fill();
      g.stroke();
      g.shadowBlur = 0;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `${Math.min(w, h) * 0.45}px system-ui`;
      g.fillText(k.emoji, o.x, o.y - h * 0.6);
      g.font = `800 ${Math.max(18, w * 0.11)}px system-ui`;
      g.fillStyle = "#fff4d6";
      g.fillText(k.name, o.x, o.y - h * 0.2);
      g.restore();
      return;
    }
    g.fillStyle = "#00000040";
    g.beginPath();
    g.ellipse(o.x, o.y, w * 0.35, w * 0.12, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#6b4520";
    g.fillRect(o.x - 6, o.y - h * 0.8, 12, h * 0.8);
    g.fillRect(o.x - w / 2, o.y - h * 0.62, w, 10);
    g.shadowBlur = 0;
    g.font = `${w * 0.7}px system-ui`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(KINDS[o.kind].emoji, o.x, o.y - h * 0.78);
    g.restore();
  }
  // glow: a colour ("r,g,b") for a soft haze round the object's outline (the one in hand: green fits, red not).
  // part: "box" draws only a bed's box, "warriors" only what grows on it; anything else draws all of it.
  function drawObject(o, now, alpha = 1, glow = null, part = "all") {
    if (part === "warriors") {
      g.save();
      g.globalAlpha = alpha;
      drawWarriors(o, now);
      g.restore();
      return;
    }
    if (KINDS[o.kind].emoji) return drawStandIn(o, alpha, glow, now);
    const name = picOf(o),
      raw = pic[name];
    if (!raw?.complete || !raw.naturalWidth) return;
    // Buildings and decorations stand with their shadows (baked once).
    const img = litSprite(`o:${name}`, raw, o.kind === "bed" ? 0 : KINDS[o.kind].foot[0] * 2.3, o.kind !== "bed");
    if (!img) return;
    const [l, t] = drawBox(o);
    g.save();
    g.globalAlpha = alpha;
    // A ripe bed glows softly gold, so it is seen from afar (only a few at a time: a live shadow is fine).
    if (o.kind === "bed" && ripe(o) && !glow) {
      g.shadowColor = `rgba(255,214,90,${0.65 + 0.3 * Math.sin(now / 300)})`;
      g.shadowBlur = 26;
    }
    if (o.flip) {
      g.translate(o.x, 0);
      g.scale(-1, 1);
      g.translate(-o.x, 0);
    }
    // A bed's picture fitted to the empty bed's size (the ripe one was drawn a little taller and more from the front).
    const [, , bw, bh] = drawBox(o),
      sx = o.kind === "bed" ? bw / raw.naturalWidth : 1,
      sy = o.kind === "bed" ? bh / raw.naturalHeight : 1;
    if (glow) {
      // The haze: the object's outline filled with the colour, blurred and a little larger than the object.
      const sil = silhouette(img, glow),
        cx = l - M * sx + (img.width * sx) / 2,
        cy = t - M * sy + (img.height * sy) / 2,
        k = 1.07;
      g.filter = `blur(${Math.max(4, 14 * cam.zoom)}px)`;
      g.globalAlpha = 0.75 + 0.25 * Math.sin(now / 220);
      for (let i = 0; i < 2; i++) g.drawImage(sil, cx - (img.width * sx * k) / 2, cy - (img.height * sy * k) / 2, img.width * sx * k, img.height * sy * k);
      g.filter = "none";
      g.globalAlpha = alpha;
    }
    g.drawImage(img, l - M * sx, t - M * sy, img.width * sx, img.height * sy);
    if (o.kind === "bed" && o.crop && !ripe(o)) drawSoil(o, l, t, bw, bh);
    g.restore();
    if (o.kind === "bed" && part !== "box") {
      g.save();
      g.globalAlpha = alpha;
      drawWarriors(o, now);
      g.restore();
    }
  }
  function draw(now) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#3f5a26";
    g.fillRect(0, 0, W, H);
    g.setTransform(dpr * cam.zoom, 0, 0, dpr * cam.zoom, dpr * (W / 2 - cam.x * cam.zoom), dpr * (H / 2 - cam.y * cam.zoom));
    // The ground: earth, trodden paths, grass and stony patches, the forest floor (cached chunks).
    drawGround();
    // While placing: every footprint with its path round it, so the free ground is plain to see.
    if (ghost) {
      g.fillStyle = "#00000022";
      for (const o of state.objects) if (o !== ghost.moving) {
        const [l, t, r, b] = footOf(o, GAP / 2);
        g.fillRect(l, t, r - l, b - t);
      }
    }
    // Objects and people back to front by where they stand.
    // A bed is a low box on the ground: it is drawn under everyone, so no one walking by it is cut by its edge. What
    // grows on it stands up, and takes its place among the walkers by where it stands.
    const placed = state.objects.filter((o) => o !== ghost?.moving);
    for (const o of placed) if (o.kind === "bed") drawObject(o, now, 1, null, "box");
    const list = [
      ...placed.map((o) => (o.kind === "bed" ? { y: o.y - 44, draw: () => drawObject(o, now, 1, null, "warriors") } : { y: o.y, draw: () => drawObject(o, now) })),
      ...walkers.map((w) => ({ y: w.y + 1, draw: () => drawWalker(w) })),
    ].sort((a, b) => a.y - b.y);
    for (const it of list) it.draw();
    drawPests(now);
    // A bed or building offered for razing: ringed in red, so it is plain which one is meant.
    if (razing) drawObject(razing, now, 1, "255,60,45", "box");
    // The object being placed, in a haze round its outline: green where it fits, red where not (as foes are ringed in
    // battle).
    if (ghost) {
      const ok = fits(ghost.moving || ghost, ghost.x, ghost.y) && (ghost.moving || state.gold >= KINDS[ghost.kind].price),
        held = ghost.moving ? { ...ghost.moving, x: ghost.x, y: ghost.y } : ghost,
        glow = ok ? "110,235,90" : "255,60,45";
      drawObject(held, now, 0.9, glow);
      const okBtn = $('#place [data-p="ok"]');
      if (okBtn) okBtn.disabled = !ok;
    }
    // Plain daylight (a warm wash over everything made it look like sunset); the corners only a little darker, in a
    // cool shade, so the eye stays on the middle.
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.5, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(6,14,22,0.2)");
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
    // A long press under way: a ring fills round the finger; full, the object is taken (or offered for razing).
    if (pressAt) {
      const k = Math.min(1, (performance.now() - pressAt.t0) / 550);
      if (k > 0.15) {
        g.lineWidth = 5;
        g.lineCap = "round";
        g.strokeStyle = "rgba(0,0,0,0.35)";
        g.beginPath();
        g.arc(pressAt.x, pressAt.y - 70, 26, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = "#ffd56b";
        g.beginPath();
        g.arc(pressAt.x, pressAt.y - 70, 26, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
        g.stroke();
      }
    }
    // The tool under the finger, at screen size.
    if (tool?.x != null) {
      const s = 64;
      if (tool.kind === "sickle") pic["icon-basket"].complete && g.drawImage(pic["icon-basket"], tool.x - s / 2, tool.y - s - 20, s, s);
      else if (face[tool.crop]) g.drawImage(face[tool.crop], tool.x - s / 2, tool.y - s - 20, s, s);
    }
  }

  // ---------- Pests and weeds ----------
  // A bug or a bird sits on a growing bed and stops its growth (a tap drives it off, for 5 gold); a mole, rare,
  // takes quick taps and leaves a small chest. Weeds come up on free ground and are in the way of building (a swipe
  // pulls them). They come while the player is here; while away only a few gather. Nothing ever eats the harvest.
  const PESTS = {
    bug: { name: "Жук", off: "прогнан", emoji: "🐞", taps: 1, gold: [5, 5] },
    bird: { name: "Птица", off: "прогнана", emoji: "🐦", taps: 1, gold: [5, 5] },
    mole: { name: "Крот", emoji: "🦔", taps: 5, gold: [300, 300] },
  };
  state.pests ||= [];
  state.weeds ||= [];
  const bedKey = (b) => `${b.x},${b.y}`;
  const pestOn = (b) => state.pests.find((p) => p.bed === bedKey(b));
  const SCARE = 500; // birds keep this far from a scarecrow
  const scared = (b) => state.objects.some((o) => o.kind === "scarecrow" && Math.hypot(o.x - b.x, o.y - b.y) < SCARE);
  function spawnPest() {
    if (state.pests.length >= 3) return;
    const free = beds().filter((b) => b.crop && !ripe(b) && !pestOn(b));
    if (!free.length) return;
    const b = free[Math.floor(Math.random() * free.length)],
      r = Math.random();
    let kind = r < 0.04 ? "mole" : r < 0.55 ? "bug" : "bird";
    if (kind === "bird" && scared(b)) kind = "bug";
    state.pests.push({ kind, bed: bedKey(b), hits: 0 });
  }
  function spawnWeed() {
    if (state.weeds.length >= 6 || !beds().length) return;
    for (let tries = 0; tries < 30; tries++) {
      const b = beds()[Math.floor(Math.random() * beds().length)],
        x = Math.round(b.x + (Math.random() - 0.5) * 900),
        y = Math.round(b.y + (Math.random() - 0.5) * 700);
      if (fits({ kind: "scarecrow" }, x, y)) return state.weeds.push({ x, y });
    }
  }
  // While the page was closed: one pest for every half hour away, one weed an hour, at most two and three.
  {
    const away = (Date.now() - (state.real || Date.now())) / 60000;
    for (let i = 0; i < Math.min(2, Math.floor(away / 30)); i++) spawnPest();
    for (let i = 0; i < Math.min(3, Math.floor(away / 60)); i++) spawnWeed();
  }
  // While away the gnomes worked: each watchman drove off the pests, each weeder pulled the weeds, water carriers
  // watered the growing beds. What they got waits in the bag by the barn; the summary says what was done.
  let awaySummary = null;
  {
    const away = (Date.now() - (state.real || Date.now())) / 60000,
      has = (role) => state.gnomes.includes(role),
      done = { water: 0, weed: 0, pest: 0, gold: 0 };
    if (away > 3) {
      if (has("guard")) for (const p of [...state.pests]) state.pests.splice(state.pests.indexOf(p), 1), (done.pest++, (done.gold += PESTS[p.kind].gold[0]));
      if (has("weed")) (done.weed = state.weeds.length), (done.gold += 10 * state.weeds.length), (state.weeds.length = 0);
      if (has("water")) for (const b of beds()) if (water(b)) done.water++;
      state.bag.gold += done.gold;
      state.bag.water += done.water;
      state.bag.weed += done.weed;
      state.bag.pest += done.pest;
      if (done.water + done.weed + done.pest || state.pests.length || state.weeds.length) awaySummary = { away, ...done, pestsLeft: state.pests.length, weedsLeft: state.weeds.length };
    }
  }
  let lastGame = state.time,
    nextPest = performance.now() + 20000,
    nextWeed = performance.now() + 45000;
  // Each frame: a pest holds its bed's growth (its start moves on with the time); new ones now and then.
  function stepPests(now) {
    const dt = state.time - lastGame;
    lastGame = state.time;
    state.pests = state.pests.filter((p) => {
      const b = beds().find((q) => bedKey(q) === p.bed);
      if (!b || !b.crop || ripe(b)) return false;
      b.at += dt;
      return true;
    });
    if (now > nextPest) (nextPest = now + 25000 + Math.random() * 20000), Math.random() < 0.6 && spawnPest();
    if (now > nextWeed) (nextWeed = now + 60000 + Math.random() * 60000), Math.random() < 0.5 && spawnWeed();
  }
  // Where a pest sits: on its bed, a little left of the middle.
  const pestPlace = (p) => {
    const b = beds().find((q) => bedKey(q) === p.bed);
    return b && [b.x - 60, b.y - 90];
  };
  function pestUnder(sx, sy) {
    return state.pests.find((p) => {
      const at = pestPlace(p);
      if (!at) return false;
      const [x, y] = toScreen(...at);
      return Math.hypot(sx - x, sy - y) < Math.max(28, 70 * cam.zoom);
    });
  }
  function hitPest(p) {
    if (!state.pests.includes(p)) return;
    const k = PESTS[p.kind];
    // The mole wants its taps quickly: a pause of 2 seconds and it has hidden again.
    if (p.kind === "mole" && performance.now() - (p.last || 0) > 2000) p.hits = 0;
    p.last = performance.now();
    p.hits++;
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    if (p.hits < k.taps) return say(`${k.name}: ещё ${k.taps - p.hits}! Быстрее, пока не спрятался.`);
    state.pests.splice(state.pests.indexOf(p), 1);
    const gold = k.gold[0] + Math.floor(Math.random() * (k.gold[1] - k.gold[0] + 1)),
      b = beds().find((q) => bedKey(q) === p.bed);
    state.gold += gold;
    if (b) floaters.push({ b, text: `+${gold}`, t0: performance.now() });
    if (p.kind === "mole") {
      // The chest: gold and two seeds of a random starting crop.
      const ids = STARTERS,
        id = ids[Math.floor(Math.random() * ids.length)];
      state.seeds[id] = (state.seeds[id] || 0) + 2;
      say(`Крот пойман! Сундучок: +${gold} золота и 2 семени: ${CROPS[id].name.toLowerCase()}.`);
    } else say(`${k.name} ${k.off}: +${gold} золота. Грядка снова растёт.`);
    save();
  }
  const weedUnder = (sx, sy) =>
    state.weeds.find((w) => {
      const [x, y] = toScreen(w.x, w.y - 25);
      return Math.hypot(sx - x, sy - y) < Math.max(24, 55 * cam.zoom);
    });
  function pullWeed(w) {
    state.weeds.splice(state.weeds.indexOf(w), 1);
    state.gold += 10;
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    say("Сорняк вырван: +10 золота.");
  }
  // The gnomes' bag: beside the barn (or the gardener's home when there is no barn); a tap empties it into the purse.
  function bagPlace() {
    const barn = state.objects.find((o) => o.kind === "armory");
    return barn ? [barn.x + 190, barn.y - 10] : [avatar.home[0] + 120, avatar.home[1]];
  }
  function bagUnder(sx, sy) {
    if (!state.bag.gold) return false;
    const [x, y] = toScreen(...bagPlace());
    return Math.hypot(sx - x, sy - (y - 40 * cam.zoom)) < Math.max(30, 70 * cam.zoom);
  }
  function emptyBag() {
    const gold = state.bag.gold;
    state.gold += gold;
    state.bag = { gold: 0, water: 0, weed: 0, pest: 0 };
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    say(`Из мешочка гномов: +${gold} золота.`);
    save();
  }
  function drawPests(now) {
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (state.bag.gold) {
      const [x, y] = bagPlace();
      g.font = "80px system-ui";
      g.fillText("💰", x, y - 40 + Math.sin(now / 300) * 4);
      g.font = "800 34px system-ui";
      g.fillStyle = "#ffd56b";
      g.strokeStyle = "#2a1600";
      g.lineWidth = 6;
      g.strokeText(`+${state.bag.gold}`, x, y - 105);
      g.fillText(`+${state.bag.gold}`, x, y - 105);
      g.fillStyle = "#000";
    }
    for (const w of state.weeds) {
      g.font = "64px system-ui";
      g.fillText("🌿", w.x, w.y - 30);
    }
    for (const p of state.pests) {
      const at = pestPlace(p);
      if (!at) continue;
      const bob = Math.sin(now / 180 + at[0]) * 6;
      g.font = `${p.kind === "mole" ? 90 : 72}px system-ui`;
      g.fillText(PESTS[p.kind].emoji, at[0], at[1] + bob);
    }
  }

  // ---------- Sowing and gathering ----------
  // Sow one empty bed with a seed of the crop (used up); gather one ripe bed into the barn.
  function sow(b, id) {
    if (b.crop || !(state.seeds[id] > 0)) return false;
    job(b);
    state.seeds[id]--;
    b.crop = id;
    b.at = state.time;
    // A greenhouse near the bed: it grows 1.2 times faster.
    if (state.objects.some((o) => o.kind === "greenhouse" && Math.hypot(o.x - b.x, o.y - b.y) < GREEN_R)) b.at -= CROPS[id].grow * MINUTE * (1 - 1 / 1.2);
    b.wet = false;
    b.boost = 0;
    b.fast = false;
    gain(4, "sow", id);
    return true;
  }
  function gather(b) {
    if (!ripe(b)) return false;
    job(b);
    // A mutation now and then: one fighter more (5%).
    const twin = Math.random() < 0.05,
      n = CROPS[b.crop].yield + (b.boost || 0) + (twin ? 1 : 0);
    gloryHarvest(b.crop, n);
    if (twin) say(`Мутация! С грядки на одного бойца больше: ${CROPS[b.crop].name.toLowerCase()} +1.`);
    state.barn[b.crop] = (state.barn[b.crop] || 0) + n;
    floaters.push({ b, text: `+${n}`, t0: performance.now() });
    const [sx, sy] = toScreen(b.x, b.y - 80);
    for (let i = 0; i < n; i++) flyers.push({ crop: b.crop, x: sx + i * 14, y: sy, t0: performance.now() + i * 120 });
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    gain(10, "harvest", b.crop);
    b.crop = null;
    b.wet = false;
    b.boost = 0;
    b.fast = false;
    return true;
  }
  // A few butterflies drifting over the field, for life.
  const butterflies = Array.from({ length: 6 }, (_, i) => ({
    cx: (Math.random() - 0.5) * 900,
    cy: (Math.random() - 0.5) * 900,
    r: 60 + Math.random() * 90,
    s: 0.25 + Math.random() * 0.35,
    ph: Math.random() * 6,
    hue: ["#ffd84a", "#ffffff", "#ff9ad5", "#9fd8ff", "#ffb347", "#c9a7ff"][i],
  }));
  function drawButterflies(now) {
    g.setTransform(dpr * cam.zoom, 0, 0, dpr * cam.zoom, dpr * (W / 2 - cam.x * cam.zoom), dpr * (H / 2 - cam.y * cam.zoom));
    const t = now / 1000;
    for (const b of butterflies) {
      const a = t * b.s + b.ph,
        x = b.cx + Math.cos(a) * b.r + Math.sin(a * 2.3) * 14,
        y = b.cy + Math.sin(a * 1.4) * b.r * 0.5 - 60,
        flap = Math.abs(Math.sin(t * 14 + b.ph)) * 9 + 3;
      g.fillStyle = b.hue;
      g.beginPath();
      g.ellipse(x - flap / 2, y, flap / 2, 7, -0.4, 0, Math.PI * 2);
      g.ellipse(x + flap / 2, y, flap / 2, 7, 0.4, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Over each sown bed, at screen size: its crop in a ring that fills as it grows; over a ripe one, the sickle bobbing.
  // The badge over a bed: where it is on the screen and how big (it is also a button: a tap opens the bed's menu).
  const badgeR = () => Math.max(14, Math.min(24, 40 * cam.zoom));
  const badgeAt = (b) => toScreen(b.x + 150, b.y - 150);
  // The bed whose badge is under a tap, with a generous margin for the finger.
  function badgeUnder(sx, sy) {
    const r = badgeR() + 14;
    return beds().find((b) => {
      if (!b.crop) return false;
      const [x, y] = badgeAt(b);
      return Math.hypot(sx - x, sy - (y - 4)) < r;
    });
  }
  function drawBadges(now) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = badgeR();
    for (const b of beds()) {
      if (!b.crop || b === ghost?.moving) continue;
      // In the bed's back right corner, clear of the warriors.
      const [x, y0] = badgeAt(b);
      if (x < -40 || x > W + 40 || y0 < -40 || y0 > H + 40) continue;
      const done = ripe(b),
        y = y0 - (done ? 4 + 4 * Math.sin(now / 200 + b.x) : 0);
      // A ripe bed shows just the basket, bobbing (no disc behind it); a growing one its crop in a ring of progress.
      if (done) {
        const icon = pic["icon-basket"];
        if (icon?.naturalWidth) {
          g.save();
          g.shadowColor = "rgba(0,0,0,0.55)";
          g.shadowBlur = 6;
          g.shadowOffsetY = 2;
          g.drawImage(icon, x - r * 1.05, y - r * 1.05, r * 2.1, r * 2.1);
          g.restore();
        }
        continue;
      }
      g.beginPath();
      g.arc(x, y, r + 3, 0, Math.PI * 2);
      g.fillStyle = "#0b1710cc";
      g.fill();
      {
        g.beginPath();
        g.arc(x, y, r + 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, growth(b)));
        // Red while a pest holds the bed (its growth stands still).
        g.strokeStyle = pestOn(b) ? "#ff5a4a" : "#9bd96b";
        g.lineWidth = 4;
        g.stroke();
      }
      const icon = face[b.crop];
      if (icon && (icon.width || icon.naturalWidth)) g.drawImage(icon, x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
      // A dry bed asks for water: a drop beside its badge.
      if (!b.wet) {
        g.font = `${Math.round(r * 1.1)}px system-ui`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("💧", x - r * 1.7, y);
      }
    }
  }
  // Fighters flying from a gathered bed into the barn button: a small portrait along an arc, then the button bounces.
  const flyers = [];
  function drawFlyers(now) {
    if (!flyers.length) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const btn = $("#barnBtn").getBoundingClientRect(),
      cr = canvas.getBoundingClientRect(),
      tx = btn.left + btn.width / 2 - cr.left,
      ty = btn.top + btn.height / 3 - cr.top;
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i],
        k = (now - f.t0) / 700;
      if (k < 0) continue;
      if (k >= 1) {
        flyers.splice(i, 1);
        const b = $("#barnBtn");
        b.classList.remove("pulse");
        void b.offsetWidth;
        b.classList.add("pulse");
        continue;
      }
      const x = f.x + (tx - f.x) * k,
        y = f.y + (ty - f.y) * k - Math.sin(Math.PI * k) * 120,
        s = 44 * (1 - 0.4 * k);
      if (face[f.crop]) g.drawImage(face[f.crop], x - s / 2, y - s / 2, s, s);
    }
  }
  // "+2" rising over a gathered bed.
  const floaters = [];
  function drawFloaters(now) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i],
        k = (now - f.t0) / 900;
      if (k >= 1) {
        floaters.splice(i, 1);
        continue;
      }
      const [x, y] = toScreen(f.b.x, f.b.y - 80);
      g.globalAlpha = 1 - k;
      g.font = "900 22px system-ui";
      g.fillStyle = "#ffd56b";
      g.strokeStyle = "#2a1600";
      g.lineWidth = 4;
      g.strokeText(f.text, x - 14, y - 40 - k * 40);
      g.fillText(f.text, x - 14, y - 40 - k * 40);
      g.globalAlpha = 1;
    }
  }

  // ---------- The menu by the finger: crops to sow, or the sickle ----------
  const menu = $("#menu");
  function showMenu(sx, sy, html) {
    menu.innerHTML = html;
    menu.hidden = false;
    const r = menu.getBoundingClientRect(),
      x = Math.max(8, Math.min(W - r.width - 8, sx - r.width / 2)),
      y = sy - r.height - 40 < 70 ? sy + 40 : sy - r.height - 40;
    menu.style.left = x + "px";
    menu.style.top = y + "px";
  }
  function hideMenu() {
    menu.hidden = true;
  }
  function seedMenu(sx, sy) {
    showMenu(
      sx,
      sy,
      `<p>Нажмите на семя — оно посадится на эту грядку. Или ведите его пальцем по пустым грядкам, чтобы засадить сразу несколько</p><div class="seeds">${Object.keys(CROPS)
        .filter((id) => opened(id))
        .map(
          (id) =>
            `<button class="seed${state.seeds[id] > 0 ? "" : " none"}" data-crop="${id}">${faceImg(id)}<b>${state.seeds[id] || 0}</b><small>${clock(CROPS[id].grow * MINUTE)} → ${CROPS[id].yield}</small></button>`,
        )
        .join("")}</div><button class="tobazaar" data-bazaar="1">Купить семена на Базаре</button>`,
    );
  }
  function sickleMenu(sx, sy) {
    showMenu(sx, sy, `<p>Нажмите на корзину — бойцы с этой грядки уйдут в амбар. Или ведите её пальцем по готовым грядкам, чтобы собрать сразу несколько</p><div class="seeds"><button class="seed sickle" data-sickle="1"><img class="face" src="/assets/garden/icon-basket.png" alt=""></button></div>`);
  }
  function growingTip(sx, sy, b) {
    const pest = pestOn(b);
    showMenu(
      sx,
      sy,
      `<p class="tip">${faceImg(b.crop)}<span><b>${CROPS[b.crop].name}</b><br>${pest ? `<em class="stop">${PESTS[pest.kind].name} — рост стоит</em>` : `созреет через ${clock(left(b))}`}</span></p>` +
        (b.wet ? `<p class="wet">💧 Полита: растёт быстрее</p>` : `<button class="tobazaar" data-water="1">💧 Полить — расти быстрее</button>`) +
        (b.boost ? `<p class="wet">🧪 Удобрено: +${b.boost} к урожаю</p>` : `<button class="tobazaar" data-fert="yield">🧪 Удобрить урожай: +${CROPS[b.crop].boost} · у вас ${state.items.yield}</button>`) +
        (b.fast ? `<p class="wet">⚡ Растёт вдвое быстрее</p>` : `<button class="tobazaar" data-fert="grow">⚡ Ускорить рост ×2 · у вас ${state.items.grow}</button>`),
    );
  }
  // A finger put on a crop or the sickle in the menu takes it; sliding it over the map sows or gathers each bed it
  // passes. A tap on it (no slide) does the bed the menu was opened for.
  let menuBed = null;
  menu.addEventListener("click", (e) => {
    if (e.target.closest("[data-bazaar]")) hideMenu(), open(bazaarCard);
    if (e.target.closest("[data-water]") && menuBed && water(menuBed)) hideMenu(), say("Полито: грядка растёт быстрее."), save();
    const fert = e.target.closest("[data-fert]")?.dataset.fert;
    if (fert && menuBed) {
      if (!(state.items[fert] > 0)) return hideMenu(), open(bazaarCard), say(`Нет: ${FERTS[fert].name.toLowerCase()}. Купите на Базаре.`);
      if (fertilize(menuBed, fert)) hideMenu(), say(fert === "yield" ? `Удобрено: урожай +${menuBed.boost}.` : "Удобрено: растёт вдвое быстрее."), save();
    }
  });
  menu.addEventListener("pointerdown", (e) => {
    const b = e.target.closest("[data-crop],[data-sickle]");
    if (!b) return;
    e.preventDefault();
    if (b.dataset.crop && !(state.seeds[b.dataset.crop] > 0)) return say(`Нет семян: ${CROPS[b.dataset.crop].name.toLowerCase()}. Купите на Базаре.`);
    tool = b.dataset.crop ? { kind: "seed", crop: b.dataset.crop } : { kind: "sickle" };
    tool.id = e.pointerId;
    tool.done = 0;
    hideMenu();
    ({ x: tool.x, y: tool.y } = local(e));
    tool.x0 = tool.x;
    tool.y0 = tool.y;
  });
  addEventListener("pointermove", (e) => {
    if (!tool || e.pointerId !== tool.id) return;
    ({ x: tool.x, y: tool.y } = local(e));
    // Sweeping over beds starts only once the finger has really moved: a trembling finger on the button does the bed
    // the menu was opened for, not the one that happens to lie under the menu.
    if (!tool.sweeping && Math.hypot(tool.x - tool.x0, tool.y - tool.y0) < 14) return;
    tool.sweeping = true;
    const b = bedUnder(tool.x, tool.y);
    if (!b) return;
    if (tool.kind === "seed" ? sow(b, tool.crop) : gather(b)) tool.done++;
    if (tool.kind === "seed" && !(state.seeds[tool.crop] > 0)) say(`Семена закончились: ${CROPS[tool.crop].name.toLowerCase()}.`);
  });
  addEventListener("pointerup", (e) => {
    if (!tool || e.pointerId !== tool.id) return;
    if (!tool.done && menuBed) tool.kind === "seed" ? sow(menuBed, tool.crop) : gather(menuBed);
    tool = null;
    menuBed = null;
    save();
  });
  // Taken away by the system (a Telegram swipe, a call): the seed or basket is let go, the map answers again.
  addEventListener("pointercancel", (e) => {
    if (!tool || e.pointerId !== tool.id) return;
    tool = null;
    menuBed = null;
    save();
  });

  // ---------- Touch on the map ----------
  // A pointer's place on the canvas.
  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  const pointers = new Map();
  let drag = null; // { kind: "pan" | "ghost" }
  let pinch = null;
  let press = null, // a long press on an object picks it up to move it
    pressAt = null; // where and when that press began: a ring fills round the finger till it takes
  function cancelPress() {
    clearTimeout(press);
    pressAt = null;
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (tool) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
    hideMenu();
    const p = local(e);
    pointers.set(e.pointerId, { ...p, x0: p.x, y0: p.y, t0: performance.now() });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: cam.zoom };
      drag = null;
      cancelPress();
      return;
    }
    const [wx, wy] = toWorld(p.x, p.y);
    if (ghost) {
      const [l, t, r, b] = footOf(ghost, 40);
      // A finger on the object being placed drags it; elsewhere it moves the map.
      if (wx > l && wx < r && wy > t - 120 && wy < b) return (drag = { kind: "ghost", dx: ghost.x - wx, dy: ghost.y - wy });
    }
    drag = { kind: "pan", cx: cam.x, cy: cam.y };
    cancelPress();
    const o = !ghost && objectAt(p.x, p.y);
    if (o) (press = setTimeout(() => pickUp(o), 550)), (pressAt = { x: p.x, y: p.y, t0: performance.now() });
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    ({ x: p.x, y: p.y } = local(e));
    if (Math.hypot(p.x - p.x0, p.y - p.y0) > 10) cancelPress();
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      cam.zoom = (pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d;
      clampCam();
    } else if (drag?.kind === "pan") {
      const weed = Math.hypot(p.x - p.x0, p.y - p.y0) > 12 && weedUnder(p.x, p.y);
      if (weed) pullWeed(weed);
      cam.x = drag.cx - (p.x - p.x0) / cam.zoom;
      cam.y = drag.cy - (p.y - p.y0) / cam.zoom;
      clampCam();
    } else if (drag?.kind === "ghost") {
      const [wx, wy] = toWorld(p.x, p.y);
      // Snapped to 10 px, so rows line up easily.
      ghost.x = Math.round((wx + drag.dx) / 10) * 10;
      ghost.y = Math.round((wy + drag.dy) / 10) * 10;
    }
  });
  const up = (e, cancelled = false) => {
    cancelPress();
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!p) return;
    const tap = Math.hypot(p.x - p.x0, p.y - p.y0) < 10 && performance.now() - p.t0 < 500;
    if (tap && !cancelled && drag?.kind !== "ghost" && !pointers.size) onTap(p.x, p.y);
    if (!pointers.size) drag = null;
  };
  canvas.addEventListener("pointerup", up);
  // A touch taken away by the system is no tap.
  canvas.addEventListener("pointercancel", (e) => up(e, true));
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      cam.zoom *= e.deltaY < 0 ? 1.1 : 1 / 1.1;
      clampCam();
    },
    { passive: false },
  );
  function onTap(sx, sy) {
    // With the drawer out, a tap on the field folds it back (and does nothing else).
    if ($("#drawer").classList.contains("open")) return toggleDrawer(false);
    if (ghost) {
      // A tap on the ground moves the object being placed there.
      const [wx, wy] = toWorld(sx, sy);
      ghost.x = Math.round(wx / 10) * 10;
      ghost.y = Math.round(wy / 10) * 10;
      return;
    }
    if (bagUnder(sx, sy)) return emptyBag();
    const pest = pestUnder(sx, sy);
    if (pest) return hitPest(pest);
    if (weedUnder(sx, sy)) return say("Сорняк: проведите по нему пальцем, чтобы вырвать.");
    // The bed itself, or its badge (which stands above its back corner, partly off the bed).
    const b = badgeUnder(sx, sy) || bedUnder(sx, sy);
    if (b) {
      menuBed = b;
      if (!b.crop) return seedMenu(sx, sy);
      if (ripe(b)) return sickleMenu(sx, sy);
      return growingTip(sx, sy, b);
    }
    const o = objectAt(sx, sy),
      opens = o && KINDS[o.kind].opens;
    if (opens === "shop") return toggleDrawer(true);
    if (opens === "barn") return open(barnCard);
    if (opens === "bazaar") return open(bazaarCard);
    if (opens === "lab") return open(labCard);
    if (opens === "orders") return open(ordersCard);
    if (o) say(`${KINDS[o.kind].name}. ${KINDS[o.kind].fixed ? "Подержите палец, чтобы снести." : "Подержите палец, чтобы передвинуть."}`);
  }
  // A long press on an object picks it up to move it; a bed or a building is not moved but offered for razing.
  function pickUp(o) {
    pressAt = null;
    if (pointers.size !== 1) return;
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");
    const k = KINDS[o.kind];
    if (k.fixed) {
      if (o.kind === "bed" && o.crop) return say("На грядке растут бойцы: соберите их, потом грядку можно снести.");
      razing = o;
      hideMenu();
      return placeBar("raze");
    }
    const p = [...pointers.values()][0],
      [wx, wy] = toWorld(p.x, p.y);
    drag = { kind: "ghost", dx: o.x - wx, dy: o.y - wy };
    ghost = { kind: o.kind, x: o.x, y: o.y, moving: o };
    startPlacing();
  }

  // ---------- Level, tasks, the army ----------
  // Experience for sowing and gathering; each level asks for more and pays some gold.
  const needFor = (level) => 40 + level * 30;
  function gain(xp, what, crop) {
    state.xp += xp;
    while (state.xp >= needFor(state.level)) {
      state.xp -= needFor(state.level);
      state.level++;
      state.gold += 500;
      say(`Уровень огорода ${state.level}! +500 золота`);
    }
    for (const q of state.quests) if (!q.done && q.what === what && q.crop === crop) (q.have = Math.min(q.need, q.have + (what === "harvest" ? CROPS[crop].yield : 1))), (q.done = q.have >= q.need);
    renderQuests();
  }
  // Three tasks at a time: sow or gather so much of a crop, for gold. A finished one is taken by a tap.
  function newQuest() {
    const ids = STARTERS,
      crop = ids[Math.floor(Math.random() * Math.min(ids.length, 2 + state.level))],
      what = Math.random() < 0.5 ? "sow" : "harvest",
      need = what === "sow" ? 2 + Math.floor(Math.random() * 3) : 4 + 2 * Math.floor(Math.random() * 3);
    return { what, crop, need, have: 0, done: false, gold: 10 * (need * (what === "sow" ? 8 : 6) + 10 * state.level) };
  }
  while (state.quests.length < 3) state.quests.push(newQuest());
  // The tasks fold into one button, so they do not cover the beds; it glows when one is done.
  $("#qbtn").onclick = () => ($("#quests").hidden = !$("#quests").hidden);
  function renderQuests() {
    const done = state.quests.filter((q) => q.done).length;
    $("#qcount").textContent = done ? `${done} готово` : `${state.quests.length}`;
    $("#qbtn").classList.toggle("ready", done > 0);
    $("#quests").innerHTML = state.quests
      .map(
        (q, i) =>
          `<li class="${q.done ? "done" : ""}" data-q="${i}">${faceImg(q.crop)}<span>${q.what === "sow" ? "Посадить" : "Собрать"} ${CROPS[q.crop].name.toLowerCase()}: ${q.have}/${q.need}</span><small>${q.done ? "Забрать " : ""}+${q.gold}</small></li>`,
      )
      .join("");
    $("#quests")
      .querySelectorAll("li.done")
      .forEach(
        (li) =>
          (li.onclick = () => {
            const q = state.quests[+li.dataset.q];
            state.gold += q.gold;
            state.quests[+li.dataset.q] = newQuest();
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
            say(`Задание выполнено: +${q.gold} золота`);
            save();
            renderQuests();
          }),
      );
  }
  // The army: every fighter in the barn; a squad of six can go to battle.
  function renderArmy() {
    const n = Object.values(state.barn).reduce((a, b) => a + b, 0);
    const t = n >= 6 ? `Армия: ${n}` : `Армия: ${n}/6`;
    if ($("#army").textContent !== t) $("#army").textContent = t;
    $("#fight").classList.toggle("ready", n >= 6);
  }
  // With fewer than six in the barn there is no squad: the battle is not opened.
  $("#fight").addEventListener("click", (e) => {
    const n = Object.values(state.barn).reduce((a, b) => a + b, 0);
    if (n >= 6) return save();
    e.preventDefault();
    say(`Для боя нужно 6 бойцов, в амбаре ${n}. Вырастите ещё на грядках.`);
  });

  // ---------- Panels ----------
  let panel = null;
  function open(fn) {
    panel = fn;
    $("#sheet").hidden = false;
    hideMenu();
    fn();
  }
  function close() {
    panel = null;
    $("#sheet").hidden = true;
  }
  $("#sheet").addEventListener("click", (e) => {
    if (e.target === $("#sheet")) close();
  });
  const show_ = (card) => card();
  function show(html) {
    const box = $("#sheet"),
      scrolled = box.firstElementChild?.scrollTop || 0;
    box.innerHTML = `<div class="card">${html}<div class="foot"><button class="back" data-do="close">← Назад</button></div></div>`;
    box.firstElementChild.scrollTop = scrolled;
    box.querySelectorAll("[data-do]").forEach((b) => (b.onclick = () => act(b.dataset.do, b.dataset.arg)));
  }
  const goldTag = (n) => `<img src="/assets/garden/icon-gold.png" alt="">${n}`;
  // The shop: beds and everything else that can be put on the ground.
  function shopCard() {
    const row = (kind) => {
      const k = KINDS[kind];
      return `<div class="row"><img class="face" src="/assets/garden/obj/${k.pic}.png" alt=""><div class="what"><b>${k.name}</b>${kind === "bed" ? "<small>Сажать — проведите семенем по пустой грядке.</small>" : ""}</div>
        <button class="buy" data-do="buy" data-arg="${kind}" ${state.gold < k.price ? "disabled" : ""}>${goldTag(k.price)}</button></div>`;
    };
    show(
      `<h3><img src="/assets/garden/icon-seed.png" alt="">Лавка</h3><p>Купите и поставьте куда хотите. Любой объект можно передвинуть: подержите на нём палец.</p>
      <h4>Грядки</h4>${row("bed")}
      <h4>Постройки</h4>${["well", "trade-stall"].map(row).join("")}
      <h4>Лагерь</h4>${["palisade", "palisade-corner", "gate", "banner-stand", "banner", "dummy", "spear-rack", "shield-rack"].map(row).join("")}
      <h4>Декор</h4>${["crates-barrels", "hay-sacks", "rocks-big", "rocks-small", "rock-moss", "bush", "bush-berries", "bush-white", "bush-yellow", "fern", "fern2", "stump", "logs"].map(row).join("")}`,
    );
  }
  function barnCard() {
    show(
      `<h3><img src="/assets/garden/icon-barn.png" alt="">Амбар</h3><p>Собранные бойцы. Сколько бойцов вида в амбаре — столько можно взять в отряд. Пал в двух раундах из трёх — погиб. Сажают семена с Базара.</p>
      ${Object.keys(CROPS)
        .filter((id) => opened(id) || state.barn[id] > 0)
        .map((id) => `<div class="row">${faceImg(id)}<div class="what"><b>${CROPS[id].name}</b><small>${CROPS[id].words} · растёт ${clock(CROPS[id].grow * MINUTE)}</small></div><span class="n">${state.barn[id] || 0}</span></div>`)
        .join("")}`,
    );
  }
  // The bazaar: seeds of the starting crops and fertilizers from the game; seeds of new crops and fighters from other
  // players (that needs the server: shown empty for now).
  function bazaarCard() {
    const seedRow = (id) =>
      `<div class="row">${faceImg(id)}<div class="what"><b>Семена: ${CROPS[id].name}</b><small>растёт ${clock(CROPS[id].grow * MINUTE)} · с грядки ${CROPS[id].yield} · с удобрением +${CROPS[id].boost} · у вас ${state.seeds[id] || 0}</small></div>
        <button class="buy" data-do="seed" data-arg="${id}" ${state.gold < CROPS[id].seed ? "disabled" : ""}>${goldTag(CROPS[id].seed)}</button></div>`;
    show(
      `<h3><img src="/assets/garden/icon-gold.png" alt="">Базар</h3><p>Семя одноразовое: одно семя — одна посадка.</p>
      <h4>Семена от игры</h4>${STARTERS.map(seedRow).join("")}
      <h4>Удобрения от игры</h4>${Object.entries(FERTS)
        .map(
          ([k, f]) =>
            `<div class="row"><i class="emo">${f.emoji}</i><div class="what"><b>${f.name}</b><small>${k === "yield" ? "одна порция на грядку: больше бойцов (прибавка — на карточке семени)" : "одна порция на грядку: растёт вдвое быстрее"} · у вас ${state.items[k] || 0}</small></div>
        <button class="buy" data-do="fert" data-arg="${k}" ${state.gold < f.price ? "disabled" : ""}>${goldTag(f.price)}</button></div>`,
        )
        .join("")}
      <h4>Гномы-помощники</h4>${Object.entries(GNOMES)
        .map(
          ([role, gn]) =>
            `<div class="row"><i class="emo">${gn.emoji}</i><div class="what"><b>${gn.name}</b><small>${gn.text} · навсегда · у вас ${state.gnomes.filter((r) => r === role).length}</small></div>
        <button class="buy" data-do="gnome" data-arg="${role}" ${state.gold < gnomePrice(role) ? "disabled" : ""}>${goldTag(gnomePrice(role))}</button></div>`,
        )
        .join("")}
      <h4>От игроков</h4><p class="soon">Здесь будут семена новых культур и готовые бойцы от других игроков. Появится, когда заработает сервер.</p>`,
    );
  }
  // ---------- The gardener's glory ----------
  // Points of the harvest (decided 14.11.2026; numbers for the test): each fighter gathered × the crop's weight
  // (√(grow / 10 min): long crops weigh more), +20 for a crop gathered for the first time this week, +30 an order,
  // a streak of days in a row up to ×1.15; above 300 a day only a fifth counts. Decor gives none. Titles and the
  // dwelling follow the total; seasonal tables need the server.
  const G_TITLES = [
    [0, "Росток"],
    [800, "Грядочник"],
    [2000, "Огородник"],
    [3500, "Садовод"],
    [5000, "Агроном"],
    [6500, "Мастер урожая"],
  ];
  const B_TITLES = [
    [0, "Новобранец"],
    [300, "Боец"],
    [1500, "Ветеран"],
    [5000, "Полководец"],
  ];
  const titleOf = (list, n) => list.filter(([at]) => n >= at).pop()[1];
  const nextOf = (list, n) => list.find(([at]) => at > n);
  const DAY = 86400000;
  {
    const gl = (state.glory ||= { total: 0, day: 0, today: 0, streak: 0, week: 0, crops: [] }),
      day = Math.floor(Date.now() / DAY);
    if (gl.day !== day) {
      gl.streak = gl.day === day - 1 ? gl.streak + 1 : Math.max(0, gl.streak - 1);
      gl.day = day;
      gl.today = 0;
    }
    const week = Math.floor(Date.now() / (7 * DAY));
    if (gl.week !== week) (gl.week = week), (gl.crops = []);
  }
  function addGlory(points) {
    const gl = state.glory,
      p = points * Math.min(1.15, 1 + 0.02 * gl.streak),
      full = Math.max(0, Math.min(p, 300 - gl.today)),
      counted = full + (p - full) * 0.2;
    gl.today += p;
    gl.total += counted;
  }
  function gloryHarvest(id, n) {
    addGlory(n * Math.sqrt(CROPS[id].grow / 10));
    if (!state.glory.crops.includes(id)) state.glory.crops.push(id), addGlory(20);
  }
  // Dwellings: the one the glory allows (1..5 by the titles from «Грядочник»), the one standing (0: a meadow).
  const homeAllowed = () => Math.min(5, G_TITLES.filter(([at]) => state.glory.total >= at).length - 1);
  const homeStanding = () => Math.max(0, ...state.objects.map((o) => KINDS[o.kind].dwelling || 0));
  // The battle's glory is kept by the battle page (localStorage "glory-battle").
  const battleGlory = () => {
    try {
      return +localStorage.getItem("glory-battle") || 0;
    } catch {
      return 0;
    }
  };
  function gloryCard() {
    const n = Math.floor(state.glory.total),
      nx = nextOf(G_TITLES, n),
      b = battleGlory(),
      bt = titleOf(B_TITLES, b),
      home = homeStanding(),
      homeName = home ? Object.values(KINDS).find((k) => k.dwelling === home).name : "Луг",
      homeEmoji = home ? Object.values(KINDS).find((k) => k.dwelling === home).emoji : "🌾";
    show(
      `<h3>🌾 Слава огородника</h3>
      <p class="glory"><b>${n}</b> очков урожая · звание <b>${titleOf(G_TITLES, n)}</b>${nx ? ` · до «${nx[1]}» ещё ${nx[0] - n}` : ""}</p>
      <p>Очки дают: сбор урожая (долгие культуры весят больше), новая за неделю культура +20, заказ +30, серия дней подряд — до ×1,15 (сейчас дней: ${state.glory.streak}). Сверх 300 в день засчитывается пятая часть. Декор очков не даёт.</p>
      <p>Слава улучшает жилище: луг → палатка → шалаш → бревенчатый дом → каменный дом → замок. Новое жилище ставится из «Стройки», старое исчезает.${homeAllowed() > home ? ` <b>Доступно новое жилище!</b>` : ""}</p>
      <h4>Карточка героя</h4>
      <div class="hero-card"><div class="hc-home">${homeEmoji}</div><div><b>${homeName}</b><br>Огородник: ${titleOf(G_TITLES, n)} · ${n}<br>Боец: ${bt} · ${b} боевой славы<br><small>Облик воина: «${bt}» (боевая слава открывает облики целиком)</small></div></div>
      <p class="soon">Таблицы лидеров по сезонам (4 недели) появятся, когда заработает сервер.</p>`,
    );
  }

  // ---------- The order board ----------
  // 3 to 5 orders: some fighters of the garden's crops for gold (80 a fighter and 50 more) and experience; a new one
  // every hour, up to five. Taking them is up to the player.
  function newOrder() {
    const ids = Object.keys(CROPS).filter((id) => opened(id)),
      items = {},
      kinds = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < kinds; i++) {
      const id = ids[Math.floor(Math.random() * ids.length)];
      items[id] = (items[id] || 0) + 2 + Math.floor(Math.random() * 3);
    }
    const n = Object.values(items).reduce((a, b) => a + b, 0);
    return { items, gold: 80 * n + 50, xp: 5 * n };
  }
  function stepOrders() {
    state.nextOrder ??= state.time + 60 * MINUTE;
    while (state.orders.length < 3) state.orders.push(newOrder());
    if (state.time >= state.nextOrder) {
      if (state.orders.length < 5) state.orders.push(newOrder());
      state.nextOrder = state.time + 60 * MINUTE;
    }
  }
  const canDo = (o) => Object.entries(o.items).every(([id, n]) => (state.barn[id] || 0) >= n);
  function ordersCard() {
    show(
      `<h3>📋 Доска заказов</h3><p>Отдайте бойцов из амбара — получите золото. Новый заказ раз в час, всего до пяти. Брать заказы не обязательно.</p>${state.orders
        .map(
          (o, i) =>
            `<div class="row"><div class="what"><b>${Object.entries(o.items)
              .map(([id, n]) => `${CROPS[id].name} ×${n} <small>(у вас ${state.barn[id] || 0})</small>`)
              .join(", ")}</b><small>+${o.xp} опыта</small></div><button class="buy" data-do="order" data-arg="${i}" ${canDo(o) ? "" : "disabled"}>${goldTag(o.gold)}</button></div>`,
        )
        .join("")}<p class="soon">Следующий заказ через ${clock(Math.max(0, state.nextOrder - state.time))}.</p>`,
    );
  }

  // ---------- The laboratory ----------
  // Study a new crop (gold and time; one study at a time); a studied crop's seeds are then made here (three at a time,
  // for half their price each, in 10 minutes). Prices are for the test: the n-th study costs 2000 + 1000·n gold and
  // takes 1 + n hours.
  const opened = (id) => !CROPS[id].locked || state.lab.opened.includes(id);
  const studyCost = () => 2000 + 1000 * state.lab.opened.length,
    studyTime = () => (1 + state.lab.opened.length) * 60 * MINUTE,
    MAKE_N = 3,
    makeCost = (id) => Math.round((CROPS[id].seed * MAKE_N) / 2),
    MAKE_TIME = 10 * MINUTE;
  function stepLab() {
    const L = state.lab;
    if (L.research && state.time >= L.research.until) {
      L.opened.push(L.research.id);
      say(`Лаборатория: изучена новая культура — ${CROPS[L.research.id].name}! Её семена делаются здесь же.`);
      L.research = null;
      save();
    }
    if (L.make && state.time >= L.make.until) {
      state.seeds[L.make.id] = (state.seeds[L.make.id] || 0) + L.make.n;
      say(`Лаборатория: готово ${L.make.n} семени — ${CROPS[L.make.id].name.toLowerCase()}.`);
      L.make = null;
      save();
    }
  }
  function labCard() {
    const L = state.lab,
      locked = Object.keys(CROPS).filter((id) => !opened(id)),
      mine = L.opened;
    show(
      `<h3>🧪 Лаборатория</h3><p>Изучите новую культуру — после этого её семена можно делать здесь. Новые культуры не сильнее старых, зато дают новые бонусы групп и тактики.</p>
      <h4>Исследование</h4>${
        L.research
          ? `<div class="row">${faceImg(L.research.id)}<div class="what"><b>${CROPS[L.research.id].name}</b><small>изучается · осталось ${clock(L.research.until - state.time)}</small></div></div>`
          : locked
              .map(
                (id) =>
                  `<div class="row">${faceImg(id)}<div class="what"><b>${CROPS[id].emoji} ${CROPS[id].name}</b><small>${CROPS[id].words} · изучать ${clock(studyTime())}</small></div><button class="buy" data-do="study" data-arg="${id}" ${state.gold < studyCost() ? "disabled" : ""}>${goldTag(studyCost())}</button></div>`,
              )
              .join("") || "<p>Изучены все культуры.</p>"
      }
      <h4>Свои семена</h4>${
        !mine.length
          ? `<p class="soon">Пока нечего делать: сначала изучите культуру.</p>`
          : L.make
            ? `<div class="row">${faceImg(L.make.id)}<div class="what"><b>${CROPS[L.make.id].name}: ${L.make.n} семени</b><small>делается · осталось ${clock(L.make.until - state.time)}</small></div></div>`
            : mine
                .map(
                  (id) =>
                    `<div class="row">${faceImg(id)}<div class="what"><b>${CROPS[id].name}: ${MAKE_N} семени</b><small>${clock(MAKE_TIME)} · у вас ${state.seeds[id] || 0}</small></div><button class="buy" data-do="make" data-arg="${id}" ${state.gold < makeCost(id) ? "disabled" : ""}>${goldTag(makeCost(id))}</button></div>`,
                )
                .join("")
      }`,
    );
  }
  function act(what, arg) {
    if (what === "close") return close();
    if (what === "order") {
      const o = state.orders[+arg];
      if (!o || !canDo(o)) return say("Не хватает бойцов в амбаре.");
      for (const [id, n] of Object.entries(o.items)) state.barn[id] -= n;
      state.gold += o.gold;
      state.orders.splice(+arg, 1);
      gain(o.xp, "order");
      addGlory(30);
      say(`Заказ выполнен: +${o.gold} золота.`);
      save();
      return show_(ordersCard);
    }
    if (what === "study") {
      if (state.lab.research) return say("В лаборатории уже идёт исследование.");
      const cost = studyCost();
      if (state.gold < cost) return say("Не хватает золота.");
      state.gold -= cost;
      state.lab.research = { id: arg, until: state.time + studyTime() };
      save();
      return show_(labCard);
    }
    if (what === "make") {
      if (state.lab.make) return say("Семена уже делаются.");
      const cost = makeCost(arg);
      if (state.gold < cost) return say("Не хватает золота.");
      state.gold -= cost;
      state.lab.make = { id: arg, n: MAKE_N, until: state.time + MAKE_TIME };
      save();
      return show_(labCard);
    }
    if (what === "gnome") {
      const price = gnomePrice(arg);
      if (state.gold < price) return say("Не хватает золота.");
      state.gold -= price;
      state.gnomes.push(arg);
      addGnome(arg);
      save();
      say(`${GNOMES[arg].name} пришёл в огород: ${GNOMES[arg].text}.`);
      return show_(bazaarCard);
    }
    if (what === "fert") {
      const f = FERTS[arg];
      if (state.gold < f.price) return say("Не хватает золота.");
      state.gold -= f.price;
      state.items[arg] = (state.items[arg] || 0) + 1;
      save();
      return show_(bazaarCard);
    }
    if (what === "seed") {
      const c = CROPS[arg];
      if (state.gold < c.seed) return say("Не хватает золота.");
      state.gold -= c.seed;
      state.seeds[arg] = (state.seeds[arg] || 0) + 1;
      save();
      return show_(bazaarCard);
    }
    if (what === "buy") {
      close();
      // The new object starts in the middle of the screen, or on the nearest free ground.
      const [cx, cy] = toWorld(W / 2, H / 2),
        probe = { kind: arg };
      let best = null;
      for (let r = 0; r < 1500 && !best; r += 40)
        for (let a = 0; a < 16 && !best; a++) {
          const x = Math.round((cx + Math.cos((a * Math.PI) / 8) * r) / 10) * 10,
            y = Math.round((cy + Math.sin((a * Math.PI) / 8) * r) / 10) * 10;
          if (fits(probe, x, y)) best = { x, y };
        }
      ghost = { kind: arg, ...(best || { x: Math.round(cx), y: Math.round(cy) }) };
      startPlacing();
    }
  }

  // ---------- The drawer: drag an object out of it onto the field ----------
  // Pressing an object in the drawer takes it in hand; it follows the finger over the field; let go on free ground
  // and it is bought and placed; let go over the drawer, or where it does not fit, and it is put back.
  const SHELVES = [
    ["Грядки", ["bed"]],
    ["Жилище", ["home-1", "home-2", "home-3", "home-4", "home-5"]],
    ["Постройки", ["laboratory", "greenhouse", "order-board", "armory", "market-tent", "well", "trade-stall"]],
    ["Лагерь", ["palisade", "palisade-corner", "gate", "banner-stand", "banner", "dummy", "spear-rack", "shield-rack"]],
    ["Декор", ["scarecrow", "crates-barrels", "barrels", "hay-sacks", "rocks-big", "rocks-small", "rock-moss", "bush", "bush-berries", "bush-white", "bush-yellow", "fern", "fern2", "stump", "logs"]],
  ];
  function renderDrawer() {
    $("#drawerList").innerHTML = SHELVES.map(
      ([title, kinds]) =>
        `<h5>${title}</h5>` +
        kinds
          // A building that stands one at a time is offered only while there is none.
          .filter((kind) => !KINDS[kind].unique || !state.objects.some((o) => o.kind === kind))
          .filter((kind) => !KINDS[kind].max || state.objects.filter((o) => o.kind === kind).length < KINDS[kind].max)
          .filter((kind) => !KINDS[kind].dwelling || (KINDS[kind].dwelling === homeAllowed() && KINDS[kind].dwelling > homeStanding()))
          .map((kind) => {
            const k = KINDS[kind],
              locked = k.level > state.level;
            return `<div class="item${state.gold < k.price || locked ? " poor" : ""}" data-kind="${kind}">${k.emoji ? `<i class="emo">${k.emoji}</i>` : `<img src="/assets/garden/obj/${k.pic}.png" alt="">`}<span>${k.name}${locked ? `<br>с ${k.level} уровня` : ""}</span><b>${k.price}</b></div>`;
          })
          .join(""),
    ).join("");
  }
  function toggleDrawer(open = !$("#drawer").classList.contains("open")) {
    if (open) renderDrawer(), hideMenu();
    $("#drawer").classList.toggle("open", open);
  }
  $("#drawerTab").onclick = () => toggleDrawer();
  // A finger on an item may mean to scroll the list (up or down) or to take the item (sideways, towards the field):
  // it is taken only once it has moved left. The items let the browser do nothing with the finger (touch-action: none),
  // so it never takes the gesture away midway to scroll; the list is scrolled here instead.
  let carry = null, // { id: the pointer, kind }
    maybe = null; // { id, kind, x, y, top, scroll }: a press on an item not yet decided, or scrolling the list
  $("#drawerList").addEventListener("pointerdown", (e) => {
    const item = e.target.closest(".item");
    if (!item || carry || (ghost && !ghost.fromDrawer)) return;
    ghost = null;
    maybe = { id: e.pointerId, kind: item.dataset.kind, x: e.clientX, y: e.clientY, top: $("#drawerList").scrollTop, scroll: false };
  });
  // If the browser or the system takes the finger away all the same, what was in hand is let go, not left hanging.
  addEventListener("pointercancel", (e) => {
    if (maybe && e.pointerId === maybe.id) maybe = null;
    if (carry && e.pointerId === carry.id) (carry = null), (ghost = null);
  });
  addEventListener("pointermove", (e) => {
    if (maybe && e.pointerId === maybe.id && !carry) {
      const dx = e.clientX - maybe.x,
        dy = e.clientY - maybe.y;
      if (maybe.scroll || (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx))) {
        maybe.scroll = true;
        $("#drawerList").scrollTop = maybe.top - dy;
        return;
      }
      if (dx > -14) return;
      const kind = maybe.kind;
      maybe = null;
      if (KINDS[kind].level > state.level) return say(`${KINDS[kind].name} откроется с ${KINDS[kind].level} уровня огорода.`);
      if (state.gold < KINDS[kind].price) return say(`Не хватает золота: ${KINDS[kind].name.toLowerCase()} стоит ${KINDS[kind].price}.`);
      carry = { id: e.pointerId, kind };
      ghost = { kind, x: 0, y: 0, fromDrawer: true };
      // The drawer folds away while the object is carried, so the whole field is free to put it on; let go at the
      // right edge (where the drawer's tab is) to put it back.
      $("#drawer").classList.remove("open");
      say("Отпустите на свободном месте. Передумали — отпустите у правого края.");
    }
    if (!carry || e.pointerId !== carry.id) return;
    const p = local(e),
      [wx, wy] = toWorld(p.x, p.y);
    ghost.x = Math.round(wx / 10) * 10;
    ghost.y = Math.round((wy - 40 / cam.zoom) / 10) * 10;
  });
  addEventListener("pointerup", (e) => {
    if (maybe && e.pointerId === maybe.id) {
      // A tap on an item (not a scroll of the list): say how to use it.
      if (!maybe.scroll) say(`Потяните «${KINDS[maybe.kind].name}» влево на поле, чтобы поставить.`);
      maybe = null;
    }
    if (!carry || e.pointerId !== carry.id) return;
    const k = KINDS[carry.kind],
      cr = canvas.getBoundingClientRect(),
      overDrawer = e.clientX > cr.right - 46;
    carry = null;
    if (overDrawer) return (ghost = null), say("Не куплено.");
    if (!fits(ghost, ghost.x, ghost.y)) {
      ghost = null;
      return say("Здесь тесно: вокруг нужен проход. Перетащите в другое место.");
    }
    state.gold -= k.price;
    const o = { kind: ghost.kind, x: ghost.x, y: ghost.y };
    if (o.kind === "bed") Object.assign(o, { crop: null, at: 0 });
    // A new dwelling: the old one is gone.
    if (k.dwelling) state.objects = state.objects.filter((q) => !KINDS[q.kind].dwelling);
    state.objects.push(o);
    ghost = null;
    save();
    renderDrawer();
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");
    say(`Поставлено: ${k.name.toLowerCase()} · −${k.price}`);
  });

  // ---------- Placing and moving ----------
  // The bar at the bottom says plainly what each button does, for the one object in hand:
  //   new  — a bought object not yet placed: "Не покупать" / "Купить и поставить · N";
  //   move — an object picked up: "Вернуть на место" / "Продать за N" / "Поставить сюда";
  //   more — just placed a bought one: "Готово" / "Ещё одну · N" (the next appears beside it).
  let lastPlaced = null,
    razing = null; // a bed or building offered for razing (they are not moved)
  function placeBar(mode) {
    const box = $("#place"),
      k = ghost ? KINDS[ghost.kind] : razing ? KINDS[razing.kind] : lastPlaced && KINDS[lastPlaced.kind],
      o = ghost?.moving,
      sellable = o && !KINDS[o.kind].unique && !(o.kind === "bed" && o.crop),
      btn = (id, cls, text) => `<button class="${cls}" data-p="${id}">${text}</button>`;
    box.innerHTML =
      mode === "raze"
        ? btn("keep", "no", "Оставить") + btn("raze", "no del", `Снести · вернётся ${Math.floor((k.price || 0) / 2)}`)
        : mode === "new"
        ? btn("cancel", "no", "✕ Не покупать") + btn("ok", "ok", `✓ Купить и поставить · ${k.price}`)
        : mode === "move"
          ? btn("cancel", "no", "↩ Вернуть на место") + (sellable ? btn("sell", "no del", `Продать за ${Math.floor((k.price || 0) / 2)}`) : "") + btn("ok", "ok", "✓ Поставить сюда")
          : btn("done", "no", "Готово") + btn("more", "ok", `+ Ещё одну · ${k.price}`);
    box.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => placeAct(b.dataset.p)));
    if (mode === "more") box.querySelector('[data-p="more"]').disabled = state.gold < k.price;
    $("#bottom").hidden = true;
    box.hidden = false;
  }
  function startPlacing() {
    hideMenu();
    lastPlaced = null;
    // The object in hand is always in sight: the view moves to it if it is off the screen.
    const [sx, sy] = toScreen(ghost.x, ghost.y - 80);
    if (sx < 40 || sx > W - 40 || sy < 60 || sy > H - 40) ([cam.x, cam.y] = [ghost.x, ghost.y - 80]), clampCam();
    placeBar(ghost.moving ? "move" : "new");
  }
  // The free spot nearest to an object (beside it first), for the next one of its kind.
  function spotBeside(o) {
    const [hw, d] = KINDS[o.kind].foot;
    for (const [dx, dy] of [[2 * hw + GAP, 0], [0, d + GAP], [-(2 * hw + GAP), 0], [0, -(d + GAP)], [2 * hw + GAP, d + GAP], [-(2 * hw + GAP), d + GAP]]) {
      const c = { x: o.x + dx, y: o.y + dy };
      if (fits({ kind: o.kind }, c.x, c.y)) return c;
    }
    return null;
  }
  function placeAct(what) {
    if (what === "cancel" || what === "done" || what === "keep") return endPlacing();
    if (what === "raze") {
      const o = razing;
      if (!o) return endPlacing();
      // Razed: gone, half its price back. A new one is bought and placed from the drawer.
      state.objects.splice(state.objects.indexOf(o), 1);
      state.gold += Math.floor((KINDS[o.kind].price || 0) / 2);
      for (const w of walkers) (w.jobs = w.jobs.filter((j) => j !== o)), w.doing === o && (w.doing = null), (w.aim = null);
      save();
      say(`Снесено: ${KINDS[o.kind].name.toLowerCase()} · +${Math.floor((KINDS[o.kind].price || 0) / 2)}`);
      renderDrawer();
      return endPlacing();
    }
    if (what === "more") {
      const c = lastPlaced && spotBeside(lastPlaced);
      if (!c) return say("Рядом нет места — откройте лавку и поставьте в другом месте.");
      ghost = { kind: lastPlaced.kind, ...c };
      return startPlacing();
    }
    if (what === "sell") {
      const o = ghost?.moving;
      if (!o) return;
      // Sold back for half its price.
      state.objects.splice(state.objects.indexOf(o), 1);
      state.gold += Math.floor((KINDS[o.kind].price || 0) / 2);
      for (const w of walkers) (w.jobs = w.jobs.filter((j) => j !== o)), w.doing === o && (w.doing = null), (w.aim = null);
      save();
      return endPlacing();
    }
    // ok
    if (!ghost) return;
    if (ghost.moving) {
      if (!fits(ghost.moving, ghost.x, ghost.y)) return say("Здесь тесно: вокруг нужен проход.");
      Object.assign(ghost.moving, { x: ghost.x, y: ghost.y });
      save();
      return endPlacing();
    }
    const k = KINDS[ghost.kind];
    if (state.gold < k.price) return say("Не хватает золота.");
    if (!fits(ghost, ghost.x, ghost.y)) return say("Здесь тесно: вокруг нужен проход.");
    state.gold -= k.price;
    const o = { kind: ghost.kind, x: ghost.x, y: ghost.y };
    if (o.kind === "bed") Object.assign(o, { crop: null, at: 0 });
    state.objects.push(o);
    save();
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");
    // Placed: nothing more in hand. The bar offers to finish or to buy one more of the same, beside it.
    ghost = null;
    lastPlaced = o;
    say(`Поставлено: ${k.name.toLowerCase()}.`);
    placeBar("more");
  }
  function endPlacing() {
    ghost = null;
    razing = null;
    lastPlaced = null;
    $("#bottom").hidden = false;
    $("#place").hidden = true;
  }

  // ---------- The bottom buttons and the top ----------
  $("#shopBtn").onclick = () => toggleDrawer();
  $("#barnBtn").onclick = () => open(barnCard);
  $("#bazaarBtn").onclick = () => open(bazaarCard);
  $("#gchip").onclick = () => open(gloryCard);
  $("#speed").onclick = () => {
    tick();
    state.speed = state.speed === 1 ? 60 : 1;
    save();
  };
  $("#reset").onclick = () => {
    if (!confirm("Начать огород заново? Всё будет удалено.")) return;
    state = fresh();
    while (state.quests.length < 3) state.quests.push(newQuest());
    for (const w of walkers) Object.assign(w, { x: w.home[0], y: w.home[1], jobs: [], doing: null, aim: null, path: [], rest: 0 });
    tool = null;
    menuBed = null;
    save();
    close();
    endPlacing();
    hideMenu();
    renderQuests();
    renderDrawer();
  };
  let sayUntil = 0,
    sayText = "";
  function say(text) {
    sayText = text;
    // Long enough to be read: about 60 ms a letter, never under 2.5 s.
    sayUntil = performance.now() + Math.max(2500, text.length * 60);
  }
  function hint() {
    if (performance.now() < sayUntil) return sayText;
    if (ghost) return ghost.moving ? `Перетащите: ${KINDS[ghost.kind].name.toLowerCase()}` : `Поставьте: ${KINDS[ghost.kind].name.toLowerCase()} · ${KINDS[ghost.kind].price} золота`;
    return "";
  }

  // ---------- The loop ----------
  // For testing (a hidden tab gets no animation frames): ?loop=timer runs the loop on a timer.
  const nextFrame = /[?&]loop=timer/.test(location.search) ? (cb) => setTimeout(() => cb(performance.now()), 16) : requestAnimationFrame;
  let saved = 0,
    // How long a frame takes to draw (smoothed), for checking by hand.
    drawMs = 0;
  let lastFrame = performance.now();
  // Text and widths of the top bar are written only when they change (a write each frame costs layout).
  const shown = {};
  function showTop(el, prop, value) {
    const key = el + prop;
    if (shown[key] === value) return;
    shown[key] = value;
    prop === "width" ? ($(el).style.width = value) : ($(el).textContent = value);
  }
  function frame(now) {
    // Asked for first, so one error in a frame does not stop the game for good.
    nextFrame(frame);
    tick();
    stepPests(now);
    stepLab();
    stepOrders();
    for (const w of walkers) step(w, Math.min(1, (now - lastFrame) / 1000));
    lastFrame = now;
    if (now - saved > 5000) (saved = now), save();
    showTop("#gold", "text", String(state.gold));
    showTop("#lvlN", "text", String(state.level));
    showTop("#xpBar", "width", `${Math.round((1000 * state.xp) / needFor(state.level)) / 10}%`);
    renderArmy();
    showTop("#speed", "text", state.speed === 1 ? "×1" : "×60");
    showTop("#gchip", "text", `🌾 ${Math.floor(state.glory.total)} · ${titleOf(G_TITLES, state.glory.total)}${homeAllowed() > homeStanding() ? " 🏠!" : ""}`);
    $("#speed").classList.toggle("on", state.speed !== 1);
    const h = hint();
    if ($("#hint").textContent !== h) $("#hint").textContent = h;
    const t0 = performance.now();
    draw(now);
    drawMs = drawMs * 0.9 + (performance.now() - t0) * 0.1;
    drawButterflies(now);
    drawBadges(now);
    drawFloaters(now);
    drawFlyers(now);
  }
  // For checking by hand from the console: the camera, the people, the state and where a world point is on screen.
  window.garden = {
    cam,
    fits,
    step,
    walkers,
    get drawMs() {
      return drawMs;
    },
    get state() {
      return state;
    },
    screenOf: (x, y) => toScreen(x, y),
    // For tests from the console.
    debug: { spawnPest, spawnWeed, water, hitPest, pestOn, beds, fertilize, emptyBag, labCard: () => open(labCard) },
  };
  addEventListener("resize", resize);
  // The system's own long-press menus (Copy / Paste, the picture menu) would come up over the game's.
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("selectstart", (e) => e.preventDefault());
  addEventListener("pagehide", save);
  // In Telegram on Android the page is often only hidden, never unloaded: save then too.
  document.addEventListener("visibilitychange", () => document.hidden && save());
  tick();
  fit();
  clampCam();
  renderQuests();
  if (awaySummary) {
    const a = awaySummary,
      hours = a.away >= 60 ? `${Math.floor(a.away / 60)} ч ${Math.round(a.away % 60)} мин` : `${Math.round(a.away)} мин`,
      line = (n, text) => (n ? `<li>${text}</li>` : "");
    open(() =>
      show(
        `<h3>Пока тебя не было…</h3><p>Прошло ${hours}.</p><ul class="away">${line(a.water, `Водонос полил грядок: ${a.water}`)}${line(a.weed, `Полольщик вырвал сорняков: ${a.weed}`)}${line(a.pest, `Сторож прогнал вредителей: ${a.pest}`)}${line(
          a.pestsLeft,
          `На грядках вредители: ${a.pestsLeft} — прогоните (или наймите сторожа на Базаре)`,
        )}${line(a.weedsLeft, `Выросли сорняки: ${a.weedsLeft} — проведите по ним пальцем`)}</ul>${state.bag.gold ? `<p>В мешочке у Амбара 💰 ${state.bag.gold} золота — нажмите на него.</p>` : ""}`,
      ),
    );
  }
  nextFrame(frame);
})();
