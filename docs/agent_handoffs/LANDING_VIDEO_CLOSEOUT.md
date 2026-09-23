# Landing product clips — closeout

Date: 2026-09-23. Branch: `lane/landing_video`. Gate: **GREEN** for this landing scope.

## Delivered

Five real Playwright `recordVideo` captures from the authenticated live demo, each 1280×800, silent and approximately nine seconds. Every video and poster is below 2,500,000 bytes. MP4 uses H.264, CRF 28, `veryfast`, YUV420p and fast-start; the VP8 WebM is retained. All videos decode successfully. Only initial page loading was trimmed; playback is not accelerated, and no assistant waiting interval needed removal.

All filenames below are under `public/landing/clips/`. Sizes are exact bytes.

| Clip | WebM file / bytes / seconds | MP4 file / bytes / seconds | PNG poster / bytes | Clip commit |
| --- | --- | --- | --- | --- |
| Сегодня | `today.webm` / 983057 / 9.00 | `today.mp4` / 378144 / 9.00 | `today.png` / 110353 | `fe70e79` |
| Закупки | `purchases.webm` / 1177889 / 9.00 | `purchases.mp4` / 551534 / 8.96 | `purchases.png` / 236891 | `ddd5ca2` |
| Заказ поставщику | `order.webm` / 782888 / 9.00 | `order.mp4` / 186587 / 9.00 | `order.png` / 179942 | `e1c179e` |
| Деньги | `money.webm` / 991883 / 9.00 | `money.mp4` / 512161 / 8.96 | `money.png` / 165378 | `ca347a9` |
| ИИ-Помощник | `assistant.webm` / 704460 / 9.00 | `assistant.mp4` / 150223 / 9.00 | `assistant.png` / 141361 | `4f5ba0a` |

The first clip shows stock value, stockout risk, the cash-outflow chart and urgent lines. Purchases shows the replenishment explanation, adding a line, and cart totals including prepayment. Order shows the existing supplier draft's line table and approval button. Money shows the 60-day payment schedule. Assistant shows a typed question and the actual structured answer, using exactly one assistant endpoint request.

## Landing section

`Что делает Ainalym` is the first section after the hero. One wide overview card precedes four workflow cards; the grid becomes one column on phones. Each card has a two-part Russian value caption, poster, MP4/WebM sources and `autoplay muted loop playsinline preload="metadata"`. The existing mountain imagery, typography and dawn palette remain in use.

An IntersectionObserver attaches videos only after their cards enter view and pauses playback offscreen. Reduced-motion users receive posters without downloading the clips, including when the preference changes after loading. Each active card provides pause/resume and fullscreen controls. No dependencies were added.

## Verification

- `npx tsc --noEmit`: passed, including generated Next types; no stale-type exclusion was needed.
- `npm run check`: **325 passed, 0 failed, 7 skipped / externally unverified**. These existing external gates cover provider/microphone scenarios outside the landing scope.
- Check setup: the worktree had no ETL database. An isolated SQLite backup of the existing fixture was made, then current `scripts/etl/derive.mjs` was run on that backup. `DATABASE_PATH` selected this disposable snapshot for `npm run check`. The initial missing-database failures and the older snapshot's stockout-derivation failure were resolved by fixture preparation; no test, engine or shared database was changed.
- `npm run build`: passed, run once with `DATABASE_PATH=:memory:`; `/landing` was prerendered.
- Scoped ESLint and `git diff --check`: passed.
- Production-server Playwright checks at 1440×900 and 390×900: all five videos load and play; correct dimensions, duration and media attributes; posters load; zero clip video requests before scrolling; pause/resume; fullscreen; offscreen pause; reduced motion both initially and after a preference change; no horizontal overflow or browser runtime errors.
- Visually inspected desktop and phone full-page layouts, all five posters, and sampled beginning/middle/end frames for every clip. FFmpeg decoded both formats of every clip and confirmed no audio streams; every PNG is 1280×800.

Reproduce the browser verification against a running server:

```sh
node --experimental-strip-types tests/e2e/landing_clips.spec.ts verify http://localhost:3133
```

Recording is opt-in through the same script's `record` command. Demo authentication uses environment variables and an in-memory cookie. A temporary exclusive marker limits the assistant to one request across recording invocations; the recorder blocks other application writes.

## Deviations and protected surfaces

- The live demo has no opening cash balance and incomplete costs. Recordings preserve those labels; captions describe payment timing and missing data rather than claim that solvency is known.
- The live review flow differs from the local proposal-review route: the clip uses the existing priced SE draft at `/orders/[order]`, where its lines and `Утвердить заказ` are visible together.
- During initial live-flow inspection, `Подготовить заказ` created one internal IEK draft. It remains a draft. No order was approved, no payment obligation was created by this work, and nothing was sent to a supplier. The recorded review uses a pre-existing SE draft.
- No deployment, merge, main-branch write, settings change, database reset or extra AI request was performed. No credentials, owner names or absolute local paths are tracked.
- Browser verification used Chromium. Safari/iOS-specific fullscreen behavior remains unverified. No Remotion setup was needed.

## File inventory

The fifteen media files are individually named in the table above. Other changed files:

- `public/landing/clips/manifest.json` — dimensions, WebM duration, file sizes and request count.
- `src/app/landing/ProductClips.tsx` — card content, playback and accessibility behavior.
- `src/app/landing/page.tsx` — section placement after the hero.
- `src/app/landing/landing.module.css` — card grid, captions, controls and responsive styles.
- `tests/e2e/landing_clips.spec.ts` — reproducible recorder and production-browser verification.
- `docs/agent_handoffs/LANDING_VIDEO_CLOSEOUT.md` — this explicitly requested closeout.

No landing deliverables remain. The internal inspection draft and existing external-check limitations are recorded above.
