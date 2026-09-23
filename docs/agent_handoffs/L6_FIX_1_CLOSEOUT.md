# L6-FIX-1 closeout — lane/world

- Outcome: six Astra findings fixed after merging `main` at `ed943f1`; no changes to `main`.
- Scope: playback now confines worker reads and claims to the caller org; two-org regression leaves the other org pending (`1122a27`).
- Compose checks SKU and supplier before writes; unknown SKU returns 404 with no row or state-version bump (`dd2f60b`).
- World, supplier, and export results carry provenance, AI, and external truth axes (`e77cf3b`, `52c8afe`).
- Supplier states use the exact §5 simulator labels (`9379237`).
- Judge quantity drives both derived text and numeric payload (`9c8d0b6`).
- Peer tests now assert worker calls, seed an ETL SKU, and prove replay preserves state version (`8cac548`).
- Files: `src/ai/worker.ts`, `src/world/{play,compose,feed}.ts`, `src/peers/{supplier,onec_export,deliver}.ts`, `src/app/(peers)/world/[code_1c]/JudgeCompose.tsx`, `tests/peers/*`.
- Check: `npm run etl && npm run check` GREEN — 163 passed, 0 failed, 3 skipped, 2 externally unverified; `npm run build` passed.
- Edge: live voice gates remain externally unverified; no paid or external channel test was attempted.
- Protected: no schema rename, secret, force-push, or UI edit outside `src/app/(peers)/**`.
- Tip: `lane/world` at code commit `52c8afe`; this closeout is the file-only successor. Gate: GREEN.
