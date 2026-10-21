// Cleans the generated sprite sheets (art/<hero>/sheet.png) once, so the game loads a ready picture and does no image
// processing (node tools/cut-sheets.cjs [hero ...]).
// For each hero it writes src/assets/characters/<hero>/sprites/sheet.png: the same layout (rows are directions, columns
// are poses, see "sheet" in the hero's manifest) on a transparent background, every figure in an equal cell with its
// feet at the same point of the cell; the cell size and that point go into the manifest. art/<hero>/preview.png shows
// the frames on a dark background, to check by eye that no white is left. The painted synergy badges
// (art/badges/badges.png) are cleaned the same way into src/assets/shared/badges/badges.png.
const fs = require("node:fs"),
  path = require("node:path"),
  zlib = require("node:zlib");
const root = path.resolve(__dirname, "..");

// ---- PNG reading and writing (8-bit greyscale, RGB, palette, RGBA; no interlace) ----
function readPng(file) {
  const buf = fs.readFileSync(file);
  let pos = 8,
    width = 0,
    height = 0,
    depth = 0,
    type = 0,
    palette = null,
    alpha = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos),
      name = buf.toString("ascii", pos + 4, pos + 8),
      body = buf.subarray(pos + 8, pos + 8 + len);
    if (name === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      type = body[9];
      if (body[12]) throw new Error(file + ": interlaced PNG is not supported");
    } else if (name === "PLTE") palette = body;
    else if (name === "tRNS") alpha = body;
    else if (name === "IDAT") idat.push(body);
    pos += 12 + len;
  }
  if (depth !== 8) throw new Error(file + ": only 8-bit PNG is supported");
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type],
    raw = zlib.inflateSync(Buffer.concat(idat)),
    stride = width * channels,
    data = Buffer.alloc(stride * height),
    rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)],
      line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)),
      out = data.subarray(y * stride, (y + 1) * stride),
      prev = y ? data.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? out[i - channels] : 0,
        b = prev ? prev[i] : 0,
        c = prev && i >= channels ? prev[i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c,
          pa = Math.abs(p - a),
          pb = Math.abs(p - b),
          pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[i] = v & 255;
    }
  }
  for (let k = 0; k < width * height; k++) {
    const s = k * channels,
      o = k * 4;
    if (type === 6) data.copy(rgba, o, s, s + 4);
    else if (type === 2) (rgba[o] = data[s]), (rgba[o + 1] = data[s + 1]), (rgba[o + 2] = data[s + 2]), (rgba[o + 3] = 255);
    else if (type === 0 || type === 4) (rgba[o] = rgba[o + 1] = rgba[o + 2] = data[s]), (rgba[o + 3] = type === 4 ? data[s + 1] : 255);
    else {
      const i = data[s];
      rgba[o] = palette[i * 3];
      rgba[o + 1] = palette[i * 3 + 1];
      rgba[o + 2] = palette[i * 3 + 2];
      rgba[o + 3] = alpha && i < alpha.length ? alpha[i] : 255;
    }
  }
  return { width, height, px: rgba };
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(name, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(name, 4, "ascii");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, tail]);
}
function writePng(file, width, height, px) {
  // Each row takes the PNG filter that leaves the smallest differences, as image editors do: much smaller files.
  const stride = width * 4,
    raw = Buffer.alloc((stride + 1) * height),
    trial = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const line = px.subarray(y * stride, (y + 1) * stride),
      prev = y ? px.subarray((y - 1) * stride, y * stride) : null;
    let best = Infinity;
    for (let filter = 0; filter < 5; filter++) {
      let cost = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= 4 ? line[i - 4] : 0,
          b = prev ? prev[i] : 0,
          c = prev && i >= 4 ? prev[i - 4] : 0;
        let p = 0;
        if (filter === 1) p = a;
        else if (filter === 2) p = b;
        else if (filter === 3) p = (a + b) >> 1;
        else if (filter === 4) {
          const q = a + b - c,
            pa = Math.abs(q - a),
            pb = Math.abs(q - b),
            pc = Math.abs(q - c);
          p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        }
        const v = (line[i] - p) & 255;
        trial[i] = v;
        cost += v < 128 ? v : 256 - v;
      }
      if (cost < best) {
        best = cost;
        raw[y * (stride + 1)] = filter;
        trial.copy(raw, y * (stride + 1) + 1);
      }
    }
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0);
  head.writeUInt32BE(height, 4);
  head[8] = 8;
  head[9] = 6;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]),
  );
}

