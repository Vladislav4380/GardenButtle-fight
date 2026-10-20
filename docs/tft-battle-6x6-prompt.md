# Бой 6×6 в ракурсе TFT — промпты

Цель: отдельная страница с боем 6 на 6 в ракурсе как на референсе (камера со стороны игрока, сверху под углом ~50°, шестиугольная доска, наш отряд снизу, соперник сверху). Героев пока три типа, поэтому в отряде повторы: например 2 моркови + 2 помидора + 2 перца или 3 моркови + 2 перца + 1 помидор.

Работа в два этапа:
1. **Страница на текущих спрайтах** — сразу посмотреть, как играется и выглядит (свои показаны со спины, враги анфас).
2. **Новые спрайты и фон** — подменить картинки, когда будут готовы. Код от этого не меняется.

---

## Промпт 1. Разработка страницы (для Claude / Kilo Code)

```
Сделай в проекте GardenButtle-fight новую отдельную страницу боя 6×6 в ракурсе TFT.

Где:
- Сцена: src/scenes/tft-6x6/index.html (по образцу src/scenes/mobile-vertical/index.html).
- Рантайм: src/assets/shared/runtime/tft-battle.js — отдельный файл, mobile-battle.js не менять.
  Общие вещи бери оттуда же по смыслу: COMBAT_SPECS, FIGHTER_ARCHETYPES/ARCHETYPE_BONUS (×1.35 / ×0.82),
  умения (перец — огненный шар, морковь — рывок, помидор — щит), figure-physics.js для столкновений.
- Маршрут: /duels/tft-6x6 — добавить 'tft-6x6' в список ids в src/app/pages/canvas-scene.page.ts
  и ссылку на главной странице рядом с другими поединками.

Камера и поле:
- Вид со стороны игрока сверху под углом ~50°: наша половина внизу, соперник вверху.
- Доска из шестиугольников: 7 колонок × 4 ряда на каждую сторону (как в TFT), клетки видны всегда.
- Перспектива: дальние ряды мельче ближних (масштаб героя ~0.8 в самом дальнем ряду, 1.0 в ближнем),
  клетки тоже сужаются к верху (трапеция).
- Размер героя ≈ 1/8 высоты экрана в ближнем ряду. Полоски здоровья над головой: свои зелёные, враги красные.
- Сортировка отрисовки по y (кто ниже на экране — рисуется поверх).

Расстановка (до боя):
- В отряде 6 героев. Тип каждого слота меняется нажатием (перец → помидор → морковь), повторы разрешены.
- Героя перетаскивают только на клетки своей половины; при отпускании он встаёт в центр ближайшей
  свободной клетки. На клетку — один герой.
- Состав и расстановка соперника случайные и видны до боя.
- Никаких линий и значков целей на поле.

Правила боя (как в текущем бою 3×3):
- Обе команды всегда атакуют, стратегий нет.
- Пока боец идёт — цель ближайший враг. Когда цель в зоне атаки, боец бьёт её до смерти.
- Сменить цель можно, только если бойца ударил другой враг и этот враг ближе текущего.
- Цель погибла — берёт ближайшего.
- Бой 60 с, последние 15 с урон ×3; по таймауту побеждает отряд с большим суммарным HP (разница > 2%).
- Умения срабатывают сами из энергии отряда.
- Во время боя герои двигаются свободно (не по клеткам), сетка нужна только для расстановки.

Спрайты:
- Свои герои показываются видом back (идут вверх на врага), враги — видом front.
- Пути к картинкам брать из src/assets/characters/<id>/manifest.json (views, states, anchor, sockets),
  чтобы потом новые спрайты подменялись без правок кода.
- Фон арены: src/assets/arenas/tft-arena.png; пока его нет — рисовать доску и простой фон кодом.

Проверка:
- Тест tools/test-tft-battle.cjs: привязка к клеткам, нельзя поставить на чужую половину и на занятую клетку,
  бой 6×6 заканчивается (гибель отряда или таймаут), правила выбора цели выше.
- Открыть /duels/tft-6x6 в браузере, сделать скриншот расстановки и середины боя.
- Ничего не коммитить без просьбы.
```

