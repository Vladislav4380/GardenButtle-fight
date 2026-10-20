// Character sprite sheets generated in one picture: rows are directions (front, three-quarter front, side,
// three-quarter back, back; all facing right), columns are poses (idle, 4 walk frames, attack wind-up, strike).
// Used by the 6×6 battle and by the 3×3 battle scenes that ask for them (<html data-sprites="sheet">).
async function loadSheetFrames(id, profile) {
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = "/assets/characters/" + id + "/" + profile.sheet.file;
  });
  return sliceSheet(image, profile.sheet);
}
// Cuts a generated sheet (rows = directions, columns = poses) into separate frames once, at load time.
// The white background is removed by a flood fill from the sheet edges and the gaps between cells (white highlights
// inside a figure stay). Figures are then found as connected blobs over the WHOLE sheet, so a figure that sticks out of
// its grid cell (a tall corn tassel) is kept whole and never shows up in the neighbour's frame. Each cell takes the
// largest blob whose centre lies in it, plus small loose bits inside that blob's box; its anchor is the feet.
function sliceSheet(image, sheet) {
  const W = image.naturalWidth,
    H = image.naturalHeight,
    cols = sheet.columns.length,
    rows = sheet.rows.length,
    work = document.createElement("canvas");
  work.width = W;
  work.height = H;
  const wg = work.getContext("2d", { willReadFrequently: true });
  wg.drawImage(image, 0, 0);
  const data = wg.getImageData(0, 0, W, H),
    px = data.data,
    N = W * H,
    bg = (k) => px[k * 4] > 232 && px[k * 4 + 1] > 232 && px[k * 4 + 2] > 232,
    clear = new Uint8Array(N),
    stack = new Int32Array(N * 2);
  let top = 0;
  const seed = (k) => (stack[top++] = k);
  for (let x = 0; x < W; x++) seed(x), seed((H - 1) * W + x);
  for (let y = 0; y < H; y++) seed(y * W), seed(y * W + W - 1);
  for (let c = 1; c < cols; c++) for (let y = 0; y < H; y++) seed(y * W + Math.round((c * W) / cols));
  for (let r = 1; r < rows; r++) for (let x = 0; x < W; x++) seed(Math.round((r * H) / rows) * W + x);
  while (top) {
    const k = stack[--top];
    if (clear[k] || !bg(k)) continue;
    clear[k] = 1;
    const x = k % W;
    if (x > 0) seed(k - 1);
    if (x < W - 1) seed(k + 1);
    if (k >= W) seed(k - W);
    if (k < N - W) seed(k + W);
  }
  for (let k = 0; k < N; k++) {
    if (clear[k]) px[k * 4 + 3] = 0;
    // Soften the light halo left around the outline.
    else if ((clear[k - 1] || clear[k + 1] || clear[k - W] || clear[k + W]) && px[k * 4] > 200 && px[k * 4 + 1] > 200 && px[k * 4 + 2] > 200) px[k * 4 + 3] = 90;
  }
  // Connected blobs of solid pixels over the whole sheet.
  const label = new Int32Array(N),
    blobs = [null];
  for (let k0 = 0; k0 < N; k0++) {
    if (label[k0] || px[k0 * 4 + 3] <= 128) continue;
    const id = blobs.length,
      b = { id, n: 0, sx: 0, sy: 0, minX: W, maxX: 0, minY: H, maxY: 0 };
    label[k0] = id;
    top = 0;
    seed(k0);
    while (top) {
      const k = stack[--top],
        x = k % W,
        y = (k - x) / W;
      b.n++;
      b.sx += x;
      b.sy += y;
      if (x < b.minX) b.minX = x;
      if (x > b.maxX) b.maxX = x;
      if (y < b.minY) b.minY = y;
      if (y > b.maxY) b.maxY = y;
      const near = [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1];
      for (let q = 0; q < 4; q++) {
        const nk = near[q];
        if (nk < 0 || label[nk] || px[nk * 4 + 3] <= 128) continue;
        label[nk] = id;
        seed(nk);
      }
    }
    blobs.push(b);
  }
  const cellOf = (b) => {
    const c = Math.min(cols - 1, Math.floor(((b.sx / b.n) * cols) / W)),
      r = Math.min(rows - 1, Math.floor(((b.sy / b.n) * rows) / H));
    return r * cols + c;
  };
  const main = new Array(rows * cols).fill(null);
  for (const b of blobs) if (b && (!main[cellOf(b)] || b.n > main[cellOf(b)].n)) main[cellOf(b)] = b;
  const owner = new Int32Array(blobs.length);
  for (const b of blobs) {
    if (!b) continue;
    const m = main[cellOf(b)];
    // Loose bits count only when they lie inside the figure's box (a gap under an arm); flying effects are dropped.
    if (m && (b === m || (b.minX >= m.minX && b.maxX <= m.maxX && b.minY >= m.minY && b.maxY <= m.maxY))) owner[b.id] = m.id;
  }
  const frames = {};
  let tallest = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const m = main[r * cols + c];
      if (!m) continue;
      const w = m.maxX - m.minX + 1,
        h = m.maxY - m.minY + 1,
        canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const cg = canvas.getContext("2d"),
        out = cg.createImageData(w, h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const k = (m.minY + y) * W + m.minX + x;
          if (owner[label[k]] !== m.id && !(px[k * 4 + 3] > 0 && px[k * 4 + 3] <= 128 && label[k] === 0)) continue;
          const o = (y * w + x) * 4;
          out.data[o] = px[k * 4];
          out.data[o + 1] = px[k * 4 + 1];
          out.data[o + 2] = px[k * 4 + 2];
          out.data[o + 3] = px[k * 4 + 3];
        }
      cg.putImageData(out, 0, 0);
      // Feet: the middle of the lowest tenth of the figure.
      let footMin = m.maxX,
        footMax = m.minX;
      for (let y = Math.round(m.maxY - h * 0.1); y <= m.maxY; y++)
        for (let x = m.minX; x <= m.maxX; x++)
          if (label[y * W + x] === m.id) {
            if (x < footMin) footMin = x;
            if (x > footMax) footMax = x;
          }
      const key = sheet.columns[c] + "/" + sheet.rows[r];
      (frames[key] = frames[key] || []).push({ canvas, ax: (footMin + footMax) / 2 - m.minX, ay: h });
      if (sheet.columns[c] === "idle") tallest = Math.max(tallest, h);
    }
  frames.height = tallest;
  return frames;
}
// Eight directions from five drawn rows: the left-facing ones are mirrored.
function sheetDirection(dx, dy) {
  const a = (Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI,
    row = a > 67.5 ? "front" : a > 22.5 ? "front34" : a > -22.5 ? "side" : a > -67.5 ? "back34" : "back";
  return { row, flip: dx < -0.01 ? -1 : 1 };
}
// The frame for a pose: state is idle, walk or attack; phase is 0..1 through the walk cycle or the attack.
function sheetFrame(frames, state, row, phase) {
  const list = frames[state + "/" + row] || frames["idle/" + row];
  if (!list?.length) return null;
  return list[state === "idle" ? 0 : Math.min(list.length - 1, Math.floor(phase * list.length))];
}
// Enemy look for sheet heroes: the whole figure is shifted toward purple (greens too, unlike the old tint that only
// turned red and orange), while light and shade stay, so a hero is still recognised by its shape.
const sheetTintCache = new WeakMap();
function sheetEnemyTint(source) {
  let tinted = sheetTintCache.get(source);
  if (tinted) return tinted;
  tinted = document.createElement("canvas");
  tinted.width = source.width;
  tinted.height = source.height;
  const t = tinted.getContext("2d");
  t.drawImage(source, 0, 0);
  t.globalCompositeOperation = "color";
  t.globalAlpha = 0.7;
  t.fillStyle = "#8a3cff";
  t.fillRect(0, 0, tinted.width, tinted.height);
  t.globalAlpha = 1;
  t.globalCompositeOperation = "destination-in";
  t.drawImage(source, 0, 0);
  sheetTintCache.set(source, tinted);
  return tinted;
}
// A hero turns only when the new direction has lasted DIRECTION_HOLD seconds: small back-and-forth steps (a shooter
// keeping its distance) no longer flip it between front and back every few frames.
const DIRECTION_HOLD = 0.3;
function steadyDirection(f, dx, dy) {
  const want = sheetDirection(dx, dy),
    now = performance.now() / 1000,
    cur = f.sheetDir;
  if (!cur) return (f.sheetDir = want);
  if (want.row === cur.row && want.flip === cur.flip) {
    f.sheetTurn = null;
    return cur;
  }
  if (!f.sheetTurn || f.sheetTurn.row !== want.row || f.sheetTurn.flip !== want.flip) f.sheetTurn = { ...want, since: now };
  if (now - f.sheetTurn.since >= DIRECTION_HOLD) {
    f.sheetDir = want;
    f.sheetTurn = null;
  }
  return f.sheetDir;
}
