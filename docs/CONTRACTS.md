# CONTRACTS v0 — Ainalym data + API contract (replenishment case)

Status: **v0, published by the root at T+7**; L1 turns it into v1 with real zod schemas in `src/server/contracts.ts` and re-publishes this file. Every lane codes against these names. L1 may add fields; nobody renames without a closeout note. JSON only; money = strings.

## 1. Conventions
- Ids: prefixed strings (`RUN-…`, `REC-…`, `PO-…`, `PR-…`, `TK-…`, `WE-…`, `AR-…`); SKUs are keyed by the partner's 1С code (`code_1c`, e.g. `030200874_`). Mutable objects carry integer `version`; every write bumps the global `state_version` in the same transaction → `GET /api/state` fingerprint.
- Money: `{ "amount": "1050.61", "currency": "KZT" }` — decimal strings, 2 dp (unit costs 2 dp); storage = integer minor units or decimal.js in `src/domain/money.ts`; never JS floats; currencies never summed.
- Truth axes on every result: `provenance: partner_anonymised|synthetic` · `ai: live|rules|replay|unavailable` · `external: export_only|local_simulator|unavailable` → label (§5).
- Modes (`AINALYM_MODE`): `live | offline`. Typed-decision provider `AI_PROVIDER=jev|openai|rules|offline` (auto when unset: `jev` if `TYPESAFE_API_KEY` or `AI_GATEWAY_API_KEY`, else `openai` if `OPENAI_API_KEY`, else `rules`). `jev` = direct TypeSafe API first, Vercel AI Gateway (`typesafe-ai/jev`) as fallback on a missing key or provider error — two parsers, `provider` = `jev:typesafe` | `jev:gateway`. `openai` honours `OPENAI_BASE_URL` + `OPENAI_MODEL`. `rules` = deterministic answers («Правила без LLM») — every must-have passes with no key. `offline` = replay for tests. A failed live call is `provider_error`/503, never a synthetic success.
- Errors: `{ ok:false, code, message, field? }` — 400 invalid · 403 denied · 404 unknown · 409 stale (version mismatch) · 422 business rejection · 503 provider_unavailable. Success bodies include `ok:true` and `state_version`.
- Idempotency: world events by `(org_id, source_id)`; ledger actions by `idempotency_key`; approvals bind `version`; voice tools by `request_id` (same id within 10 min → first result + `replayed:true`).
- Policies (stated, editable through `/api/params`, every change is a `param_change` proposal): lead time IEK 40 d, SE 50 d; review period 30 d; service level 90 % (z = 1.28); outlier rule: a document line > max(3 × the SKU's median monthly qty, 5 × the SKU's p95 document qty, 20 units) → one-off; growth cap ±50 %; IEK category = first 4 characters of `code_1c`; supplier terms prepayment 30 % at approval, balance at ETA.

