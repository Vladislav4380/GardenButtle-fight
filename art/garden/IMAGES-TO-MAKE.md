# Огород — картинки для первой версии

Стиль тот же, что у героев: яркий мультяшный фэнтези-рендер, мягкий свет сверху слева, лёгкая тень снизу.
Все объекты рисуются **в изометрии сверху-сбоку под 45°** (как клетки поля в бою 6×6), **на прозрачном фоне**, PNG.
Размер указан для одной картинки; можно присылать крупнее — я уменьшу.

Общая приставка к каждому промпту (английский, для генератора):

> cartoon fantasy mobile game asset, isometric 3/4 top-down view, vibrant colors, soft light from top left, clean outline, isolated on transparent background, no text, no characters

## 1. Основа участка (обязательно)

| № | Файл | Размер | Что это | Промпт (после приставки) |
|---|---|---|---|---|
| 1 | `ground-grass.png` | 512×512, бесшовная | Трава участка, повторяется плиткой | seamless tileable grass texture, short lush garden grass, small flowers and clover, top-down |
| 2 | `ground-path.png` | 512×512, бесшовная | Утоптанная земля / тропинка | seamless tileable packed dirt path texture, small pebbles, top-down |
| 3 | `fence.png` | 512×256 | Кусок деревянного забора по краю участка | short rustic wooden picket fence segment |

## 2. Грядка 2×2 клетки (обязательно)

Одна и та же грядка в 4 состояниях, одинаковый размер и ракурс, чтобы картинки сменяли друг друга без скачка.

| № | Файл | Размер | Что это | Промпт |
|---|---|---|---|---|
| 4 | `bed-empty.png` | 512×384 | Пустая вскопанная грядка с деревянной рамкой | raised garden bed with wooden frame, freshly dug dark soil with furrows, empty |
| 5 | `bed-sprouts.png` | 512×384 | Та же грядка, маленькие ростки | same raised garden bed, rows of tiny green sprouts |
| 6 | `bed-growing.png` | 512×384 | Та же грядка, кустики подросли | same raised garden bed, rows of medium leafy young plants |
| 7 | `bed-ready.png` | 512×384 | Та же грядка, всё созрело, лёгкое золотое свечение | same raised garden bed, rows of mature lush plants ready to harvest, soft golden glow |

Над созревшей грядкой я сам покажу портрет героя этой культуры — рисовать конкретный овощ на грядке не нужно.

## 3. Здания (обязательно)

Каждое примерно 3×3 клетки.

| № | Файл | Размер | Что это | Промпт |
|---|---|---|---|---|
| 8 | `shop-seeds.png` | 512×512 | Лавка семян | small cozy seed shop stall, wooden counter, sacks and jars of seeds, striped awning, hanging sign without text |
| 9 | `barn.png` | 512×512 | Амбар, склад бойцов | cozy red wooden barn with big double doors, hay at the door, small banner with crossed swords |
| 10 | `bazaar.png` | 512×512 | Базар, торговля между игроками | colorful market tent with several stalls, crates of vegetables, lanterns |

## 4. Значки интерфейса (обязательно)

Круглые значки в той же манере, что значки групп (Стражи, Плоды…), 128×128.

| № | Файл | Что |
|---|---|---|
| 11 | `icon-gold.png` | Золотая монета |
| 12 | `icon-seed.png` | Мешочек семян |
| 13 | `icon-plant.png` | Лопатка с ростком — кнопка «Посадить» |
| 14 | `icon-build.png` | Молоток — кнопка «Построить» |
| 15 | `icon-barn.png` | Амбар — кнопка «Амбар» |
| 16 | `icon-harvest.png` | Корзинка — «Собрать» |

## 5. Потом (не нужно для первой версии)

Теплица (`greenhouse.png`, 3×3), декор 1×1: фонарь, пугало, клумба, бочка, колодец, камни, куст; тропинка-плитка; мешочки семян для каждой из 19 культур.

---

Готовые файлы клади в `art/garden/` с этими именами — я нарежу, уменьшу и подключу.
