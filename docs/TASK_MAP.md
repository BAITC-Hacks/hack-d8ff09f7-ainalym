# TASK_MAP — требование → файл/маршрут → проверка → статус

Единственный источник статусов для README. Статус ставится только по коду на `main` и проверке L7 (чистый клон без ключей) или закрытиям в `docs/agent_handoffs/*`. Обновляется после каждого слияния (L7).

Наблюдение: **2026-09-23 12:05Z**, `main` @ `230b038` (= GitHub `origin/main` на 11:57Z) (после MERGE-2, L5 voice, L4a/L4b/L4c, L6, L3, L8, INTEG-1). Чистый клон: `/tmp`, `.env.local` из `.env.example` + `DATABASE_PATH=./data/partner.db`, без ключей.

Статусы: `GREEN` — проверено командой в это время · `PARTIAL` — есть код, проверка неполная · `RED` — проверка падает · `PENDING` — нет на `main` · `UNVERIFIED` — нужен внешний ресурс (ключ, микрофон).

| # | Требование | Файл / маршрут / экран | Команда проверки | Статус · UTC |
|---|---|---|---|---|
| M1 | Потребность по всем источникам; товар в пути меняет результат; изоляция по артикулу | `src/domain/engine.ts` · `src/domain/apply.ts` · `POST /api/calc/run` · `/skus/:code` | `node scripts/scenario.mjs` → `[PASS] M1`, `[PASS] M1-active (010300014_)`, `[PASS] M1-source`; API: `300200745_` 126 → 24 шт после «Товар в пути +100» | GREEN · 12:02Z |
| M2 | Сезонность и рост | `src/domain/engine.ts` | `node scripts/scenario.mjs` → `[PASS] M2 (max/min=10.38)`, `[PASS] M2-peak` | GREEN · 12:00Z |
| M3 | Компенсация упущенного спроса (подтверждённый и предполагаемый дефицит) | `src/domain/engine.ts` · `scripts/etl/derive.mjs` | `node scripts/scenario.mjs` → `[PASS] M3 (raw=886.204, adjusted=1056.676)`; API: `300200898_` 20.84 → 21.541 шт/мес | GREEN · 12:04Z |
| M4 | Исключение разовых документов (порог max(20, min(3×медиана, 5×p95 без проверяемого документа))) | `src/domain/engine.ts` · `POST /api/world/compose` | `node scripts/scenario.mjs` → `[PASS] M4 (change=0.00%, excluded=true)`; API: `010500008_` 14 документов, порог 720 | GREEN · 12:04Z |
| M5 | Список по поставщикам + обоснование + экспорт для 1С | `GET /api/recommendations` · `/replenishment` · `/review/:id` · `/orders/:id` · `GET /api/orders/:id/export.xlsx` | `node scripts/scenario.mjs` → `[PASS] M5-full`, `[PASS] M5 (rows=566)`; API: SE 317 строк, срочность 69/104/144 | GREEN · 12:03Z |
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
| F1 | Деньги по поставщикам без выдуманной себестоимости | `GET /api/money` · `/money` | API: SE 73 897 006,01 KZT, 281 из 317 с себестоимостью; предоплата 22 169 101,80 и остаток 51 727 904,21 к 12.11 | GREEN · 12:03Z |
| W1 | Лента: воспроизведение, ввод жюри, однократность, метка | `/api/world/*` · `/world` | API: compose → `processed`, «Симулятор мира — синтетическое событие» | GREEN · 09:48Z |
| P1 | Экспорт для 1С и канал поставщика | `/api/peers/onec-export/*` · `/supplier/:po_id` | API: страница поставщика — «Черновик заказа — не отправлен» | GREEN · 09:48Z |
| S1 | Карточка артикула | `GET /api/skus/:code` · `/skus/:code` | API: рекомендация, в пути, журнал | GREEN · 09:48Z |
| V1 | Голос: Realtime-сессия, инструменты; текстовый путь без ключа | `src/voice/*` · `/api/voice/*` · `/api/assistant/message` · `/assistant` | `npm run check` (voice) | PARTIAL · 09:48Z (живой микрофон — UNVERIFIED, 2 проверки пропущены) |
| U1 | Экраны: Сегодня, Закупки, Проверка, Заказы, Поставщики, Товары, Деньги, Лента, Связи, Помощник | `/today` `/replenishment` `/review/:id` `/orders` `/suppliers` `/skus` `/money` `/world` `/connections` `/assistant` | клон `220d777`: все 200; кнопки «Проверить», «Утвердить заказ» — в коде `230b038`; снимки `docs/evidence/shell/*.png` | PARTIAL · 12:05Z (L7 проверял ответы, подписи в коде и API, не вёрстку глазами) |
| C2 | Сводная проверка | `scripts/check.mjs` | `npm run etl && npm run check` → `check: passed=325 failed=0 skipped=7 externally-unverified=7` | GREEN · 11:58Z (клон с GitHub `230b038`) |
| C3 | Чистый клон с GitHub | `scripts/clean_clone_check.sh https://github.com/BAITC-Hacks/hack-d8ff09f7-ainalym.git main` | `CLEAN-CLONE: PASS @ 230b038` (325/0/7/7) | GREEN · 11:58Z |
| C5 | Пересборка демо-базы | `scripts/demo_reset.mjs` · `POST /api/demo/reset` | `npm run demo:reset` | GREEN · 09:3xZ |
| H1 | Хостинг-демо: код доступа, лимиты | `src/middleware.ts` · `src/server/demo_guard.ts` · `scripts/deploy/*` · https://65.109.172.188.sslip.io | `curl <URL>/api/health` → 200 | GREEN · 11:20Z |
| R1 | README: методика, выбросы, запуск, экраны | `README.md` §4, §7, §8, «Экраны» | клон с GitHub по §7–8 | GREEN (v2.1) · 12:05Z |
| R2 | Без ключей — «Правила без LLM» | `AI_PROVIDER` auto → `rules` | `GET /api/health` → `"ai_provider":"rules"`, провайдеры `missing` | GREEN · 09:48Z |
