// Cuts a generated sheet of separate objects on a white background into one picture per object
// (node tools/cut-objects.cjs <sheet.png> <out dir>): the white around the objects is made transparent (flood fill from
// the edges, so white inside an object stays), each object is found as a connected blob, small loose bits are kept with
// the object whose box holds them, and the objects are written as 01.png, 02.png… in reading order (by rows, then left
// to right), with index.json giving each one's box in the sheet.
const fs = require("node:fs"),
  path = require("node:path"),
  { readPng, writePng } = require("./cut-sheets.cjs");

const [, , sheetFile, outDir] = process.argv;
const img = readPng(sheetFile),
  { width: W, height: H, px } = img;

// The background: near-white, near-grey pixels reached from the sheet's edges.
const isWhite = (k) => {
  const r = px[k * 4],
    g = px[k * 4 + 1],
    b = px[k * 4 + 2];
  return Math.min(r, g, b) > 228 && Math.max(r, g, b) - Math.min(r, g, b) < 22;
};
const bg = new Uint8Array(W * H),
  stack = [];
for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
while (stack.length) {
  const k = stack.pop();
  if (bg[k] || !isWhite(k)) continue;
  bg[k] = 1;
  const x = k % W,
    y = (k / W) | 0;
  if (x > 0) stack.push(k - 1);
  if (x < W - 1) stack.push(k + 1);
  if (y > 0) stack.push(k - W);
  if (y < H - 1) stack.push(k + W);
}
const HOLE_MIN = Number(process.env.HOLE_MIN || 220) || Infinity;
// White left inside an object (gaps between a tree's branches, under a cart) is background too, if it is a large patch.
{
  const seen = new Uint8Array(W * H);
  for (let k0 = 0; k0 < W * H; k0++) {
    if (bg[k0] || seen[k0] || !isWhite(k0)) continue;
    const comp = [k0];
    seen[k0] = 1;
    for (let i = 0; i < comp.length; i++) {
      const k = comp[i], x = k % W, y = (k / W) | 0;
      for (const q of [x > 0 && k - 1, x < W - 1 && k + 1, y > 0 && k - W, y < H - 1 && k + W])
        if (q !== false && !bg[q] && !seen[q] && isWhite(q)) (seen[q] = 1), comp.push(q);
    }
    // Painted white highlights (on canvas, stones, metal) are smaller: up to about 200 pixels on the sheets so far.
    // HOLE_MIN raises it for a large single picture, whose highlights are larger too (0 keeps every white inside).
    if (comp.length >= HOLE_MIN) for (const k of comp) bg[k] = 1;
  }
}
// The grey shadows the generator paints under objects on its white sheet: pale, colourless pixels reached from the
// background, at most SHADE pixels into the object's outline. Left as they are they stay a light grey halo on the
// game's ground (the game draws its own shadows), so they are made a faint dark shadow instead, fading with how light
// they were. Being limited to the rim, stones and iron keep their greys.
const SHADE = 26,
  shade = new Uint8Array(W * H),
  isShade = (k) => {
    const r = px[k * 4],
      g = px[k * 4 + 1],
      b = px[k * 4 + 2];
    // Pale and greyish or warm (the generator's shadows are often beige); not green, so leaves stay. The spread
    // starts at the background and stops at an object's dark outline, so light parts inside an object are not reached.
    return Math.min(r, g, b) > 110 && Math.max(r, g, b) - Math.min(r, g, b) < 90 && g <= r + 12;
  };
let front = [];
for (let k = 0; k < W * H; k++) if (bg[k]) front.push(k);
for (let step = 0; step < SHADE && front.length; step++) {
  const next = [];
  for (const k of front) {
    const x = k % W,
      y = (k / W) | 0;
    for (const q of [x > 0 && k - 1, x < W - 1 && k + 1, y > 0 && k - W, y < H - 1 && k + W])
      if (q !== false && !bg[q] && !shade[q] && isShade(q)) (shade[q] = 1), next.push(q);
  }
  front = next;
}
if (process.env.SHADE_DEBUG) {
  // A copy of the sheet with the pixels taken for shadow in magenta, to see what the rule catches.
  const d = Buffer.from(px);
  for (let k = 0; k < W * H; k++) if (shade[k]) (d[k * 4] = 255), (d[k * 4 + 1] = 0), (d[k * 4 + 2] = 255);
  writePng(process.env.SHADE_DEBUG, W, H, d);
}
for (let k = 0; k < W * H; k++)
  if (shade[k]) {
    const light = (px[k * 4] + px[k * 4 + 1] + px[k * 4 + 2]) / 765;
    px[k * 4] = 34;
    px[k * 4 + 1] = 24;
    px[k * 4 + 2] = 10;
    px[k * 4 + 3] = Math.round(90 * Math.max(0, 1 - light));
  }
