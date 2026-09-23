# TASK_MAP — требование → файл/маршрут → проверка → статус

Единственный источник статусов для README. Статус ставится только по коду на `main` и проверке L7 (чистый клон без ключей) или закрытиям в `docs/agent_handoffs/*`. Обновляется после каждого слияния (L7).

Наблюдение: **2026-09-23 11:20Z**, `main` @ `220d777` (после MERGE-2, L5 voice, L4a/L4b/L4c, L6, L3, L8, INTEG-1). Чистый клон: `/tmp`, `.env.local` из `.env.example` + `DATABASE_PATH=./data/partner.db`, без ключей.

Статусы: `GREEN` — проверено командой в это время · `PARTIAL` — есть код, проверка неполная · `RED` — проверка падает · `PENDING` — нет на `main` · `UNVERIFIED` — нужен внешний ресурс (ключ, микрофон).

| # | Требование | Файл / маршрут / экран | Команда проверки | Статус · UTC |
|---|---|---|---|---|
| M1 | Потребность по всем источникам; товар в пути меняет результат; изоляция по артикулу | `src/domain/engine.ts` · `src/domain/apply.ts` · `POST /api/calc/run` · `/skus/:code` | `node scripts/scenario.mjs` → `[PASS] M1`, `[PASS] M1-active`, `[PASS] M1-source`; API: `300200745_` 126 → 24 шт после «Товар в пути +100» | GREEN · 11:10Z |
| M2 | Сезонность и рост | `src/domain/engine.ts` | `node scripts/scenario.mjs` → `[PASS] M2 (max/min=22.95)`, `[PASS] M2-peak` | GREEN · 09:48Z |
| M3 | Компенсация упущенного спроса | `src/domain/engine.ts` · `scripts/etl/derive.mjs` | `node scripts/scenario.mjs` → `[PASS] M3 (raw=853.218, adjusted=1479.83)` | GREEN · 09:48Z |
| M4 | Исключение разовых документов (порог max(20, min(3×медиана, 5×p95))) | `src/domain/engine.ts` · `POST /api/world/compose` | `node scripts/scenario.mjs` → `[PASS] M4 (change=0.00%, excluded=true)` | GREEN · 09:48Z |
| M5 | Список по поставщикам + обоснование + экспорт для 1С | `GET /api/recommendations` · `/replenishment` · `GET /api/orders/:id/export.xlsx` (форма «Заказ поставщику») | `node scripts/scenario.mjs` → `[PASS] M5-full`, `[PASS] M5 (rows=566)`; API: SE 307 строк, срочность 66/99/142 | GREEN · 11:10Z |
| D1 | Загрузка данных партнёра, текущий остаток 22.09 | `scripts/etl/*.mjs` → `data/partner.db` | `npm run etl` → sku 3909, sales_line 248915, in_transit 313, stockout months 1591 | GREEN · 09:48Z |
| D2 | Путь к базе: приложение и ETL в одном файле | `src/db/path.mjs` (общий резолвер, по умолчанию `./data/ainalym.db`) | чистый клон `da810b1`: `npm run etl` → `data/ainalym.db`, приложение видит данные | GREEN · 10:31Z |
| D3 | Данные партнёра и происхождение | `fixtures/partner/*` · `fixtures/PROVENANCE.md` · `DISCLOSURE.md` | `ls fixtures/partner/*/*.xlsx \| wc -l` → 12 | GREEN · 09:48Z |
| D4 | События-фикстуры и эталоны | `fixtures/world_events.jsonl` (45) · `tests/fixtures/eval/replenishment_expectations.json` | `node scripts/scenario.mjs` → `[PASS] World (applied=45/45)` | GREEN · 09:48Z |
| Q0 | Правка количества менеджером с причиной, по версии | `POST /api/recommendations/:id/adjust` · `GET /api/recommendations/:id` | API: 126 → `qty_adjusted` 132, повтор со старой версией → 409 `stale_version` | GREEN · 10:27Z |
| W2 | Ответ поставщика → предложение разделить/ускорить заказ, 30/70 по частям | `src/ai/supplier-reply.ts` · событие `WE-046` · `/review/:id` | `npm run check` → `supplier reply consequence …` (5); `node scripts/scenario.mjs` → `[PASS] World (applied=46/46)` | GREEN · 11:10Z |
| Q1 | Очередь решений, утверждение по версии | `/api/queue` · `/api/proposals/:id/approve` · `/review` | API: предложение SE (294 позиций) → утверждено → PO | GREEN · 09:48Z |
| Q2 | Утверждение заказа, обязательства 30/70 | `POST /api/orders/:id/approve` · `src/domain/obligations.ts` | `node scripts/scenario.mjs` → `[PASS] Money`; API: заказ `approved`, версия 2 | GREEN · 09:48Z (в API-прогоне `next_60d.out` пуст — передано корню) |
| Q3 | Воркер агентов и журнал | `src/ai/worker.ts` · `/api/agent/ledger` · `/api/agent/runs` | API: журнал карточки «Пересчитана потребность 300200745_: 24 шт» | GREEN · 09:48Z |
| T1 | Задачи и плановые проверки | `src/domain/tasks.ts` · `schedule.ts` | `npm run check` | GREEN · 09:48Z |
| A1 | Типизированные решения jev/openai/rules/replay | `src/ai/provider.ts` · `/api/decisions` | `npm run check` (без ключей — rules/replay; живые — `UNVERIFIED` без `AINALYM_LIVE_SMOKE=1`) | GREEN · 10:28Z |
| A2 | Черновики письма поставщику и сводки | `src/ai/drafting.ts` · `/api/drafts` | живой — отдельно | UNVERIFIED · 09:48Z (нужен `OPENAI_API_KEY`) |
| F1 | Деньги по поставщикам без выдуманной себестоимости | `GET /api/money` · `/money` | API: SE 70 810 601,71 KZT, 271 из 307 с себестоимостью; предоплата 21 243 180,51 и остаток 49 567 421,20 к 12.11 | GREEN · 11:10Z |
| W1 | Лента: воспроизведение, ввод жюри, однократность, метка | `/api/world/*` · `/world` | API: compose → `processed`, «Симулятор мира — синтетическое событие» | GREEN · 09:48Z |
| P1 | Экспорт для 1С и канал поставщика | `/api/peers/onec-export/*` · `/supplier/:po_id` | API: страница поставщика — «Черновик заказа — не отправлен» | GREEN · 09:48Z |
| S1 | Карточка артикула | `GET /api/skus/:code` · `/skus/:code` | API: рекомендация, в пути, журнал | GREEN · 09:48Z |
| V1 | Голос: Realtime-сессия, инструменты; текстовый путь без ключа | `src/voice/*` · `/api/voice/*` · `/api/assistant/message` · `/assistant` | `npm run check` (voice) | PARTIAL · 09:48Z (живой микрофон — UNVERIFIED, 2 проверки пропущены) |
| U1 | Экраны: Сегодня, Закупки, Заказы, Поставщики, Товары, Деньги, Лента, Связи, Помощник | `/today` `/replenishment` `/orders` `/suppliers` `/skus` `/skus/:code` `/money` `/world` `/connections` `/assistant` | чистый клон `220d777`: все 200, `/` → 307 на `/today`; снимки `docs/evidence/shell/*.png` | GREEN · 11:19Z (ответы и снимки; вёрстку L7 глазами не проверял) |
| C2 | Сводная проверка | `scripts/check.mjs` | `npm run etl && npm run check` → `check: passed=287 failed=0 skipped=7 externally-unverified=7` | GREEN · 11:18Z (чистый клон `220d777`) |
| C3 | Чистый клон | `scripts/clean_clone_check.sh` (клон → install → etl → check) | локальный клон `220d777` → `CLEAN-CLONE: PASS` (287/0/7/7) | GREEN · 11:18Z (GitHub-remote — ≈12:10Z) |
| C5 | Пересборка демо-базы | `scripts/demo_reset.mjs` · `POST /api/demo/reset` | `npm run demo:reset` | GREEN · 09:3xZ |
| H1 | Хостинг-демо: код доступа, лимиты | `src/middleware.ts` · `src/server/demo_guard.ts` · `scripts/deploy/*` · https://65.109.172.188.sslip.io | `curl <URL>/api/health` → 200 | GREEN · 11:20Z |
| R1 | README: методика, выбросы, запуск, экраны | `README.md` §4, §7, §8, «Экраны» | чистый клон по §7–8 | GREEN (v2.0) · 11:20Z |
| R2 | Без ключей — «Правила без LLM» | `AI_PROVIDER` auto → `rules` | `GET /api/health` → `"ai_provider":"rules"`, провайдеры `missing` | GREEN · 09:48Z |
