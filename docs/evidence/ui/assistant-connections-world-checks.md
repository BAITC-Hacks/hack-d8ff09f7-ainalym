# L4c tier-1 evidence · 2026-09-23

Gate: RED — UI checks pass; integrated modes/source metadata and live microphone gate are incomplete.

- `npm run check -- ui`: passed=49 failed=0 (23 c_* tests); mocks cover eight voice states, four no-key tools, duplicate/pending/error/retry, scope changes, spoken-result event, mode labels, filters, timer visibility and structured compose payloads.
- `npx tsc --noEmit`: passed. `npm run build`: passed; existing Next middleware deprecation warning belongs to the demo lane.
- Browser: actual lane production server at `http://127.0.0.1:3104`, keys blank, rules/offline, isolated ETL database `data/l4c-ui.db`. No paid provider calls, no external writes. Initial localhost captures resolved to another lane's IPv6 server; all retained captures were replaced from this lane's explicit IPv4 server.
- Desktop: assistant/connections/world at 1440×900; assistant also 1728×920. PNG names specify width; connections/world full-page captures retain viewport width. Phone: all three at 390×844.
- No horizontal overflow on all three phone surfaces. Owned action targets meet 44 px; timer checkbox has a 44 px label. Assistant send button bottom 847 at desktop height 920; full-screen phone composer remains visible. Virtual phone keyboard was not tested.
- Phone assistant background navigation has inert attributes and body scroll lock; initial focus is close link. Desktop resize restores the background. Visible focus ring captured.
- `/api/health` confirms voice missing: assistant shows `Provider unavailable`, `Голос недоступен — печатайте`, `Realtime + async speech`, four available tools and typed input.
- Bare ETL has no organization; actual deterministic-tool request returned `Unknown organization scope` and exposed retry, with no fabricated result card. Root must seed org or supply active scope. Empty world list is an actual API response.
- `/api/modes`, `/api/state`, `/api/agent/runs/:id` absent: connections and shell show unavailable states. §5 strings and exact plain 1C diagnostic meta pass component tests, but integrated label gate is RED.
- Spoken tool event is tested, real microphone + provider result is externally-unverified (root gate). No claim of voice completion.
- Independent review and resolution: `docs/agent_handoffs/L4C_INDEPENDENT_REVIEW.md`, `L4C_REVIEW_RESOLUTION.md`.
