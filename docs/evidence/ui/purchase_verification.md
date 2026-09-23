# L4b browser and state evidence — 2026-09-23

## Scope and provenance
- Branch lane/ui_b; owned UI on main a32279a for screenshots; subsequent merge 303f2dc brings L4a navigation fix. No live paid provider calls, no external sends.
- Production build on port 3104, process provider=rules and provider keys empty. Local ETL from the committed anonymised partner XLSX; the UI reads real `/api/*` responses.
- Real calculation prepared by existing `/api/voice/tools/recommend_for` for SE/category 3: run `RUN-e4c2c8f3-d0e0-4b60-b82f-1a7f63afd9ea`, 84 recommended rows; proposal `PR-4a261569-a59c-4d26-b0ad-252c8385b2e1`. This verifies SKU rendering, not the missing workspace/approval routes.
- SKU 130300028_: stock 8, transit 0, forecast 745.743, safety 717.542, raw need 1455.285, MOQ 140, recommendation 1540. Outlier document marks come from persisted components. Regular history absent in upstream response stays missing; negative actual sales are preserved.

## Captures
| File | Viewport / state |
|---|---|
| purchase_workspace_1440_unavailable.png | 1440×900; actual missing recommendation, runs, ledger routes |
| review_desk_1440_unavailable.png | 1440×900; actual missing proposals route for the real proposal ID |
| purchase_sku_1440_partner.png | 1440×900, full page; actual stock/forecast/need, unknown result axes |
| purchase_sku_1728_partner.png | 1728×920; same partner calculation |
| purchase_sku_390_partner.png | 390×844, full page; phone chart, facts, need proof |
| purchase_quantity_failure_1728.png | actual 404 /adjust; qty 1680 and typed reason retained |
| purchase_assistant_1728.png | L4c AssistantPanel mounted with partner/SE/130300028_ scope; no submitted message |

## Measurements and limits
- DOM overflow false at 1440, 1728 and 390; Inter fonts loaded. Phone main links/buttons/disclosures measured >=44 px tall. Responsive SVG labels retain 12 px CSS font size instead of scaling down with the desktop viewBox.
- Contrast against white, from token sRGB values: ink 16.29, muted 5.84, accent 5.81, forecast 5.17, actual series 3.14, outlier marker 5.02. This is not a complete contrast audit of every overlay/background combination.
- Actual quantity editor opens with input focus; request failure preserves qty/reason and displays an inline error. Screenshot proves real error, not a mocked successful save.
- Unit/component tests cover pending within the submit turn, duplicate click lock, 409 preserving explicit choice and qty, new record identity requiring rebase, stale state, unknown truth, all proposal enum states, removed fields, Decimal amount preview and historical read-only rows.
- API integration calculation → recommendations → queue → decision → order → export is externally unverified. Live 409, no-reload Pulse update, browser timing <=100 ms, full three-keystroke reachability, background CLS and phone populated review footer are unmeasured. Do not infer them from test count or unavailable screenshots.
- Main API requests and residual persisted-rationale issue: ../../agent_handoffs/L4B_API_REQUESTS.md. Independent refutation: ../../agent_handoffs/L4B_INDEPENDENT_REVIEW.md.
