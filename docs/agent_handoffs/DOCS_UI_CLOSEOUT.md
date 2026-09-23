# DOCS-UI closeout — «Документы» + evidence rail (lane/docs_ui, 23.09.2026)

Lane: Fable UI (class C, D-H68 / prep D-H52). Branch `lane/docs_ui`, cut from main `9b3bbb0`. Built against the JSON shapes in `ops/briefs/DOCS_INTAKE_SOL.md` and the real files of `lane/docs_intake` (read only, never merged).

## What was built
- **`/documents`** — nav item «Документы» in the (v2) rail with an attention badge (documents not yet accepted); inbox table (документ · вид · поставщик · заказ · извлечено · расхождения · состояние · дата, two-line cells, money right-aligned); drop zone «Перетащите счёт, накладную или фото — агент извлечёт строки и сверит с заказом» (multipart `POST /api/documents`, jpg/png/webp/pdf/xlsx/csv, «Выбрать файл»); «Загрузить пример» (`POST /api/documents` JSON `{fixture: "iek_invoice_demo.xlsx"}`); j/k row keys; empty, loading, unavailable states.
- **`/documents/[id]`** — two-pane review: left = file card (name, friendly type, size when the API sends it, sha256 prefix; image from this session's upload, table for xlsx/csv, «PDF»/«Фото» card otherwise); right = extracted header (поставщик, № документа, дата, валюта, итого), summary strip (строк совпало · расхождений · по документу vs по заказу), line table (в документе / в заказе / принято на склад / цена док·заказ) with status pills (ok · расхождение по количеству · расхождение по цене · нет в заказе · нет в документе), extraction-mode pill, «Принять» (`POST /api/documents/:id/accept` with version, 409 → stale banner + reload), «Отклонить» (local state + reason in sessionStorage; nothing sent).
- **Order page `(v2)/orders/[po_id]`** — new section «Пакет документов · маршрут: …» (`GET /api/orders/:id/package`): five-stage rail (договор → счёт → транспорт → ввоз → приёмка) with states, checklist with pills (есть / нет / черновик агента / расхождение) and «открыть сверку» links, «Черновики агента — не отправлены» card with a per-draft «Открыть» disclosure (fields + line table, 328.00 for ЕАЭС, ДТ for import). Route chip is a select (`PATCH /api/suppliers/:id {route}`) with the label «маршрут задан по умолчанию, уточните» when the API reports the default.
- **Thin client with fixture fallback** — `src/components/documents/client.ts`: real endpoints first; when the route is absent (404 without `not_found`, network, 5xx) it serves `src/components/documents/fixture.ts` (same shapes, the same synthetic IEK invoice: 10 lines, 60 vs 100 qty discrepancy, one price discrepancy, ЕАЭС package with a 328.00 draft) and every screen says «пример без сервера». No broken state when the API is missing (verified: the screenshots were taken with the intake API absent).

## Files
- New: `src/components/documents/{types.ts,fixture.ts,client.ts,EvidenceRail.tsx,documents.module.css}`, `src/app/(v2)/documents/{page.tsx,DocumentsInbox.tsx}`, `src/app/(v2)/documents/[id]/{page.tsx,DocumentReview.tsx}`, `docs/evidence/ui/documents/{documents_inbox,documents_review,order_evidence_rail}.png`, this file.
- Edited: `src/components/v2/Shell.tsx` (nav item + `docs` count), `src/app/(v2)/orders/[po_id]/SupplierDraft.tsx` (one `<EvidenceRail>` line + import).

## Checks
- `npx tsc --noEmit` — clean (no errors outside stale `.next/types`).
- `npx eslint` on the new/touched files — 0 errors in my files (1 `<img>` warning, same pattern the order page already uses). `Shell.tsx:50` `react-hooks/set-state-in-effect` is pre-existing on main (verified on the main checkout), not introduced here.
- `npm run check` — passed=307 failed=3 skipped=19; the 3 failures are «unable to open database file» / «Run npm run etl» in this fresh worktree (ETL database not loaded); none touch the UI.
- `npm run build` — green; `/documents` (static) and `/documents/[id]` (dynamic) in the route list.
- Evidence: three Playwright screenshots at 1440 px in `docs/evidence/ui/documents/`, taken against the built app with the intake API absent (fixture path).

## Depends on the backend lane (`lane/docs_intake`)
- `POST /api/documents` JSON fixture ingest requires the file name **with extension** (`iek_invoice_demo.xlsx`) — the backend derives the MIME from it; the brief said `iek_invoice_demo`. The client sends the extension.
- `GET /api/documents` without `po_id` answers 400 in the backend; the inbox therefore fans out over `GET /api/orders` → `GET /api/documents?po_id=` (capped at 24 orders). Documents whose order could not be inferred (`po_id = null`) are not listed until the backend adds a list-all — the review page still opens them by id after ingest/upload.
- Image preview: the backend stores files under `data/uploads/` without a serving route, so images show only in the window that uploaded them; other windows get the file card. `size` is not in the document shape; shown when present.
- `route_note_ru` from `GET /api/orders/:id/package` drives the «маршрут задан по умолчанию, уточните» label.

## Leftovers
- The `Shell.tsx` pre-existing lint error (`setOpen(false)` in an effect) is untouched — outside this lane's scope.
- Fan-out for the badge costs one `/api/orders` + N `/api/documents?po_id=` per state revision; a backend list-all makes it one request.
- No e2e spec for the new screens (screenshots only; the 5-minute budget).

Gate: GREEN
