# TASK_MAP — требование → файл/маршрут → проверка → статус

Единственный источник статусов для README. Статус ставится только по коду на `main` и `Gate: GREEN` в `docs/agent_handoffs/*`. Обновляется после каждого слияния (L7).

Наблюдение: **2026-09-23 08:56Z**, `main` @ `2b29bd2` (L9 ETL, L1 check/health/reset, L4a оболочка).

Статусы: `GREEN` — проверено командой в это время · `PARTIAL` — есть код, проверки нет или неполная · `PENDING` — кода нет на `main`.

| # | Требование | Файл / маршрут | Команда проверки | Статус · UTC |
|---|---|---|---|---|
| M1 | Базовая потребность по всем источникам; изменение товара в пути меняет результат | `src/domain/engine.ts` · `POST /api/calc/run` | `node scripts/scenario.mjs` (M1) | PENDING · 08:45Z (заглушка) |
| M2 | Сезонность и устойчивый рост в прогнозе | `src/domain/engine.ts` · `GET /api/skus/:code` | `node scripts/scenario.mjs` (M2) | PENDING · 08:45Z |
| M3 | Оценка и компенсация упущенного спроса (stockout) | `src/domain/engine.ts` | `node scripts/scenario.mjs` (M3) | PENDING · 08:45Z |
| M4 | Выявление и исключение разовых крупных заказов | `src/domain/engine.ts` · `POST /api/world/compose` | `node scripts/scenario.mjs` (M4) | PENDING · 08:45Z |
| M5 | Список по поставщикам + обоснование по строке + экспорт «Код 1с» | `src/domain/apply.ts` · `GET /api/recommendations` · `GET /api/orders/:id/export.xlsx` | `node scripts/scenario.mjs` (M5) | PENDING · 08:45Z |
| D1 | Загрузка данных партнёра в SQLite, счётчики | `scripts/etl/*.mjs` → `data/partner.db` · (`POST /api/demo/reset` — PENDING) | `npm run etl` → sku 3909, sales_line 248915, in_transit 313, stockout months 1596; `npx vitest run tests/etl/counts.test.ts` | GREEN · 08:53Z |
| D4 | Лента событий-фикстур и эталоны проверок | `fixtures/world_events.jsonl` (45) · `tests/fixtures/eval/replenishment_expectations.json` | `wc -l fixtures/world_events.jsonl` → 45 | GREEN · 08:55Z |
| D2 | Схема БД и клиент SQLite | `src/db/schema.sql` (26 таблиц) · `src/db/client.ts` | `grep -c "CREATE TABLE" src/db/schema.sql` → 26 | GREEN · 08:45Z |
| D3 | Данные партнёра в репозитории | `fixtures/partner/{IEK,SE}/*.xlsx` (12 файлов) | `ls fixtures/partner/*/*.xlsx \| wc -l` → 12 | GREEN · 08:45Z |
| Q1 | Очередь решений: утверждение привязано к версии, без автоотправки | `/api/proposals/*` · `/api/queue` | `npm run check` | PENDING · 08:45Z |
| Q2 | Воркер агентов + журнал, идемпотентность событий | `src/ai/worker.ts` · `src/server/ledger.ts` · `/api/agent/*` | `npm run check` | PENDING · 08:45Z (заглушки) |
| F1 | Деньги и обязательства по утверждённым заказам | `src/domain/cashflow.ts` · `GET /api/money` | `npm run check` | PENDING · 08:45Z |
| W1 | Лента событий: воспроизведение и ввод события | `/api/world/*` | `npm run check` | PENDING · 08:45Z |
| V1 | Голос и текстовый ассистент на тех же инструментах | `src/voice/*` · `/api/voice/*` · `/api/assistant/message` | ручная проверка (микрофон) | PENDING · 08:45Z |
| U0 | Оболочка интерфейса: навигация, метки режимов, Inter | `src/components/shell/*` · `src/components/labels/*` · `src/app/(app)/layout.tsx` | `npm run dev` → `/` ведёт на `/today` | PARTIAL · 08:56Z (код влит, в браузере L7 не проверял) |
| U1 | Интерфейс: пульс, рекомендации, карточка артикула, заказы | `src/app/(app)/**` | `npm run dev` | PENDING · 08:56Z («Сегодня» — пустая заготовка) |
| C1 | Сборка и типы | весь проект | `npx next typegen && npx tsc --noEmit` | GREEN · 08:43Z |
| C2 | Сводная проверка | `scripts/check.mjs` | `npm run check` → `check: passed=2 failed=0 skipped=0 externally-unverified=0` | GREEN · 08:56Z (2 проверки) |
| C4 | Здоровье приложения | `src/app/api/health/route.ts` · `GET /api/health` | `npm run check` (skeleton) | GREEN · 08:56Z |
| C5 | Пересборка демо-базы | `scripts/demo_reset.mjs` | `npm run demo:reset` → `"ok":true`, world_event 45 | GREEN · 08:56Z |
| C3 | Чистый клон | `scripts/clean_clone_check.sh` | `bash scripts/clean_clone_check.sh <remote>` | PENDING · 08:45Z |
| R1 | README: методика, алгоритм выбросов, запуск (ТЗ п. 10) | `README.md` §4, §7 | чтение | GREEN (v1) · 08:45Z |
| R2 | Режим без ключей «Правила без LLM» | `AI_PROVIDER` auto → `rules` | `npm run check` без ключей | PENDING · 08:45Z |
| H1 | Хостинг-демо с кодом доступа | L8 | открыть URL из формы платформы | PENDING · 08:45Z |
