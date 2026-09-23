# PRODUCT — what we build and what «complete» means (acceptance, D-H46 case)

Case: «Автоматический расчёт заказов поставщикам для пополнения склада» (HackAlem AI, трек «Логистика», партнёр ТОО «Электрокомплект»). Every row below is real code a reviewer can check; the ТЗ must-haves are M1–M5.
**Promise.** «Ainalym is a financial operations OS for trading businesses. Agents run the commercial cycle. You decide.» First vertical today: supplier replenishment for an electrical-components distributor. Agents compute what to order, from every source the company has, explain every number, and only the purchasing manager approves.
**Episode.** New sales day / stock snapshot / in-transit update arrives (world feed) → the worker recomputes the affected SKUs → recommendations with rationale, grouped by supplier → decision queue «Заказ поставщику IEK: n позиций, сумма» → the manager adjusts a quantity, approves → PO draft, 1С-compatible export, prepared supplier email (never sent) → money: committed cash by supplier and expected outflow at ETA → voice: «что нужно заказать по категории 2?».
**Contract table (real code, reviewer-visible proof).**
| Capability | Real | Proof |
|---|---|---|
| Data intake (L9/L1) | xlsx → SQLite, one table per source; counts printed; anonymised | reset reloads; counts match the files |
| Need engine (M1) | per SKU: forecast over lead time + review period − on hand − in transit + safety stock, MOQ rounding; every source read | change in-transit by +100 → qty drops (before rounding); remove a source → the run refuses with the missing source named |
| Forecast (M2) | per-SKU seasonal index (own months ≥ 12 with sales, else supplier revenue seasonality) × YoY growth (capped) | seasonal SKU forecast varies by month, not flat; chart shows it |
| Stockout compensation (M3) | months with opening stock 0 after prior sales = censored → estimated from neighbours | raw need vs adjusted need shown; adjusted > raw |
| Outlier exclusion (M4) | document-level one-off detection (qty ≫ SKU's typical doc and month) → excluded, listed in the rationale | judge injects a 5 000-unit doc via the feed → regular qty changes < 10 %; the doc appears as «исключено» |
| Supplier orders + export (M5) | grouped by supplier, rationale per line with the numbers, urgency; xlsx/csv with «Код 1с» | export opens; every row has a rationale |
| Approval queue | proposals `needs_review`; adjust → approve binds version; auto-send impossible | queue empties; ledger shows it |
| Agent worker + ledger | one worker on events; affected-only recompute; every step logged | feed play → ledger rows; duplicate event → nothing |
| Money and obligations | committed cash = Σ qty × unit cost (SE known; IEK «себестоимость не задана»), outflow at ETA by stated terms | strip changes when a PO is approved |
| Voice + assistant | Realtime over the same tools; typed path always | spoken question → same records |
| Reviewer path | README 11 RU items incl. methodology + outlier algorithm + run; clean clone; offline = `rules` provider, no key | judge runs it alone |
**Numbers (from the data, code computes).** 2 152 IEK SKUs, 566 SE SKUs; sales lines 171 604 + 77 313 (2023-01 → 2026-09, warehouse Алматы only); monthly stock/sales 2024-01 → 2026-09; IEK in-transit = 6 open POs (columns), SE in-transit = «СЭ в пути 24.09»; unit cost only for SE («СС реал»); MOQ IEK «Мин. разр. к отгр.», SE «Кратность». Lead-time policy (stated, editable): IEK 40 days, SE 50 days; review period 30 days; service level 90 % (z = 1.28); outlier rule: a document line > max(20, min(3 × the SKU's median monthly qty, 5 × the SKU's p95 document qty)) → one-off; growth cap ±50 %.
**Modes.** live (Jev/OpenAI for borderline outlier judgments, change summaries, voice) · `rules` («Правила без LLM» — the engine is deterministic; every must-have passes with no key) · offline replay for tests. Labels as CONTRACTS §5 + «Данные партнёра · обезличены» + «Черновик заказа — не отправлен».
**Checks.** `npm run check` → engine tests (M1–M5 properties on named SKUs), ETL counts, queue/ledger, export; `node scripts/scenario.mjs` prints the five judge checks as `[PASS|FAIL]`.
**Cut order.** landing · voice polish · category trend chart · SE weight/volume · `/api/columns` · notifications/search · timer. Never: engine M1–M5, queue, ledger, pulse, feed play + judge compose, export, README, offline `rules` mode, hosted demo.
