# art-work: исходники персонажей

Сюда не попадает ничего из игры: игровые спрайты лежат в `src/assets/characters/<id>/`.

```text
art-work/
├── shared/
│   └── poses/<анимация>/       библиотека поз манекена, одна на всю игру
│       ├── pose_sheet.png
│       └── walk_preview.gif
└── characters/<id>/<анимация>/  например characters/tomato/walk/
    ├── ref-1-4.png              склейка для Scenario: персонаж + позы 1–4
    ├── ref-5-8.png              склейка для Scenario: персонаж + позы 5–8
    ├── prompt.txt               промт, один на обе склейки
    └── scenario/                сюда сохранять то, что сгенерировал Scenario
```

`<id>` совпадает с именем папки в `src/assets/characters` (pepper, carrot, tomato).
