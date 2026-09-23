# Pulse verification — L4a

Production build, local port 3101. Pulse cold-open shows the real unavailable L1 state; the world feed and money page read real persisted partner-derived data. No browser response mocks.
- `today_1440_unavailable.png`: 1440 × 900; document scrollWidth 1440; Inter loaded.
- `today_390_unavailable.png`: 390 × 844; document scrollWidth 390; visible links/buttons/inputs/selects/summary targets all at least 44 × 44 px.
- Browser: palette opens, native modal focus moves to search, Escape restores the trigger; phone calculation POST returns the real unavailable message; compose expands its editable form.
- Automated: `npm run check -- ui` → passed=30 failed=0; distinct loading/empty/unavailable, labels, exact money, busy locks, stale versions, typed-input retention, replay receipts, five-second refresh, hidden-tab pause and focus retention.
- A removed queue row remains mounted while its action owns focus; the changed API snapshot is offered explicitly, with stale writes blocked. The update notice reserves its height. A regression proves retained focus and no stale request.
- Integration with today/queue/modes/state/ledger routes is externally-unverified: those routes are not in merged main at this render. L6 world routes landed subsequently and the real Play/compose/replay controls passed the partial integration below. No partner business rows were invented.
- Not measured: first-paint budget, real-browser click-to-paint latency, CLS across data-changing events, screen-reader speech. The CSS/React mechanisms exist; this note does not claim measurements.

Independent review: `docs/agent_handoffs/L4A_REVIEW_CLOSEOUT.md` found four counterexamples; fixes and regressions recorded in `L4A_REVIEW_RESOLUTION.md`.
Declared-token contrast computed with sRGB relative luminance: ink/white 16.29:1; muted/wash 5.36:1; accent/white 5.81:1; focus ring/wash 4.70:1; success/white 5.17:1; warning/warning-bg 4.75:1; danger/danger-bg 5.62:1. Graphic series/white: revenue 3.13:1, cost 3.14:1, profit 3.41:1. These are token-pair computations, not a browser-wide text audit.

Latest bounded review: `L4A_REVIEW_FOLLOWUP.md` is GREEN for the four original findings plus disappearing-record/disclosure focus. Full integration and timing are outside that review.

L6 integration on rules-only `data/ui-a-qa.sqlite`: loaded canonical partner exports and the 45 canonical world fixtures; no custom business fixtures. Play produced one processed event and one proposal; focus remained on the Play button while the next rows changed without reload. Ledger rows remained zero because L1 ledger is still a seam. Compose in-transit +100 changed the fixture SKU total from 30000 to 30100; submitting the same event again showed «Уже обработано — без эффекта» and total remained 30100. Screenshot: `today_feed_replay.png`. These are isolated QA effects, not approved orders or supplier sends.

Final browser pass: `/` redirected to `/today`; 1440×900 and 390×844 Pulse captures refreshed on the integrated build. No horizontal overflow; the visible phone targets met 44×44 px. A second canonical event was played from the phone; the next feed rows updated while focus remained on Play (`today_feed_phone.png`). The catalogue navigation states the actual missing capability. `money_1728_partner.png` shows the money API over the isolated ETL database at 1728×920, with no horizontal overflow. `money_1728_unavailable.png` retains the earlier organization-not-found state before the upstream seed landed. Viewport restored after QA.

Historical truth axes on queue rows and ledger rows are visible before opening «Почему?»; the regression checks that ledger labels are outside a closed explanation disclosure.
