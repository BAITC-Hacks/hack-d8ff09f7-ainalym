# VOICE-FIX-2 — lane/voicefix2
1. Spoken tool follow-up: `src/voice/useVoiceSession.ts:198`, `src/voice/summary.ts:3,36` send one short audio response with transcript per accepted call ID within the two-response cap in `src/voice/transport.ts:45`.
2. Compact model JSON: `src/voice/summary.ts:22` sends `{total,top_items:[{name,qty,unit,urgency}]≤3,reason?,next_step}`; the full result stays in the UI event at `src/voice/useVoiceSession.ts:186`.
3. Additive card `render`: `src/voice/tools.ts:11,81,98,120,141` supplies `queue` (approvals or changes), `sku_explain`, and `calc_result`; `urgent_list` and `cashflow` are reserved. Event: `src/voice/useVoiceSession.ts:186`; contract: `docs/CONTRACTS.md:102`.
4. No filler and tool-first response: `src/app/api/voice/session/route.ts:17`, `src/voice/useVoiceSession.ts:127`.
5. Russian transcription and script/noise filter: `src/app/api/voice/session/route.ts:29`, `src/voice/transport.ts:32`.
6. Audio resumes for each response and track: `src/voice/useVoiceSession.ts:92,102,234`.
7. Tests: `tests/voice/state_machine.test.tsx:12`, `tests/voice/summary.test.ts:4`, `tests/voice/interruption.test.ts:44`, plus session/tools tests; duplicate call, full UI card, compact spoken facts, Korean noise, and repeat playback pass.
8. Checks: `npm run etl && npm run check` 321 passed, 0 failed; `npm run build` passed; `npx tsc --noEmit` clean. Realtime uses supported `output_modalities:["audio"]`, which includes a text transcript; live microphone/provider playback was not exercised.
Gate: GREEN (local gates and client event tests).
