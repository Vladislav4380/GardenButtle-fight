// Cache a thin alpha-silhouette outline at display size; original PNGs stay intact.
const enemyOutlineCache = new WeakMap();
function drawEnemyOutline(image, x, y, width, height) {
  const key = width.toFixed(2) + "x" + height.toFixed(2);
  let cache = enemyOutlineCache.get(image);
  if (!cache) {
    cache = new Map();
    enemyOutlineCache.set(image, cache);
  }
  let outline = cache.get(key);
  const pad = 4;
  if (!outline) {
    const mask = document.createElement("canvas");
    mask.width = Math.ceil(width) + pad * 2;
    mask.height = Math.ceil(height) + pad * 2;
    const m = mask.getContext("2d");
    m.drawImage(image, pad, pad, width, height);
    m.globalCompositeOperation = "source-in";
    m.fillStyle = "#ff5b37";
    m.fillRect(0, 0, mask.width, mask.height);
    outline = document.createElement("canvas");
    outline.width = mask.width;
    outline.height = mask.height;
    const o = outline.getContext("2d");
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6;
      o.drawImage(mask, Math.cos(angle) * 1.6, Math.sin(angle) * 1.6);
    }
    o.globalCompositeOperation = "destination-out";
    o.drawImage(mask, 0, 0);
    if (cache.size >= 8) cache.clear();
    cache.set(key, outline);
  }
  g.save();
  g.filter = "none";
  g.drawImage(outline, x - pad, y - pad);
  g.restore();
}

// Opponents are drawn slightly darker and cooler so mirrored lineups stay readable.
// Pixels are tinted once per frame image (canvas filters are missing on some mobile browsers).
const enemyTintCache = new WeakMap();
function enemyTint(image) {
  let tinted = enemyTintCache.get(image);
  if (tinted) return tinted;
  tinted = document.createElement("canvas");
  tinted.width = image.naturalWidth;
  tinted.height = image.naturalHeight;
  const t = tinted.getContext("2d");
  t.drawImage(image, 0, 0);
  try {
    const data = t.getImageData(0, 0, tinted.width, tinted.height),
      px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      px[i] = px[i] * 0.74;
      px[i + 1] = px[i + 1] * 0.8;
      px[i + 2] = Math.min(255, px[i + 2] * 0.92 + 22);
    }
    t.putImageData(data, 0, 0);
  } catch {
    return image;
  }
  enemyTintCache.set(image, tinted);
  return tinted;
}

const characterProfiles = {},
  mixedSprites = { pepper: {}, tomato: {}, carrot: {} };
const mixedReady = Promise.all(
  ["pepper", "tomato", "carrot"].map(async (id) => {
    const response = await fetch("/assets/characters/" + id + "/manifest.json");
    if (!response.ok) throw Error("Missing character " + id);
    const profile = (characterProfiles[id] = await response.json());
    await Promise.all(
      Object.entries(profile.states).flatMap(([state, config]) =>
        ["front"].flatMap((view) => {
          const frames = (mixedSprites[id][state + "/" + view] = []);
          return Array.from(
            { length: config.files.length },
            (_, index) =>
              new Promise((resolve, reject) => {
                const image = new Image();
                frames.push(image);
                image.onload = resolve;
                image.onerror = () => reject(Error(id + "/" + state + "/" + view + "/" + index));
                image.src = "/assets/characters/" + id + "/sprites/" + view + "/" + config.files[index];
              }),
          );
        }),
      ),
    );
  }),
);
function mixedPose(f) {
  const state = f.cast > 0 ? "attack" : f.moving ? "walk" : "idle",
    view = "front",
    frames = mixedSprites[f.character][state + "/" + view];
  const index =
    state === "walk"
      ? Math.floor(((f.walk || 0) % 1) * frames.length)
      : state === "attack"
        ? Math.min(frames.length - 1, Math.floor((1 - f.cast / 0.42) * frames.length))
        : 0;
  return frames[index];
}
function mixedFlip(f) {
  return (f.facing || (f.team === 0 ? 1 : -1)) * (f.character === "tomato" ? -1 : 1);
}
function mixedSocket(f) {
  const p = characterProfiles[f.character],
    socket = p.sockets.front.attack,
    z = (baseScale() * 1100 * (p.scale || 1)) / p.visualHeight;
  return { x: f.x + mixedFlip(f) * (socket[0] - p.anchor.x) * z, y: f.y + (socket[1] - p.anchor.y) * z };
}
function drawMixedFighter(f) {
  if (f.hp <= 0) return;
  const image = mixedPose(f),
    p = characterProfiles[f.character];
  if (!image || !image.complete || !image.naturalWidth) return;
  const z = (baseScale() * 1100 * (p.scale || 1)) / p.visualHeight;
  g.save();
  g.translate(f.x, f.y);
  g.scale(mixedFlip(f), 1);
  // Team ring under the feet: blue for the player, red for the opponent.
  g.fillStyle = f.team ? "#ff4b3055" : "#48aaff55";
  g.strokeStyle = f.team ? "#ff5b37" : "#5ab8ff";
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(0, 3, baseScale() * 260 * (p.scale || 1), baseScale() * 65 * (p.scale || 1), 0, 0, 7);
  g.fill();
  g.stroke();
  if (f.hit) g.filter = "brightness(2.1)";
  if (f.character === "carrot" && f.cast > 0) {
    const phase = Math.sin((1 - f.cast / 0.42) * Math.PI);
    g.translate(phase * 8, -phase);
    g.rotate(phase * 0.04);
  }
  if (!f.moving && f.cast <= 0) g.scale(1, 1 + 0.004 * Math.sin((performance.now() / 1000) * 2 + f.lane));
  if (f.team === 1) drawEnemyOutline(image, -p.anchor.x * z, -p.anchor.y * z, Math.max(p.canvas.width, image.naturalWidth) * z, p.canvas.height * z);
  g.drawImage(f.team === 1 ? enemyTint(image) : image, -p.anchor.x * z, -p.anchor.y * z, Math.max(p.canvas.width, image.naturalWidth) * z, p.canvas.height * z);
  g.restore();
  // Health bars are drawn by the battle scene so they can avoid overlapping.
}
