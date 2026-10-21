// Character sprite sheets: rows are directions (front, three-quarter front, side, three-quarter back, back; all facing
// right), columns are poses (idle, 4 walk frames, attack wind-up, strike). tools/cut-sheets.cjs has already cleaned
// each sheet: a transparent background, equal cells, the feet at the same point of every cell (all in the manifest's
// "sheet"). Here the picture is only loaded and split by that grid. Used by the 6×6 battle and by the 3×3 battle
// scenes that ask for them (<html data-sprites="sheet">).
async function loadSheetFrames(id, profile) {
  const sheet = profile.sheet,
    image = await loadImage("/assets/characters/" + id + "/" + sheet.file),
    frames = { height: sheet.height };
  sheet.rows.forEach((row, r) =>
    sheet.columns.forEach((pose, c) => {
      // A canvas per frame, so the enemy tint can read its pixels.
      const canvas = document.createElement("canvas");
      canvas.width = sheet.cell.w;
      canvas.height = sheet.cell.h;
      canvas.getContext("2d").drawImage(image, c * sheet.cell.w, r * sheet.cell.h, sheet.cell.w, sheet.cell.h, 0, 0, sheet.cell.w, sheet.cell.h);
      (frames[pose + "/" + row] = frames[pose + "/" + row] || []).push({ canvas, ax: sheet.feet.x, ay: sheet.feet.y });
    }),
  );
  // The portrait: the standing figure facing the camera, without the cell's empty margins.
  const box = sheet.portrait,
    face = document.createElement("canvas");
  face.width = box.w;
  face.height = box.h;
  face.getContext("2d").drawImage(image, sheet.columns.indexOf("idle") * sheet.cell.w + box.x, sheet.rows.indexOf("front") * sheet.cell.h + box.y, box.w, box.h, 0, 0, box.w, box.h);
  frames.portrait = face.toDataURL();
  return frames;
}
function loadImage(src) {
  const image = new Image();
  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
// An empty picture for a portrait shown before the hero's sheet has loaded.
const BLANK_PICTURE = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
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
// Enemy look for sheet heroes: a light purple tint (about a third, so a tomato still reads red and a zucchini green)
// and a purple outline around the figure. The result is ENEMY_PAD pixels larger on each side; drawSheetFrame places it.
const sheetTintCache = new WeakMap(),
  ENEMY_PAD = 7;
function sheetEnemyTint(source) {
  let out = sheetTintCache.get(source);
  if (out) return out;
  const pad = ENEMY_PAD,
    w = source.width + pad * 2,
    h = source.height + pad * 2,
    shape = document.createElement("canvas");
  shape.width = w;
  shape.height = h;
  const s = shape.getContext("2d");
  s.drawImage(source, pad, pad);
  s.globalCompositeOperation = "source-in";
  s.fillStyle = "#b45cff";
  s.fillRect(0, 0, w, h);
  out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const t = out.getContext("2d");
  // The outline: the purple silhouette stamped around the figure.
  for (let a = 0; a < 16; a++) t.drawImage(shape, Math.cos((a / 16) * Math.PI * 2) * 5, Math.sin((a / 16) * Math.PI * 2) * 5);
  t.drawImage(source, pad, pad);
  // The light tint on the figure only.
  t.globalCompositeOperation = "source-atop";
  t.globalAlpha = 0.35;
  t.fillStyle = "#8a3cff";
  t.fillRect(pad, pad, source.width, source.height);
  out.pad = pad;
  sheetTintCache.set(source, out);
  return out;
}
// Draws a cut frame with its feet at (0, 0) of the current transform, scaled by z; enemies get the tint and outline.
function drawSheetFrame(g, fr, z, enemy) {
  const img = enemy ? sheetEnemyTint(fr.canvas) : fr.canvas,
    pad = img.pad || 0;
  g.drawImage(img, -(fr.ax + pad) * z, -(fr.ay + pad) * z, img.width * z, img.height * z);
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
