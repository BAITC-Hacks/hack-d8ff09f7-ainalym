# L4c independent source/contract review

Gate: RED — the reviewed snapshot has missing runtime dependencies and actionable state/label defects. This was one finite independent pass against `docs/PRODUCT.md` and `docs/CONTRACTS.md` §§3–5, using `oil-frontend`. Review baseline: worktree HEAD `db3742d` plus its working changes, inspected on 2026-09-23. Parent integration was concurrent; the late-arriving world route is distinguished below from the reviewed source.

## Findings by severity

1. **P2 — Changing the panel scope destroys the draft and any pending result.** `src/components/assistant/AssistantPanel.tsx:20` keys the whole `AssistantSession` by `JSON.stringify(scope)`. Its input, entries, and retry identity live inside that keyed child (`:28–41`), and the POST completion writes only to that child's state (`:46–54`). Reproduce by starting a deferred tool POST for supplier SE, rerendering the panel with supplier IEK, then resolving the SE response: the server operation continues but its completion is discarded with the old session. Switching back also loses the SE draft/history. Even equivalent scope objects with a different property insertion order generate different keys. Preserve sessions and pending request ownership by a stable semantic scope key, with results explicitly attributed to their originating scope; do not silently discard an accepted operation on a context change. No current test rerenders the scope during a request.

2. **P2 — World-event rows discard the canonical simulator label.** `src/components/world-console/WorldEventList.tsx:28` uses the existence of `event.label` only to infer `provenance: "synthetic"`, then renders generic truth-axis labels. The actual feed supplies `Симулятор мира — синтетическое событие` from `src/world/feed.ts:3,25–28`, but that label is never displayed by the event list. Instead rows show “Синтетические данные” and “Локальный симулятор”. This misses the exact world disclosure required by CONTRACTS.md:75,86. Render the canonical world label (the shared `WorldLabel` already exists at `src/components/labels/index.tsx:27`) while retaining any separately supplied truth axes. The existing world fixture contains the canonical label but its test does not assert it is visible.

## Concurrent integration observed at closeout

The initial inventory had no `/world` page and no production consumer of `WorldEventList`/`PlaybackTimer`, despite links at `ConnectionsPage.tsx:36` and `WorldRun.tsx:9`. This was reported promptly to the parent. The final inventory showed a newly created `src/app/(app)/world/page.tsx` importing `WorldConsole`, which now mounts `WorldControls`, `PlaybackTimer`, and `WorldEventList`. The absent-route finding is therefore withdrawn. The new `WorldControls` implementation arrived after this finite review and is explicitly unreviewed; the earlier UI-check result does not validate it.

## Required surfaces still missing in the reviewed snapshot

- The file inventory contains no handlers for `/api/assistant/message`, `/api/voice/tools/:name`, `/api/voice/session`, `/api/modes`, `/api/state`, or `/api/agent/runs/:id`. These are actual dependencies of the scoped pages and shared shell. Assistant buttons and typed submission call absent routes at `AssistantPanel.tsx:58,68`; connections cannot load its principal data at `ConnectionsPage.tsx:11`; run detail cannot load at `WorldRun.tsx:8`. These are integration gaps owned by the corresponding API lanes, not successful API-backed acceptance.
- `src/voice/useVoiceSession.ts:6–7` is a permanent unavailable/no-op stub. The UI honestly disables this stub, but PRODUCT.md:18's spoken-question path is not implemented in this snapshot. `AssistantPanel.tsx:133–134` renders hook captions separately from entries populated only by the typed/tool request helper; no successful spoken tool result reaches a result card through the current hook interface. Integrate the actual voice implementation and verify the spoken result against the same records.
- Result links to `/replenishment`, `/skus/:code`, and queue-provided review pages cannot be validated to completion here: those page entries are absent from this snapshot. Do not count rendered links as completed downstream navigation.

## Correct structure and deletion guidance

- Keep the current API request/response boundary and retry request ID. Retain user drafts and result ownership across scope changes instead of deleting the whole session as the scope changes.
- Remove the simulator-label inference from arbitrary label presence; use the canonical world disclosure and supplied axes as distinct data.
- Expose the world feed, play/compose actions, and run links through one reachable route. Do not add substitute demo results to make missing APIs appear successful.

## Verification and limits

Commands run: `pwd`; `git status --short`; `git rev-parse --short HEAD`; `git diff --numstat -- <scoped component directories>`; `rg --files` and targeted `rg -n` searches for route inventories, consumers, scope/API wiring and labels; `cat`/`nl -ba` of the named specification, product/contracts, scoped source/tests, relevant shared dependencies, and the oil-frontend skill plus scope/state rules; `npm run check -- ui`.

`npm run check -- ui` exited 0: 20 passed, 0 failed, 0 skipped. The runner sets `DATABASE_PATH=:memory:`. The tests establish duplicate-submission suppression while a request is busy, preserved failed typed text, retry ID reuse, explicit supplier scope, the eight voice-state renderings, external-link filtering, retained connections data after refresh failure, local world filtering, and basic hidden-tab timer behavior. They mock `fetch`, and assistant tests mock `useVoiceSession`; they do not establish real route availability, voice operation, scope transitions, or layout.

No browser or server was started or mutated; no network/provider calls, database writes, credentials, application/test changes, or commits were made. Phone and desktop control reachability, virtual-keyboard behavior, actual focus restoration, real API response compatibility, and real microphone/spoken-result behavior remain unverified. CSS source inspection alone is insufficient evidence for those viewport claims. Failed exploratory reads only concerned guessed paths (`src/peers/world.ts`, `src/server/modes.ts`, `src/ai/providers.ts`, `src/server/config.ts`); authoritative files were located through the source inventory.

Files changed by this reviewer: only `docs/agent_handoffs/L4C_INDEPENDENT_REVIEW.md`. No additional agents were spawned. STOP: finite review completed; remediation belongs to the owning integration lane.
