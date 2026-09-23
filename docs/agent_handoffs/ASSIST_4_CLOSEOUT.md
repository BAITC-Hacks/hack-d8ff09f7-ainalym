# ASSIST-4 closeout — green talk button back, «ИИ-Помощник», follow-ups, typing reveal, product rows (D-H69, D-H70)

Lane: `lane/assist4` (cut from main 98c2902, after VOICE-FIX-2). Fable UI language, non-technical Russian copy, no new dependencies.

## What changed
1. **Big green «Говорить с помощником» button** is back on /assistant, immediately to the right of the send button (`--v2-ok` green, pill, shadow). Click starts the voice session inside the click handler (audio unlock stays in the click stack — VOICE-FIX-1); while live the same button shows the mini sound wave + «Завершить». The compact mic on/off toggle (D-H65) stays for muting inside a live session. Esc still ends the session.
2. **«Помощник» → «ИИ-Помощник»** across the (v2) shell: sidebar nav (both nav tables), /assistant page title + h1 + region label, chat-sheet dialog label + header, panel header, settings/connections mentions, landing section copy. Route stays /assistant. README untouched (docs lane).
3. **Follow-ups and one clarifying question.**
   - Rules answers (`src/server/assistant_answers.ts`): `clarifyingQuestion()` asks ONE short question for high-stakes / under-specified requests (approve / pay / send without an order in scope; «закажи» without supplier or item; «закажи» on an item without a quantity). `followUpsFor()` ends every answer with 1–2 deterministic, data-tied offers («Почему столько по коду …?», «Что если в пути +10 по коду …?», «Что срочно в этом заказе?», …) — every chip text is a question the rules engine answers when sent back.
   - Chips render under the last answer on /assistant and in the chat sheet; click sends the text as the next user turn. Voice tool-result cards and error cards get the default pair («Что срочно?», «Что нужно от меня?»).
   - Voice: realtime instructions now demand exactly one short clarifying question for ambiguous / approval / payment / sending requests, and a closing sentence with 1–2 concrete next steps; the spoken summary shape (VOICE-FIX-2) ends with the same short offer instead of a generic «next step».
4. **Typing reveal** (`Reveal.tsx` + `reveal.module.css`): every fresh answer (rules fallback included) fades in word by word at 32 ms/word (cap 2.4 s), pure CSS — no timers, no layout shift, respects `prefers-reduced-motion`. Follow-up chips land right after the reveal finishes. Answers restored from storage render instantly.
5. **Proactive opener**: on /assistant with an empty thread the surface asks the rules engine one context-aware question (urgent / pay week / why this order / why this qty) and shows its first sentence as «… — показать?»; the chip sends that question as the first turn. Nothing is pushed into the thread without a click.
6. **Product rows with images**: answer items that are goods carry `code` + `image` (existing `skuImageUrl`, IEK/SE fixtures); `ResultCard` renders them as a compact row — 36 px thumbnail (neutral tile when missing), name, «Код …», key figure. Applied to «что срочно» rows and the «почему столько» card.

## Files
- `src/components/assistant/AssistantSurface.tsx` — green talk button, follow-up chips, greeting, reveal, rename
- `src/components/assistant/AssistantDock.tsx` — follow-up chips, reveal, rename
- `src/components/assistant/ResultCard.tsx` — word reveal on prose, product rows
- `src/components/assistant/Reveal.tsx`, `src/components/assistant/reveal.module.css` — new
- `src/components/assistant/surface.module.css`, `src/components/assistant/assistant.module.css` — `.talk`, `.greet`, `.followRow`, `.product/.thumb`
- `src/components/assistant/types.ts` — `followups`, item `image`/`code`
- `src/server/assistant_answers.ts` — `clarifyingQuestion`, `followUpsFor`, `clarify` kind, images on items
- `src/app/api/voice/session/route.ts`, `src/voice/summary.ts` — instructions
- `src/components/shell/navigation.ts`, `src/components/v2/Shell.tsx`, `src/app/(v2)/assistant/page.tsx`, `src/components/assistant/AssistantPanel.tsx`, `src/app/(v2)/settings/SettingsPage.tsx`, `src/components/connections/ConnectionsPage.tsx`, `src/app/landing/page.tsx`, `tests/e2e/assist.spec.ts` — rename
- `tests/ui/assistant_followups.test.ts` — new unit test (clarify + follow-ups)

## Checks
- `npx tsc --noEmit` — exit 0, 0 errors.
- `npm run check` — `check: passed=327 failed=0 skipped=7 externally-unverified=7` (fresh worktree needed `npm run etl` once for the local DB; three earlier failures were only that missing DB).
- `npm run build` — exit 0, compiled; 3 pre-existing Turbopack «dynamic filesystem access» warnings.
- New vitest: 2/2 passed.

## Leftovers / unverified
- Playwright e2e (`tests/e2e/assist.spec.ts`) not executed in this lane (needs a running server); the rename in the spec matches the new labels.
- «Что срочно?» without scope answers for the whole warehouse (data-tied) and narrows via chips rather than blocking the most common chip with a question — a judgement call; approval / payment / sending / «закажи» requests do get the clarifying question.
- Live voice behaviour (clarifying question, closing offer) follows instruction text; not exercised against the realtime provider here.
- Follow-ups for the Jev/LLM text path are the same deterministic templates (the ask route runs the rules engine); no LLM-generated chips yet.

Gate: GREEN