## 2. Entities (SQLite via `node:sqlite`; `src/db/schema.sql` written by the root; L9 loads the partner tables, L2 computes, L1 owns repositories)
| Table | Key fields | Distinction it protects |
|---|---|---|
| organization | id, name, payload(json: opening_cash[]) | one org: the partner (anonymised) |
| supplier | id (IEK · SE), name, lead_time_days, review_days, terms(json), currency, version | policies are data, not code |
| sku | code_1c PK, supplier_id, article, name, unit, category, unit_cost?, moq, weight?, first_sale_ym?, months_with_sales?, median_month_qty?, p95_doc_qty?, version | one row per partner SKU; cost known only for SE |
| sales_line | id, code_1c, doc_no, doc_type, at, warehouse, qty, source (file · judge) | the raw history; sold = positive, negative = return; judge-injected rows are marked |
| sales_month | code_1c, ym, qty_file, qty_lines, qty_regular?, stockout; unique (code_1c, ym) | file vs derived vs outlier-cleaned series kept apart |
| stock_month | code_1c, ym, opening_qty, known; unique (code_1c, ym) | blank ≠ zero is remembered |
| in_transit | id, code_1c, po_ref, qty, expected_at, source_file | a change here must change the result (M1) |
| seasonality · season_index | supplier_id, year, month, revenue_kzt · supplier_id, month, index | company-level pattern, normalised to mean 1 |
| outlier_doc | id, code_1c, doc_no, at, qty, rule, stat(json), decision (auto · jev · owner), state (excluded · kept), run_id | every excluded document is visible (M4) |
| forecast | id, run_id, code_1c, horizon_months, base_rate, season(json), growth, stockout_uplift, safety, method_ru, version | the numbers behind a recommendation (M2, M3) |
| calc_run | id, scope(json), params(json), started_at, finished_at, skus, recommended, agent_run_id | one run = one agent run |
| recommendation | id, run_id, code_1c, supplier_id, qty_recommended, qty_adjusted?, on_hand, in_transit, forecast_id, urgency (critical · soon · normal · none), rationale_ru, components(json), state (proposed · adjusted · approved · rejected · exported), proposal_id?, version | rationale per row (M5); adjustment never overwrites the recommendation |
| purchase_order · purchase_order_line | id, supplier_id, run_id, state (draft · approved · exported), total_qty, total_cost?, cost_known_lines, eta, export_path?, version · po_id, code_1c, qty, unit_cost?, rationale_ru | grouped by supplier; approval binds version; export is a file |
| proposal | id, kind (supplier_order · outlier_review · param_change), subject_type, subject_id, subject_version, payload(json), affects(json), supersedes_id?, state (draft · needs_review · approved · stale · rejected · delivered · delivery_failed), rationale_ru, sources(json), money_at_stake?(json), version | the decision queue's rows; nothing autonomous approves them |
| approval | id, proposal_id, proposal_version, decision (approve · reject), adjustments(json)?, by, at | binds the exact version |
| task | id, title, state (preparing · awaiting_supplier · needs_review · ready_to_handover · handed_over · handover_failed), owner_role, proposal_id?, next_event_at, updated_at | persisted; English keys |
| obligation | id, kind (supplier_prepayment · supplier_balance), po_id, supplier_id, amount, currency, due_at, state (open · settled · superseded), basis, version | money committed by approved orders |
| payment | id, direction, counterparty_id, amount, currency, payment_ref (unique), at | duplicate ref → no double effect |
| world_event | id, org_id, seq, kind (sales_day · stock_snapshot · in_transit_update · price_update · judge_message · supplier_reply), actor_id, code_1c?, po_id?, at, source_id, text, payload(json), state (scripted · pending · processed · replayed · failed), run_id?, emitted_at, processed_at; unique (org_id, source_id) | the inbox the worker drains; the world only inserts |
| agent_run | id, org_id, trigger_type (world_event · calc_request · scheduled_check · voice · goal), trigger_ref, state (running · done · failed), started_at, finished_at, actions_count, escalations_count | one run per event/tick/request |
| agent_action | id, run_id, org_id, world_event_id?, code_1c?, po_id?, kind (recompute · outlier_flagged · recommendation_prepared · order_drafted · escalation · decision · status_change · export_written · obligation_updated · noop), subject_ref, summary_ru, rationale_ru?, sources(json), autonomy (auto · escalated), result (done · needs_owner · failed), provider?, model_version?, idempotency_key (unique), at | the «agents did this» ledger |
| decision_record | id, question_id, subject_ref, answer, distribution(json), provider, model_version, result_state (decided · insufficient · unsupported · provider_error), mode (live · rules · replay), at | Unknown ≠ No ≠ Error |
| ledger_peer_record | id, peer (onec_export · supplier_channel), external_identity (unique per peer), kind, payload(json), version, state, as_of | export files and supplier-channel states |
| state_version | n | fingerprint for `/api/state` |

