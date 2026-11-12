# Огород v2 — картинки в стиле наших героев

Стиль как у героев боя: плотный стилизованный 3D-рендер в духе Clash of Clans / Clash Royale, объём, фактуры (старое дерево с сучками, камень, кованое железо, грубая ткань), насыщенные, но не кислотные цвета, мягкий тёплый свет сверху-слева, глубокие тени, чуть «боевая», а не детская атмосфера. Ракурс — изометрия сверху-сбоку, как поле боя 6×6.

Общая приставка к промптам:

> stylized 3D game art in the style of Clash of Clans, same style as chibi vegetable warrior characters in armor, rich hand-painted textures, weathered wood with knots, mossy stone, wrought iron details, saturated but natural colors, warm soft light from top left, deep soft shadows, isometric 3/4 top-down view, high detail, no text

Чтобы картинки были «из одной руки», лучше делать их в одном генераторе подряд, с одним и тем же стилем/seed и, если можно, с картинкой героя (например, art/tomato/preview.png) как образцом стиля.

## 1. Фон участка (главное)

Камера ближе, чем сейчас: на экране телефона видно поле грядок крупно, здания по краям. Карта больше экрана и двигается пальцем.

- Файл: `farm-v2.png`, вертикальный, **2048×3072** или больше.
- Промпт (после приставки):

> a large fortified farmstead in a forest clearing, the center is a wide empty flat field of rich dark tilled soil and short grass framed by a low wooden palisade, a sturdy wooden barn with iron-banded doors and a war banner at the top, a seed merchant stall with sacks and crates on the right, a market tent on the left, dirt paths with stones, a well, haystacks, barrels, tall trees and bushes around the edges, portrait orientation, the empty field takes the middle half of the picture, no fields or plants in the empty area, no characters

## 2. Грядка — 4 состояния (обязательно)

Одна и та же грядка, одинаковый размер и ракурс, прозрачный фон, PNG, 512×512.

| Файл | Промпт (после приставки) |
|---|---|
| `bed2-empty.png` | a single square raised garden bed with a thick weathered wooden frame and iron corner brackets, freshly dug dark soil in furrows, empty, isolated on transparent background |
| `bed2-sprouts.png` | the same raised garden bed, tiny green sprouts in rows, isolated on transparent background |
| `bed2-growing.png` | the same raised garden bed, young leafy plants half grown, isolated on transparent background |
| `bed2-ready.png` | the same raised garden bed, lush mature plants ready to harvest, a few golden sparkles, isolated on transparent background |

## 3. По желанию

- `sign-board.png` — деревянная доска заказов на столбе (для будущих заказов), прозрачный фон.
- `well.png`, `scarecrow.png`, `cart.png` — декор, прозрачный фон.

Готовые файлы — в `art/garden/` или пришли пути.
