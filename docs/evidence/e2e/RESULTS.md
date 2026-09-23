# Hosted judge steps — 2026-09-23T09:50:39.609Z

Runner: passed. Step durations include assertions and screenshot capture; page/API timings are in each project's measurements.json.

| Project | Step | Result | Evidence | Duration and observation |
|---|---|---|---|---|
| desktop | 01 access and Today shell | PASS | [screenshot](desktop/01.jpg) | 5799 ms;  |
| desktop | 02 Pulse numbers | FAIL | [screenshot](desktop/02.jpg) | 8956 ms; P2: Pulse metrics contain nonnumeric values: Нет обязательств / Не запланирован / 144 117 720,71 ₸ / 636 |
| desktop | 03 supplier groups and SKU links | PASS | [screenshot](desktop/03.jpg) | 982 ms;  |
| desktop | 04 SKU chart sources and facts | FAIL | [screenshot](desktop/04.jpg) | 769 ms; P1: supplier-row navigation unavailable; direct real-SKU diagnostic fallback; P1: SKU only reachable by direct diagnostic navigation; supplier-row path blocked |
| desktop | 05 adjust recommendation and ledger | FAIL | [screenshot](desktop/05.jpg) | 9144 ms; expect(locator).toBeEnabled() failed  Locator:  getByRole('form', { name: 'Изменить количество 010300008_' }).getByRole('button', { name: 'Сохранить количество' }) Expected: enabled Received: disabled Timeout:  8000ms   |
| desktop | 06 approve proposal draft and export | SKIP | [screenshot](desktop/06.jpg) | 378 ms; No supplier proposal present; approval/export unverified |
| desktop | 07 money cash and commitments | PASS | [screenshot](desktop/07.jpg) | 1153 ms; Cash records: 0; supplier commitments: 0; empty cash is disclosed by UI |
| desktop | 08 world in-transit update and Play | PASS | [screenshot](desktop/08.jpg) | 1659 ms; 010300016_: 198 → 98; compose may process immediately |
| desktop | 09 typed assistant truth-labelled result | PASS | [screenshot](desktop/09.jpg) | 4233 ms;  |
| desktop | 10 keyboard visible focus | PASS | [screenshot](desktop/10.jpg) | 1091 ms; [{"tag":"A","visible":true,"ring":true},{"tag":"A","visible":true,"ring":true},{"tag":"A","visible":true,"ring":true},{"tag":"A","visible":true,"ring":true},{"tag":"A","visible":true,"ring":true},{"tag":"BUTTON","visible":true,"ring":true},{"tag":"A","visible":true,"ring":true},{"tag":"A","visible":true,"ring":true}] |
| desktop | 11 phone overflow and primary targets | SKIP | [screenshot](desktop/11.jpg) | 39 ms; Phone-only checks |
| desktop | 12 latency and browser errors | FAIL | [screenshot](desktop/12.jpg) | 29 ms; Console/page errors: 1; write actions: 3; slow pages: /today TTFB 1666ms; slow APIs: /api/today 3519ms, /api/state 3522ms, /api/agent/ledger 3535ms, /api/modes 3536ms, /api/today 3583ms, /api/state 3584ms, /api/agent/ledger 3592ms, /api/modes 3595ms, /api/assistant/message 3934ms; P2: browser errors or requested latency thresholds exceeded |
| phone | 01 access and Today shell | PASS | [screenshot](phone/01.jpg) | 7818 ms;  |
| phone | 02 Pulse numbers | FAIL | [screenshot](phone/02.jpg) | 13394 ms; expect(locator).toBeVisible() failed  Locator: locator('main') Expected: visible Timeout: 8000ms Error: element(s) not found   |
| phone | 03 supplier groups and SKU links | FAIL | [screenshot](phone/03.jpg) | 9982 ms; expect(locator).toBeVisible() failed  Locator: locator('main') Expected: visible Timeout: 8000ms Error: element(s) not found   |
| phone | 04 SKU chart sources and facts | FAIL | [screenshot](phone/04.jpg) | 790 ms; P1: supplier-row navigation unavailable; direct real-SKU diagnostic fallback; P1: SKU only reachable by direct diagnostic navigation; supplier-row path blocked |
| phone | 05 adjust recommendation and ledger | FAIL | [screenshot](phone/05.jpg) | 9288 ms; expect(locator).toBeEnabled() failed  Locator:  getByRole('form', { name: 'Изменить количество 010300008_' }).getByRole('button', { name: 'Сохранить количество' }) Expected: enabled Received: disabled Timeout:  8000ms   |
| phone | 06 approve proposal draft and export | FAIL | [screenshot](phone/06.jpg) | 8268 ms; expect(locator).toBeVisible() failed  Locator: locator('a[href="/review/PR-505049c6-9fbc-482d-bfc8-c0508bf80fb1"]').first() Expected: visible Timeout: 8000ms Error: element(s) not found   |
| phone | 07 money cash and commitments | FAIL | [screenshot](phone/07.jpg) | 8076 ms; expect(locator).toBeVisible() failed  Locator: locator('main') Expected: visible Timeout: 8000ms Error: element(s) not found   |
| phone | 08 world in-transit update and Play | FAIL | [screenshot](phone/08.jpg) | 429 ms; P1: no recommendation above 100 with MOQ ≤100 to verify in-transit effect |
| phone | 09 typed assistant truth-labelled result | PASS | [screenshot](phone/09.jpg) | 1412 ms;  |
| phone | 10 keyboard visible focus | PASS | [screenshot](phone/10.jpg) | 1066 ms; [{"tag":"A","visible":true,"ring":true},{"tag":"BUTTON","visible":true,"ring":true},{"tag":"BUTTON","visible":true,"ring":true},{"tag":"A","visible":true,"ring":true},{"tag":"SELECT","visible":true,"ring":true},{"tag":"INPUT","visible":true,"ring":true},{"tag":"BUTTON","visible":true,"ring":true},{"tag":"BUTTON","visible":true,"ring":true}] |
| phone | 11 phone overflow and primary targets | PASS | [screenshot](phone/11.jpg) | 3004 ms; /today: width 390/390; primary buttons 1; 324×44; /replenishment: width 390/390; primary buttons 1; 172.484375×44; /money: width 390/390; primary buttons 0; ; /world: width 390/390; primary buttons 0; ; /assistant: width 390/390; primary buttons 1; 44×44 |
| phone | 12 latency and browser errors | FAIL | [screenshot](phone/12.jpg) | 16 ms; Console/page errors: 6; write actions: 1; slow pages: none; slow APIs: /api/today 7731ms, /api/state 7732ms, /api/agent/ledger 7742ms, /api/assistant/message 1123ms; P2: browser errors or requested latency thresholds exceeded |
