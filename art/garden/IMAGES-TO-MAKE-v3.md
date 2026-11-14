# Огород v3 — одна проекция для всех построек

## Зачем

Сейчас постройки нарисованы по-разному:

- Амбар, Лавка, Базар, Прилавок, Колодец и стойки нарисованы в изометрии: углом к зрителю, видны две стены.
- Грядки, частокол и ворота стоят фронтально: передняя стенка параллельна экрану.

Рядом это выглядит как предметы из разных игр. Огород построен на прямоугольной сетке (грядки рядами, дорожки прямые), поэтому берём **фронтальный ракурс, как у грядки**.

- Камера смотрит сверху-спереди, примерно 40° от горизонта.
- Передняя стена (фасад) параллельна нижнему краю картинки.
- Левая и правая стены почти не видны: вертикальные, без перспективного схождения.
- Крыша видна сверху.

Образец ракурса: грядка `src/assets/garden/obj/bed-empty.png` и частокол `palisade.png`.

## Как генерировать

- Все картинки делать в одном генераторе подряд, с одной приставкой, при возможности с одним seed.
- Если генератор принимает картинку-образец, дать ему `art/garden/style-reference.png` для стиля и `bed-empty.png` для ракурса.
- Фон чисто белый, без тени под объектом: тень игра рисует сама. Если генератор всё же нарисует серую тень, нарезка её уберёт.
- Можно все объекты на одном листе с промежутками, как `objects-sheet.png`: я нарежу его `tools/cut-objects.cjs`.

Общая приставка:

> stylized painterly game art, serious medieval fantasy tone (not cartoonish, not chibi), same style as the reference, rich hand-painted textures: weathered wood with knots, mossy stone, wrought iron, coarse canvas; natural daylight from the upper left, muted natural colors; **front-facing top-down 3/4 view: camera 40 degrees above the ground, the front facade exactly parallel to the bottom edge of the image, side walls vertical with no perspective convergence, symmetric framing**; isolated on a plain white background, no cast shadow on the ground, no text, no characters

## Что сделать

| Файл | Промпт (после приставки) |
|---|---|
| `armory.png` | a sturdy timber armory building with a red tiled roof, iron-banded double doors in the middle of the front facade, a war banner with a golden leaf above the doors, two shields on the facade, a spear rack and a weapon crate by the doors, square footprint |
| `seed-tent.png` | a seed merchant tent of cream canvas on wooden poles, open front, sacks and baskets of seeds inside on wooden shelves, a red banner with a golden leaf on the front pole, square footprint |
| `market-tent.png` | a round market tent with red and cream striped canopy, open front with a wooden counter, crates of vegetables and two barrels at the front |
| `trade-stall.png` | a small wooden market stall with a blue canvas awning, a counter with vegetables, a sack beside it, a small banner |
| `well.png` | a round stone well with a small red tiled roof on two wooden posts, a wooden bucket on a rope |
| `spear-rack.png` | a wooden rack with spears standing upright, front view |
| `shield-rack.png` | a wooden rack with round shields hanging on it, front view |
| `banner-stand.png` | a war banner on a pole set in a pile of stones, red cloth with a golden leaf |
| `laboratory.png` | a seed laboratory: a squat stone-and-iron alchemical apparatus with copper pipes and valves, a big glass dome on top filled with glowing purple liquid and a floating seed inside, a small round porthole and an arched iron door on the front facade, a few seed jars on a ledge (same idea as the old one in `D:\HomeProjects\GardenBattle\img\garden_items.png`, «Лаборатория», but in our style and front-facing) |
| `greenhouse.png` | a greenhouse of wooden frames and glass panes with a pitched glass roof, green seedlings visible through the glass, a wooden door in the middle of the front facade (old reference: «Теплица» in the same sheet) |

Не нужно переделывать: грядку, частокол, ворота, ящики, бочки, сено, камни, кусты. Они уже фронтальные или круглые, и ракурс на них почти не заметен.

## Размер

Квадрат 1024×1024 на объект или лист 3072×2048 со всеми объектами. Размер в игре я подгоню сам, но пропорции между объектами пусть будут как в жизни: колодец меньше амбара.

Готовые файлы положи в `art/garden/` и пришли пути, дальше нарезка и замена с моей стороны.
