# Local demo container — checkpoints 2026-09-23 08:53–09:00 UTC

Image: `ainalym-demo` from `docker build -t ainalym-demo .` → build completed; Next compiled and typechecked. Docker context excludes local environment files. Inspection: no `.env*` file under `/app`.

Offline run: `docker run -d -e AINALYM_MODE=offline -e DATABASE_PATH=/data/ainalym.db -v ainalym-data:/data -p 3100:3000 ainalym-demo` → Docker health `healthy`. `curl -sS -i http://localhost:3100/api/health` → `HTTP/1.1 200 OK`, body `{"ok":true,"demo_guard":"off","remaining_daily_budget":null}`.

Guard run on port 3101 with a synthetic test code supplied only as a runtime environment variable: Docker health `healthy`. First `/` → 307 to code page; code page → 200, RU/EN; accepted form → 303 with signed cookie; next `/` with cookie → 200; `/api/health` → `{"ok":true,"demo_guard":"on","remaining_daily_budget":500}`. No production access code, provider key, or public demo URL was used.

Runtime rate check: 61 authenticated `/api/today` requests from one IP in one minute → 60 passed to the route, one returned HTTP 429. A clean temporary build with staged `output: "standalone"` produced `.next/standalone/server.js`; the tracked Next config stayed unchanged.

Host release shape check: clean standalone build copied into a separate temporary release; `npm ci --include=dev`, `scripts/deploy/first_etl.sh`, and `node server.js` ran locally with no provider keys. `GET /api/health` → `{"ok":true,"mode":"offline","ai_provider":"rules","providers":{"jev":"missing","openai":"missing","voice":"missing"},"db":"ok","version":1,"demo_guard":"off","remaining_daily_budget":null}`; SQLite `sku 3909`. Temporary release was removed after the check. Caddy, SSH transfer, and VPS restart remain externally unverified.

After the L9 merge, a fresh container initialized `/data/ainalym.db` with `npm run etl -- --db /data/ainalym.db` on first start. Direct volume queries: `supplier 2`, `sku 3909`, `sales_line 248915`, `sales_month 99634`, `stock_month 117282`, `in_transit 313`. Docker health `healthy`. `curl -sS -i http://localhost:3103/api/health` → `HTTP/1.1 200 OK`, body `{"ok":true,"mode":"offline","ai_provider":"rules","providers":{"jev":"missing","openai":"missing","voice":"missing"},"db":"ok","version":1,"demo_guard":"off","remaining_daily_budget":null}`. No provider keys entered the container.

Scenario gap: `POST /api/demo/example` → HTTP 404; `GET /api/today` → HTTP 404. L9 ETL and the L1 health route landed; the remaining L1 scenario routes have not. Rerun both after the next L1 floor.

Checks: `npm run check -- demo` → `passed=8 failed=0`; `npm run build` → GREEN; `npx tsc --noEmit` → GREEN. Live provider cap is tested in isolation but awaits L3/L5 provider-boundary wiring; external phone/tunnel integration remains unverified. The merged ETL uses `xlsx`, whose installed package reports a high severity audit advisory; its supplied exports are the current input boundary.
