# Brand evidence — curl of built HTML (next build && next start, 2026-09-23T10:26Z)

Shells: AppShell (/today), Fable v2 Shell (/v2/money — /v2/today is not a route on main), opus_a (/opus_a/today), opus_b (/opus_b/today). Favicon: src/app/icon.svg (app-router convention); src/app/favicon.ico removed (/favicon.ico -> 404, /icon.svg -> 200 image/svg+xml).

## /today (HTTP 200)
```html
<title>Сегодня · Ainalym</title>
<link rel="icon" href="/icon.svg?icon.2h0snza2f3f51.svg" sizes="any" type="image/svg+xml"/>
<img src="/brand/ainalym-mark.svg" alt="" width="24" height="24" class="shell-module__aN5Q9a__brandMark"/>
```
Cyrillic brand present: 0

## /v2/money (HTTP 200)
```html
<title>Деньги · Ainalym</title>
<link rel="icon" href="/icon.svg?icon.2h0snza2f3f51.svg" sizes="any" type="image/svg+xml"/>
<img src="/brand/ainalym-mark.svg" alt="" width="20" height="20" class="shell-module__eI7a1q__mark"/>Ainalym
```
Cyrillic brand present: 0

## /opus_a/today (HTTP 200)
```html
<title>Сегодня (вариант A) · Ainalym</title>
<link rel="icon" href="/icon.svg?icon.2h0snza2f3f51.svg" sizes="any" type="image/svg+xml"/>
<img src="/brand/ainalym-mark.svg" alt="" width="22" height="22" class="oa-brand-mark"/>Ainalym
```
Cyrillic brand present: 0

## /opus_b/today (HTTP 200)
```html
<title>Сегодня · вариант B · Ainalym</title>
<link rel="icon" href="/icon.svg?icon.2h0snza2f3f51.svg" sizes="any" type="image/svg+xml"/>
<img src="/brand/ainalym-mark.svg" alt="" width="22" height="22" class="shell-module__8jq23q__brandDot"/>Ainalym
```
Cyrillic brand present: 0