## 3. JSON API (App Router route handlers; the owner in brackets writes the route file)
| Method · path | Purpose / shape | Owner |
|---|---|---|
| GET /api/health | `{ok, mode, ai_provider, providers:{jev, openai, voice: configured|missing}, demo_guard?, db:"ok", version}` | L1 (+L8) |
| GET /api/state · GET /api/modes | `{fingerprint, state_version, at}` · labels + axes (§5) | L1 |
| POST /api/demo/reset · POST /api/demo/example | rebuild the database from `fixtures/partner/` (runs the ETL) → counts · `{}` → runs `POST /api/calc/run {scope:{supplier:"SE"}}` = the UI's «Запустить расчёт» | L1 |
| POST /api/calc/run · GET /api/calc/runs[/:id] | `{scope:{supplier?, category?}, params?}` → `{run_id, skus, recommended, proposals[], state_version}` (one agent run; affected SKUs only when a previous run exists) · runs | L1 route · L2a engine |
| GET /api/recommendations?run_id=&supplier=&category=&urgency= | `{groups:[{supplier_id, total_qty, total_cost?, cost_known_lines, rows:[{id, code_1c, name, on_hand, in_transit, forecast_qty, qty_recommended, qty_adjusted?, moq, urgency, rationale_ru, components, outliers_excluded:[…], stockout_months:[…]}]}]}` | L1 route · L2a |
| POST /api/recommendations/:id/adjust | `{qty, reason, version}` → adjusted row (409 stale); never changes `qty_recommended` | L2a |
| GET /api/skus?q=&supplier=&category= · GET /api/skus/:code | list · `{sku, series:[{ym, qty_file, qty_regular, stock, stockout, outliers:[…]}], forecast, recommendation?, in_transit:[…], timeline:[agent_action…]}` | L1 route · L2b |
| GET /api/orders[/:id] · POST /api/orders/:id/approve · GET /api/orders/:id/export.(xlsx|csv) | PO drafts grouped by supplier · `{version}` → approved, obligations created (409 stale) · the 1С-compatible file («Код 1с», Артикул поставщика, Наименование, Кол-во, Кратность, Срочность, Обоснование) | L2a · L2b · L6 |
| GET /api/proposals?state= · POST /api/proposals/:id/approve|reject | `{proposal_version, adjustments?}`; 409 stale; kinds `supplier_order` → PO approved, `param_change` → params applied + recompute, `outlier_review` → outlier kept/excluded + recompute | L2a |
| GET /api/params · PUT /api/params | policies of §1 · a change = `param_change` proposal | L2a |
| GET /api/money | `{cash[], committed_by_supplier:[{supplier_id, amount, currency, lines, cost_known_lines}], next_60d:{out:[{at, amount, currency, po_id}]}, stock_value?:{amount, currency, cost_known_share}, risks:[…]}` | L1 route · L2b |
| GET /api/today | `{lead, decision|null, queue_count, pulse:{money: <money summary>, stockout_risk:{count, top:[{code_1c, name, days_of_cover, lead_time_days}]}, agents:{auto, needs_you, ratio}}, commitments:[{id, kind: po|run, title, next_event, amount?, owner, state}], background:[…], feed_next:[…], empty_reason?}` | L1 route · L2a |
| GET /api/queue | `{items:[{id, kind: proposal|task, title, why, sources[], money_at_stake?, options:[{key, label, effect}], href, since}]}` — money at stake first | L1 route · L2a |
| GET /api/world/feed?state=&code= · POST /api/world/play · POST /api/world/compose | events · `{steps?:1, until?:seq}` → `{emitted[], runs[], processed}` · `{kind, actor_id?, code_1c?, text, payload?}` → `{event, run_id?, replayed?}` (presets: «Разовый заказ N шт по коду X», «Товар в пути +N», «Цена X = Y») | L6 |
| GET /api/agent/ledger?since=&code=&po=&limit= · GET /api/agent/runs[/:id] · POST /api/agent/tick | rows newest first + `stats:{auto, needs_you}` · runs · `{runs[], processed}` | L1 (tick body = L3 worker) |
| POST /api/decisions · GET /api/decisions?subject= | `{question_id, subject_ref, context}` → decision_record | L3 |
| POST /api/drafts · GET /api/artifacts/:id[/download] | `{kind: supplier_email|run_summary, po_id?|run_id?}` → artifact (RU; «подготовить, не отправлять») | L3 |
| POST /api/voice/session · POST /api/voice/tools/:name · POST /api/assistant/message | ephemeral Realtime session · tool call (§4) · typed path `{text, scope, request_id}` → `{reply_ru, tool?, result?, labels, state_version}` | L5 |
| GET /supplier/:po_id (page) · POST /api/supplier/:po_id/reply | the prepared order email + a confirmation reply (simulator; never sent by the app) | L6 |
| GET /api/search?q= · GET /api/notifications · POST /api/notifications/read | palette search (SKUs, orders, runs) · derived events · mark read | L4c |

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
| urgency | `critical · soon · normal · none` | «критично · скоро · планово · не требуется» |
| task states | `preparing · awaiting_supplier · needs_review · ready_to_handover · handed_over · handover_failed` | «Готовлю · Ждём поставщика · Нужна ваша проверка · Готово к передаче · Передано · Ошибка передачи» |
| proposal states | `draft · needs_review · approved · stale · rejected · delivered · delivery_failed` | «черновик · ждёт вас · утверждено · устарело — есть новая версия · отклонено · передано · ошибка передачи» |