// Clear the background; soften the pale fringe left along it (anti-aliased edges mixed with white).
for (let k = 0; k < W * H; k++) {
  if (bg[k]) {
    px[k * 4 + 3] = 0;
    continue;
  }
  const x = k % W,
    y = (k / W) | 0,
    edge = (x > 0 && bg[k - 1]) || (x < W - 1 && bg[k + 1]) || (y > 0 && bg[k - W]) || (y < H - 1 && bg[k + W]);
  if (edge) {
    const m = Math.min(px[k * 4], px[k * 4 + 1], px[k * 4 + 2]);
    if (m > 170) px[k * 4 + 3] = Math.round(255 * Math.max(0, (255 - m) / 85));
  }
}

// Objects: blobs of seen pixels (8-connected).
const label = new Int32Array(W * H).fill(-1),
  blobs = [];
for (let k0 = 0; k0 < W * H; k0++) {
  if (label[k0] >= 0 || px[k0 * 4 + 3] < 16) continue;
  const id = blobs.length,
    b = { l: W, t: H, r: 0, b: 0, n: 0 };
  stack.push(k0);
  label[k0] = id;
  while (stack.length) {
    const k = stack.pop(),
      x = k % W,
      y = (k / W) | 0;
    b.n++;
    if (x < b.l) b.l = x;
    if (x > b.r) b.r = x;
    if (y < b.t) b.t = y;
    if (y > b.b) b.b = y;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (label[q] < 0 && px[q * 4 + 3] >= 16) (label[q] = id), stack.push(q);
      }
  }
  blobs.push(b);
}
// Bits smaller than this go with the big blob whose box (with a margin) holds their middle.
const MIN = 1500,
  big = blobs.filter((b) => b.n >= MIN);
for (const b of blobs) {
  if (b.n >= MIN) continue;
  const cx = (b.l + b.r) / 2,
    cy = (b.t + b.b) / 2,
    host = big.find((h) => cx >= h.l - 12 && cx <= h.r + 12 && cy >= h.t - 12 && cy <= h.b + 12);
  if (host) (host.l = Math.min(host.l, b.l)), (host.t = Math.min(host.t, b.t)), (host.r = Math.max(host.r, b.r)), (host.b = Math.max(host.b, b.b));
}
// Reading order: into rows by their middles, then left to right.
big.sort((a, b) => (a.t + a.b) / 2 - (b.t + b.b) / 2);
const rows = [];
for (const b of big) {
  const row = rows.find((r) => Math.abs((r[0].t + r[0].b) / 2 - (b.t + b.b) / 2) < (r[0].b - r[0].t) / 2);
  row ? row.push(b) : rows.push([b]);
}
const ordered = rows.flatMap((r) => r.sort((a, b) => a.l - b.l));
fs.mkdirSync(outDir, { recursive: true });
const index = [];
ordered.forEach((b, i) => {
  const w = b.r - b.l + 1,
    h = b.b - b.t + 1,
    out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const s = ((b.t + y) * W + b.l + x) * 4;
      // Only this object's pixels: a neighbour reaching into the box is left out.
      const own = label[(b.t + y) * W + b.l + x];
      if (own >= 0 && blobs[own].n >= MIN && blobs[own] !== b) continue;
      px.copy(out, (y * w + x) * 4, s, s + 4);
    }
  const name = String(i + 1).padStart(2, "0");
  writePng(path.join(outDir, name + ".png"), w, h, out);
  index.push({ name, box: [b.l, b.t, w, h] });
});
fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(index, null, 1));
console.log(ordered.length + " objects");