// ---- Cutting ----
// The white background is removed by a flood fill from the sheet edges and the gaps between cells. Figures are then
// found as connected blobs over the WHOLE sheet, so a figure that sticks out of its grid cell (a tall corn tassel) is
// kept whole and never shows up in the neighbour's frame. Each cell takes the largest blob whose centre lies in it,
// plus small loose bits inside that blob's box; its anchor is the feet.
// Smallest enclosed white pocket (in sheet pixels) taken for background; eye whites are far smaller. Rows that show
// the back (no eyes) and the top quarter of every row take any white pocket of a few pixels.
const POCKET_MIN = 60,
  BACK_POCKET_MIN = 3;
function cutSheet({ width: W, height: H, px }, rows, cols, backRows = []) {
  const N = W * H,
    rgb = (k) => [px[k * 4], px[k * 4 + 1], px[k * 4 + 2]],
    lo = (k) => Math.min(...rgb(k)),
    spread = (k) => Math.max(...rgb(k)) - lo(k),
    // Background: white, plus the pale grey shadow some sheets draw under the feet (light and colourless).
    bg = (k) => px[k * 4 + 3] < 128 || lo(k) > 232 || (lo(k) > 196 && spread(k) < 16),
    clear = new Uint8Array(N),
    stack = new Int32Array(N * 4);
  let top = 0;
  const seed = (k) => (stack[top++] = k),
    near4 = (k) => {
      const x = k % W;
      return [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k >= W ? k - W : -1, k < N - W ? k + W : -1];
    };
  for (let x = 0; x < W; x++) seed(x), seed((H - 1) * W + x);
  for (let y = 0; y < H; y++) seed(y * W), seed(y * W + W - 1);
  for (let c = 1; c < cols; c++) for (let y = 0; y < H; y++) seed(y * W + Math.round((c * W) / cols));
  for (let r = 1; r < rows; r++) for (let x = 0; x < W; x++) seed(Math.round((r * H) / rows) * W + x);
  while (top) {
    const k = stack[--top];
    if (clear[k] || !bg(k)) continue;
    clear[k] = 1;
    for (const n of near4(k)) if (n >= 0 && !clear[n]) seed(n);
  }
  // White background caught inside a figure (between the legs, under a raised arm, between a hand and a bow) is not
  // reached from the edges. Such pockets go when they are large and almost pure white; small white spots (eyes, a
  // blade's shine) stay.
  const pure = (k) => lo(k) > 240 && spread(k) < 14,
    seen = new Uint8Array(N),
    pocket = [];
  for (let k0 = 0; k0 < N; k0++) {
    if (clear[k0] || seen[k0] || !pure(k0)) continue;
    pocket.length = 0;
    top = 0;
    seen[k0] = 1;
    seed(k0);
    while (top) {
      const k = stack[--top];
      pocket.push(k);
      for (const n of near4(k))
        if (n >= 0 && !seen[n] && !clear[n] && pure(n)) {
          seen[n] = 1;
          seed(n);
        }
    }
    // Eyes sit in the middle of a cell; the top quarter holds only leaf tops and tendrils, so any pocket there goes.
    const rowAt = ((k0 / W) * rows) / H,
      back = backRows.includes(Math.min(rows - 1, Math.floor(rowAt))),
      upper = rowAt % 1 < 0.25;
    if (pocket.length >= (back || upper ? BACK_POCKET_MIN : POCKET_MIN)) for (const k of pocket) clear[k] = 1;
  }
  // Peel the pale fringe next to the cleared background a few pixels deep: the light antialiased rim around the outline
  // and around holes is slightly tinted, so it escapes the tests above and showed as white slivers.
  const pale = (k) => lo(k) > 200 && spread(k) < 32;
  for (let pass = 0; pass < 3; pass++) {
    const peel = [];
    for (let k = W; k < N - W; k++) if (!clear[k] && (clear[k - 1] || clear[k + 1] || clear[k - W] || clear[k + W]) && pale(k)) peel.push(k);
    for (const k of peel) clear[k] = 1;
  }
  const alpha = new Uint8Array(N);
  for (let k = 0; k < N; k++) if (!clear[k]) alpha[k] = 255;
  // Connected blobs of solid pixels over the whole sheet.
  const label = new Int32Array(N),
    blobs = [null];
  for (let k0 = 0; k0 < N; k0++) {
    if (label[k0] || alpha[k0] <= 128) continue;
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
      b.minX = Math.min(b.minX, x);
      b.maxX = Math.max(b.maxX, x);
      b.minY = Math.min(b.minY, y);
      b.maxY = Math.max(b.maxY, y);
      for (const n of near4(k))
        if (n >= 0 && !label[n] && alpha[n] > 128) {
          label[n] = id;
          seed(n);
        }
    }
    blobs.push(b);
  }
  const cellOf = (b) => Math.min(rows - 1, Math.floor(((b.sy / b.n) * rows) / H)) * cols + Math.min(cols - 1, Math.floor(((b.sx / b.n) * cols) / W));
  const main = new Array(rows * cols).fill(null);
  for (const b of blobs) if (b && (!main[cellOf(b)] || b.n > main[cellOf(b)].n)) main[cellOf(b)] = b;
  const owner = new Int32Array(blobs.length);
  for (const b of blobs) {
    if (!b) continue;
    const m = main[cellOf(b)];
    // Loose bits count only when they lie inside the figure's box (a gap under an arm); flying effects are dropped.
    if (m && (b === m || (b.minX >= m.minX && b.maxX <= m.maxX && b.minY >= m.minY && b.maxY <= m.maxY))) owner[b.id] = m.id;
  }
  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const m = main[r * cols + c];
      if (!m) {
        cells.push(null);
        continue;
      }
      const w = m.maxX - m.minX + 1,
        h = m.maxY - m.minY + 1,
        od = new Uint8Array(w * h * 4);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const k = (m.minY + y) * W + m.minX + x;
          if (owner[label[k]] !== m.id) continue;
          const o = (y * w + x) * 4;
          od[o] = px[k * 4];
          od[o + 1] = px[k * 4 + 1];
          od[o + 2] = px[k * 4 + 2];
          od[o + 3] = alpha[k];
        }
      const flo = (o) => Math.min(od[o], od[o + 1], od[o + 2]),
        fspread = (o) => Math.max(od[o], od[o + 1], od[o + 2]) - flo(o),
        open = (x, y) => x < 0 || y < 0 || x >= w || y >= h || od[(y * w + x) * 4 + 3] === 0;
      // A grey shadow painted under the boots: in the lowest band of the figure, grey colourless pixels touching the
      // transparent background are peeled away (boots are brown and stay; weapons are higher up).
      const band = Math.floor(h * 0.86);
      for (let pass = 0; pass < 8; pass++) {
        const peel = [];
        for (let y = band; y < h; y++)
          for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4;
            if (od[o + 3] && flo(o) > 105 && fspread(o) < 20 && (open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1))) peel.push(o);
          }
        if (!peel.length) break;
        for (const o of peel) od[o + 3] = 0;
      }
      // Left-over white specks between the feet (no eyes or blades this low): any near-white pixel of the band goes.
      for (let y = band; y < h; y++)
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          if (od[o + 3] && flo(o) > 195 && fspread(o) < 30) od[o + 3] = 0;
        }
      // Small white holes elsewhere (between fingers and a bow string) that are open to the outside through a gap of
      // a pixel or two: white pixels that reach the transparent background through white only are background.
      for (let pass = 0; pass < 2; pass++) {
        const q = [],
          mark = new Uint8Array(w * h);
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4;
            if (od[o + 3] && flo(o) > 228 && fspread(o) < 20 && (open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1))) (mark[y * w + x] = 1), q.push(y * w + x);
          }
        while (q.length) {
          const i = q.pop(),
            x = i % w,
            y = (i - x) / w;
          for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx,
              o = j * 4;
            if (!mark[j] && od[o + 3] && flo(o) > 228 && fspread(o) < 20) (mark[j] = 1), q.push(j);
          }
        }
        for (let i = 0; i < w * h; i++) if (mark[i]) od[i * 4 + 3] = 0;
      }
      // The outline pixels were painted half over white: each takes the colour of the figure next to it, and its
      // transparency from how much white was mixed in, so no light rim shows on a dark board.
      const rim = [];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (od[(y * w + x) * 4 + 3] && (open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1))) rim.push(y * w + x);
      const isRim = new Uint8Array(w * h);
      for (const i of rim) isRim[i] = 1;
      const fixed = [];
      for (const i of rim) {
        const x = i % w,
          y = (i - x) / w,
          f = [0, 0, 0];
        let n = 0;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx,
              ny = y + dy,
              j = ny * w + nx;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || isRim[j] || !od[j * 4 + 3]) continue;
            for (let q = 0; q < 3; q++) f[q] += od[j * 4 + q];
            n++;
          }
        if (!n) continue;
        const o = i * 4;
        let mix = 0,
          weight = 0;
        for (let q = 0; q < 3; q++) {
          f[q] /= n;
          const room = 255 - f[q];
          if (room > 24) (mix += (255 - od[o + q]) / room), weight++;
        }
        const a = weight ? Math.max(0, Math.min(1, mix / weight)) : 1;
        fixed.push([o, f, a]);
      }
      for (const [o, f, a] of fixed) {
        // A darker outline pixel keeps its own colour; only the whitened ones take the neighbours'.
        if (a < 1) for (let q = 0; q < 3; q++) od[o + q] = Math.round(f[q]);
        od[o + 3] = Math.round(255 * a);
      }
      // Loose specks: islands of a few pixels cut off from the figure, and light pixels sticking out of the outline.
      const island = new Int32Array(w * h).fill(-1),
        sizes = [];
      for (let i0 = 0; i0 < w * h; i0++) {
        if (island[i0] >= 0 || !od[i0 * 4 + 3]) continue;
        const q = [i0],
          id = sizes.length;
        island[i0] = id;
        let n = 0;
        while (q.length) {
          const i = q.pop(),
            x = i % w,
            y = (i - x) / w;
          n++;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx,
                ny = y + dy,
                j = ny * w + nx;
              if (nx >= 0 && ny >= 0 && nx < w && ny < h && island[j] < 0 && od[j * 4 + 3]) (island[j] = id), q.push(j);
            }
        }
        sizes.push(n);
      }
      for (let i = 0; i < w * h; i++) if (island[i] >= 0 && sizes[island[i]] < 40) od[i * 4 + 3] = 0;
      for (let pass = 0; pass < 2; pass++) {
        const drop = [];
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4;
            if (!od[o + 3] || flo(o) < 170) continue;
            let empty = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && open(x + dx, y + dy)) empty++;
            if (empty >= 5) drop.push(o);
          }
        for (const o of drop) od[o + 3] = 0;
      }
      // Feet: the middle of the lowest tenth of the figure.
      let footMin = m.maxX,
        footMax = m.minX;
      for (let y = Math.round(m.maxY - h * 0.1); y <= m.maxY; y++)
        for (let x = m.minX; x <= m.maxX; x++)
          if (label[y * W + x] === m.id) {
            footMin = Math.min(footMin, x);
            footMax = Math.max(footMax, x);
          }
      cells.push({ row: r, col: c, w, h, px: od, ax: Math.round((footMin + footMax) / 2 - m.minX), ay: h });
    }
  return cells;
}

