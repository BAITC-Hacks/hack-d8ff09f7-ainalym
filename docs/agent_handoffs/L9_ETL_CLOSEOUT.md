# L9 ETL closeout

Outcome: the twelve unchanged partner XLSX exports rebuild the SQLite intake and derived series with `npm run etl`; named M1–M5 eval fixtures and 45 scripted world events are present.

Files: `scripts/etl/load.mjs`, `scripts/etl/derive.mjs`, `scripts/etl/world-events.mjs`, `fixtures/world_events.jsonl`, `fixtures/PROVENANCE.md`, `tests/fixtures/eval/replenishment_expectations.json`, `tests/etl/counts.test.ts`, `package.json`, `package-lock.json`, `docs/agent_handoffs/L9_CHECKPOINT.md`, this closeout. Source XLSX files were not edited. `data/partner.db` is generated and ignored.

Commits: `c7dbac0` loader; `1ec111a` derived series; `47b662c` eval expectations; `451cff1` world events; `538b973` provenance and reset test; `28ddfdb` zero-sum fix. Each is one logical unit.

Counts: supplier 2; sku 3,909 (IEK 3,185, SE 724); sales_line 248,915; sales_month 99,634; stock_month 117,282; in_transit 313 (IEK 306, SE 7); seasonality 66; season_index 24 (12 per supplier, mean 1); stockout sales months 1,596.

`qty_file / qty_lines` across 2024-01–2026-09: IEK 6,398,591 / 3,848,302 = 1.6627; SE 4,819,965 / 6,841,676 = 0.7045. These series intentionally remain separate; monthly file scope and document-line totals differ.

Eval SKUs: `seasonal` SE `130300027_` Сжим У 733M — 24 sold months in 2024–2025, CV 0.907, Q3 peak in both years. `stockout` IEK `130200032_` Розетка на дин-рейку — eight flagged months in 2025–2026 with earlier sales. `oneoff` IEK `010500008_` ВА47-29 25А — doc `20000099834` qty 7,488 vs p95 line qty 144 (52×). `intransit` IEK `010500006_` ВА47-29 16А — 30,000 in transit and sales in all nine 2026 months. `nocost` IEK `200400085_` F/UTP кабель — unit cost unknown, 33 months with sales.

Policies introduced: IEK/SE lead times 40/50 days, review 30 days, prepayment 30%; IEK category first four code characters; SE cost/category from its transit export; MOQ blank/zero → 1; monthly sales blank → 0; stock blank → `opening_qty=0, known=0`; positive outgoing lines alone form `qty_lines`; expected arrival is 2026-09-22 plus lead time. 2024–2025 supplier revenue determines season indices; 2026 partial year is excluded. Three judge presets are the only synthetic events.

Dependency: dev dependency `xlsx` for read-only parsing. `npm audit` reports high severity SheetJS prototype pollution/ReDoS advisories without a published npm fix; the supplied exports are the current input boundary.

Checks: `npm run etl` completed in 6.71–6.77 s; `npx vitest run tests/etl/counts.test.ts` passed after two identical reloads and five SKU existence checks; SQLite verified 1,596 stockouts and season-index mean 1; 45 JSONL rows parsed with unique sources and monotone seq.

Unverified surface: engine property checks M1–M5 and the root reset's scripted-event import belong to other lanes. The approximate SKU gate (~2,700; IEK ~2,150, SE ~570) conflicts with the explicit all-file union: sales-line codes alone are IEK 2,151 and SE 565, but other exports add codes. No codes were discarded to fit the estimate.

Gate: YELLOW

tip: 28ddfdb
