# Pulse verification — L4a

Production build, local port 3101; browser screenshots are real API-unavailable state, not populated mocks.
- `today_1440_unavailable.png`: 1440 × 900; document scrollWidth 1440; Inter loaded.
- `today_390_unavailable.png`: 390 × 844; document scrollWidth 390; visible links/buttons/inputs/selects/summary targets all at least 44 × 44 px.
- Browser: palette opens, native modal focus moves to search, Escape restores the trigger; phone calculation POST returns the real unavailable message; compose expands its editable form.
- Automated: `npm run check -- ui` → passed=25 failed=0; distinct loading/empty/unavailable, labels, exact money, busy locks, stale versions, typed-input retention, replay receipts, five-second refresh, hidden-tab pause and focus retention.
- Integration with live today/queue/modes/world/ledger routes is externally-unverified: those routes are not in merged main at this render. No partner business rows were invented.
- Not measured: first-paint budget, real-browser click-to-paint latency, CLS across data-changing events, screen-reader speech. The CSS/React mechanisms exist; this note does not claim measurements.

Independent review: `docs/agent_handoffs/L4A_REVIEW_CLOSEOUT.md` found four counterexamples; fixes and regressions recorded in `L4A_REVIEW_RESOLUTION.md`.
Declared-token contrast computed with sRGB relative luminance: ink/white 16.29:1; muted/wash 5.36:1; accent/white 5.81:1; focus ring/wash 4.70:1; success/white 5.17:1; warning/warning-bg 4.75:1; danger/danger-bg 5.62:1. Graphic series/white: revenue 3.13:1, cost 3.14:1, profit 3.41:1. These are token-pair computations, not a browser-wide text audit.
