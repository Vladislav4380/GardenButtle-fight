// The garden, test: a farm in the manner of Hay Day. Small beds of one cell stand in rows; a crop is sown by sliding its
// icon over empty beds and gathered by sliding the sickle over ripe ones. One sowing gives a fixed harvest; the seed is
// a fighter of that crop taken from the barn (1 sown → 2 gathered). Beds are bought in the shop and dragged onto the
// map. No avatar yet, no server: everything is kept in this browser.
// Concept: D:\HomeProjects\GardenBattle\Doc\Огород — концепция модуля.md.
(() => {
  const $ = (s) => document.querySelector(s);
  const canvas = $("#map"),
    g = canvas.getContext("2d");

  // ---------- Rules ----------
  // grow: game minutes from sowing to ripe; yield: fighters gathered from one bed.
  const CROPS = {
    tomato: { name: "Помидор", words: "страж · плод", grow: 5, yield: 2 },
    carrot: { name: "Морковь", words: "боец · корнеплод", grow: 10, yield: 2 },
    potato: { name: "Картофель", words: "страж · корнеплод", grow: 15, yield: 2 },
    peach: { name: "Персик", words: "боец · плод", grow: 30, yield: 2 },
    onion: { name: "Лук", words: "стрелок · корнеплод", grow: 30, yield: 2 },
    corn: { name: "Кукуруза", words: "стрелок · зерно", grow: 60, yield: 2 },
  };
  const START_GOLD = 300,
    START_STOCK = 3,
    BED_PRICE = 50,
    MINUTE = 60000,
    SAVE_KEY = "garden-test-v3";

  // ---------- The plot ----------
  // A square of N×N cells drawn as a diamond: cell (u, v) is at x = (u − v)·TW/2, y = (u + v)·TH/2.
  const N = 12,
    TW = 96,
    TH = 48;
  const iso = (u, v) => [((u - v) * TW) / 2, ((u + v) * TH) / 2];
  // The buildings stand around the back corner (the barn in it, the shop and the bazaar along the two back edges), so
  // all three are in view on a narrow screen; a path runs in front of them as an L.
  const BUILDINGS = [
    { kind: "barn", u: 1, v: 1, size: 3, name: "Амбар" },
    { kind: "shop", u: 5, v: 0, size: 3, name: "Лавка" },
    { kind: "bazaar", u: 0, v: 5, size: 3, name: "Базар" },
  ];
  const PATH = 4,
    PATH_END = 9;
  const onPath = (u, v) => (v === PATH && u < PATH_END) || (u === PATH && v < PATH_END);

  // ---------- Saved state ----------
  // time: game time in ms, which runs `speed` times faster than real time (×60 for the test) and also runs while the
  // page is closed; real: the real time it was last brought up to date.
  function fresh() {
    const beds = [];
    for (let u = 6; u <= 8; u++) for (let v = 6; v <= 7; v++) beds.push({ u, v, crop: null, at: 0 });
    return {
      gold: START_GOLD,
      barn: Object.fromEntries(Object.keys(CROPS).map((id) => [id, START_STOCK])),
      beds,
      time: 0,
      real: Date.now(),
      speed: 1,
    };
  }
  let state;
  try {
    state = JSON.parse(localStorage.getItem(SAVE_KEY)) || fresh();
  } catch {
    state = fresh();
  }
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
    } catch {}
  }
  const left = (bed) => CROPS[bed.crop].grow * MINUTE - (state.time - bed.at);
  const ripe = (bed) => bed.crop && left(bed) <= 0;
  function clock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000 / state.speed)),
      h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60);
    return h ? `${h} ч ${m} мин` : m ? `${m}:${String(s % 60).padStart(2, "0")}` : `${s} с`;
  }

  // ---------- Pictures ----------
  const pic = {};
  for (const name of ["ground-grass", "ground-path", "fence", "bed-empty", "bed-sprouts", "bed-growing", "bed-ready", "barn", "shop-seeds", "bazaar", "icon-harvest"]) {
    pic[name] = new Image();
    pic[name].src = `/assets/garden/${name}.png`;
  }
  const BUILDING_PIC = { barn: "barn", shop: "shop-seeds", bazaar: "bazaar" };
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
        img.onload = () => {
          const c = document.createElement("canvas"),
            b = sh.portrait;
          c.width = b.w;
          c.height = b.h;
          c.getContext("2d").drawImage(img, sh.columns.indexOf("idle") * sh.cell.w + b.x, sh.rows.indexOf("front") * sh.cell.h + b.y, b.w, b.h, 0, 0, b.w, b.h);
          face[id] = c;
          faceUrl[id] = c.toDataURL();
          if (panel) panel();
        };
        img.src = `/assets/characters/${id}/${sh.file}`;
      });
  const faceImg = (id) => `<img class="face" src="${faceUrl[id] || BLANK}" alt="">`;

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
    // Close enough for the small beds to be tapped easily (about 85 px wide on a phone), looking at the beds with the
    // barn behind them; the rest is reached by moving the map.
    cam.zoom = Math.min(1.3, Math.max(0.85, W / (N * TW * 0.4)));
    [cam.x, cam.y] = iso(5.5, 5.5);
  }
  const toScreen = (x, y) => [(x - cam.x) * cam.zoom + W / 2, (y - cam.y) * cam.zoom + H / 2];
  const toWorld = (sx, sy) => [(sx - W / 2) / cam.zoom + cam.x, (sy - H / 2) / cam.zoom + cam.y];
  // The cell (fractional) under a point of the screen.
  function cellAt(sx, sy) {
    const [x, y] = toWorld(sx, sy),
      a = x / (TW / 2),
      b = y / (TH / 2);
    return [(a + b) / 2, (b - a) / 2];
  }
  function clampCam() {
    cam.zoom = Math.min(1.8, Math.max(0.45, cam.zoom));
    const half = (N * TW) / 2;
    cam.x = Math.min(half, Math.max(-half, cam.x));
    cam.y = Math.min(N * TH, Math.max(0, cam.y));
  }

  // ---------- What stands on the plot ----------
  const inside = (t, u, v) => u >= t.u && u < t.u + t.size && v >= t.v && v < t.v + t.size;
  const bedAt = (u, v) => state.beds.find((b) => b.u === Math.floor(u) && b.v === Math.floor(v));
  const buildingAt = (u, v) => BUILDINGS.find((t) => inside(t, Math.floor(u), Math.floor(v)));
  // A bed may stand on the grass only: inside the plot, off the path, on nothing else.
  function free(u, v, skip = null) {
    if (u < 0 || v < 0 || u >= N || v >= N || onPath(u, v) || buildingAt(u, v)) return false;
    const b = bedAt(u, v);
    return !b || b === skip;
  }

  // ---------- Drawing ----------
  // ghost: a bed being placed or moved, {u, v, moving: the bed it was picked up from}.
  let ghost = null;
  // tool: what the finger is sliding over the beds: {kind: "seed", crop} or {kind: "sickle"}, with its screen point.
  let tool = null;
  // A texture spread over cells as if lying on the ground: `cells` cells per picture.
  function groundFill(img, u0, v0, u1, v1, cells) {
    if (!img.complete || !img.naturalWidth) return;
    g.save();
    g.transform(TW / 2, TH / 2, -TW / 2, TH / 2, 0, 0);
    const pat = g.createPattern(img, "repeat");
    pat.setTransform(new DOMMatrix().scale(cells / img.naturalWidth));
    g.fillStyle = pat;
    g.fillRect(u0, v0, u1 - u0, v1 - v0);
    g.restore();
  }
  function diamond(u, v, size) {
    const p = [iso(u, v), iso(u + size, v), iso(u + size, v + size), iso(u, v + size)];
    g.beginPath();
    g.moveTo(...p[0]);
    for (const q of p.slice(1)) g.lineTo(...q);
    g.closePath();
  }
  // A picture standing on its cells: as wide as its footprint, its bottom on the footprint's front corner.
  function stand(img, u, v, size, widen = 1.08, lift = 0) {
    if (!img?.complete || !img.naturalWidth) return;
    const w = size * TW * widen,
      h = (w * img.naturalHeight) / img.naturalWidth,
      [cx, y] = iso(u + size, v + size);
    g.drawImage(img, cx - w / 2, y - h + size * TH * 0.12 - lift, w, h);
  }
  function bedPicture(b) {
    if (!b.crop) return pic["bed-empty"];
    const k = (state.time - b.at) / (CROPS[b.crop].grow * MINUTE);
    return k >= 1 ? pic["bed-ready"] : k >= 0.5 ? pic["bed-growing"] : pic["bed-sprouts"];
  }
  function draw(now) {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#1c3a1e";
    g.fillRect(0, 0, W, H);
    g.setTransform(dpr * cam.zoom, 0, 0, dpr * cam.zoom, dpr * (W / 2 - cam.x * cam.zoom), dpr * (H / 2 - cam.y * cam.zoom));
    // Meadow all around, darker, so the screen has no empty space; then the plot's own grass and the path.
    groundFill(pic["ground-grass"], -N, -N, 2 * N, 2 * N, 4);
    diamond(-N, -N, 3 * N);
    g.fillStyle = "#0b2a0e88";
    g.fill();
    groundFill(pic["ground-grass"], 0, 0, N, N, 4);
    groundFill(pic["ground-path"], 0, PATH, PATH_END, PATH + 1, 2);
    groundFill(pic["ground-path"], PATH, 0, PATH + 1, PATH_END, 2);
    // The grid, only while a bed is being placed.
    if (ghost) {
      g.lineWidth = 1.5;
      g.strokeStyle = "#ffffff70";
      g.beginPath();
      for (let k = 0; k <= N; k++) g.moveTo(...iso(k, 0)), g.lineTo(...iso(k, N)), g.moveTo(...iso(0, k)), g.lineTo(...iso(N, k));
      g.stroke();
    }
    fenceRow(false);
    // Everything standing, back to front.
    const list = [...BUILDINGS, ...state.beds.filter((b) => b !== ghost?.moving).map((b) => ({ u: b.u, v: b.v, size: 1, bed: b }))].sort(
      (a, b) => a.u + a.v + a.size - (b.u + b.v + b.size),
    );
    for (const t of list) {
      if (!t.bed) {
        stand(pic[BUILDING_PIC[t.kind]], t.u, t.v, t.size, 1.1);
        continue;
      }
      const b = t.bed;
      stand(bedPicture(b), b.u, b.v, 1);
      // A ripe bed shows its crop bobbing over it, so it is known what will be gathered.
      if (ripe(b) && face[b.crop]) {
        const [x, y] = iso(b.u + 0.5, b.v + 0.5),
          s = TW * 0.42,
          bob = Math.sin(now / 300 + b.u + b.v) * 3;
        g.drawImage(face[b.crop], x - s / 2, y - s * 1.35 + bob, s, s);
      }
    }
    // The bed being placed: its cell green where it fits, red where not.
    if (ghost) {
      const ok = free(ghost.u, ghost.v, ghost.moving) && (ghost.moving || state.gold >= BED_PRICE);
      diamond(ghost.u, ghost.v, 1);
      g.fillStyle = ok ? "#9bd96b88" : "#ff5a4a88";
      g.fill();
      g.globalAlpha = 0.8;
      stand(ghost.moving ? bedPicture(ghost.moving) : pic["bed-empty"], ghost.u, ghost.v, 1, 1.08, 8);
      g.globalAlpha = 1;
      $("#placeOk").disabled = !ok;
    }
    fenceRow(true);
    // Screen-sized marks: building names, the tool under the finger.
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const t of BUILDINGS) nameplate(t);
    if (tool?.x != null) {
      const s = 64;
      if (tool.kind === "sickle") pic["icon-harvest"].complete && g.drawImage(pic["icon-harvest"], tool.x - s / 2, tool.y - s - 20, s, s);
      else if (face[tool.crop]) g.drawImage(face[tool.crop], tool.x - s / 2, tool.y - s - 20, s, s);
    }
  }
  // The fence: along v = 0 and v = N it runs down to the right (the picture mirrored), along u = 0 and u = N down to
  // the left. `front`: the two front edges, else the two back ones.
  function fenceRow(front) {
    const img = pic.fence;
    if (!img.complete || !img.naturalWidth) return;
    const w = TW * 1.06,
      h = (w * img.naturalHeight) / img.naturalWidth,
      edge = front ? N : 0;
    for (let k = 0; k < N; k += 2) {
      const [x1, y1] = iso(k + 1, edge);
      g.save();
      g.translate(x1, y1);
      g.scale(-1, 1);
      g.drawImage(img, -w / 2, -h + TH * 0.55, w, h);
      g.restore();
      const [x2, y2] = iso(edge, k + 1);
      g.drawImage(img, x2 - w / 2, y2 - h + TH * 0.55, w, h);
    }
  }
  function nameplate(t) {
    const [x, y] = toScreen(...iso(t.u + t.size, t.v + t.size)),
      s = Math.max(0.8, Math.min(1.2, cam.zoom));
    g.font = `800 ${13 * s}px system-ui`;
    const w = g.measureText(t.name).width + 16;
    g.beginPath();
    g.roundRect ? g.roundRect(x - w / 2, y + 2, w, 22 * s, 11 * s) : g.rect(x - w / 2, y + 2, w, 22 * s);
    g.fillStyle = "#0b1710cc";
    g.fill();
    g.fillStyle = "#ffe9b0";
    g.textBaseline = "middle";
    g.fillText(t.name, x - w / 2 + 8, y + 2 + 11 * s);
  }

  // ---------- Sowing and gathering ----------
  // Sow one empty bed with a fighter of the crop from the barn; gather one ripe bed into the barn.
  function sow(b, id) {
    if (b.crop || !(state.barn[id] > 0)) return false;
    state.barn[id]--;
    b.crop = id;
    b.at = state.time;
    return true;
  }
  function gather(b) {
    if (!ripe(b)) return false;
    state.barn[b.crop] = (state.barn[b.crop] || 0) + CROPS[b.crop].yield;
    floaters.push({ b, text: `+${CROPS[b.crop].yield}`, t0: performance.now() });
    b.crop = null;
    return true;
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
      const [x, y] = toScreen(...iso(f.b.u + 0.5, f.b.v + 0.5));
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
      `<p>Проведите семенем по пустым грядкам</p><div class="seeds">${Object.keys(CROPS)
        .map(
          (id) =>
            `<button class="seed${state.barn[id] > 0 ? "" : " none"}" data-crop="${id}">${faceImg(id)}<b>${state.barn[id] || 0}</b><small>${clock(CROPS[id].grow * MINUTE)}</small></button>`,
        )
        .join("")}</div>`,
    );
  }
  function sickleMenu(sx, sy) {
    showMenu(sx, sy, `<p>Проведите серпом по спелым грядкам</p><div class="seeds"><button class="seed sickle" data-sickle="1"><img class="face" src="/assets/garden/icon-harvest.png" alt=""></button></div>`);
  }
  function growingTip(sx, sy, b) {
    showMenu(sx, sy, `<p class="tip">${faceImg(b.crop)}<span><b>${CROPS[b.crop].name}</b><br>созреет через ${clock(left(b))}</span></p>`);
  }
  // A finger put on a crop or the sickle in the menu takes it; sliding it over the map sows or gathers each bed it
  // passes. A tap on it (no slide) does the bed the menu was opened for.
  let menuBed = null;
  menu.addEventListener("pointerdown", (e) => {
    const b = e.target.closest("[data-crop],[data-sickle]");
    if (!b) return;
    e.preventDefault();
    if (b.dataset.crop && !(state.barn[b.dataset.crop] > 0)) return say(`В амбаре нет: ${CROPS[b.dataset.crop].name}. Соберите урожай или купите на базаре.`);
    tool = b.dataset.crop ? { kind: "seed", crop: b.dataset.crop } : { kind: "sickle" };
    tool.id = e.pointerId;
    tool.moved = false;
    tool.done = 0;
    hideMenu();
    const r = canvas.getBoundingClientRect();
    tool.x = e.clientX - r.left;
    tool.y = e.clientY - r.top;
  });
  addEventListener("pointermove", (e) => {
    if (!tool || e.pointerId !== tool.id) return;
    const r = canvas.getBoundingClientRect();
    tool.x = e.clientX - r.left;
    tool.y = e.clientY - r.top;
    tool.moved = true;
    const b = bedAt(...cellAt(tool.x, tool.y));
    if (!b) return;
    if (tool.kind === "seed" ? sow(b, tool.crop) : gather(b)) tool.done++;
    if (tool.kind === "seed" && !(state.barn[tool.crop] > 0)) say(`${CROPS[tool.crop].name} в амбаре закончились.`);
  });
  addEventListener("pointerup", (e) => {
    if (!tool || e.pointerId !== tool.id) return;
    if (!tool.done && menuBed) tool.kind === "seed" ? sow(menuBed, tool.crop) : gather(menuBed);
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
  let press = null; // a long press on a bed picks it up to move it
  canvas.addEventListener("pointerdown", (e) => {
    if (tool) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
    hideMenu();
    pointers.set(e.pointerId, { ...local(e), x0: local(e).x, y0: local(e).y, t0: performance.now() });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: cam.zoom };
      drag = null;
      clearTimeout(press);
      return;
    }
    const [u, v] = cellAt(local(e).x, local(e).y);
    if (ghost && Math.floor(u) === ghost.u && Math.floor(v) === ghost.v) drag = { kind: "ghost" };
    else {
      drag = { kind: "pan", cx: cam.x, cy: cam.y };
      const b = !ghost && bedAt(u, v);
      clearTimeout(press);
      if (b) press = setTimeout(() => pickUp(b), 550);
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    ({ x: p.x, y: p.y } = local(e));
    if (Math.hypot(p.x - p.x0, p.y - p.y0) > 10) clearTimeout(press);
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      cam.zoom = (pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d;
      clampCam();
    } else if (drag?.kind === "pan") {
      cam.x = drag.cx - (p.x - p.x0) / cam.zoom;
      cam.y = drag.cy - (p.y - p.y0) / cam.zoom;
      clampCam();
    } else if (drag?.kind === "ghost") {
      const [u, v] = cellAt(p.x, p.y);
      ghost.u = Math.max(0, Math.min(N - 1, Math.floor(u)));
      ghost.v = Math.max(0, Math.min(N - 1, Math.floor(v)));
    }
  });
  const up = (e) => {
    clearTimeout(press);
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!p) return;
    const tap = Math.hypot(p.x - p.x0, p.y - p.y0) < 10 && performance.now() - p.t0 < 500;
    if (tap && drag?.kind !== "ghost" && !pointers.size) onTap(p.x, p.y);
    if (!pointers.size) drag = null;
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
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
    const [u, v] = cellAt(sx, sy);
    if (ghost) {
      // A tap on the grass moves the bed being placed there.
      ghost.u = Math.max(0, Math.min(N - 1, Math.floor(u)));
      ghost.v = Math.max(0, Math.min(N - 1, Math.floor(v)));
      return;
    }
    const b = bedAt(u, v);
    if (b) {
      menuBed = b;
      if (!b.crop) return seedMenu(sx, sy);
      if (ripe(b)) return sickleMenu(sx, sy);
      return growingTip(sx, sy, b);
    }
    const t = buildingAt(u, v);
    if (t?.kind === "shop") return open(shopCard);
    if (t?.kind === "barn") return open(barnCard);
    if (t?.kind === "bazaar") return open(bazaarCard);
  }
  // A long press on a bed picks it up; it is put down like a new one, with what grows on it.
  function pickUp(b) {
    if (pointers.size !== 1) return;
    drag = { kind: "ghost" };
    ghost = { u: b.u, v: b.v, moving: b };
    startPlacing();
  }

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
  function show(html) {
    const box = $("#sheet"),
      scrolled = box.firstElementChild?.scrollTop || 0;
    box.innerHTML = `<div class="card">${html}<div class="foot"><button class="back" data-do="close">← Назад</button></div></div>`;
    box.firstElementChild.scrollTop = scrolled;
    box.querySelectorAll("[data-do]").forEach((b) => (b.onclick = () => act(b.dataset.do)));
  }
  const goldTag = (n) => `<img src="/assets/garden/icon-gold.png" alt="">${n}`;
  function shopCard() {
    show(
      `<h3><img src="/assets/garden/icon-build.png" alt="">Магазин</h3><p>Купите и перетащите на участок.</p>
      <div class="row"><img class="face" src="/assets/garden/bed-empty.png" alt=""><div class="what"><b>Грядка</b><small>Одна клетка. Сажать — проведите семенем по пустым грядкам.</small></div>
      <button class="buy" data-do="bed" ${state.gold < BED_PRICE ? "disabled" : ""}>${goldTag(BED_PRICE)}</button></div>
      <div class="row soon"><img class="face" src="/assets/garden/barn.png" alt=""><div class="what"><b>Теплица, декор</b><small>Скоро</small></div></div>`,
    );
  }
  function barnCard() {
    show(
      `<h3><img src="/assets/garden/icon-barn.png" alt="">Амбар</h3><p>Собранные бойцы. Их же сажают как семена: один посаженный даёт двух. Сколько бойцов вида в амбаре — столько можно взять в отряд.</p>
      ${Object.keys(CROPS)
        .map((id) => `<div class="row">${faceImg(id)}<div class="what"><b>${CROPS[id].name}</b><small>${CROPS[id].words} · растёт ${clock(CROPS[id].grow * MINUTE)}</small></div><span class="n">${state.barn[id] || 0}</span></div>`)
        .join("")}`,
    );
  }
  function bazaarCard() {
    show(`<h3><img src="/assets/garden/icon-gold.png" alt="">Базар</h3><p>Здесь игроки будут продавать и покупать бойцов. Откроется позже.</p>`);
  }
  function act(what) {
    if (what === "close") return close();
    if (what === "bed") {
      close();
      // The new bed starts on the free cell nearest the middle of the screen.
      const [cu, cv] = cellAt(W / 2, H / 2);
      let best = null;
      for (let u = 0; u < N; u++) for (let v = 0; v < N; v++) if (free(u, v) && (!best || Math.hypot(u - cu, v - cv) < Math.hypot(best.u - cu, best.v - cv))) best = { u, v };
      if (!best) return say("На участке нет места.");
      ghost = best;
      startPlacing();
    }
  }

  // ---------- Placing a bed ----------
  function startPlacing() {
    hideMenu();
    $("#bottom").hidden = true;
    $("#place").hidden = false;
  }
  $("#placeOk").onclick = () => {
    if (!ghost) return;
    if (ghost.moving) {
      if (!free(ghost.u, ghost.v, ghost.moving)) return;
      Object.assign(ghost.moving, { u: ghost.u, v: ghost.v });
      save();
      return endPlacing();
    }
    if (!free(ghost.u, ghost.v) || state.gold < BED_PRICE) return;
    state.gold -= BED_PRICE;
    state.beds.push({ u: ghost.u, v: ghost.v, crop: null, at: 0 });
    save();
    // As in such games, the next bed is offered at once beside the last one, while gold lasts.
    const next = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ]
      .map(([du, dv]) => ({ u: ghost.u + du, v: ghost.v + dv }))
      .find((c) => free(c.u, c.v));
    if (next && state.gold >= BED_PRICE) ghost = next;
    else endPlacing();
  };
  $("#placeNo").onclick = endPlacing;
  function endPlacing() {
    ghost = null;
    $("#bottom").hidden = false;
    $("#place").hidden = true;
  }

  // ---------- The bottom buttons and the top ----------
  $("#shopBtn").onclick = () => open(shopCard);
  $("#barnBtn").onclick = () => open(barnCard);
  $("#speed").onclick = () => {
    tick();
    state.speed = state.speed === 1 ? 60 : 1;
    save();
  };
  $("#reset").onclick = () => {
    if (!confirm("Начать огород заново? Всё будет удалено.")) return;
    state = fresh();
    save();
    close();
    endPlacing();
  };
  let sayUntil = 0,
    sayText = "";
  function say(text) {
    sayText = text;
    sayUntil = performance.now() + 3500;
  }
  function hint() {
    if (performance.now() < sayUntil) return sayText;
    if (ghost) return ghost.moving ? "Перетащите грядку на новое место" : `Перетащите грядку на свободное место · ${BED_PRICE} золота`;
    return "";
  }

  // ---------- The loop ----------
  let saved = 0;
  function frame(now) {
    tick();
    if (now - saved > 5000) (saved = now), save();
    $("#gold").textContent = state.gold;
    $("#speed").textContent = state.speed === 1 ? "×1" : "×60";
    $("#speed").classList.toggle("on", state.speed !== 1);
    const h = hint();
    if ($("#hint").textContent !== h) $("#hint").textContent = h;
    draw(now);
    drawFloaters(now);
    requestAnimationFrame(frame);
  }
  // For checking by hand from the console: the camera, the state and where a cell is on the screen.
  window.garden = {
    cam,
    get state() {
      return state;
    },
    screenOf: (u, v) => toScreen(...iso(u, v)),
  };
  addEventListener("resize", resize);
  addEventListener("pagehide", save);
  tick();
  fit();
  clampCam();
  requestAnimationFrame(frame);
})();
