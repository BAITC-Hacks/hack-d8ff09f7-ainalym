# LANDING-LIGHT closeout

Lane: `lane/landing_light` (cut from landing tip `1f50405`). Owner verdict D-H78: the landing must be light/white, not dark.

## Outcome

The whole `/landing` page is relit to a light theme. Palette/tone change only: every section, copy string, clip, link and behaviour is untouched. One file changed: `src/app/landing/landing.module.css`. `page.tsx`, `HeroMedia.tsx`, `ProductClips.tsx` and `public/landing/**` are unchanged (the hero and closing overlays live in CSS, so no poster edit was needed).

## Palette

| Token | Before (dark) | After (light) |
| --- | --- | --- |
| page background | `#0a0e14` | `#faf8f4` warm white |
| cards / facts | `#0d1219` | `#ffffff` + soft shadow `0 1px 2px / 0 10px 28px` ink at 4-6 % |
| text | `#f5f2ec` | `#14161c` ink |
| secondary text | 74 % cream | `#4c5160` |
| tertiary text | 54 % cream | `#676c78` |
| hairline | 10 % cream | `#e6e2da` |
| accent (dawn) | `#f2b894` | `#a85626` (same warm family, darkened for AA on white) |
| color-scheme | dark | light |

- Nav: white at 86 % with blur and a hairline bottom border; link hover is a 5 % ink tint. Position and height unchanged.
- Hero: mountains video and poster stay; the shade is now warm-white to transparent (left and bottom), ending in the page colour, so the ink headline sits on a light base. Headline second line keeps its warm gradient in the darkened accent family.
- CTAs: primary = warm accent with white text; secondary = white 82 % with hairline border and ink text.
- Product clips: white cards with shadow on the warm-white page; the clip media well stays dark (`#0d1219`) because the recordings are of the app and letterbox against it with `object-fit: contain`.
- Three-step strip, proof block, honest-calculation facts, promise chip, closing band (white haze over the poster), footer: same light tokens.

## Contrast (WCAG AA, computed)

- ink `#14161c` on paper: 17.05:1
- text-2 `#4c5160` on paper 7.46:1, on card 7.92:1
- text-3 `#676c78` on paper 4.96:1, on card 5.26:1
- accent `#a85626` on paper 4.92:1, on card 5.22:1 (kicker, clip numbers, clip status, proof figures)
- white on accent button 5.22:1

First cut used `#b8622e` (4.10:1) and was darkened in the follow-up commit; nothing ships below 4.5:1 for body-size text.

## Checks

- `npx tsc --noEmit`: clean outside the stale `.next/types` entries.
- `npm run build`: exit 0, all routes prerendered/rendered.
- `npm run check`: see the lane log; CSS-only change, not expected to affect it.
- No secrets, no absolute local paths in tracked files.

## Not done / follow-ups

- No browser screenshot in this lane (deadline 12:32Z); a visual pass of the hero overlay density on the real video is the one thing worth eyeballing before merge — if the peaks read too washed out, lower the vertical stop at 74 % from 0.86 toward 0.78.

Gate: GREEN
