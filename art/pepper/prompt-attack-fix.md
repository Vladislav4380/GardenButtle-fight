# Промпт для ChatGPT: исправить кадры атаки перца

Приложить к сообщению исходный лист `art/pepper/sheet.png` и вставить текст ниже.
Готовый лист сохранить как `art/pepper/sheet.png` и запустить `node tools/cut-sheets.cjs pepper`.

---

Edit the attached sprite sheet. Keep everything exactly the same — the same character (red bell-pepper warrior in red-and-gold armor with a red cape), the same art style, colors, lighting, proportions and scale, the same 5 rows × 7 columns grid, the same cell positions and spacing, the same pure white background. Columns 1–5 (idle and 4 walk frames) must stay pixel-for-pixel unchanged.

Redraw ONLY columns 6 and 7 (the attack) in all 5 rows. The rows are the same character seen from 5 angles, all facing right: row 1 front, row 2 three-quarter front, row 3 side view, row 4 three-quarter back, row 5 back. Keep each row's viewing angle.

Column 6 — wind-up: the pepper pulls his right hand back to the shoulder; a small, compact ball of fire (about the size of his fist) glows in that palm, close to the body. Body leaning back slightly, knees bent, cape moving.

Column 7 — throw: the pepper thrusts the same arm forward toward the right with an open palm, body leaning into the throw, front foot forward. At the palm there is only a short, small burst of flame and sparks (a muzzle flash no longer than his forearm) — NOT a large fireball and no flame trail flying away; the projectile is drawn separately by the game.

Important for both columns:
- The whole figure, the arm and all fire must stay well inside its own cell, with clear white space on every side; nothing may touch or cross the cell border or overlap the neighbouring cell.
- Feet on the same ground line and at the same horizontal position as in column 1 of that row; the character must be the same height as in the other columns.
- Fire colors: bright yellow-white core, orange, red edges; clean edges, no smoke, no glow spilling onto the background, no shadow on the ground.
- No text, no frame lines, no extra objects.
