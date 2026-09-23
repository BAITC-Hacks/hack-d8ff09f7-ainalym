# Hosted demo judge-flow report

Date: 2026-09-23 UTC · branch `lane/e2e` · Chromium · desktop 1440×900 / phone 390×844.

**Verdict: RED.** The judge purchase cycle is not verified end to end. Three confirmed defects: 2 P1, 0 P2, 1 P3. Access, assistant and keyboard checks pass on both projects; desktop verifies an in-transit update changing quantity 198 → 98. Quantity saving is blocked and approval/export remain unverified.

Run: `npx playwright test` → **2 failed** (desktop journey 52.3 s; phone journey 1.4 min). The journeys continue after individual failures. Each action/step is bounded by 20 s, with a 300 s outer journey watchdog; no retries. `npm run e2e` uses the same configuration through the root forwarding config.

## Steps

Durations include assertions and screenshot capture. Original runner outcomes are retained below; read the qualification notes before interpreting failures as product defects.

| Step | Desktop | Phone |
|---|---|---|
| 01 access and Today shell | [PASS](desktop/01.jpg) · 5799 ms | [PASS](phone/01.jpg) · 7818 ms |
| 02 Pulse numbers | [FAIL](desktop/02.jpg) · 8956 ms | [FAIL](phone/02.jpg) · 13394 ms |
| 03 supplier groups and SKU links | [PASS](desktop/03.jpg) · 982 ms | [FAIL](phone/03.jpg) · 9982 ms |
| 04 SKU chart sources and facts | [FAIL](desktop/04.jpg) · 769 ms | [FAIL](phone/04.jpg) · 790 ms |
| 05 adjust recommendation and ledger | [FAIL](desktop/05.jpg) · 9144 ms | [FAIL](phone/05.jpg) · 9288 ms |
| 06 approve proposal draft and export | [SKIP](desktop/06.jpg) · 378 ms | [FAIL](phone/06.jpg) · 8268 ms |
| 07 money cash and commitments | [PASS](desktop/07.jpg) · 1153 ms | [FAIL](phone/07.jpg) · 8076 ms |
| 08 world in-transit update and Play | [PASS](desktop/08.jpg) · 1659 ms | [FAIL](phone/08.jpg) · 429 ms |
| 09 typed assistant truth-labelled result | [PASS](desktop/09.jpg) · 4233 ms | [PASS](phone/09.jpg) · 1412 ms |
| 10 keyboard visible focus | [PASS](desktop/10.jpg) · 1091 ms | [PASS](phone/10.jpg) · 1066 ms |
| 11 phone overflow and primary targets | [SKIP](desktop/11.jpg) · 39 ms | [PASS](phone/11.jpg) · 3004 ms |
| 12 latency and browser errors | [FAIL](desktop/12.jpg) · 29 ms | [FAIL](phone/12.jpg) · 16 ms |

Detailed observations: [RESULTS.md](RESULTS.md), [desktop steps](desktop/steps.json), [phone steps](phone/steps.json). Empty access-page evidence: [desktop](desktop/00-access-empty.jpg), [phone](phone/00-access-empty.jpg).

## Confirmed defects, severity order

1. **P1 — Quantity adjustment cannot be submitted.** On SKU `010300008_`, the quantity/reason fields accept input, but Save remains disabled on both viewports. UI explicitly says the recommendation version has not arrived. [Desktop evidence](desktop/05.jpg), [phone evidence](phone/05.jpg). Certain local guard location: `src/components/purchase/QuantityEditor.tsx:27` (undefined version disables Save; notice at line 25). Backend root cause is not proven. No adjustment POST was emitted, so write-route HTTP status, persisted version, receipt and ledger mutation are **unverified**, not fabricated as 404.

2. **P1 — Intermittent blank hosted pages.** Phone Today, replenishment and money failed to render `main` within the assertion deadline; screenshots show blank content. [Today](phone/02.jpg), [replenishment](phone/03.jpg), [money](phone/07.jpg). Final network evidence includes two `/api/state` HTTP 502 responses. Do not infer a source-file cause. The deployment/state changed during this session; reproduction requires a stable hosted revision.

3. **P3 — Latency exceeds the requested limits.** Desktop `/today` TTFB reached 1,666 ms (>1,500); API calls exceeded 1,000 ms on both projects, up to 7,742 ms. This is a small live sample, not a percentile or benchmark. Full request durations (request start to response end) and statuses are saved below.

## Coverage qualifications

