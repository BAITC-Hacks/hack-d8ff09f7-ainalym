# L5 voice evidence (2026-09-23)

- `npm run check -- voice` after L2a/L2b merge: 17 passed, 0 failed, 2 externally unverified. `tests/voice/tools.test.ts` runs the real `runCalculation` service and observes one `calc_run`, one `proposal`, and one durable `task` after concurrent duplicate delivery; it checks stale state rejection, supplier scope, and the persisted SKU explanation.
- `npm run build`: GREEN; `npx tsc --noEmit`: GREEN after build.
- `tests/voice/session.test.ts`: missing key returns `503` with `label:"Provider unavailable"`; mocked mint requests provider TTL 50 seconds, returns actual expiry and four tool definitions, rejects provider expiry over 60 seconds, and exposes no standard key.
- Ephemeral token creation sends a stable, hashed safety identifier for the shared demo guest, as required by the current OpenAI WebRTC guide; `tests/voice/session.test.ts` asserts its shape without exposing the key.
- Local HTTP check with `OPENAI_API_KEY='' PORT=3335 npm run dev` then `curl -X POST http://localhost:3335/api/voice/session`: HTTP `503`, `code:"provider_unavailable"`, `label:"Provider unavailable"`. The dev server was stopped after the check.
- Session, transcription and typed intent reserve the existing live-demo budget before each provider call. `tests/voice/session.test.ts` confirms exhausted budget makes no provider request.
- `tests/voice/interruption.test.ts`: scripted response creation, interruption and late completion abort a pending request and drop the late call; a late transcript from an earlier input item is not reused for a calculation.
- `tests/voice/fallback.test.ts`: no-key typed status answer comes from a persisted ledger action; missing-key transcription returns no transcript; mocked provider transcript is stored once with `medium:"voice_note"`.
- Partner ETL check via `node scripts/etl/load.mjs --db <temporary-db>`: `organization=0`, `supplier=2`, `sku=3909`. Voice scope deliberately rejects an absent organization; upstream ETL/reset must insert the contract organization row before a partner-data round-trip can pass.
- `tests/voice/partner.test.ts`: ETL into a disposable SQLite file, then a temporary contract organization row, then `recommend_for` on a real anonymised SE SKU → one persisted `calc_run`. This isolates the missing organization row from the working engine bridge.
- Live Russian microphone/WebRTC round-trip and UI task visibility: externally unverified; L4 panel and L1 state/ledger routes were not present at this checkpoint. No OpenAI product call was made to build or test.
- L4 panel landed on `main`; the hook now dispatches `ainalym:voice-tool-result` after a confirmed tool HTTP result so its result card can use the same backend result. L4 still needs to subscribe; the UI acceptance gate is not claimed.

Official OpenAI Docs checked: [WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc), [Realtime conversations and function calls](https://developers.openai.com/api/docs/guides/realtime-conversations), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [file transcription](https://developers.openai.com/api/docs/guides/speech-to-text).
