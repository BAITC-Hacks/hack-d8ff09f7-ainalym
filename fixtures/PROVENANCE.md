# Partner data provenance

Данные партнёра ТОО «Электрокомплект», обезличены (номера документов, без клиентов). The twelve XLSX files below were copied verbatim by the root. This lane reads them without editing them. Product names, 1C codes and document numbers remain source values; no customer or person fields are loaded.

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
- Introduced replenishment policies: IEK lead time 40 days, SE 50 days, review interval 30 days, prepayment 30%. Positive in-transit rows have `expected_at` equal to 2026-09-22 plus supplier lead time (IEK 2026-11-01; SE 2026-11-11). PO references retain IEK column headers or `СЭ 24.09` for SE.
- `season_index` uses 2024–2025 annual-normalized supplier revenue, averaged by calendar month and normalized to mean one; partial 2026 is excluded. A stockout requires zero or unknown opening stock and sales in at least two of the previous three months. SKU p95 uses positive outgoing document lines.
- `fixtures/world_events.jsonl` contains 40 real sales days, the September 2026 opening-stock snapshot, and the SE in-transit update. The only synthetic records are the three explicitly labeled judge presets (one-off line, in-transit +100, SE price update). No synthetic rows are inserted by `npm run etl`.