## 6. Data and evaluation isolation
Runtime data = `fixtures/partner/{IEK,SE}/*.xlsx` (the partner's anonymised exports, verbatim, disclosed) loaded by `npm run etl` (L9) into the tables of §2; `fixtures/world_events.jsonl` (L9: real sales days replayed + judge presets) loaded as `scripted` rows; `fixtures/decision_catalog.json` (L3: five typed questions — `one_off_order`, `category_hint`, `urgency_override_reason`, `change_summary`, `supplier_terms_hint`; authority `proposal_only`); `fixtures/replay_decisions.json` (L3). Evaluation only: `tests/fixtures/eval/replenishment_expectations.json` (L9: the named SKUs `seasonal`, `stockout`, `oneoff`, `intransit`, `nocost` + the five property checks + counts) — never imported by `src/`. Reset = ETL rebuild; nothing processed.

## 7. Check runner (`npm run check [-- domain|ai|ui|voice|peers|skeleton|etl|demo]`, owner L1; `scripts/scenario.mjs` owner L2b, run when present)
One line per item `[PASS|FAIL|SKIP|UNVERIFIED] <id> — <property>` then `check: passed=N failed=N skipped=N externally-unverified=N`; exit 1 only when `failed>0`; a test lacking a key/mic/network calls `ctx.skip("UNVERIFIED: <reason>")`. Tests run on `DATABASE_PATH=":memory:"`. `scripts/scenario.mjs` prints the five ТЗ checks M1–M5 as `[PASS|FAIL]` lines and the money view.

## 8. Seam stubs (root-written; every lane modifies, never adds, the shared file)
`src/db/client.ts` (root; L1 extends additively): `db()` singleton `DatabaseSync`, `migrate()` from `schema.sql`, `withTx(fn)`, `bumpStateVersion()` · `src/domain/money.ts` (L2a): `Money.of(amount, currency)`, `add`, `sub`, `mul`, `allocate(n)`, `toJSON()` · `src/domain/engine.ts` (L2a): `computeNeed(code_1c, params, ctx) → {forecast, need, rationale_ru, components}` · `src/domain/apply.ts` (L2a): `applyRecommendations(run_id) → {proposals[], tasks[], affected[]}` · `src/domain/views.ts` (L2a): `todayView(orgId)`, `queueView(orgId)`, `ordersView(orgId)`; re-exports `moneyView`, `skuView` · `src/domain/events.ts` (L2b): `applyWorldEvent(event) → {applied, affected_codes[], actions[], escalations[]}` · `src/domain/cashflow.ts` (L2b): `moneyView(orgId)` · `src/domain/skus.ts` (L2b): `skuView(code_1c)` · `src/server/ledger.ts` (L1): `startRun({org_id, trigger_type, trigger_ref}) → run_id`, `recordAction(run_id, {...}) → id`, `finishRun(run_id, state)` · `src/server/pipeline.ts` (L1): `onEvent(kind, payload, source_id) → {event_id, run_id?, replayed?}` · `src/ai/worker.ts` (L3): `processEvent(world_event_id) → {run_id, actions, escalations}`, `tick() → {runs[], processed}` · `src/ai/interpret.ts` (L3): `judgeOutlier(doc, stats) → decision`, `summarizeChanges(run_id) → text` · `src/peers/deliver.ts` (L6): `deliverOrder(po) → {state: "exported"|"delivery_failed", path?, reason?}` · `src/voice/useVoiceSession.ts` + `src/voice/Captions.tsx` (L5). Dependencies a lane adds are listed in its closeout; `package.json` conflicts are resolved by the root taking both.