// Every frame on a dark background, row by row, to look at.
function writePreview(file, cells, cols) {
  const cw = Math.max(...cells.filter(Boolean).map((f) => f.w)) + 12,
    ch = Math.max(...cells.filter(Boolean).map((f) => f.h)) + 12,
    rows = Math.ceil(cells.length / cols),
    W = cw * cols,
    H = ch * rows,
    out = new Uint8Array(W * H * 4);
  for (let k = 0; k < W * H; k++) out.set([40, 36, 58, 255], k * 4);
  cells.forEach((f, i) => {
    if (!f) return;
    const ox = (i % cols) * cw + ((cw - f.w) >> 1),
      oy = Math.floor(i / cols) * ch + (ch - 6 - f.h);
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        const s = (y * f.w + x) * 4,
          a = f.px[s + 3] / 255,
          o = ((oy + y) * W + ox + x) * 4;
        for (let q = 0; q < 3; q++) out[o + q] = Math.round(f.px[s + q] * a + out[o + q] * (1 - a));
      }
  });
  writePng(file, W, H, out);
}

// Frames placed into equal cells of one picture, each at offset (dx, dy) inside its cell.
function packSheet(file, cells, cols, rows, cw, ch, place) {
  const W = cw * cols,
    out = new Uint8Array(W * ch * rows * 4);
  for (const f of cells) {
    if (!f) continue;
    const [dx, dy] = place(f);
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        const s = (y * f.w + x) * 4,
          o = ((f.row * ch + dy + y) * W + f.col * cw + dx + x) * 4;
        out.set(f.px.subarray(s, s + 4), o);
      }
  }
  writePng(file, W, ch * rows, out);
}

