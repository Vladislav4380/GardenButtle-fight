// Makes the sides of a symmetric picture upright (node tools/straighten.cjs <in.png> <out.png>): a box drawn a little
// in perspective (wider at the top than at the bottom, or the other way) becomes a plain rectangle. The outline's half
// width is measured at the top and bottom corners; every row is then stretched or squeezed about the middle, along
// the straight line between them, to the half width at the bottom. Run it after symmetrize.cjs.
const { readPng, writePng } = require("./cut-sheets.cjs");

const [, , inFile, outFile] = process.argv;
const { width: W, height: H, px } = readPng(inFile),
  cx = (W - 1) / 2;
// Half width of each row: from the middle to the farthest solid pixel.
const rows = [];
for (let y = 0; y < H; y++) {
  let l = -1;
  for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 160) { l = x; break; }
  if (l >= 0) rows.push([y, cx - l]);
}
// The corners decide: the widest point of the top quarter (the top corners) and of the bottom quarter (the bottom
// corners), with a straight line between them, so all four corners end up one above the other.
const band = (from, to) => rows.filter(([y]) => y >= H * from && y <= H * to).reduce((m, r) => (r[1] > m[1] ? r : m), [0, -1]),
  [yTop, hTop] = band(0.05, 0.3),
  [yBot, hBot] = band(0.7, 0.97),
  ok = hTop > 0 && hBot > 0 && yBot > yTop || (console.error("no outline found at the top or the bottom"), process.exit(1)),
  half = (y) => hTop + ((hBot - hTop) * (y - yTop)) / (yBot - yTop),
  target = hBot;
console.log(`half width ${half(0).toFixed(1)} at the top, ${half(H - 1).toFixed(1)} at the bottom -> ${target.toFixed(1)}`);
const out = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  const k = half(y) / target;
  for (let x = 0; x < W; x++) {
    // Where this pixel comes from in the row, with linear blending between the two nearest.
    const sx = cx + (x - cx) * k,
      x0 = Math.floor(sx),
      f = sx - x0,
      d = (y * W + x) * 4;
    if (x0 < 0 || x0 + 1 >= W) continue;
    const a = (y * W + x0) * 4,
      b = a + 4;
    for (let c = 0; c < 4; c++) out[d + c] = Math.round(px[a + c] * (1 - f) + px[b + c] * f);
  }
}
writePng(outFile, W, H, out);
