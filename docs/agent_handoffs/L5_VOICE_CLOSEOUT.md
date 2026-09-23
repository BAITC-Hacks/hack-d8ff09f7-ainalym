# L5 — realtime and async speech closeout

BEFORE: `src/voice/useVoiceSession.ts` and `Captions.tsx` were stubs; there was no voice session, tool bridge, typed assistant, note transcription, or voice evidence.
AFTER: `src/app/api/voice/session/route.ts:19` mints a server-key ephemeral secret with an actual 50-second provider TTL and four replenishment tools; `src/voice/useVoiceSession.ts:16` connects microphone WebRTC, handles interruption/connection loss, and refreshes `/api/state`; `src/voice/Captions.tsx:4` labels user/assistant/tool lines.
AFTER: `src/voice/tools.ts:130` and `src/app/api/voice/tools/[name]/route.ts:4` execute the four scoped tools over the shared ledger, queue, SKU view and calculation service, with a 10-minute `request_id` result cache; `src/app/api/assistant/message/route.ts:9` uses the same tools for typed requests; `src/app/api/voice/transcribe/route.ts:9` stores actual provider text as `medium:"voice_note"`.
Only L5 owned paths plus this handoff and checkpoint were edited. No dependencies added. The standard key remains server-only; no value was logged or committed. No provider product call was made while building.
Files: `src/voice/{useVoiceSession.ts,Captions.tsx,tools.ts,transport.ts,typed.ts}`; `src/app/api/voice/{session/route.ts,tools/[name]/route.ts,transcribe/route.ts}`; `src/app/api/assistant/message/route.ts`.
Tests: `tests/voice/{session.test.ts,tools.test.ts,interruption.test.ts,fallback.test.ts,partner.test.ts,live.test.ts}`.
Evidence/handoffs: `docs/evidence/voice/{verification.md,integration.md,no-key-panel.png,typed-partner-status.png}`; `docs/agent_handoffs/{L5_CHECKPOINT.md,L5_VOICE_CLOSEOUT.md}`.

Realtime endpoints and model: server `POST https://api.openai.com/v1/realtime/client_secrets`; browser SDP `POST https://api.openai.com/v1/realtime/calls` with the ephemeral secret; model `gpt-realtime-2.1`. Checked against [OpenAI WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc) and [client-secret API reference](https://developers.openai.com/api/reference/typescript/resources/realtime/subresources/client_secrets/methods/create).

| Voice contract case | Status and evidence |
|---|---|
| Status question | Automated: `tests/voice/tools.test.ts` reads persisted `agent_action`. Local HTTP + browser typed question against reset partner DB returned the SE ledger and queue at state_version 724: `docs/evidence/voice/integration.md`. Spoken round trip: externally-unverified. |
| Interruption | Automated: `tests/voice/interruption.test.ts` aborts pending request and drops late response/transcript; stop during handshake is guarded in the hook. Browser microphone: externally-unverified. |
| Prepare, never send | Automated: `tests/voice/tools.test.ts` creates one proposal/task, zero approvals and purchase orders; `labels.draft` only after a stored proposal. |
| Ambiguous quantity | Automated scripted speech/transcript events: corrected «тринадцать… нет, четырнадцать тысяч» returns `needs_clarification`, zero calculation writes in `tests/voice/tools.test.ts`. |
| Task outlives call | Automated: durable `task` remains after turn cancellation in `tests/voice/tools.test.ts`. Browser `stop()` and task visibility: externally-unverified. |
| Duplicate delivery | Automated: same `request_id` returns first result with `replayed:true`, one `calc_run`/proposal/task; a 2.2-second first call is also replayed in `tests/voice/tools.test.ts`. |
| Failure recovery | HTTP no-key `503`/`label:"Provider unavailable"`; browser [no-key screenshot](../evidence/voice/no-key-panel.png) shows typed composer enabled and microphone disabled; [integrated screenshot](../evidence/voice/typed-partner-status.png) shows a backend typed result. Real dropped WebRTC connection: externally-unverified. |

Checks after L1/L3/E2E merges: `npm run check -- voice` → passed=19 failed=0 externally-unverified=2; `npm run build` GREEN, including TypeScript. Details: [voice verification](../evidence/voice/verification.md) and [partner HTTP/browser gate](../evidence/voice/integration.md). Each disposable reset provided the contract organization and 3,909 partner SKUs. The post-L1-fix HTTP replay again yielded one calculation, one proposal and zero approvals/orders. A value-only scan of 31 built browser assets found zero occurrences of the configured standard key.
Remaining integration: L4 must subscribe to `ainalym:voice-tool-result` to render voice result cards. L8 currently blocks `/api/assistant/message` when the live-call budget is zero. Upstream `/api/queue` hrefs target missing pages and L4 labels a zero-recommendation run as a draft; L5 maps its own proposal/task links to existing review pages. These owning-lane gaps are recorded in `L5_CHECKPOINT.md`.
Build warning: L1's dynamic `databasePath()` causes Turbopack to trace the project into server output; the browser asset scan above passed, while the deploy package itself was not audited in this lane.
Next route: merge L4/L8 fixes on `main`; record a genuine Russian microphone → `what_changed` → ledger → UI trace with the event key, including browser stop/task visibility. No synthetic transcript or action claim substitutes for that trace.
Gate: RED — live microphone/UI round trip and cross-lane integration remain externally unverified.
tip: 9ee034b
