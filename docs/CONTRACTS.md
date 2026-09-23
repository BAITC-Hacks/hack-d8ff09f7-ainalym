# CONTRACTS v1 — Ainalym data + API contract (replenishment case)

Status: **v1, L1 implementation checkpoint**. `src/db/schema.sql` is the storage source; `src/server/contracts.ts` holds zod request/response shapes and inferred TypeScript types. Every lane codes against these names. JSON only; money = decimal strings.

## 1. Conventions
- Ids: prefixed strings (`RUN-…`, `REC-…`, `PO-…`, `PR-…`, `TK-…`, `WE-…`, `AR-…`, `AA-…`); SKUs are keyed by the partner's 1С code (`code_1c`, e.g. `030200874_`). Tables with a `version` column bump it on repository updates; every repository/ledger/event write bumps global `state_version` in the same transaction → `GET /api/state` fingerprint.
- Money: `{ "amount": "1050.61", "currency": "KZT" }` — decimal strings, 2 dp (unit costs 2 dp); storage = integer minor units or decimal.js in `src/domain/money.ts`; never JS floats; currencies never summed.
- Truth axes on every result: `provenance: partner_anonymised|synthetic` · `ai: live|rules|replay|unavailable` · `external: export_only|local_simulator|unavailable` → label (§5).
- Modes (`AINALYM_MODE`): `live | offline`. Typed-decision provider `AI_PROVIDER=jev|openai|rules|offline` (auto when unset: `jev` if `TYPESAFE_API_KEY` or `AI_GATEWAY_API_KEY`, else `openai` if `OPENAI_API_KEY`, else `rules`). `jev` = direct TypeSafe API first, Vercel AI Gateway (`typesafe-ai/jev`) as fallback on a missing key or provider error — two parsers, `provider` = `jev:typesafe` | `jev:gateway`; task-class model aliases are optional and otherwise the existing Jev models pass through. `openai` honours `OPENAI_BASE_URL`, `OPENAI_REASONING_MODEL`, `OPENAI_FAST_MODEL`; `OPENAI_MODEL` remains a legacy environment name and does not override class defaults. `rules` = deterministic answers («Правила без LLM») — every must-have passes with no key. `offline` = replay for tests. A failed live call is `provider_error`/503, never a synthetic success.
- Errors: `{ ok:false, code, message, field? }` — 400 invalid · 403 denied · 404 unknown · 409 stale (version mismatch) · 422 business rejection · 503 provider_unavailable. Success bodies include `ok:true` and `state_version`.
- Idempotency: world events by `(org_id, source_id)`; ledger actions by `idempotency_key`; approvals bind `version`; voice tools by `request_id` (same id within 10 min → first result + `replayed:true`).
- Policies (stated, editable through `/api/params`, every change is a `param_change` proposal): lead time IEK 40 d, SE 50 d; review period 30 d; service level 90 % (z = 1.28); outlier rule: a document total with qty > max(20, min(3 × the SKU's median monthly qty, 5 × p95 of the other documents)) is a one-off; with fewer than 6 documents use the other documents' median instead of p95 (excluded from the regular series, listed in the rationale); growth cap ±50 %; IEK category = first 4 characters of `code_1c`; IEK `moq` is a minimum, SE `moq` is a multiple, with quantity measured in `sku.unit`; approved unreceived order lines and transit due within the horizon count as supply; supplier terms prepayment 30 % at approval, balance at ETA.

## 2. SQLite entities

Storage source: src/db/schema.sql. The raw row types are Tables in src/db/repo/index.ts. In this table s = TEXT, i = INTEGER, r = REAL, j = JSON stored as TEXT; ? means nullable. Quantities and money stored as TEXT are decimal strings. All primary and unique keys are enforced by SQLite.

| Table | Columns (name:type) | Primary / additional unique key |
|---|---|---|
| organization | id:s, name:s, payload:j | id |
| supplier | id:s, name:s, lead_time_days:i, review_days:i, terms:j, currency:s, version:i | id |
| sku | code_1c:s, supplier_id:s, article:s?, name:s, unit:s?, category:s?, unit_cost:s?, moq:i, weight:s?, first_sale_ym:s?, months_with_sales:i?, median_month_qty:s?, p95_doc_qty:s?, version:i | code_1c |
| sales_line | id:i, code_1c:s, doc_no:s?, doc_type:s?, at:s, warehouse:s?, qty:s, source:s | id |
| sales_month | code_1c:s, ym:s, qty_file:s?, qty_lines:s?, qty_regular:s?, stockout:i, stockout_kind:s? (`observed`/`inferred`) | (code_1c, ym) |
| stock_month | code_1c:s, ym:s, opening_qty:s?, known:i | (code_1c, ym) |
| in_transit | id:i, code_1c:s, po_ref:s, qty:s, expected_at:s?, source_file:s? | id |
| seasonality | supplier_id:s, year:i, month:i, revenue_kzt:s? | (supplier_id, year, month) |
| season_index | supplier_id:s, month:i, idx:s | (supplier_id, month) |
| outlier_doc | id:i, code_1c:s, doc_no:s?, at:s?, qty:s, rule:s, stat:j, decision:s, state:s, run_id:s? | id |
| forecast | id:s, run_id:s, code_1c:s, horizon_months:r, base_rate:s, season:j, growth:s, stockout_uplift:s, safety:s, method_ru:s?, version:i | id |
| calc_run | id:s, scope:j, params:j, started_at:s, finished_at:s?, skus:i, recommended:i, agent_run_id:s? | id |
| recommendation | id:s, run_id:s, code_1c:s, supplier_id:s, qty_recommended:i, qty_adjusted:i?, on_hand:s, in_transit:s, forecast_id:s?, urgency:s, rationale_ru:s, components:j, state:s, proposal_id:s?, version:i | id |
| purchase_order | id:s, supplier_id:s, run_id:s?, state:s, total_qty:i, total_cost:s?, cost_known_lines:i, eta:s?, export_path:s?, version:i | id |
| purchase_order_line | id:i, po_id:s, code_1c:s, qty:i, unit_cost:s?, rationale_ru:s? | id |
| proposal | id:s, kind:s, subject_type:s?, subject_id:s?, subject_version:i?, payload:j, affects:j, supersedes_id:s?, state:s, rationale_ru:s?, sources:j, money_at_stake:j?, version:i, created_at:s | id |
| approval | id:s, proposal_id:s, proposal_version:i, decision:s, adjustments:j?, by:s?, at:s | id |
| task | id:s, title:s, state:s, owner_role:s?, proposal_id:s?, next_event_at:s?, updated_at:s, version:i | id |
| obligation | id:s, kind:s, po_id:s?, supplier_id:s?, amount:s, currency:s, due_at:s?, state:s, basis:s?, version:i | id |
| payment | id:s, direction:s, counterparty_id:s?, amount:s, currency:s, payment_ref:s, at:s | id; payment_ref |
| world_event | id:s, org_id:s, seq:i?, kind:s, actor_id:s?, code_1c:s?, po_id:s?, at:s?, source_id:s, text:s?, payload:j, state:s, run_id:s?, emitted_at:s?, processed_at:s? | id; (org_id, source_id) |
| agent_run | id:s, org_id:s, trigger_type:s, trigger_ref:s?, state:s, started_at:s, finished_at:s?, actions_count:i, escalations_count:i | id |
| agent_action | id:s, run_id:s, org_id:s, world_event_id:s?, code_1c:s?, po_id:s?, kind:s, subject_ref:s?, summary_ru:s, rationale_ru:s?, sources:j, autonomy:s, result:s, provider:s?, model_version:s?, idempotency_key:s?, at:s | id; idempotency_key |
| decision_record | id:s, question_id:s, subject_ref:s?, answer:s?, distribution:j, provider:s?, model_version:s?, result_state:s, mode:s, at:s | id |
| ledger_peer_record | id:s, peer:s, external_identity:s, kind:s?, payload:j, version:i, state:s, as_of:s | id; (peer, external_identity) |
| state_version | n:i | singleton row, initial n=1 |

The L1 repository accepts typed raw rows, validates column names, and provides get/list/insert/update. Insert and update use a transaction; update increments row version where the column exists and increments state_version. Added indexes: world_event(org_id,state,seq), world_event(code_1c,state), agent_run(org_id,started_at), agent_action(org_id,at), agent_action(po_id,at). The L9 ETL produces 3,909 union SKUs; demo reset imports the original 45 scripted events plus one supplier reply, one local approved demo order, and one partner organization. Scripted events have no processing side effect until played.

## 3. JSON API

App Router handlers use the zod schemas in src/server/contracts.ts. A successful L1 response carries ok:true, provenance:partner_anonymised, ai:live/rules/replay/unavailable, external:export_only and state_version:i, except health, which carries version:i. An error is {ok:false,code:s,message:s,field?:s}. HTTP 400 covers malformed JSON, validation, kind, or source; 404 covers unknown or foreign org and unknown IDs; 409 is stale version on delegated approval routes; 422 is business rejection; 503 is unavailable ETL, database, or provider. JSON numeric amounts remain strings; only counts, versions, and quantities are JSON numbers.

| Method / path | Request and response fields | Status |
|---|---|---|
| GET /api/health | mode:live or offline; ai_provider:jev/openai/rules/offline; providers:{jev,openai,voice}:configured or missing; demo_guard:on/off; remaining_daily_budget:i or null; db:ok; version:i | 200, 503 |
| GET /api/state | fingerprint:s, state_version:i, at:ISO string | 200 |
| GET /api/modes | axes:{provenance,ai,external}, labels:map with section 5 values; connections includes `onec_in` (file_import, ETL `as_of` when loaded) and `onec_out` (export_only) | 200 |
| POST /api/demo/reset | Rebuild partner.db via ETL; returns counts: table-name to integer, including world_event=46 before processing | 200, 503 |
| POST /api/demo/example | Empty body; performs the SE calculation; same result as /api/calc/run | 200, 500 |
| POST /api/calc/run | {scope:{supplier?:IEK or SE,category?:s},params?:{lead_time_days?:i,review_days?:i,service_level?:number,growth_cap?:number,outlier?:{k_month,k_doc,min_units:number}}} → {run_id:s,skus:i,recommended:i,proposals:[{id,kind,subject_id,state,money_at_stake}],excluded:{missing_sales:i,missing_stock:i}} | 200, 400, 500 |
| GET /api/calc/runs; GET /api/calc/runs/:id | {runs:[calc_run]} newest first; {run:calc_run} with parsed scope and params | 200, 404 |
| GET /api/recommendations?run_id=&supplier=&category=&urgency= | {groups:[{supplier_id:s,total_qty:i,total_cost:Money or null,cost_known_lines:i,rows:[{id,code_1c,name,version,state,proposal_id,adjust_reason,on_hand,in_transit,forecast_qty,qty_recommended,qty_adjusted,moq,urgency,rationale_ru,components,outliers_excluded,stockout_months}]}]}; only positive quantities | 200 |
| GET /api/recommendations/:id | {recommendation:single row with rationale_ru, parsed components, version and proposal_id} | 200, 404 |
| POST /api/recommendations/:id/adjust | {qty:integer ≥ 0, reason:non-empty string ≤ 200, version:integer} → {recommendation:updated row,proposal:{id,version}}; stale version → {code:stale_version,current_version} | 200, 400, 404, 409 |
| GET /api/skus?q=&supplier=&category=&limit=&offset=; GET /api/skus/:code | {items:[sku],total:i}; {sku,series:[{ym,qty_file,qty_lines,qty_regular,stock,stock_known,stockout,outliers}],forecast?,recommendation?,in_transit:[],timeline:[]} | 200, 404 |
| GET /api/ekt/status | `{configured,live_reachable,last_snapshot_at,products,mapped_skus,source,as_of,label}`; read-only catalog status | 200 |

| GET /api/params; PUT /api/params | {suppliers:[{id,lead_time_days,review_days,terms,currency,version}],defaults:{service_level,growth_cap,outlier}}; PUT {supplier_id,lead_time_days?,review_days?,service_level?,growth_cap?} → {proposal_id,state:needs_review}; no immediate parameter write | 200, 202, 400, 404 |
| GET /api/money | {cash:[Money],committed_by_supplier:[{supplier_id,amount,currency,lines,cost_known_lines}],next_60d:{out:[{at,amount,currency,po_id,kind}]},stock_value:Money with cost_known_share or null,risks:[]} | 200, 500 |
| GET /api/today | {lead:s,decision:object or null,queue_count:i,pulse:{money,stockout_risk:{count,top:[{code_1c,name,days_of_cover,lead_time_days}]},agents:{auto:i,needs_you:i,ratio:number}},commitments:[],background:[],feed_next:[],empty_reason?:s}; derived from persisted runs, actions, proposals and world events | 200, 500 |
| GET /api/queue | {items:[{id,kind:proposal,title,why,sources:[],money_at_stake?,options:[{key,label,effect}],href,since}],empty_reason?:s}; priced proposals first | 200 |
| GET /api/agent/ledger?since=&code=&po=&limit= | {rows:[agent_action with sources array],stats:{auto:i,needs_you:i}}; newest first, limit 1–200 | 200 |
| GET /api/agent/runs; GET /api/agent/runs/:id | {runs:[agent_run]}; {run:agent_run,actions:[agent_action]} | 200, 404 |
| POST /api/agent/tick | {runs:[s],processed:i}; delegates to L3 worker | 200, 500 |

EKT-1 additions: `GET /api/skus/:code` carries `ekt:{id,url,price,currency,stock_total,stock_by_warehouse,availability,image_url,as_of,source}|null`. SKU and recommendation rows carry nullable `image_url`, `ekt_url`, `ekt_stock_total`, `ekt_source`, `ekt_as_of` from the dated snapshot; recommendation rows also carry nullable `ekt_price`, `ekt_currency`. Only the single-SKU route attempts a live detail lookup. EKT source labels are in §5.

Internal entry onEvent(kind, payload, source_id) accepts the section 2 world kinds, validates the current organization, inserts one pending world_event by (org_id,source_id), then calls processEvent(id). An identical source returns {event_id,run_id,replayed:true} with no second insert or state_version bump. Ledger startRun, recordAction and finishRun accept an optional caller DatabaseSync transaction; action idempotency_key replay returns the existing ID with no write.

### Supplier reply consequence

| Shape | Fields and effect |
|---|---|
| `world_event.kind=supplier_reply` | `actor_id=supplier_id`, `po_id`, `text` in Russian, `payload:{supplier_id,po_id,affected_lines?:code_1c[]}`, unique `(org_id,source_id)`. Scripted `WE-046` refers to the local demo order and follows the original 45 events. |
| Typed interpretation | `{action:split\|expedite\|unknown, partial_share:string\|null, partial_qty:integer\|null, delay_days:integer\|null, promised_eta:ISO-date\|null, affected_lines:code_1c[], decision_record_id}`. `supplier_fulfilment` uses the existing provider choice layer; the rules adapter works without keys. Quantity and date extraction are validated by rules before proposing an order change. |
| `proposal.kind=supplier_split` | `subject_type=purchase_order`, `subject_id=po_id`, `subject_version=PO.version`, `state=needs_review`, `payload:{source_id,supplier_id,original_text,decision,parts:{now,later}}`. Each part has `eta,lines,total_qty,total_cost,prepayment,balance`; the parts conserve quantity and priced cost. Queue and feed use Russian explanations. |
| `proposal.kind=supplier_expedite` | Same subject binding; `payload` also has `alternatives:[{code_1c,available_supplier}]`. Approval raises recommendation urgency and prepares an internal purchasing task. A supplier move is suggested only when that exact SKU exists under another supplier. |
| Approval and money | No event sends or changes an order. Approving a split against the current PO version divides the approved local order into two approved parts, synchronizes 30 % prepayment and 70 % balance for each part, and exposes four obligations in `/api/money`. Settled obligations block the split. Rejecting leaves the order unchanged. |

Delegated surface remains: GET /api/orders[/:id], POST /api/orders/:id/approve and GET /api/orders/:id/export.csv|xlsx (L2/L6, versioned PO approval and 1C export); GET /api/proposals and POST /api/proposals/:id/approve|reject (L2a, proposal_version, 409 stale); GET /api/world/feed, POST /api/world/play|compose (L6, scripted events); POST/GET /api/decisions and POST /api/drafts, GET /api/artifacts/:id[/download] (L3); voice and assistant routes (L5); supplier simulator and search/notifications routes (L6/L4c). Their owner-specific request details continue under sections 4–8 and their route modules.

1С «Заказ поставщику» file export (CSV/XLSX) columns, in order: `Номенклатура.Код`, `Номенклатура`, `Артикул`, `Ед.`, `Количество`, `Цена` (blank when unknown), `Поставщик`, `Дата поставки (ETA)`, `Срочность`, `Обоснование`. The first column is the partner's 1С SKU code; readers may also accept legacy `Код 1с` as an input alias. Download name: `Заказ_поставщику_<SE|IEK>_<YYYY-MM-DD>.xlsx|csv` via UTF-8 `filename*`. Export remains a file for separate import into 1С, with no accounting-system write.

## 4. Voice tools (L5 bridge → L2/L3). Call `{request_id, scope:{org_id, supplier_id?, code_1c?}, args}`.
| Tool | args | result |
|---|---|---|
| what_needs_me | `{}` | `{items:[{id, kind, title, money_at_stake?, href}]}` (= the queue) |
| what_changed | `{since?: state_version}` | `{summary_ru, changes:[{object, id, field, before, after}], state_version, labels}` |
| recommend_for | `{supplier_id?|category?}` | runs the engine on the scope → `{run_id, recommended, top:[{code_1c, qty, urgency}]}`; never approves |
| explain_sku | `{code_1c}` | `{rationale_ru, components, outliers_excluded, stockout_months, forecast}` |
Client seam (L5 exports, L4 imports): `useVoiceSession(scope) → {state: idle|connecting|listening|checking|preparing|waiting_review|ended|unavailable, reason?, start, stop, mute, interrupt, captions:[{who, text}]}` from `src/voice/useVoiceSession.ts`; `<Captions lines/>` from `src/voice/Captions.tsx`.

## 5. Labels — the single table (served by `GET /api/modes`; UI, tests and README use these strings and no variants; never a badge that reads «connected» or «1С подключена»)
| value | EN (canonical) | RU (UI) |
|---|---|---|
| provenance=partner_anonymised | `Partner data · anonymised` | «Данные партнёра · обезличены» |
| ai=live | `Live AI` | «Живой AI» |
| ai=rules | `Rules, no LLM` | «Правила без LLM» |
| ai=replay | `Replay · recorded decision` | «Воспроизведение · записанное решение» |
| ai=unavailable | `Provider unavailable` | «Провайдер недоступен» |
| agents | `Agents · synthetic company` → for this case `Agents · partner data` | «Агенты · данные партнёра» |
| external=export_only (1С file) | `Export for 1C (file)` | «Экспорт для 1С (файл)» |
| supplier channel | `Draft — not sent` / `Sent (controlled demo channel)` / `Confirmed (simulator)` | «Черновик заказа — не отправлен» / «Отправлено (контролируемый демо-канал)» / «Подтверждено (симулятор)» |
| world | `World simulator · synthetic event` | «Симулятор мира — синтетическое событие» |
| voice | `Voice: live` / `Voice: unavailable` | «Голос: живой» / «Голос недоступен» |
| ekt catalog | `ekt_api_live` / `ekt_snapshot` | «Каталог ekt.kz · живой API» / «Снимок каталога ekt.kz от <дата>» |
| urgency | `critical · soon · normal · none` | «критично · скоро · планово · не требуется» |
| task states | `preparing · awaiting_supplier · needs_review · ready_to_handover · handed_over · handover_failed` | «Готовлю · Ждём поставщика · Нужна ваша проверка · Готово к передаче · Передано · Ошибка передачи» |
| proposal states | `draft · needs_review · approved · stale · rejected · delivered · delivery_failed` | «черновик · ждёт вас · утверждено · устарело — есть новая версия · отклонено · передано · ошибка передачи» |

## 6. Data and evaluation isolation
Runtime data = `fixtures/partner/{IEK,SE}/*.xlsx` (the partner's anonymised exports, verbatim, disclosed) loaded by `npm run etl` (L9) into the tables of §2; `fixtures/world_events.jsonl` (40 sales days, two stock/transit events, three judge presets, one supplier reply) loaded as `scripted` rows; `fixtures/decision_catalog.json` (six typed questions, including `supplier_fulfilment`; authority `proposal_only`); `fixtures/replay_decisions.json` (L3). Evaluation only: `tests/fixtures/eval/replenishment_expectations.json` (L9: the named SKUs `seasonal`, `stockout`, `oneoff`, `intransit`, `nocost` + the five property checks + counts) — never imported by `src/`. Reset = ETL rebuild plus the one local demo order; no event processed.

## 7. Check runner (`npm run check [-- domain|ai|ui|voice|peers|skeleton|etl|demo]`, owner L1; `scripts/scenario.mjs` owner L2b, run when present)
One line per item `[PASS|FAIL|SKIP|UNVERIFIED] <id> — <property>` then `check: passed=N failed=N skipped=N externally-unverified=N`; exit 1 only when `failed>0`; a test lacking a key/mic/network calls `ctx.skip("UNVERIFIED: <reason>")`. Tests run on `DATABASE_PATH=":memory:"`. `scripts/scenario.mjs` prints the five ТЗ checks M1–M5 as `[PASS|FAIL]` lines and the money view.

## 8. Seam stubs (root-written; every lane modifies, never adds, the shared file)
`src/db/client.ts` (root; L1 extends additively): `db()` singleton `DatabaseSync`, `migrate()` from `schema.sql`, `withTx(fn)`, `bumpStateVersion()` · `src/domain/money.ts` (L2a): `Money.of(amount, currency)`, `add`, `sub`, `mul`, `allocate(n)`, `toJSON()` · `src/domain/engine.ts` (L2a): `computeNeed(code_1c, params, ctx) → {forecast, need, rationale_ru, components}` · `src/domain/apply.ts` (L2a): `applyRecommendations(run_id) → {proposals[], tasks[], affected[]}` · `src/domain/views.ts` (L2a): `todayView(orgId)`, `queueView(orgId)`, `ordersView(orgId)`; re-exports `moneyView`, `skuView` · `src/domain/events.ts` (L2b): `applyWorldEvent(event) → {applied, affected_codes[], actions[], escalations[]}` · `src/domain/cashflow.ts` (L2b): `moneyView(orgId)` · `src/domain/skus.ts` (L2b): `skuView(code_1c)` · `src/server/ledger.ts` (L1): `startRun({org_id, trigger_type, trigger_ref}) → run_id`, `recordAction(run_id, {...}) → id`, `finishRun(run_id, state)` · `src/server/pipeline.ts` (L1): `onEvent(kind, payload, source_id) → {event_id, run_id?, replayed?}` · `src/ai/worker.ts` (L3): `processEvent(world_event_id) → {run_id, actions, escalations}`, `tick() → {runs[], processed}` · `src/ai/interpret.ts` (L3): `judgeOutlier(doc, stats) → decision`, `summarizeChanges(run_id) → text` · `src/peers/deliver.ts` (L6): `deliverOrder(po) → {state: "exported"|"delivery_failed", path?, reason?}` · `src/voice/useVoiceSession.ts` + `src/voice/Captions.tsx` (L5). Dependencies a lane adds are listed in its closeout; `package.json` conflicts are resolved by the root taking both.
