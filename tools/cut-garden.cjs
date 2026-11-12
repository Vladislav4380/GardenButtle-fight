// Prepares the garden pictures once (node tools/cut-garden.cjs): each generated picture in art/garden/src is cut to
// what it shows (its transparent margin dropped), made smaller and written to src/assets/garden/<name>.png. The
// buildings come as one collection picture: each is found there as a separate blob.
const fs = require("node:fs"),
  path = require("node:path"),
  { readPng, writePng, shrink } = require("./cut-sheets.cjs");
const root = path.resolve(__dirname, ".."),
  src = (f) => path.join(root, "art/garden/src", f),
  out = (name) => path.join(root, "src/assets/garden", name + ".png");

// The box of the pixels seen (alpha above a little) within x0..x1, y0..y1.
function box({ width: W, px }, x0, y0, x1, y1) {
  let l = x1,
    t = y1,
    r = x0,
    b = y0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++)
      if (px[(y * W + x) * 4 + 3] > 12) {
        if (x < l) l = x;
        if (x > r) r = x;
        if (y < t) t = y;
        if (y > b) b = y;
      }
  return [l, t, r + 1, b + 1];
}
function crop({ width: W, px }, [l, t, r, b]) {
  const w = r - l,
    h = b - t,
    o = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) o.set(px.subarray(((t + y) * W + l) * 4, ((t + y) * W + r) * 4), y * w * 4);
  return { w, h, px: o };
}
function save(name, f, size) {
  const s = shrink(f, size);
  writePng(out(name), s.w, s.h, Buffer.from(s.px));
  console.log(name, s.w + "×" + s.h);
}
// A picture cut to what it shows, at most `size` px on its longer side.
function one(file, name, size) {
  const img = readPng(src(file));
  save(name, crop(img, box(img, 0, 0, img.width, img.height)), size);
}
// A tiling texture: the middle square only, so no soft edge of the painting repeats.
function tile(file, name, size) {
  const img = readPng(src(file)),
    [l, t, r, b] = box(img, 0, 0, img.width, img.height),
    side = Math.floor(Math.min(r - l, b - t) * 0.9),
    x = Math.floor((l + r - side) / 2),
    y = Math.floor((t + b - side) / 2);
  save(name, crop(img, [x, y, x + side, y + side]), size);
}
// The separate blobs of a collection picture, found on a coarse grid of 8 px, largest first.
function blobs(img, top = 0) {
  const S = 8,
    gw = Math.ceil(img.width / S),
    gh = Math.ceil(img.height / S),
    on = new Uint8Array(gw * gh),
    seen = new Uint8Array(gw * gh),
    found = [];
  for (let y = top; y < img.height; y++)
    for (let x = 0; x < img.width; x++) if (img.px[(y * img.width + x) * 4 + 3] > 12) on[((y / S) | 0) * gw + ((x / S) | 0)] = 1;
  for (let i = 0; i < on.length; i++) {
    if (!on[i] || seen[i]) continue;
    let l = gw,
      t = gh,
      r = 0,
      b = 0,
      n = 0;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const k = stack.pop(),
        x = k % gw,
        y = (k / gw) | 0;
      n++;
      l = Math.min(l, x);
      r = Math.max(r, x);
      t = Math.min(t, y);
      b = Math.max(b, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx,
          ny = y + dy,
          q = ny * gw + nx;
        if (nx >= 0 && ny >= 0 && nx < gw && ny < gh && on[q] && !seen[q]) (seen[q] = 1), stack.push(q);
      }
    }
    found.push({ n, box: [l * S, t * S, Math.min(img.width, (r + 1) * S), Math.min(img.height, (b + 1) * S)] });
  }
  return found.sort((a, b) => b.n - a.n);
}

// The painted farm: the whole scene behind the beds (the barn, the shop and the bazaar are part of it), as a JPEG-like
// opaque PNG at its own size.
{
  const img = readPng(src("Whimsical Forest Farmstead Playfield.png"));
  writePng(out("farm"), img.width, img.height, img.px);
  console.log("farm", img.width + "×" + img.height);
}
// Ground and fence.
tile("Colorful Wildflower Grass Texture-1.png", "ground-grass", 512);
tile("Lush Clover Meadow Texture-2.png", "ground-meadow", 512);
tile("Seamless Cartoon Dirt Tile with Stones-4.png", "ground-path", 512);
one("Isometric Wooden Picket Fence Segment-6.png", "fence", 384);
// The bed as it grows: empty, seedlings, young plants, ready.
one("Isometric Wooden Garden Bed-9.png", "bed-empty", 384);
one("Isometric Garden Bed with Sprouts-11.png", "bed-sprouts", 384);
one("Isometric Garden Bed with Seedlings-10.png", "bed-growing", 384);
one("Isometric Garden Bed with Green Plants-12.png", "bed-ready", 384);
// The beds without frames, 2 rows × 4: tilled soil, seedlings, then each crop grown: tomato, carrot, corn, onion,
// potato, peach.
{
  const img = readPng(src("Isometric Garden Crop Sprite Sheet.png")),
    names = ["plot-soil", "plot-sprouts", "plot-tomato", "plot-carrot", "plot-corn", "plot-onion", "plot-potato", "plot-peach"],
    cw = img.width / 4,
    ch = img.height / 2;
  names.forEach((name, i) => {
    const x0 = Math.round((i % 4) * cw),
      y0 = Math.round(Math.floor(i / 4) * ch);
    save(name, crop(img, box(img, x0, y0, Math.round(x0 + cw), Math.round(y0 + ch))), 384);
  });
}
// Buttons and money.
one("Golden Sprout Coin Medallion-1.png", "icon-gold", 128);
one("Seed Sack Garden Badge-2.png", "icon-seed", 128);
one("Garden Trowel and Sprout Badge-3.png", "icon-plant", 128);
one("Golden Hammer Badge-4.png", "icon-build", 128);
one("Colorful Cartoon Barn Emblem-5.png", "icon-barn", 128);
one("Wicker Basket of Dewy Greens-6.png", "icon-harvest", 128);
// The buildings: the three largest blobs of the collection's lower half (its upper half holds tiles and beds), from
// left to right: seed shop, barn, bazaar.
{
  const img = readPng(src("Isometric Farm Market Asset Collection-3.png")),
    big = blobs(img, Math.round(img.height * 0.5)).slice(0, 3).sort((a, b) => a.box[0] - b.box[0]);
  ["shop-seeds", "barn", "bazaar"].forEach((name, i) => save(name, crop(img, box(img, ...big[i].box)), 448));
}
