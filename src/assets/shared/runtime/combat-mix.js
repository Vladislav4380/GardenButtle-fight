// Opponents are recoloured once per frame image: warm body hues (red/orange) turn purple,
// greens and neutrals stay as they are. No separate enemy files are needed.
const ENEMY_HUE = 280;
const enemyTintCache = new WeakMap();
function enemyTint(image) {
  let tinted = enemyTintCache.get(image);
  if (tinted) return tinted;
  tinted = document.createElement("canvas");
  // Half resolution is still sharper than the fighter on screen and tints 4x faster.
  tinted.width = Math.ceil(image.naturalWidth / 2);
  tinted.height = Math.ceil(image.naturalHeight / 2);
  const t = tinted.getContext("2d");
  t.drawImage(image, 0, 0, tinted.width, tinted.height);
  try {
    const data = t.getImageData(0, 0, tinted.width, tinted.height),
      px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3] || px[i] < px[i + 2]) continue;
      const r = px[i] / 255, gr = px[i + 1] / 255, b = px[i + 2] / 255,
        mx = Math.max(r, gr, b), d = mx - Math.min(r, gr, b) + 1e-6, s = mx > 0 ? d / mx : 0;
      if (s < 0.42 || mx < 0.18) continue;
      let h = (mx === r ? ((gr - b) / d + 6) % 6 : mx === gr ? (b - r) / d + 2 : (r - gr) / d + 4) * 60;
      if (h > 180) h -= 360;
      if (h < -25 || h > 48) continue;
      const w = Math.min(1, Math.min(h + 25, 48 - h) / 8) * Math.min(1, (s - 0.42) / 0.12),
        nh = (((ENEMY_HUE + (h - 10) * 0.6) % 360) + 360) % 360,
        c = mx * s, x = c * (1 - Math.abs(((nh / 60) % 2) - 1)), m0 = mx - c,
        k = Math.floor(nh / 60) % 6,
        nr = k === 0 || k === 5 ? c : k === 1 || k === 4 ? x : 0,
        ng = k === 1 || k === 2 ? c : k === 0 || k === 3 ? x : 0,
        nb = k === 3 || k === 4 ? c : k === 2 || k === 5 ? x : 0;
      px[i] = (r * (1 - w) + (nr + m0) * w) * 255;
      px[i + 1] = (gr * (1 - w) + (ng + m0) * w) * 255;
      px[i + 2] = (b * (1 - w) + (nb + m0) * w) * 255;
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
  // Short soft flash on a hit; a strong one made tanks that are hit often flicker.
  if (f.hit) g.filter = "brightness(1.35)";
  if (f.character === "carrot" && f.cast > 0) {
    const phase = Math.sin((1 - f.cast / 0.42) * Math.PI);
    g.translate(phase * 8, -phase);
    g.rotate(phase * 0.04);
  }
  // Tomato recoil is done in code: idle and shot use the same aiming frame, the body jerks back a little.
  if (f.character === "tomato" && f.cast > 0) g.translate(Math.sin((1 - f.cast / 0.42) * Math.PI) * 6, 0);
  if (!f.moving && f.cast <= 0) g.scale(1, 1 + 0.004 * Math.sin((performance.now() / 1000) * 2 + f.lane));
  g.drawImage(f.team === 1 ? enemyTint(image) : image, -p.anchor.x * z, -p.anchor.y * z, Math.max(p.canvas.width, image.naturalWidth) * z, p.canvas.height * z);
  g.restore();
  // Health bars are drawn by the battle scene so they can avoid overlapping.
}
