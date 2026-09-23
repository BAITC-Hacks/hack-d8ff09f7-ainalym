# TASK_MAP — требование → файл/маршрут → проверка → статус

Единственный источник статусов для README. Статус ставится только по коду на `main` и `Gate: GREEN` в `docs/agent_handoffs/*`. Обновляется после каждого слияния (L7).

Наблюдение: **2026-09-23 08:57Z**, `main` @ `ad19258` (L9 ETL, L1 check/health/reset/repos, L2a engine+apply, L2b orders/money/skus, L4a shell).

Статусы: `GREEN` — проверено командой в это время · `PARTIAL` — есть код, проверки нет, неполная или только на тестовых данных · `RED` — проверка падает · `PENDING` — кода нет на `main`.

| # | Требование | Файл / маршрут | Команда проверки | Статус · UTC |
|---|---|---|---|---|
| M1 | Базовая потребность по всем источникам; изменение товара в пути меняет результат | `src/domain/engine.ts` `computeNeed` · `src/domain/apply.ts` `runCalculation` | `npm run check` → `reduces need when in-transit supply rises`, `refuses a missing stock source` | PARTIAL · 08:57Z (PASS на тестовых данных; на данных партнёра — `scripts/scenario.mjs` нет) |
| M2 | Сезонность и устойчивый рост в прогнозе | `src/domain/engine.ts` · `GET /api/skus/:code` | `npm run check` → `raises the forecast into the SKU's seasonal peak` | PARTIAL · 08:57Z (тестовые данные) |
| M3 | Оценка и компенсация упущенного спроса (stockout) | `src/domain/engine.ts` | `npm run check` → `compensates a censored stockout month` | PARTIAL · 08:57Z (тестовые данные) |
| M4 | Выявление и исключение разовых крупных заказов | `src/domain/engine.ts` · (`POST /api/world/compose` — PENDING) | `npm run check` → `excludes an injected one-off document from regular demand` | PARTIAL · 08:57Z (тестовые данные) |
| M5 | Список по поставщикам + обоснование по строке + экспорт «Код 1с» | `src/domain/apply.ts` · `GET /api/orders[/:id]` · (`/api/recommendations`, export — PENDING) | `npm run check` → `calculation to supplier approval …` | PARTIAL · 08:57Z (экспорта нет) |
| D1 | Загрузка данных партнёра в SQLite, счётчики | `scripts/etl/*.mjs` → `data/partner.db` · (`POST /api/demo/reset` — PENDING) | `npm run etl` → sku 3909, sales_line 248915, in_transit 313, stockout months 1596; `npx vitest run tests/etl/counts.test.ts` | GREEN · 08:53Z |
| D4 | Лента событий-фикстур и эталоны проверок | `fixtures/world_events.jsonl` (45) · `tests/fixtures/eval/replenishment_expectations.json` | `wc -l fixtures/world_events.jsonl` → 45 | GREEN · 08:55Z |
| D2 | Схема БД и клиент SQLite | `src/db/schema.sql` (26 таблиц) · `src/db/client.ts` | `grep -c "CREATE TABLE" src/db/schema.sql` → 26 | GREEN · 08:45Z |
| D3 | Данные партнёра в репозитории | `fixtures/partner/{IEK,SE}/*.xlsx` (12 файлов) | `ls fixtures/partner/*/*.xlsx \| wc -l` → 12 | GREEN · 08:45Z |
| Q1 | Утверждение привязано к версии, без автоотправки | `src/domain/orders.ts` · `POST /api/orders/:id/approve` · (`/api/proposals`, `/api/queue` — PENDING) | `npm run check` → `rejects a stale order version`, `approves the exact version and bumps it once` | PARTIAL · 08:57Z |
| Q2 | Воркер агентов + журнал, идемпотентность событий | `src/ai/worker.ts` · `src/server/ledger.ts` · `/api/agent/*` | `npm run check` | PENDING · 08:45Z (заглушки) |
| F1 | Деньги и обязательства по утверждённым заказам | `src/domain/obligations.ts` · `cashflow.ts` · `GET /api/money` | `npm run check` → `creates 30% prepayment at approval and 70% balance at ETA`, `money derived from ledger rows …` | RED · 08:57Z (`keeps floating point coercion out of domain source` падает на `cashflow.ts`) |
| W1 | Лента событий: применение событий, пересчёт затронутых | `src/domain/events.ts` · `recompute.ts` · (`/api/world/*` — PENDING) | `npm run check` → `world events and SKU drilldown …` | RED · 08:57Z (`recomputes exactly the requested codes` — `sales source missing for SE-1`) |
| V1 | Голос и текстовый ассистент на тех же инструментах | `src/voice/*` · `/api/voice/*` · `/api/assistant/message` | ручная проверка (микрофон) | PENDING · 08:45Z |
| U0 | Оболочка интерфейса: навигация, метки режимов, Inter | `src/components/shell/*` · `src/components/labels/*` · `src/app/(app)/layout.tsx` | `npm run dev` → `/` ведёт на `/today` | PARTIAL · 08:56Z (код влит, в браузере L7 не проверял) |
| U1 | Интерфейс: пульс, рекомендации, карточка артикула, заказы | `src/app/(app)/**` | `npm run dev` | PENDING · 08:56Z («Сегодня» — пустая заготовка) |
| C1 | Сборка и типы | весь проект | `npx next typegen && npx tsc --noEmit` | GREEN · 08:43Z |
| C2 | Сводная проверка | `scripts/check.mjs` | `npm run check` → `check: passed=41 failed=2 skipped=0 externally-unverified=0` | RED · 08:57Z (2 падения, см. F1, W1) |
| C4 | Здоровье приложения | `src/app/api/health/route.ts` · `GET /api/health` | `npm run check` (skeleton) | GREEN · 08:56Z |
| C5 | Пересборка демо-базы | `scripts/demo_reset.mjs` | `npm run demo:reset` → `"ok":true`, world_event 45 | GREEN · 08:56Z |
| C3 | Чистый клон | `scripts/clean_clone_check.sh` | `bash scripts/clean_clone_check.sh <remote>` | RED · 08:55Z (локальный клон `main` @ 2b29bd2: установка OK, путей/кешей нет, `check` failed=2; на GitHub не запускался) |
| R1 | README: методика, алгоритм выбросов, запуск (ТЗ п. 10) | `README.md` §4, §7 | чтение | GREEN (v1) · 08:45Z |
| S1 | Карточка артикула: ряд, прогноз, таймлайн | `src/domain/skus.ts` · `GET /api/skus[/:code]` | `npm run check` → `returns a SKU with its series, forecast and timeline` | PARTIAL · 08:57Z |
| R2 | Режим без ключей «Правила без LLM» | `AI_PROVIDER` auto → `rules` | `npm run check` без ключей | PENDING · 08:45Z |
| H1 | Хостинг-демо с кодом доступа | L8 | открыть URL из формы платформы | PENDING · 08:45Z |
