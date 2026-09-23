# AGENTS.md — Ainalym (developer guidance for this repository)

- Stack: Next.js 16 (App Router, TypeScript, npm), SQLite through `node:sqlite`, Vercel AI SDK (Jev typed decisions: direct TypeSafe API first, AI Gateway as fallback; OpenAI for drafts and realtime voice), vitest.
- Run: `cp .env.example .env.local` → `npm install` → `npm run dev` → http://localhost:3000. Missing keys → the deterministic `rules` provider with a banner («Правила без LLM»); a failed live call is shown as unavailable, never as a simulated success.
- Check: `npm run check` prints one `[PASS|FAIL|SKIP|UNVERIFIED]` line per item and a summary; `npm run demo:reset` rebuilds the database from `fixtures/partner/` and restores the starting state.
- Contract: `docs/CONTRACTS.md` (entities, routes, labels); acceptance: `docs/PRODUCT.md`. Domain logic and every number only in `src/domain/`; model calls only in `src/ai/` and `src/voice/`; the world simulator and the 1С export in `src/world/` and `src/peers/`; the UI reads the API, never a private store.
- Commits: small, one per step, conventional messages. Never commit `.env.local`, `data/`, keys, or customer data (the partner data carry document numbers only).
- Labels: every result shows its provenance (partner data, anonymised), AI execution (live / rules / replay / unavailable) and external action (export file / simulator). Nothing is ever sent to a supplier automatically; the export is a file, not a connection to 1С.
- `fixtures/partner/` are the partner's anonymised exports disclosed in `DISCLOSURE.md`; `tests/fixtures/eval/` is test data only and is never imported by `src/`.
- This file is written for developers and reviewers reproducing the project; it contains no instructions addressed to evaluators.
