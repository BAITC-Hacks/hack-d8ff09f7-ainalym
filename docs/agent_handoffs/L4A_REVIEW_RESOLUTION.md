# L4a review resolution

Independent input: L4A_REVIEW_CLOSEOUT.md (fresh finite reviewer pass). The original RED is retained unchanged as evidence.
- Unseen proposal version: removed the proposals lookup. Inline writes require the version from the displayed queue row; otherwise the control explains that review is required. Regression supplies a newer v8 server response and proves no request is made.
- Historical truth axes: shared `resultAxes` reads result nested/top-level metadata. Pulse no longer substitutes `/api/modes` for queue/ledger/money/calculation/event results. Runtime modes remain in shell. Regression proves a top-level replay/synthetic result stays replay/synthetic despite a live/partner fallback.
- Pending money: `empty_reason` blocks claims that payments or approved orders do not exist. Regression renders the actual documented pending shape and checks unavailable wording.
- Compose run reference: a run ID no longer means calculation completed. Receipt says the event was saved and processing will appear in the ledger; missing event result and unknown axes stay explicit. Regression covers accepted event + running run ID.
- Additional resource checks: retry after a transient failure without a changed fingerprint; never display an old URL's payload as a new object; body edit and focus persist across refresh.
- Checks: `npm run check -- ui` passed=25 failed=0; scoped ESLint and TypeScript passed. Source and counterexamples were examined by the implementing parent after the independent pass; no claim of a second independent gate.
- Integration remains externally-unverified pending route/reset dependencies listed in L4A_INTEGRATION_FINDINGS.md. Timing, CLS and screen-reader speech remain unmeasured.
