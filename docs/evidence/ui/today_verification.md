# Pulse verification — L4a

Production build, local port 3101; browser screenshots are real API-unavailable state, not populated mocks.
- `today_1440_unavailable.png`: 1440 × 900; document scrollWidth 1440; Inter loaded.
- `today_390_unavailable.png`: 390 × 844; document scrollWidth 390; visible links/buttons/inputs/selects/summary targets all at least 44 × 44 px.
- Browser: palette opens, native modal focus moves to search, Escape restores the trigger; phone calculation POST returns the real unavailable message; compose expands its editable form.
- Automated: `npm run check -- ui` → passed=18 failed=0; distinct loading/empty/unavailable, labels, exact money, busy locks, stale versions, typed-input retention, replay receipts, five-second refresh, hidden-tab pause and focus retention.
- Integration with live today/queue/modes/world/ledger routes is externally-unverified: those routes are not in merged main at this render. No partner business rows were invented.
- Not measured: first-paint budget, real-browser click-to-paint latency, CLS across data-changing events, screen-reader speech. The CSS/React mechanisms exist; this note does not claim measurements.
