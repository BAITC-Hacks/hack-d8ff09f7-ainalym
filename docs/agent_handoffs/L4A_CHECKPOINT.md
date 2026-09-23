# L4a checkpoint 4 — money
Done: tier 1 shell/Pulse/states plus `/money`: cash per currency, dated 60-day schedule, supplier commitments, SE stock value and unknown-cost risks.
Done: closest payment links from Pulse; supplier amounts with zero known-cost lines stay unknown, never zero.
Checks: UI passed=20 failed=0; production build, scoped ESLint and TypeScript pass.
Renders: Pulse desktop + phone available in docs/evidence/ui; integrated populated render pending the route merges.
Shared imports remain `@/components/labels`, `@/components/shell`; money uses the same API sync and decimal formatting.
Resumable: current main merged; validate today/queue/modes/ledger/world payloads when available and run the integrated feed→ledger→queue check.
Unverified: integrated live-refresh scenario; performance timing/CLS not measured. Gate: RED until integration runs.
sha: state/render cut a0ca77b; money commit resolves this file. Fresh independent review in L4A_REVIEW_SPEC.md is running.