---

## Промпт 2. Спрайты героев в новом ракурсе (для генерации картинок)

Генерировать по одному герою, подкладывая текущий спрайт как референс внешности (`src/assets/characters/<id>/sprites/front/idle.png`), чтобы персонаж остался узнаваемым.

Общий текст (подставить героя):

```
Game sprite of [HERO], a stylized cartoon vegetable warrior for a mobile auto-battler,
in the same art style as the reference image (painted 3D-cartoon look, thick readable shapes,
warm lighting from the top-left).
Camera: isometric-style view from above at about 50 degrees, like Teamfight Tactics units on the board.
View: [3/4 FRONT — the character faces down-right toward the camera] or
      [3/4 BACK — the character faces up-left, away from the camera, we see its back and the weapon side].
Pose: [idle / walk frame 1 of 4 / attack wind-up / attack release].
Full body, centered, feet at the bottom center, the same size and position in every frame.
Transparent background, no shadow on the ground, no text, no border.
Canvas 1024×1536 px.
```

Герои:
- **Помидор** (Страж): круглый красный помидор, зелёная ботва-«хохолок», щит с узором помидора, стреляет помидорами из небольшой пушки.
- **Перец** (Стрелок): красный перец в броне, огненный шар в руке / посох.
- **Морковь** (Быстрый боец): оранжевая морковь, зелёный хохолок, копьё и круглый щит.

На каждого героя нужно: 2 вида (3/4 front и 3/4 back) × (idle 1 кадр + walk 4 кадра + attack 2 кадра) = **14 картинок**. На трёх героев — 42.

Чтобы кадры были согласованы:
- сначала сделать idle в обоих видах, потом каждый следующий кадр генерировать с idle как референсом;
- ноги в одной точке холста во всех кадрах (это `anchor` в manifest.json);
- после генерации обновить `anchor`, `sockets` (точка вылета снаряда) и `visualHeight` в manifest.json.

Цвет команды не рисовать в спрайте: враги перекрашиваются кодом (сейчас фиолетовый тон).

---

## Промпт 3. Фон арены

```
Top-down 50-degree view of a fantasy arena floating on a sky island, for a mobile auto-battler board,
same camera as Teamfight Tactics. Stone hexagon floor 7 columns × 8 rows (two halves of 4 rows),
mossy stone walls around, braziers with fire in the corners, purple banners on the far side,
blue-and-gold banners on the near side, small barrels and vegetable crates near the walls,
waterfalls and floating islands in the background, bright sunny lighting.
No characters. No UI. No text. 1920×1080, the board centered and filling about 80% of the height.
```

Файл положить в `src/assets/arenas/tft-arena.png`; координаты углов доски записать в `src/assets/arenas/tft-arena.json`, чтобы код совместил сетку с картинкой.

---

## Промпт 4. Разворот героя на одном листе (все ракурсы сразу)

Идея как с походкой: все ракурсы на одной картинке — тогда размер, пропорции и стиль у них общие. Рисуем 5 уникальных ракурсов, остальные 3 из 8 направлений получаются зеркальным отражением (вниз-влево, влево, вверх-влево).

ЗАГРУЗИТЬ: текущий спрайт героя `src/assets/characters/<id>/sprites/front/idle.png`. Новый чат ChatGPT.

