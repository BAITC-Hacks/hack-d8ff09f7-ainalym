# L4a checkpoint 1 — shell cut for L4b/L4c
Done: option A tokens, local Inter/OFL, bare root, `(app)` shell, phone navigation, static palette, keyboard map, API sync, honest mode/offline bands.
Imports: `@/components/labels` → Chip, ModeChip, TruthAxisLabels/TruthLabels, TaskStateChip, ProposalStateChip, UrgencyChip, AgentsLabel, WorldLabel, TruthAxes, LABELS.
Imports: `@/components/shell` → useApi, useApiSync, apiRequest, ApiError, Button, ActionStatus, LoadError, Skeleton, EmptyState, useApiAction.
Routes: place application pages under `src/app/(app)`; bare landing/supplier/peers remain outside. Root redirects `/today`.
Undone: Pulse API panels/actions, state tests/screenshots, tier-2 money. Today is a temporary empty entry.
Resumable: L4a continues Pulse; L4b/L4c can import labels/tokens immediately. Assistant navigation is `/assistant`.
Checks: production build + `npx tsc --noEmit` pass; UI gate unrun (L1 runner pending).
sha: this checkpoint commit (resolve `git log -1 --format=%H -- docs/agent_handoffs/L4A_CHECKPOINT.md`); parent 0d9406a.
