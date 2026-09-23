# LANDING-POLISH closeout

Date: 2026-09-23. Branch: `lane/landing_video`. Base: `4a47a0f` (clips lane). Completed before the 12:31 UTC hard stop.

Gate: **GREEN** for the requested landing scope.

## Outcome and design context

Audience: owner or purchasing manager of a Kazakhstani electrical-goods distributor. Primary job: understand what to buy, why the quantity is recommended, and how to inspect the demo. This is a first-visit acquisition page, with a short narrative on desktop and a single-column reading flow on phones.

The readiness dimension is truthful, reviewable purchasing value, grounded in `docs/PRODUCT.md`, the current `README.md` methodology and `docs/DATA_DICTIONARY_RU.md`. Current README/data dictionary and the task's explicit 3 909 count supersede the older product document's partial SKU counts. Product records remain the data authority; landing copy does not introduce calculations or change business behavior.

Trust failure to avoid: implying live accounting connections, automatic supplier sending, verified supplier terms, or fabricated financial gains. Anti-metric: extra animation, duplicated buttons or more claims are not evidence of a better landing. Stop boundary: no business logic, backend, shared data, dependency, main-branch or deployment changes.

Craft contract: preserve the mountain imagery, existing typography and dawn accent; show the purchasing outcome, recorded product behavior, three-step mechanism, concrete proof, then human control. One primary CTA; plain Russian; no hover-only information. Ramp's mechanism lens and Stripe's evidence lens informed the review. `frontend-craft` covered review and visual QA; `oil-frontend` covered implementation and motion/state behavior.

## Sections and commits

| Commit | Section / result |
| --- | --- |
| `ffb8dd6` | Hero, workflow and closing: clearer purchasing narrative; exactly one «Открыть демо» linking to `/`; «Как считаем» links to the existing README `#методика-расчёта` anchor; three steps «Файлы 1С → Расчёт → Заказ поставщику»; remove unsupported daily-calculation and supplier-sending promises. |
| `8ce8896` | Proof: 3 909 products, IEK / Systeme Electric, 40–50 days, payment split 30 / 70. Delivery and payment terms explicitly identified as demo settings; missing IEK cost disclosed. |
| `451cf00` | Clips: mouse hover pauses the recording for inspection; leaving resumes it; manual pause persists; warm caption highlight also works with keyboard focus; one-time 280 ms reveal. |
| `e057f49` | Keep the clips lane's product-first section order and autoplay contract. |
| `b40e4ac` | Semantic proof definitions and an honest media-error poster fallback. |
| `12e23dc` | Reserve caption/control space to avoid layout shifts as lazy video controls appear; handle failure of the final video source. |

All transitions and entrance animations are at most 280 ms, without an added delay. Reduced-motion preferences disable the transitions/reveal and retain posters instead of video. Touch users have explicit 44 px playback/fullscreen controls; hovering is optional. Paused video keeps its actual frame visible. Existing clips, mountain assets and fonts are reused unchanged.

## Checks and evidence

- `npx tsc --noEmit`: passed both before and after the production build. No stale `.next/types` exclusions needed.
- `npm run check`: **325 passed, 0 failed, 7 skipped / externally unverified**. Used the clips lane's existing isolated ETL fixture through `DATABASE_PATH`; shared databases were not reset or changed. The seven external provider/microphone gates remain outside this scope.
- `npm run build`: **passed, invoked once**, with `DATABASE_PATH=:memory:`. `/landing` is static. Three existing dynamic-filesystem tracing warnings concern `src/db/path.mjs` and `src/peers/ekt.ts`; those files were untouched.
- `npx eslint src/app/landing`: passed. `git diff --check`: passed.
- Unmodified regression verifier: `node --experimental-strip-types tests/e2e/landing_clips.spec.ts verify http://localhost:3134` against the production server: **PASS**. All five clips play at 1440 and 390 px; dimensions, durations, posters, lazy loading, pause/resume, fullscreen, offscreen pause, initial and live reduced-motion changes pass. Zero runtime errors or horizontal overflow. The verifier emits temporary full-page screenshots. Its existing Node module-type warning is non-fatal.
- Fresh browser inspection additionally verified the new behavior: hover holds the current frame with opacity 1; pointer exit resumes; manual pause survives pointer entry/exit; Enter resumes playback; focused/hovered captions highlight. Exactly one demo CTA points to `/`.
- Screenshots visually inspected at 1440×900 (product and proof), 1280×800 (hero), 1024×768 (three-step strip), and 390×844 (hero, steps, proof, clips and controls). No horizontal overflow at these widths. Phone proof uses two columns; workflow and clips use one. Long Russian labels wrap without clipping.

Review rubric (0–4): comprehension 4; task completion 4; truth/trust 4; hierarchy 4; domain fit 4; visual craft 3; responsive quality 4; accessibility 3; state completeness 3; system coherence 4. Mean 3.7. Accessibility evidence is keyboard operation, focus treatment, 44 px controls and reduced motion; this is not a claim of a full accessibility audit. State evidence covers playing, hover-paused, manually paused, offscreen and reduced-motion views.

## Files changed

- `src/app/landing/page.tsx`
- `src/app/landing/ProductClips.tsx`
- `src/app/landing/landing.module.css`
- `docs/agent_handoffs/LANDING_POLISH_CLOSEOUT.md` — the expressly requested closeout, the sole exception to the landing-only edit scope.

## Leftovers, assumptions and protected surfaces

No requested landing implementation remains. Safari/iOS fullscreen and a deliberately broken media response were not exercised; the latter has an explicit poster fallback. The methodology anchor was verified against the local README and repository remote; anonymous access to the hosted GitHub repository was not verified.

No paid generation, new dependencies, API/business changes, live 1С/Кеден/ЭСФ claims, deployment, merge, external communication or main-branch write. 1С is labeled «файловый обмен». No new media was generated or changed. No secrets, personal names or absolute local paths were added to tracked files.
