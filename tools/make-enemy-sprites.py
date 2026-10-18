"""Build recoloured enemy copies: characters/<id>/sprites/front/*.png -> sprites/enemy/*.png.
Warm body hues (red/orange) are shifted to purple; greens and neutrals stay as they are.
Run again after changing any front sprite: python tools/make-enemy-sprites.py"""
import pathlib, numpy as np
from PIL import Image

TARGET_HUE = 280  # purple

def recolor(src, dst, target_h=TARGET_HUE, hmin=-25, hmax=48, smin=.42, vmin=.18):
    a = np.asarray(Image.open(src).convert("RGBA")).astype(np.float32) / 255
    rgb = a[..., :3]; mx = rgb.max(-1); mn = rgb.min(-1); d = mx - mn + 1e-6
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 0, d / (mx + 1e-6), 0); v = mx
    hh = np.where(h > 180, h - 360, h)
    m = (hh >= hmin) & (hh <= hmax) & (s >= smin) & (v >= vmin) & (a[..., 3] > 0)
    w = np.clip(np.minimum(hh - hmin, hmax - hh) / 8, 0, 1) * np.clip((s - smin) / .12, 0, 1) * m
    nh = (target_h + (hh - 10) * 0.6) % 360
    c = v * s; x = c * (1 - np.abs((nh / 60) % 2 - 1)); m0 = v - c
    i = (nh // 60).astype(int) % 6; z = 0 * c
    R = np.choose(i, [c, x, z, z, x, c]); G = np.choose(i, [x, c, c, x, z, z]); B = np.choose(i, [z, z, x, c, c, x])
    out = rgb * (1 - w[..., None]) + np.stack([R + m0, G + m0, B + m0], -1) * w[..., None]
    Image.fromarray((np.dstack([out, a[..., 3:]]) * 255).clip(0, 255).astype(np.uint8)).save(dst)

root = pathlib.Path(__file__).resolve().parent.parent / "src/assets/characters"
for front in sorted(root.glob("*/sprites/front")):
    enemy = front.parent / "enemy"; enemy.mkdir(exist_ok=True)
    for png in sorted(front.glob("*.png")):
        recolor(png, enemy / png.name); print(enemy / png.name)
