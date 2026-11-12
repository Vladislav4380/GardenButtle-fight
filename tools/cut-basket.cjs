// Takes the basket out of the round harvest icon (node tools/cut-basket.cjs <in.png> <out.png>): the gold rim and the
// bluish green disc behind the basket are cleared, flooding in from the edges, and stop at the wicker and the leaves.
const { readPng, writePng } = require("./cut-sheets.cjs");

const [, , inFile, outFile] = process.argv;
const { width: W, height: H, px } = readPng(inFile);
const cx = (W - 1) / 2,
  cy = (H - 1) / 2,
  R = Math.min(W, H) / 2;
const isBack = (k) => {
  const r = px[k * 4],
    g = px[k * 4 + 1],
    b = px[k * 4 + 2],
    a = px[k * 4 + 3],
    x = k % W,
    y = (k / W) | 0;
  if (a < 40) return true;
  // The gold rim: the outer ring of the icon, whatever its colour.
  if (Math.hypot(x - cx, y - cy) > 0.86 * R) return true;
  // The disc: a bluish green (the leaves in the basket are a yellow green, with almost no blue).
  const disc = g > r && b > 0.3 * g,
    dark = r + g + b < 90;
  return disc || dark;
};
const back = new Uint8Array(W * H),
  stack = [];
for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
while (stack.length) {
  const k = stack.pop();
  if (back[k] || !isBack(k)) continue;
  back[k] = 1;
  const x = k % W,
    y = (k / W) | 0;
  if (x > 0) stack.push(k - 1);
  if (x < W - 1) stack.push(k + 1);
  if (y > 0) stack.push(k - W);
  if (y < H - 1) stack.push(k + W);
}
for (let k = 0; k < W * H; k++) if (back[k]) px[k * 4 + 3] = 0;
writePng(outFile, W, H, px);
