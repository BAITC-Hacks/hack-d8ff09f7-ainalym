# POLISH-2 execution contract

- Outcome: D-H72 priority surfaces read as white elevated cards on the existing warm canvas across Today, Replenishment, Orders, Suppliers, SKU list/detail, Money, World and Settings.
- Audience/job: purchasing managers scanning stock, cash and decisions in a dense daily workspace; preserve all existing data, actions, Russian copy and information structure.
- Craft contract: existing grid and type family; white hero fill, 1 px hairline, low shadow, 13 px muted metric labels, semibold tabular values and existing comfortable padding. Secondary surfaces retain warm tones.
- Authority: current task, `docs/DESIGN_NOTES.md`, `docs/CONTRACTS.md`; readiness dimension U1 in `docs/TASK_MAP.md`. This is a visual revision, not a change to product truth.
- Evidence: rendered routes at 1440, 1280 and 390 px, DOM measurements for overflow and computed surfaces, TypeScript, `npm run check`, one final production build and independent diff review. More files or screenshots are not acceptance.
- Sequence: shared surface + Today; Replenishment; Orders; Suppliers; SKU list/detail; Money; World; Settings; common control polish; checks/build/closeout. Commit every completed section.
- Unknowns: page-specific hero ownership and narrow-width fit are resolved from source and browser evidence; data is generated only in this worktree's ignored local database with rules mode.
- STOP: no work after 12:25 UTC on 2026-09-23; commit consistent progress and disclose any remaining gap. Stop mutations on overlap or failed scope validation.
- Maintenance: the shared shell class owns elevation and shared tokens own metric typography; future pages opt in to the same class instead of duplicating values.

## FOOTGUNS

- Work only on `lane/polish2`; no main, production, external writes, paid APIs, new dependencies, credentials or business logic changes.
- Exclude assistant, voice, CartPanel and documents files. Today/Money styles and the SKU table belong to another lane: only surface styling there; keep shared changes in the shell and common UI.
- Preserve warm secondary and semantic alert surfaces; do not globally turn every card white or suppress focus/hover feedback.
- CSS import order may differ after bundling: validate the production build. Browser-only findings must be recorded in the closeout/evidence.
