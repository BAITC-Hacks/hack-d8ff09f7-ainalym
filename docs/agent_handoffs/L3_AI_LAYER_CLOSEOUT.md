# L3 AI layer closeout — replenishment case

BEFORE → AFTER: `src/ai/provider.ts:104` replaces no provider seam with one typed Choice interface and four selectable paths; `src/ai/catalog.ts:16` validates five proposal-only questions; `src/ai/decisions.ts:86` persists answer, full distribution, mode, provider/model, evidence versions, rubric and cache key.

BEFORE → AFTER: `src/ai/interpret.ts:22` judges only borderline outlier documents; `src/ai/worker.ts:231` processes each pending event once, calls L2 world application and affected-SKU recomputation, prepares L2 supplier and outlier-review proposals, records decisions and failures, and drains scheduled checks (`:239`, `:260`).

BEFORE → AFTER: `src/ai/drafting.ts:72` prepares an approved-PO supplier email in RU and `:118` a run summary, checks factual consistency, and saves markdown+JSON under ignored `data/artifacts`. `src/app/api/decisions/route.ts:7`, `src/app/api/drafts/route.ts:10`, and `src/app/api/artifacts/[id]/route.ts:3` expose the results; download is `src/app/api/artifacts/[id]/download/route.ts:3`.

Provider observations from `tests/ai/live_smoke.test.ts`: direct TypeSafe `jev:typesafe` → `jev-1.13.0` via `https://api.typesafe.ai/v1/systemone` (`jev-latest` request); fallback Gateway `jev:gateway` → `typesafe-ai/jev` via `https://ai-gateway.vercel.sh/v1/evaluate`; OpenAI → `gpt-5-mini-2025-08-07`; rules → `rules-v1`, «Правила без LLM». Live supplier draft: OpenAI `gpt-5-mini-2025-08-07`, consistency passed.

Replay table: `fixtures/replay_decisions.json` has six case recordings: one-off and regular document, IEK category, stockout reason, increased run, prepayment terms. All five catalog questions have a recording; unknown subject/question returns `unsupported`, never a chosen default. No `tests/fixtures/eval/*` import exists under `src/`.

Guardrails: mocked 429/timeout → `provider_error`/503; direct provider error falls back to Gateway; unknown/insufficient/unsupported stay distinct; foreign-org references are removed before model input; image-only facts avoid a model call; Chinese `预付` is retained; a SKU version change discards a stale answer. Worker tests cover sequence, concurrent insertion during tick, idempotency, failure ledger call, scheduled checks, and borderline outlier review.

Gate output: `RUN_AI_DRAFT_LIVE=1 npm run check -- ai` → `passed=35 failed=0 skipped=0 externally-unverified=0`; default `npm run check -- ai` → `passed=34 failed=0 skipped=1` (opt-in live draft). `npx tsc --noEmit` → exit 0. `npm run build` → exit 0 (Next middleware deprecation warning is from another lane). Live provider smoke → 4/4. Drafting timeout was raised to 20 s after a concurrent live-gate timeout; the rerun passed.

Partner replay: WE-043 reaches processed state, excludes the 5,000-unit judge document, and produces a supplier proposal after the integrated ETL/engine changes. WE-044 adds 100 in transit and recomputes its SKU; WE-045 updates SE cost to 360.00 and recomputes. `tests/ai/partner_event.test.ts` keeps all three checks reproducible.

Dependencies added by L3: none. `npm install` was rerun after L9 added `xlsx` to the shared lockfile.

Unverified: L1's ledger implementation has not merged into this worktree; unit worker tests mock its seam, and the partner replay currently uses the stub. Re-run ledger rows/provider metadata after L1 merge.

Protected surfaces: no UI files, main branch, history rewrite, evaluation-fixture import, or schema file edited. Runtime migration adds only `decision_record.evidence_versions`, `rubric_version`, and `cache_key` plus an index.

Gate: YELLOW

tip: a37ce46
