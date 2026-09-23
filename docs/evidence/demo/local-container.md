# Local demo container — checkpoint 2026-09-23 08:53 UTC

Image: `ainalym-demo` from `docker build -t ainalym-demo .` → build completed; Next compiled and typechecked. Docker context excludes local environment files. Inspection: no `.env*` file under `/app`.

Offline run: `docker run -d -e AINALYM_MODE=offline -e DATABASE_PATH=/data/ainalym.db -v ainalym-data:/data -p 3100:3000 ainalym-demo` → Docker health `healthy`. `curl -sS -i http://localhost:3100/api/health` → `HTTP/1.1 200 OK`, body `{"ok":true,"demo_guard":"off","remaining_daily_budget":null}`.

Guard run on port 3101 with a synthetic test code supplied only as a runtime environment variable: Docker health `healthy`. First `/` → 307 to code page; code page → 200, RU/EN; accepted form → 303 with signed cookie; next `/` with cookie → 200; `/api/health` → `{"ok":true,"demo_guard":"on","remaining_daily_budget":500}`. No production access code, provider key, or public demo URL was used.

Runtime rate check: 61 authenticated `/api/today` requests from one IP in one minute → 60 passed to the route, one returned HTTP 429. A clean temporary build with staged `output: "standalone"` produced `.next/standalone/server.js`; the tracked Next config stayed unchanged.

Scenario gap on the scaffold: `POST /api/demo/example` → `HTTP/1.1 404 Not Found`; `GET /api/today` → `HTTP/1.1 404 Not Found`. L1 routes and L9 ETL have not landed on `main`; rerun the offline scenario after their checkpoint merge.

Checks: `npx vitest run tests/demo` → 6 passed; `npm run build` → GREEN; `npx tsc --noEmit` → GREEN. `npm run check -- demo` → RED (`Missing script: "check"`, owner L1). Live provider cap is tested in isolation but awaits L3/L5 provider-boundary wiring; external phone/tunnel integration remains unverified.