- Pulse strict numeric assertion fails because zero commitments/outflow are displayed as “Нет обязательств” / “Не запланирован”; stock value and risk are numeric. This is an acceptance mismatch, not evidence of wrong arithmetic or a misleading placeholder.
- SKU step initially checked row visibility before asynchronous data settled. The committed test now waits. A read-only follow-up clicked a real row and verified chart, numeric facts and provenance on phone: [PASS screenshot](phone/04-recheck.jpg). Desktop follow-up found an empty recommendations screen: [evidence](desktop/04-recheck.jpg). [Recheck measurements](SKU_RECHECK.json). The original FAILs remain in the runner table and are not counted as a confirmed navigation defect.
- Approval/export: desktop had no reviewable supplier proposal. Phone API returned a proposal whose exact link was absent from the visible queue. The committed selector now matches API candidates to visible queue links; this refinement passed static checks but was not rerun through approval. No PO approval or export download was achieved, so the “Код 1с” CSV assertion exists but remains unverified.
- World: desktop composed +100 through the UI and clicked Play; `010300016_` changed 198 → 98. Compose processes immediately; Play reported no remaining events. Phone had no qualifying recommendation (>100, MOQ ≤100) afterward, so it made no world write. No claim that a +100 change must affect a zero/clamped or high-MOQ recommendation.
- Money renders stock value and explicitly discloses no recorded cash/commitments. This is not proof of commitments after approval.
- Assistant produced truth-labelled cards in the final run on both viewports. Keyboard checks sampled 8 consecutive Tab targets per viewport. Phone measured all five pages at 390/390 px; tested primary controls were 324×44, 172.48×44 and 44×44. Money/world had no visible primary-variant button in their default state.
- Historical 404/503/429 responses changed during the session; they are separated in [run notes](RUN_NOTES.md), not counted as current confirmed defects. The hosted revision was not pinned. Console/page-error counts record categories only; API status evidence identifies known failures.

## Navigation and API timing

| Project | Page | Samples | Max TTFB (ms) | Max load (ms) |
|---|---|---:|---:|---:|
| desktop | `/today` | 2 | 1666 | 1831 |
| desktop | `/replenishment` | 3 | 79 | 230 |
| desktop | `/skus/010400432_` | 1 | 86 | 237 |
| desktop | `/review` | 1 | 93 | 252 |
| desktop | `/money` | 1 | 748 | 904 |
| desktop | `/world` | 1 | 74 | 228 |
| desktop | `/assistant` | 1 | 67 | 220 |
| phone | `/replenishment` | 3 | 83 | 218 |
| phone | `/skus/010400432_` | 1 | 87 | 213 |
| phone | `/review` | 1 | 63 | 185 |
| phone | `/world` | 2 | 131 | 257 |
| phone | `/assistant` | 2 | 63 | 207 |
| phone | `/today` | 2 | 906 | 1029 |
| phone | `/money` | 1 | 86 | 208 |

| Project | API samples | Max API duration (ms) | API calls >1s | Console/page errors | POST API actions |
|---|---:|---:|---:|---:|---:|
| desktop | 63 | 3934 | 13 | 2 | 3 |
| phone | 62 | 7742 | 4 | 6 | 1 |

Raw timing evidence: [desktop](desktop/measurements.json), [phone](phone/measurements.json). Navigation metrics cover completed direct navigations; failed/blank navigations and client-side transitions may lack a navigation entry. API metrics cover finished browser requests, not diagnostic context-request GETs. Login has step elapsed time only.

## Checks, safety and handoff

- 33 masked JPEG screenshots; largest 77,967 bytes, all below 400 KB. No password-state screenshots, auth storage, traces, videos or HARs retained.
- `npx tsc --noEmit --pretty false`, scoped ESLint and `git diff --check`: PASS. Test discovery: 2 Chromium project journeys. Browser results intentionally remain RED.
- Only tests/config, npm dev dependency/script/lockfile, ignored transient test output, evidence and handoff changed. Full inventory: [FILES.txt](FILES.txt). No application source edits; no main checkout, merge, push or reset.
- Authorized demo mutations: world events and assistant-triggered calculations; no external supplier delivery. Shared demo state is not rolled back or reset. Exact provider-internal usage is not exposed; bounded UI action accounting is in RUN_NOTES.md.
- Next route: stabilize the hosted revision, provide recommendation versions to the editor, then rerun the same journey and complete approval → PO → downloaded CSV header verification.

Gate: RED.
