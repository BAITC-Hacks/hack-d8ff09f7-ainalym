# TASK_MAP — требование → файл/маршрут → проверка → статус

Единственный источник статусов для README. Статус ставится только по коду на `main` и чекпоинтам/закрытиям в `docs/agent_handoffs/*`. Обновляется после каждого слияния (L7).

Наблюдение: **2026-09-23 09:30Z**, `main` @ `846bfb0` (L9 ETL · L1 check/health/reset · L2a engine · L2b orders/money/events/skus · INTEG-1 · L3 AI · L4a shell/today/money · L6 world/peers · L8 demo).

Статусы: `GREEN` — проверено командой в это время · `PARTIAL` — есть код, проверки нет или неполная · `RED` — проверка падает · `PENDING` — кода нет на `main`.

| # | Требование | Файл / маршрут | Команда проверки | Статус · UTC |
|---|---|---|---|---|
| M1 | Потребность по всем источникам; товар в пути меняет результат; нет источника → отказ | `src/domain/engine.ts` · `src/domain/apply.ts` | `node scripts/scenario.mjs` → `[PASS] M1`, `[PASS] M1-source` | GREEN · 09:26Z |
| M2 | Сезонность и рост | `src/domain/engine.ts` | `node scripts/scenario.mjs` → `[PASS] M2 (max/min=22.95)`, `[PASS] M2-peak` | GREEN · 09:26Z |
| M3 | Компенсация упущенного спроса | `src/domain/engine.ts` · `scripts/etl/derive.mjs` | `node scripts/scenario.mjs` → `[PASS] M3 (raw=853.218, adjusted=1479.83)` | GREEN · 09:26Z |
| M4 | Исключение разовых крупных заказов | `src/domain/engine.ts` (порог max(20, min(3×медиана, 5×p95))) · `POST /api/world/compose` | `node scripts/scenario.mjs` → `[PASS] M4 (change=0.00%, excluded=true)`; `npm run check` → `partner event replay …` | GREEN · 09:26Z |
| M5 | Список по поставщикам + обоснование + экспорт «Код 1с» | `src/domain/apply.ts` · `GET /api/orders` · `GET /api/peers/onec-export/:po_id` | `node scripts/scenario.mjs` → `[PASS] M5-full`, `[PASS] M5 (rows=724)` | GREEN · 09:26Z (экран рекомендаций — PENDING) |
| D1 | Загрузка данных партнёра, текущий остаток 22.09 | `scripts/etl/*.mjs` → `data/partner.db` | `npm run etl` → sku 3909, sales_line 248915, in_transit 313, stockout months 1591 | GREEN · 09:25Z |
| D2 | Схема БД, клиент, репозитории | `src/db/schema.sql` · `src/db/client.ts` · `src/db/repo/` | `npm run check` | GREEN · 09:27Z |
| D3 | Данные партнёра и происхождение | `fixtures/partner/{IEK,SE}/*.xlsx` (12) · `fixtures/PROVENANCE.md` | `ls fixtures/partner/*/*.xlsx \| wc -l` → 12 | GREEN · 08:45Z |
| D4 | События-фикстуры и эталоны | `fixtures/world_events.jsonl` (45) · `tests/fixtures/eval/replenishment_expectations.json` | `node scripts/scenario.mjs` → `[PASS] World (applied=45/45)` | GREEN · 09:26Z |
| Q1 | Утверждение по версии, без автоотправки | `src/domain/orders.ts` · `POST /api/orders/:id/approve` · `/supplier/:po_id` | `npm run check` → `purchase approvals and obligations …` | GREEN · 09:27Z |
| Q2 | Очередь решений (`/api/queue`, `/api/proposals`) и экран «Проверка» | — | — | PENDING · 09:30Z |
| Q3 | Воркер агентов, разбор пограничных документов | `src/ai/worker.ts` · `src/ai/interpret.ts` | `npm run check` → `worker …` | GREEN · 09:27Z |
| Q4 | Журнал агентов (`/api/agent/*`) | `src/server/ledger.ts` | — | PENDING · 09:30Z (заглушка по L3/L6) |
| T1 | Задачи и плановые проверки | `src/domain/tasks.ts` · `schedule.ts` | `npm run check` → `task state and scheduled checks …` | GREEN · 09:27Z |
| A1 | Типизированные решения jev/openai/rules/replay | `src/ai/provider.ts` · `/api/decisions` | `npm run check` → `typed decision service …`, `live provider smoke …` | GREEN · 09:27Z (живые — с ключами L7) |
| A2 | Черновики письма поставщику и сводки расчёта | `src/ai/drafting.ts` · `/api/drafts` · `/api/artifacts/:id` | `npm run check` → `drafting …`; живой — отдельно | PARTIAL · 09:27Z (живой черновик пропущен в общем прогоне) |
| F1 | Деньги и обязательства 30/70 | `src/domain/obligations.ts` · `cashflow.ts` · `GET /api/money` | `node scripts/scenario.mjs` → `[PASS] Money` | GREEN · 09:26Z |
| W1 | Лента событий: воспроизведение, ввод жюри, однократность | `src/domain/events.ts` · `/api/world/feed` · `/api/world/play` · `/api/world/compose` | `node scripts/scenario.mjs` → `[PASS] World` | GREEN · 09:26Z |
| P1 | Экспорт для 1С и канал поставщика (симулятор) | `/api/peers/onec-export/*` · `/supplier/:po_id` · `/api/supplier/:po_id/reply` · `/peers` | `npm run check` (peers) · `docs/evidence/peers/*` | GREEN · 09:27Z |
| S1 | Карточка артикула | `src/domain/skus.ts` · `GET /api/skus[/:code]` | `npm run check` → `returns a SKU with its series, forecast and timeline` | GREEN · 09:27Z (экран «Товары» — PENDING) |
| V1 | Голос и текстовый ассистент | `src/voice/*` (заглушки) | — | PENDING · 09:30Z |
| U0 | Оболочка интерфейса | `src/components/shell/*` · `src/components/labels/*` | L4a: UI passed=26 | PARTIAL · 09:30Z (L7 в браузере не проверял) |
| U1 | Экраны «Сегодня», «Деньги» | `src/app/(app)/today` · `src/app/(app)/money` | `docs/evidence/ui/*.png` | PARTIAL · 09:30Z (L4a: заполненный вид не проверен) |
| U2 | Экраны «Закупки», «Проверка», «Товары», «Помощник» | — | — | PENDING · 09:30Z |
| C1 | Сборка и типы | весь проект | `npm run build` (INTEG-1) | GREEN · 09:2xZ (по закрытию INTEG-1) |
| C2 | Сводная проверка | `scripts/check.mjs` | `npm run check` → `check: passed=138 failed=0 skipped=1 externally-unverified=0` | GREEN · 09:27Z (с ключами) |
| C3 | Чистый клон | `scripts/clean_clone_check.sh` | `bash scripts/clean_clone_check.sh <remote>` | PENDING · 09:30Z (запуск ≈12:10Z) |
| C5 | Пересборка демо-базы | `scripts/demo_reset.mjs` | `npm run demo:reset` | GREEN · 08:55Z |
| H1 | Хостинг-демо: код доступа, лимиты | `src/middleware.ts` · `src/server/demo_guard.ts` · `scripts/deploy/*` | `GET <URL>/api/health` → 200 | PARTIAL · 09:14Z (по данным корня) |
| R1 | README: методика, выбросы, запуск (ТЗ п. 10) | `README.md` §4, §7, §8 | чтение | GREEN (v1.6) · 09:30Z |
| R2 | Без ключей — «Правила без LLM» | `AI_PROVIDER` auto → `rules` | чистый клон без ключей → `npm run check` | PENDING · 09:30Z |
