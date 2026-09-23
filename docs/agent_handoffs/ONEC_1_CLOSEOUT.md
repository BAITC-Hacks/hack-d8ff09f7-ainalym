# ONEC-1 closeout
- Outcome: standard 1С УТ report files enter through ETL; `/api/modes` exposes `onec_in` with the last ETL fetch time and `onec_out` as `export_only`.
- Exact CSV/XLSX header: `Номенклатура.Код;Номенклатура;Артикул;Ед.;Количество;Цена;Поставщик;Дата поставки (ETA);Срочность;Обоснование`.
- Download example: `Заказ_поставщику_SE_2026-09-23.xlsx` (also `.csv`), via RFC 5987 UTF-8 `filename*`.
- Checks: `npm run etl` → 3,909 SKUs; `npm run check` → `check: passed=246 failed=0 skipped=6 externally-unverified=6`; `npm run build` → exit 0.
- Tip: rerun ETL after replacing partner reports, then download the approved order file and import it into 1С separately.
- Limits: unknown price and ETA remain blank; no live OData/EnterpriseData or write into 1С.
- Gate: GREEN for file import metadata and file export; live 1С connection is outside this scope.
