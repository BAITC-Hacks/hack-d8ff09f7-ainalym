# VOICE-FIX-1 closeout
1. SKU: `src/server/sku_lookup.ts:14` resolves trim → exact → underscore → prefix → article → name within scope; `src/voice/tools.ts:56,138` uses canonical codes in status, explanation, and calculation.
2. Loop: `src/voice/transport.ts:41` tracks call IDs and caps automatic replies at two per turn; `src/voice/useVoiceSession.ts:94,126,181` resets on input and sends one reply per handled tool result; `src/app/api/voice/session/route.ts:17` adds the exact Russian instruction.
3. Audio: `src/voice/useVoiceSession.ts:78,186,196` starts playback in the click stack, exposes `audioBlocked` and `enableAudio()`, and attaches the remote stream on track.
4. UI handoff: in `src/components/assistant/AssistantPanel.tsx`, render `{voice.audioBlocked && <button onClick={voice.enableAudio}>Включить звук</button>}`; that file belongs to the assistant lane.
5. Budget: `src/server/demo_guard.ts:125`, `src/app/api/voice/turn/route.ts:5`, and `src/app/api/voice/session/route.ts:23` reserve once per committed user turn; tool follow-ups spend no extra unit.
6. Root reset on the box: point `GUARD_DB` at `demo_guard.db` beside the configured database, then run `sqlite3 "$GUARD_DB" "DELETE FROM demo_daily_budget WHERE day = date('now');"`; restart alone does not reset this persistent row.
7. Tests: `tests/voice/sku_lookup.test.ts`, `tools.test.ts`, `interruption.test.ts`, `audio.test.tsx`, `session.test.ts`, and `tests/demo/guard.test.ts` cover real ETL data, canonical tools, response cap, audio retry, VAD, and turn idempotence.
8. Checks: `npm run etl && npm run check` GREEN; `npm run build` and `npx tsc --noEmit` clean.
9. Remaining: hosted microphone round-trip and assistant-lane button wiring are unverified here; no box changes made.
Gate: YELLOW
