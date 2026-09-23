# TASK_MAP — требование → файл/маршрут → проверка → статус

Единственный источник статусов для README. Статус ставится только по коду на `main` и чекпоинтам/закрытиям в `docs/agent_handoffs/*`. Обновляется после каждого слияния (L7).

Наблюдение: **2026-09-23 09:01Z**, `main` @ `af5c9ac` (L9 ETL · L1 check/health/reset/repos · L2a engine/apply/tasks · L3 AI providers/decisions/drafts/worker · L4a shell · L8 demo guard/deploy).

Статусы: `GREEN` — проверено командой в это время · `PARTIAL` — есть код, проверки нет, неполная или только на тестовых данных · `RED` — проверка падает · `PENDING` — кода нет на `main`.

| # | Требование | Файл / маршрут | Команда проверки | Статус · UTC |
|---|---|---|---|---|
| M1 | Базовая потребность по всем источникам; изменение товара в пути меняет результат | `src/domain/engine.ts` `computeNeed` · `src/domain/apply.ts` `runCalculation` · (`POST /api/calc/run` — PENDING) | `npm run check` → `reduces need when in-transit supply rises`, `refuses a missing stock source`, `records all inputs and arithmetic in components` | PARTIAL · 09:00Z (PASS на тестовых данных; на данных партнёра — `scripts/scenario.mjs` нет) |
| M2 | Сезонность и устойчивый рост в прогнозе | `src/domain/engine.ts` | `npm run check` → `raises the forecast into the SKU's seasonal peak` | PARTIAL · 09:00Z (тестовые данные) |
| M3 | Оценка и компенсация упущенного спроса (stockout) | `src/domain/engine.ts` | `npm run check` → `compensates a censored stockout month` | PARTIAL · 09:00Z (тестовые данные) |
| M4 | Выявление и исключение разовых крупных заказов | `src/domain/engine.ts` · (`POST /api/world/compose` — PENDING) | `npm run check` → `excludes an injected one-off document from regular demand` | PARTIAL · 09:00Z (тестовые данные) |
| M5 | Список по поставщикам + обоснование по строке + экспорт «Код 1с» | `src/domain/apply.ts` (предложения `supplier_order` по поставщику, строки с `rationale_ru`) · (`/api/recommendations`, `/api/orders`, export — PENDING) | `npm run check` → `calculation to supplier approval persists the forecast, recommendation, proposal and review task` | PARTIAL · 09:00Z (маршрутов и экспорта нет) |
| D1 | Загрузка данных партнёра в SQLite, счётчики | `scripts/etl/*.mjs` → `data/partner.db` | `npm run etl` → sku 3909, sales_line 248915, in_transit 313, stockout months 1596 | GREEN · 08:53Z |
| D2 | Схема БД, клиент, репозитории | `src/db/schema.sql` (26 таблиц) · `src/db/client.ts` · `src/db/repo/` | `grep -c "CREATE TABLE" src/db/schema.sql` → 26 | GREEN · 08:45Z |
| D3 | Данные партнёра в репозитории | `fixtures/partner/{IEK,SE}/*.xlsx` (12) · `fixtures/PROVENANCE.md` | `ls fixtures/partner/*/*.xlsx \| wc -l` → 12 | GREEN · 08:45Z |
| D4 | Лента событий-фикстур и эталоны проверок | `fixtures/world_events.jsonl` (45) · `tests/fixtures/eval/replenishment_expectations.json` | `wc -l fixtures/world_events.jsonl` → 45 | GREEN · 08:55Z |
| Q1 | Очередь решений: утверждение по версии, без автоотправки | `src/domain/apply.ts` (предложения `needs_review`, устаревание) · (`/api/proposals`, `/api/queue`, `/api/orders/:id/approve` — PENDING) | `npm run check` → `marks an unapproved proposal stale when a newer run supersedes it` | PARTIAL · 09:00Z |
| Q2 | Воркер агентов + журнал | `src/ai/worker.ts` · `src/server/ledger.ts` · (`/api/agent/*` — PENDING) | — (тестов воркера нет) | PARTIAL · 09:01Z |
| T1 | Задачи и плановые проверки | `src/domain/tasks.ts` · `schedule.ts` | `npm run check` → `task state and scheduled checks …` (4) | GREEN · 09:00Z |
| A1 | Типизированные решения: jev/openai/rules/replay, каталог 5 вопросов | `src/ai/provider.ts` · `src/ai/*` · `POST/GET /api/decisions` | `npm run check` → `typed decision service …` (3), `live provider smoke …` (4, с ключами) | GREEN · 09:00Z (живые проверки — с ключами L7) |
| A2 | Черновики письма поставщику и сводки расчёта (не отправляются) | `src/ai/drafting.ts` · `POST /api/drafts` · `GET /api/artifacts/:id` | — (нужен `OPENAI_API_KEY`) | PARTIAL · 09:01Z |
| F1 | Деньги и обязательства | `src/domain/money.ts` (KZT) · (`cashflow.ts` — заглушка; `/api/money` — PENDING) | `npm run check` → `KZT money …` (3) | PARTIAL · 09:00Z |
| W1 | Лента событий: применение и пересчёт затронутых | (`src/domain/events.ts` — заглушка; `/api/world/*` — PENDING) | — | PENDING · 09:01Z |
| S1 | Карточка артикула | (`src/domain/skus.ts` — заглушка; `/api/skus` — PENDING) | — | PENDING · 09:01Z |
| V1 | Голос и текстовый ассистент | `src/voice/*` (заглушки) · `/api/voice/*` · `/api/assistant/message` | ручная проверка (микрофон) | PENDING · 09:01Z |
| U0 | Оболочка интерфейса: навигация, метки режимов, Inter | `src/components/shell/*` · `src/components/labels/*` · `src/app/(app)/layout.tsx` · `public/fonts/` | `npm run dev` → `/` ведёт на `/today` | PARTIAL · 09:01Z (в браузере L7 не проверял) |
| U1 | Экраны: пульс, рекомендации, карточка, заказы | `src/app/(app)/**` | `npm run dev` | PENDING · 09:01Z («Сегодня» — заготовка) |
| C1 | Сборка и типы | весь проект | `npx next typegen && npx tsc --noEmit` | GREEN · 08:43Z |
| C2 | Сводная проверка | `scripts/check.mjs` | `npm run check` → `check: passed=26 failed=0 skipped=0 externally-unverified=0` | GREEN · 09:00Z (с ключами) |
| C3 | Чистый клон | `scripts/clean_clone_check.sh` | `bash scripts/clean_clone_check.sh <remote>` | PENDING · 09:01Z (механика проверена 08:55Z на локальном клоне; на GitHub не запускался) |
| C4 | Здоровье приложения | `src/app/api/health/route.ts` | `npm run check` → `skeleton GET /api/health …` | GREEN · 09:00Z |
| C5 | Пересборка демо-базы | `scripts/demo_reset.mjs` | `npm run demo:reset` → `"ok":true`, world_event 45 | GREEN · 08:55Z |
| H1 | Хостинг-демо: код доступа, лимиты, контейнер | `src/middleware.ts` · `src/server/demo_guard.ts` · `scripts/deploy/*` · `docs/evidence/demo/local-container.md` | открыть URL из формы платформы | PARTIAL · 09:01Z (URL не выдан) |
| R1 | README: методика, алгоритм выбросов, запуск (ТЗ п. 10) | `README.md` §4, §7 | чтение | GREEN (v1.4) · 09:01Z |
| R2 | Режим без ключей «Правила без LLM» | `AI_PROVIDER` auto → `rules` · `src/ai/provider.ts` | чистый клон без ключей → `npm run check` | PENDING · 09:01Z |
