# Воины на грядках — ещё 13 культур

Те же три стадии прорастания, что у первых шести (`art/garden/warriors-sheet.png`):

1. Из кучки земли торчит только верх головы в стальном шлеме, видны глаза.
2. Боец вылез по грудь, руки лежат на земле, видны наплечники. Оружия нет.
3. Боец стоит на кучке земли в полный рост, в доспехе и с оружием, в боевой стойке.

Каждый боец должен быть узнаваем как свой герой из боя: тот же цвет, доспех и оружие. Образцы для каждого героя лежат в `src/assets/characters/<id>/` (портрет в `sprites/sheet.png` или `sprites/front/idle.png`). Если генератор принимает картинку-образец, давай ему `warriors-sheet.png` для стиля и раскладки и портрет героя для облика.

## Как генерировать

Лучше листами, как первый: **1024×1536, белый фон, 6 строк × 3 столбца**. Одна строка — одна культура, слева направо стадии 1, 2, 3. Объекты не касаются друг друга. Нарезку сделаю сам (`tools/cut-objects.cjs`).

- Лист A: перец, свёкла, кабачок, орех, баклажан, огурец.
- Лист B: капуста, виноград, ананас, банан, вишня, петрушка.
- Лист C: укроп (можно одной строкой 1024×512).

Если листом не выходит, делай по одной культуре: строка 1536×512, три стадии.

### Общая приставка

> game asset sheet on a plain white background, same style as the reference sheet: stylized 3D render of chibi vegetable warriors in armor, rich hand-painted textures, serious determined faces, warm soft light from the upper left, each figure on its own small mound of dark crumbly soil, no ground plane, no cast shadow beyond the mound, no text. Each row is one vegetable warrior in three growth stages from left to right: (1) only the top of its head wearing a steel helmet peeks out of the soil mound, eyes visible; (2) it has emerged up to the chest, arms resting on the soil, shoulder armor visible, no weapon; (3) fully out of the ground, standing on the mound in full armor holding its weapon, battle-ready pose. Same size and scale for every row, figures evenly spaced, not touching.

### Строки (после приставки)

| id | Культура | Описание строки |
|---|---|---|
| pepper | Перец | a red bell pepper warrior with a green curled stem on top, ornate red-and-gold plate armor, a red cape, bare armored fists clenched (no weapon) |
| beet | Свёкла | a dark crimson beet warrior with big green beet leaves on top, a dark green hooded cloak, leather armor, a straight steel sword |
| zucchini | Кабачок | a pale green striped zucchini warrior, green leather armor and cape, a spiked wooden club, a round wooden shield with a zucchini emblem |
| walnut | Орех | a brown walnut-shell warrior with a carved shell face, sturdy leather and bronze armor, a heavy iron war hammer, a round wooden shield with a golden leaf |
| eggplant | Баклажан | a purple eggplant mage with a green calyx cap, purple-and-gold robe-armor with a high collar and red cape, a twisted wooden staff topped with a glowing purple orb |
| cucumber | Огурец | a bumpy green cucumber warrior with a curly tendril on top, green leather armor and leafy cape, a knobbly spiked club, a round wooden shield with a leaf emblem |
| cabbage | Капуста | a round green cabbage warrior with leafy layers as a hood, green leather armor, a spiked wooden club, a round wooden shield with a leaf emblem |
| grape | Виноград | a light green grape-bunch warrior with a vine stem and leaf on top, green and leather armor, a short sword, a round wooden shield with a grape emblem |
| pineapple | Ананас | a golden pineapple warrior with a spiky green crown, golden-brown armor, a spiked iron mace on a long handle |
| banana | Банан | a yellow banana warrior whose peel opens like a cape, brown leather armor, a large broad steel sword |
| cherry | Вишня | a pair of red cherries joined by one stem with two big green leaves, a red scarf, red-and-brown leather armor, two curved daggers |
| parsley | Петрушка | a parsley warrior with a big bushy head of flat parsley leaves, green leather armor, a pair of wooden-and-brass nunchucks |
| dill | Укроп | a dill warrior with a tall feathery fan of fine dill fronds on its head, green leather armor and scarf, two curved swords |

Стадия 1 у всех одинаковая по форме: шлем на макушке, из-под него видно, чей это верх (листья свёклы, корона ананаса, хвостик перца, черешок вишни и т. п.), чтобы ростки разных культур различались.

## После генерации

Положи листы в `art/garden/` (например `warriors-sheet-2.png`, `warriors-sheet-3.png`) и пришли пути. Дальше с моей стороны:

- нарезать и разложить как `src/assets/garden/obj/w-<id>-1..3.png`;
- добавить культуры в огород (время роста, урожай) и в стартовый амбар;
- после этого они станут доступны в бою из огорода.