```
The uploaded image is my game character: [ОПИСАНИЕ ГЕРОЯ — см. ниже].
Draw a character turnaround sheet for a mobile auto-battler: the same character 5 times in one row,
left to right, standing in the same idle combat pose, turned to 5 directions:
1 - facing the camera (front),
2 - three-quarter front, turned to the RIGHT (we see the face and the right side),
3 - side view, facing RIGHT (profile),
4 - three-quarter back, turned to the RIGHT (we see the back and the right side, no face),
5 - facing away from the camera (back).
Camera: slightly from above, about 35 degrees down, like units on a Teamfight Tactics board,
the same camera for all 5 figures.
Same character, same costume, same weapon in the same hand in every figure; the weapon and the shield
turn together with the body.
Size: exactly the same size in all 5 figures: the same head width, the same total height
(top of the head to the soles, difference not more than 3%). All 5 figures stand on one common ground line.
Leave clear white space between the figures, they must not touch or overlap.
White background, no shadows on the ground, no text, no numbers, no grid.
```

Описание героев для вставки:
- **Морковь:** an angry carrot warrior with a green leafy top, green cape, leaf skirt, brown boots, a spear and a round wooden shield with a carrot emblem.
- **Помидор:** an angry tomato guardian with a green stem on top, green ragged cape, brown boots, a round red shield on one arm and a small tomato cannon on the other.
- **Перец:** an angry red bell pepper knight with a green stalk, red armor with gold rivets, red cape with gold trim, red boots, fists ready to throw fireballs.

## Промпт 5. Анимации по ракурсам (после разворота)

Для каждого из 5 ракурсов — отдельный лист, как делали с походкой: загрузить фигуру этого ракурса из разворота (вырезать её) и попросить 4 кадра ходьбы / 2 кадра атаки в одном ряду, тем же текстом, что `src/assets/characters/carrot/source/walk/prompt-walk.txt`, заменив «walks to the RIGHT, three-quarter view» на нужный ракурс.

Нарезка: листы режутся на кадры скриптом (убрать белый фон, найти каждую фигуру, выровнять подошвы по общей линии и центр по одной точке), кадры кладутся в `sprites/<ракурс>/`, точки опоры пишутся в `manifest.json`.

## Промпт 6. Атака по ракурсам

Готовые тексты для каждого героя (с подставленными описанием и ракурсом) — в `art/<id>/prompts.txt`, шаги 7–11. Шаблон:

ЗАГРУЗИТЬ: фигуру нужного ракурса из разворота (`turn-<ракурс>.png`). Новый чат ChatGPT. СОХРАНИТЬ КАК: `attack-<ракурс>.png`.

```
The uploaded image is my game character in one direction: [ОПИСАНИЕ ГЕРОЯ]. Draw a new image: the same character 3 times in one row, left to right, frames 1-3, an attack animation. The character keeps EXACTLY the direction of the uploaded image: [DIRECTION]. Camera slightly from above, about 35 degrees down, the same as in the uploaded image.
Frame 1 - wind-up: [ЗАМАХ].
Frame 2 - strike: [УДАР].
Frame 3 - recovery: halfway back to the idle pose of the uploaded image.
The feet stay planted on the same spot in all 3 frames (only a small step forward in frame 2 is allowed, not more than half a head width). Exactly the same size in all 3 frames: the same head width, total height differs by no more than 3%. All 3 figures stand on one common ground line, clear white space between them, they must not touch. White background, no shadows on the ground, no text, no numbers.
```

[DIRECTION]:
1. `facing the camera`
2. `three-quarter front view, turned to the RIGHT`
3. `side view, facing RIGHT`
4. `three-quarter back view, turned to the RIGHT, no face visible`
5. `back view, facing away from the viewer, no face visible`

[ЗАМАХ] / [УДАР]:
- **Морковь:** `pulls the spear back to the hip, shield forward, body leaning back` / `a fast spear thrust forward in the facing direction, arm fully extended, body leaning forward, shield pulled to the chest`
- **Помидор:** `raises the tomato cannon and aims it in the facing direction, shield covering the body` / `the cannon fires, a small burst of red juice and smoke at the muzzle, the arm recoils back a little`
- **Перец:** `pulls one fist back, a small fireball forming in the hand` / `throws the fireball forward in the facing direction, arm fully extended, the fireball just leaving the hand`

Навыки (щит, огненный шар, удар из тени) пока показываются кадрами атаки и эффектом из кода; отдельные кадры не нужны.