function cutHero(id) {
  const dir = path.join(root, "src/assets/characters", id),
    manifestFile = path.join(dir, "manifest.json"),
    manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")),
    sheet = manifest.sheet,
    cells = cutSheet(
      readPng(path.join(root, "art", id, "sheet.png")),
      sheet.rows.length,
      sheet.columns.length,
      sheet.rows.flatMap((row, i) => (row.startsWith("back") ? [i] : [])),
    ),
    frames = cells.filter(Boolean),
    // The cell fits the widest reach left and right of the feet and the tallest figure, plus a 2 px margin.
    left = Math.max(...frames.map((f) => f.ax)) + 2,
    right = Math.max(...frames.map((f) => f.w - f.ax)) + 2,
    top = Math.max(...frames.map((f) => f.h)) + 2,
    cw = left + right,
    ch = top + 2;
  packSheet(path.join(dir, "sprites/sheet.png"), cells, sheet.columns.length, sheet.rows.length, cw, ch, (f) => [left - f.ax, top - f.h]);
  sheet.file = "sprites/sheet.png";
  sheet.cell = { w: cw, h: ch };
  sheet.feet = { x: left, y: top };
  // The standing figure facing the camera, inside its cell: the hero's portrait on buttons.
  const face = cells[sheet.rows.indexOf("front") * sheet.columns.length + sheet.columns.indexOf("idle")];
  sheet.portrait = { x: left - face.ax, y: top - face.h, w: face.w, h: face.h };
  // Height of the tallest standing figure: the game scales heroes by it.
  sheet.height = Math.max(...frames.filter((f) => sheet.columns[f.col] === "idle").map((f) => f.h));
  delete manifest.frames;
  fs.rmSync(path.join(dir, "sprites/frames"), { recursive: true, force: true });
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
  writePreview(path.join(root, "art", id, "preview.png"), cells, sheet.columns.length);
  console.log(`${id}: ${frames.length} frames, ${cw}×${ch} cells`);
}

