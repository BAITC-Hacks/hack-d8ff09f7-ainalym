# Partner data provenance

Данные партнёра ТОО «Электрокомплект», обезличены (номера документов, без клиентов). The twelve XLSX files below were copied verbatim by the root. This lane reads them without editing them. Product names, 1C codes and document numbers remain source values; no customer or person fields are loaded.

## Вход 1С

Вход: стандартные отчёты 1С УТ партнёра в XLSX — динамика продаж, ежемесячные продажи и остатки, товар в пути, MOQ и сезонность. Файлы загружаются как есть через `npm run etl`, без доработки конфигурации 1С. Это файловый импорт, не живая связь с учётной системой. `GET /api/modes` показывает время последней загрузки как `connections[onec_in].as_of` из `organization.payload.etl_fetched_at`; дата относится к ETL, а не к созданию исходных отчётов. Выход — отдельный файл «Экспорт для 1С (файл)» после утверждения заказа; автоматической записи в 1С нет.

| Supplier | File | Data rows | Period | Loaded fields |
| --- | --- | ---: | --- | --- |
| IEK | `MOQ  ИЭК.xlsx` | 1,938 | 2026 export | Код 1с, Артикул поставщика, Наименование, Мин. разр. к отгр. |
| IEK | `Динамика продаж_2025-2026.xlsx` | 171,604 | 2023-01–2026-09 | Дата, Номер, Документ, Код, Номенклатура, Ед., Склад, Количество |
| IEK | `Ежемесячные остатки продукции за последние 2 года  ИЭК.xlsx` | 2,853 SKUs | 2024-01–2026-09 | Номенклатура, Ед., Номенклатура.Код, monthly opening quantities |
| IEK | `Ежемесячные продажи в количественном выражении за последние 2 года.xlsx` | 2,463 SKUs | 2024-01–2026-09 | Номенклатура, Номенклатура.Код, monthly sales quantities |
| IEK | `Путь ИЭК 22.09.2026.xlsx` | 2,623 coded rows | 2026-09-22 | Код 1с, Артикул ИЭК, Наименование, six PO columns |
| IEK | `Сезонность ИЭК.xlsx` | 3 years | 2024–2026 | год, 12 monthly revenue fields, ИТОГО |
| SE | `MOQ SystemElectric.xlsx` | 554 | 2026 export | Номенклатура, Номенклатура.Код, Артикул, Кратность |
| SE | `Динамика продаж_Syseme Electric_2025-2026.xlsx` | 77,313 | 2023-01–2026-09 | Дата, Номер, Документ, Код, Номенклатура, Ед., Склад, Количество |
| SE | `Ежемесячные остатки SystemElectric 2024-2026.xlsx` | 701 SKUs | 2024-01–2026-09 | Номенклатура, Номенклатура.Код, Ед.изм, monthly opening quantities |
| SE | `Ежемесячные продажи в кол-м выражении SystemElectric 2024-2026.xlsx` | 554 SKUs | 2024-01–2026-09 | Номенклатура, Номенклатура.Код, Артикул, Кратность, monthly sales quantities; embedded Лист1 ignored |
| SE | `Сезонность SystemElectric 2024-2026.xlsx` | 3 years | 2024–2026 | год, 12 monthly revenue fields, ИТОГО |
| SE | `Товар в пути_SystemElectric на 22.09.2026.xlsx` | 497 coded rows | 2026-09-22 | Код 1с, Артикул поставщика, Наименование, Категория 2026, СС реал, СЭ в пути 24.09, Вес; monthly sales columns observed but not used as the authoritative monthly series |

## Interpretation and introduced policies

- SKU is the union of all twelve source files per supplier. This yields 3,909 codes (IEK 3,185; SE 724), above the approximate sales-only gate of 2,700; sales-line codes alone are IEK 2,151 and SE 565. No source code was dropped to reach the estimate.
- The monthly sales and stock exports cover January 2024 through September 2026. Blank sales cells become zero. Blank opening stock cells become `opening_qty='0', known=0`; present zero cells have `known=1`. Negative sales lines are retained. `qty_lines` sums only positive `Расходная накладная` lines and is kept separate from `qty_file`.
- IEK category is the first four characters of the 1C code. SE category comes from `Категория 2026`; SE cost from `СС реал`, with zero treated as unknown. IEK cost remains unknown. MOQ or multiple of zero/blank becomes one.
- Fresh on-hand is stored separately from month-opening stock: SE `Свободный остаток` on 2026-09-22; IEK known September opening less outgoing lines through 2026-09-22. Missing fresh values fall back to month-opening stock.
- Introduced replenishment policies: IEK lead time 40 days, SE 50 days, review interval 30 days, prepayment 30%. Positive in-transit rows have `expected_at` equal to 2026-09-22 plus supplier lead time (IEK 2026-11-01; SE 2026-11-11). PO references retain IEK column headers or `СЭ 24.09` for SE.
- `season_index` uses 2024–2025 annual-normalized supplier revenue, averaged by calendar month and normalized to mean one; partial 2026 is excluded. A stockout requires zero or unknown opening stock and sales in at least two of the previous three months (1,591 flagged months); known negative stock is not zero. SKU p95 uses positive outgoing document lines.
- `fixtures/world_events.jsonl` contains 40 real sales days, the September 2026 opening-stock snapshot, and the SE in-transit update. The only synthetic records are the three explicitly labeled judge presets (one-off line, in-transit +100, SE price update). No synthetic rows are inserted by `npm run etl`.

