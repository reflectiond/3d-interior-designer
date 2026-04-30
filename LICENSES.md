# Третьесторонние ассеты — лицензии

Все графические ассеты (PNG-спрайты мебели, glTF-модели), используемые в приложении, должны быть под лицензией **CC0** или **CC-BY**. Любая мебель в каталоге, использующая `sprite2d` или `model3d`, обязана иметь запись в этой таблице.

## Спрайты (2D)

| Файл  | Объект каталога (`id`) | Автор | Источник | Лицензия |
| ----- | ---------------------- | ----- | -------- | -------- |
| _нет_ | _нет_                  | _нет_ | _нет_    | _нет_    |

## 3D-модели (glTF / GLB)

Все 12 моделей мебели — из набора **Kenney Furniture Kit (v2.0, 2018)**:
автор [Kenney Vleugels](https://kenney.nl/), источник <https://kenney.nl/assets/furniture-kit>, лицензия **CC0 1.0 Universal** ([deed](https://creativecommons.org/publicdomain/zero/1.0/)). Атрибуция не обязательна по лицензии, указана для прозрачности.

| Файл                                           | Объект каталога (`id`) |
| ---------------------------------------------- | ---------------------- |
| `public/models/kenney/tableCross.glb`          | `table`                |
| `public/models/kenney/chair.glb`               | `chair`                |
| `public/models/kenney/loungeSofa.glb`          | `sofa`                 |
| `public/models/kenney/bedDouble.glb`           | `bed`                  |
| `public/models/kenney/cabinetBedDrawer.glb`    | `wardrobe`             |
| `public/models/kenney/chairDesk.glb`           | `chair_office`         |
| `public/models/kenney/desk.glb`                | `desk`                 |
| `public/models/kenney/kitchenCabinet.glb`      | `kitchen_lower`        |
| `public/models/kenney/kitchenCabinetUpper.glb` | `kitchen_upper`        |
| `public/models/kenney/kitchenFridge.glb`       | `kitchen_column`       |
| `public/models/kenney/toilet.glb`              | `toilet`               |
| `public/models/kenney/kitchenSink.glb`         | `sink`                 |

## Шрифты

| Файл                                   | Использование       | Автор    | Источник                                                  | Лицензия |
| -------------------------------------- | ------------------- | -------- | --------------------------------------------------------- | -------- |
| `public/fonts/PT_Sans-Web-Regular.ttf` | PDF-экспорт (F10.1) | ParaType | [Google Fonts](https://fonts.google.com/specimen/PT+Sans) | OFL-1.1  |
| `public/fonts/PT_Sans-Web-Bold.ttf`    | PDF-экспорт (F10.1) | ParaType | [Google Fonts](https://fonts.google.com/specimen/PT+Sans) | OFL-1.1  |

## Правила

1. **Только CC0 или CC-BY.** Никаких NC (NonCommercial), ND (NoDerivatives) или unlicensed-ассетов.
2. **CC-BY требует атрибуции** — указывать автора прямо в этой таблице.
3. **При добавлении нового ассета**:
   - Скопировать файл в `public/sprites/` или `public/models/`.
   - Добавить запись в соответствующую таблицу.
   - Обновить `furniture-catalog.json` (поле `sprite2d` или `model3d`).
   - В PR-описании сослаться на эту запись.
4. **При удалении** — убрать запись из таблицы вместе с файлом.