// Area-average downscale (colours weighted by alpha), so a badge stays small on the page.
function shrink(f, size) {
  const k = Math.min(1, size / Math.max(f.w, f.h)),
    w = Math.max(1, Math.round(f.w * k)),
    h = Math.max(1, Math.round(f.h * k)),
    out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sum = [0, 0, 0, 0];
      let n = 0;
      for (let sy = Math.floor(y / k); sy < Math.min(f.h, Math.floor((y + 1) / k)); sy++)
        for (let sx = Math.floor(x / k); sx < Math.min(f.w, Math.floor((x + 1) / k)); sx++) {
          const o = (sy * f.w + sx) * 4,
            a = f.px[o + 3];
          for (let q = 0; q < 3; q++) sum[q] += f.px[o + q] * a;
          sum[3] += a;
          n++;
        }
      const o = (y * w + x) * 4;
      if (sum[3]) for (let q = 0; q < 3; q++) out[o + q] = Math.round(sum[q] / sum[3]);
      out[o + 3] = n ? Math.round(sum[3] / n) : 0;
    }
  return { w, h, px: out };
}

function cutBadges() {
  const ids = ["guard", "shooter", "fighter", "fruit", "root", "grain"],
    size = 112,
    cells = cutSheet(readPng(path.join(root, "art/badges/badges.png")), 1, ids.length).map((f, i) => f && { ...shrink(f, size), row: 0, col: i });
  // One row of 112 px cells in the order above, each badge centred in its cell.
  packSheet(path.join(root, "src/assets/shared/badges/badges.png"), cells, ids.length, 1, size, size, (f) => [(size - f.w) >> 1, (size - f.h) >> 1]);
  for (const id of ids) fs.rmSync(path.join(root, "src/assets/shared/badges", id + ".png"), { force: true });
  writePreview(path.join(root, "art/badges/preview.png"), cells, ids.length);
  console.log("badges: " + cells.filter(Boolean).length);
}

const wanted = process.argv.slice(2),
  heroes = fs.readdirSync(path.join(root, "src/assets/characters")).filter((id) => {
    const m = path.join(root, "src/assets/characters", id, "manifest.json");
    return fs.existsSync(m) && JSON.parse(fs.readFileSync(m, "utf8")).sheet && (!wanted.length || wanted.includes(id));
  });
for (const id of heroes) cutHero(id);
if (!wanted.length || wanted.includes("badges")) cutBadges();
