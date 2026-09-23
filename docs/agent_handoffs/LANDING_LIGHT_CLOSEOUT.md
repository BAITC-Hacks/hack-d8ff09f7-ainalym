# LANDING-LIGHT closeout

Lane: `lane/landing_light` (cut from landing tip `1f50405`). Owner verdict D-H78: the landing must be light/white, not dark; then (12:26Z) the hero loop and white design must match the owner reference prototype, plus a clips scroll story and copy additions.

## Commits, in order

1. `5b97ed6` relight to a light theme (palette only; first cut used a warm accent).
2. `50e6075` accent darkened for WCAG AA; first closeout.
3. `9431b39` clips as a scroll story + owner copy items (B1-B4).
4. `f5cacef` hero brand loop assets + white design tokens from the owner reference prototype.
5. this commit: closeout rewrite.

## Files changed

- `src/app/landing/landing.module.css` - tokens, hero, nav, sections, clips layout, reveal, responsive rules.
- `src/app/landing/HeroMedia.tsx` - new poster + mp4/webm sources, phone mp4 under 650px (`key` remount on breakpoint change), autoplay muted/loop/playsInline kept; reduced motion = still only.
- `src/app/landing/ProductClips.tsx` - one attribute: `data-inview` from the existing IntersectionObserver.
- `src/app/landing/page.tsx` - copy items, step 04, proof tile, closing block, closing poster dimensions.
- `public/landing/hero/` - `hero-brand.mp4`, `hero-brand-720.mp4`, `hero-brand.webm`, `hero-brand-poster.webp` copied from the owner reference prototype (3.1 MB total). The old `mountains.*` files remain on disk but are no longer referenced.
- `docs/agent_handoffs/LANDING_LIGHT_CLOSEOUT.md` - this file.

## Design (matching the owner reference prototype)

Tokens: page `#fdfdfc`, surface `#fff`, inset `#f8f9fa`, ink `#111417`, muted `#626e86`, hairline `#eff0f1`, interactive border `#899398`, lime accent `#dff25d` / hover `#d3e84b` / accent text `#182003`, focus ring `#236bd1`, panel radius 8px, header 56px, container 1280px, shadow `0 8px 28px` navy at 12 %.

- Nav: white, 56px, hairline bottom, 14px links (still absolute over the hero, not fixed - no structural change).
- Hero: dark base `#0c1520`, brand loop scaled 1.15 from the bottom edge like the reference, white h1 (48-68px, -0.03em), uppercase 12px eyebrow in `#dde2ea`, lead in `#dde2ea`, lime primary + outlined white secondary; a light dark gradient at the bottom keeps the copy legible while the loop plays.
- Sections: uppercase muted kickers, ink headings, muted leads; white cards with hairline + shadow at 8px radius; promise chip on the inset grey; footer light.
- Clips: scroll story - one row per clip, media 60 % / caption 40 %, sides alternating per row, 96-120px between rows, 30 %-opacity + 20px rise until the row is in view (existing observer, threshold 0.15), stacked with 56px gaps on phones. Reduced motion: rows fully visible, no transition.
- Closing band: the new poster under a white haze, ink title.

## Copy (hyphens, no em-dashes in the new strings)

- Hero eyebrow «Операционная система импорта и закупок»; h1 unchanged; new line under the lead «Белый импорт должен быть таким же простым, как заказать доставку.»
- Step 04 «Документы» added (steps grid 4 columns, 2 on tablets, 1 on phones).
- Proof tile «Данные демо» - «249 тыс. строк продаж» / «12 файлов партнёра» (grid 5 columns, 2 on tablets).
- Closing block «Куда это ведёт» inside the existing closing section (no new section).

## Contrast (WCAG AA, computed)

- ink on paper 18.16:1; muted `#626e86` on paper 5.04:1, on card 5.13:1
- lime button text 13.63:1
- hero lead `#dde2ea` on the hero base 14.11:1; hero white 18.36:1 (the gradient makes the real surface darker where the copy sits)

## Checks

- `npx tsc --noEmit`: clean outside the stale `.next/types` entries (after every commit).
- `npm run build`: compiled successfully, 50/50 static pages (after f5cacef); the three "dynamic filesystem access" tracing warnings pre-exist.
- `npm run check` (after 50e6075): passed=311 failed=3 skipped=19 externally-unverified=7 - the 3 failures are the lane-independent baseline, not touched by this CSS/copy work; not re-run after the later commits (deadline).
- No secrets, no absolute local paths in tracked files.

## Not verified / follow-ups

- No browser screenshot in this lane (deadline 12:34Z). Worth one visual pass: hero copy legibility over the brand loop's brightest frames (raise the bottom gradient stop from 0.66 if needed), and the alternating clip rows at 1024-1280px.
- The reference uses Inter Variable; this lane did not add a font file (assets were limited to the hero), so the app's existing font stack applies.
- `public/landing/mountains.*` are now unreferenced and can be deleted in a follow-up.

Gate: GREEN