## Изображения товаров

`fixtures/documents/iek_invoice_demo.xlsx` — синтетический демонстрационный счёт: реальные коды, артикулы и названия IEK из каталога, но условные цена, количество, номер и дата; расхождения с синтетическим заказом `PO-DEMO-IEK-DOCUMENTS` внесены намеренно.

Изображения иллюстративные: помогают распознать товар и **не участвуют в расчёте** спроса, количества, стоимости или заказа. Реестр: `fixtures/sku_images.json`; точное изображение SKU имеет приоритет над `category:<supplier_id>:<category>`, иначе API возвращает `image_url: null`. Поле добавлено в строки `/api/skus`, объект `sku` в `/api/skus/:code` и строки `/api/recommendations`.

- **379 `official`** — [официальный каталог IEK](https://www.iek.ru/products/catalog/search?q=MAD10-2-016-C-030), точное совпадение артикула поставщика, изображения с `cdn-02.iek.ru`. Источник каждого SKU записан отдельно. Проверено 400 положительных рекомендаций: поставщик по возрастанию, себестоимость по убыванию (неизвестная = 0), код 1С по возрастанию. При таком порядке все первые 400 — IEK. Попадания: **379/400 (94,75%)**.
- **0 `store`** — [Электрокомплект](https://ekt.kz/robots.txt): 0/21 резервных поисков по публичному permalink кода. Поиск с query-параметрами и `/upload/` запрещены robots.txt; запрещённые адреса не скачивались. 10 SKU без артикула, 11 без точного изображения в IEK остались без индивидуальной фотографии.
- [Systeme Electric](https://systeme.ru/product/GAL001029): адаптер публичной страницы по артикулу и проверка JSON-LD Product; проба вернула HTTP 200 и совпадающий SKU. В лимит 400 SE не вошёл, поэтому hit-rate SE — **не измерялся**, строки SE используют категории при наличии. IEK.kz не использован.
- **30 `category`**, **0 `generated` для отдельных SKU** — Higgsfield CLI, выбранный Team workspace, Nano Banana 2 (`nano_banana_flash`, 1k, 1:1). Нейтральный тёплый серо-бежевый фон, мягкий свет, без надписей. Первые 30 категорий по числу рекомендованных строк: IEK — первые четыре символа кода; SE — «Категория 2026». Смешанные категории SE 1/2/3 и IEK 1303/1501 изображают ассортимент, а не точную модель. Категории и примеры: `docs/evidence/images/categories.json`.
- Кредиты этой линии: **45 / 1 200**, 30 вызовов по 1,5. Журнал каждого задания, prompt, quote и списание: `docs/evidence/images/generation.json`. Сумма подтверждена 30 транзакциями; API транзакций не содержит job ID, поэтому привязка списаний к вызовам хронологическая. Один HTTP 503 на оценке стоимости преодолён возобновлением без повторной отправки уже созданных заданий. Общий бюджет владельца 2 500 включает другие линии; их расходы здесь не учитываются.
- Все **409 JPEG — 96×96, максимум 5 654 байта**, лимит 12 000. Масштабирование без искажения пропорций и дополнение полей через macOS `sips`; новых runtime-зависимостей нет. Загрузчик использует `AinalymSkuImages/1.0`, общую очередь с интервалом ≥550 мс, robots.txt каждого origin, повторную проверку редиректов и остановку запросов к origin после 429/503; без авторизации.
- Проверка: все 3 909 строк SKU API, exact/category/null в detail, 1 259 рекомендаций, из них **1 184 с изображением**. Старый ответ рекомендаций совпадает полностью после удаления только `image_url`. Доказательства: `docs/evidence/images/fetch.json`, `verification.json`, `checks.json`.

Воспроизведение на macOS: `DATABASE_PATH=./data/partner.db npm run etl`; запустить `DATABASE_PATH=./data/partner.db AINALYM_MODE=offline AI_PROVIDER=rules npx next dev -p 3410`; выполнить `POST /api/calc/run` с `{}` и сохранить `GET /api/recommendations` в `data/images/recommendations.json`. Далее последовательно `node scripts/images/fetch_sku_images.mjs`, `node scripts/images/generate_categories.mjs`, `node scripts/images/verify_images.mjs`. Существующие журналы возобновляются; для новой приоритетной выборки сначала архивировать старый fetch-журнал. Генератор использует зафиксированные 30 категорий и сохраняет резерв стоимости до отправки; не запускать оба писателя реестра одновременно. Для новой генерации повторно сверить списания CLI с журналом.
