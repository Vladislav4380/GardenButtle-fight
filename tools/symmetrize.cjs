// Makes a picture symmetric left to right: one half is kept and mirrored onto the other, blended over a band in the
// middle so no seam shows (node tools/symmetrize.cjs <in.png> <out.png> [left|right] [band px]).
// For pictures the generator drew a little lopsided, such as the bed, whose two ends must match when beds stand in a row.
const { readPng, writePng } = require("./cut-sheets.cjs");

const [, , inFile, outFile, keep = "left", bandArg = "24"] = process.argv;
const { width: W, height: H, px } = readPng(inFile),
  band = Number(bandArg),
  out = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    // How much of the kept side's mirror this pixel takes: none on the kept half, all past the band on the other.
    const fromMid = keep === "left" ? x - W / 2 : W / 2 - x,
      t = Math.min(1, Math.max(0, (fromMid + band / 2) / band)),
      a = (y * W + x) * 4,
      b = (y * W + (W - 1 - x)) * 4;
    for (let c = 0; c < 4; c++) out[a + c] = Math.round(px[a + c] * (1 - t) + px[b + c] * t);
  }
writePng(outFile, W, H, out);
