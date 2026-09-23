import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { db, dbPath, stateVersion } from "@/db/client";
import { extractDeterministic, packageForRoute, type ExtractedDocument } from "@/domain/documents";
import { extractWithModel, replayExtraction } from "@/ai/extract";
import { documentsForOrder, ensureDocumentsDemoOrder, inferOrder, insertDocument, listDocuments } from "@/server/documents";

export const runtime = "nodejs";
const limit = 10 * 1024 * 1024;
const mimes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv", "application/csv", "text/plain"]);
const extensionMime: Record<string,string> = { xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv", txt: "text/plain", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };
const kinds = new Set(["invoice", "delivery_note", "transport", "receipt", "customs", "other"]);
const packageKeys = new Set((["domestic", "eaeu", "import"] as const).flatMap(route => packageForRoute(route).map(item => item.key)));
const bad = (message: string, status = 400) => Response.json({ ok: false, code: "invalid_document", message }, { status });

export async function POST(request: Request): Promise<Response> {
  const length = Number(request.headers.get("content-length"));
  if (length > limit + 100_000) return bad("Файл превышает 10 МБ");
  let buffer: Buffer, name: string, mime: string, po_id: string | null = null, kind = "invoice", package_key: string | null = null, source: "fixture" | "upload";
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json() as { fixture?: unknown; po_id?: unknown; kind?: unknown; package_key?: unknown };
      if (typeof body.fixture !== "string" || basename(body.fixture) !== body.fixture || body.fixture.startsWith(".")) return bad("Неизвестный демонстрационный документ");
      name = body.fixture;
      mime = extensionMime[name.split(".").pop()?.toLowerCase() || ""] || "";
      if (!mimes.has(mime)) return bad("Формат документа не поддерживается");
      try { buffer = readFileSync(join(process.cwd(), "fixtures", "documents", name)); }
      catch { return bad("Демонстрационный документ не найден", 404); }
      po_id = typeof body.po_id === "string" ? body.po_id : null;
      kind = typeof body.kind === "string" ? body.kind : "invoice";
      package_key = typeof body.package_key === "string" ? body.package_key : null;
      source = "fixture";
    } else {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return bad("Добавьте файл документа");
      if (file.size > limit) return bad("Файл превышает 10 МБ");
      name = basename(file.name);
      mime = file.type || extensionMime[name.split(".").pop()?.toLowerCase() || ""] || "";
      buffer = Buffer.from(await file.arrayBuffer());
      po_id = typeof form.get("po_id") === "string" ? String(form.get("po_id")) : null;
      kind = typeof form.get("kind") === "string" ? String(form.get("kind")) : "invoice";
      package_key = typeof form.get("package_key") === "string" ? String(form.get("package_key")) : null;
      source = "upload";
    }
  } catch { return bad("Не удалось прочитать документ"); }
  if (buffer.length > limit) return bad("Файл превышает 10 МБ");
  if (!mimes.has(mime)) return bad("Формат документа не поддерживается");
  if (!kinds.has(kind)) return bad("Тип документа не поддерживается");
  if (package_key && !packageKeys.has(package_key)) return bad("Пункт пакета документов не поддерживается");
  const po = po_id ? db().prepare("SELECT supplier_id FROM purchase_order WHERE id=?").get(po_id) as { supplier_id: string } | undefined : undefined;
  if (po_id && !po) return bad("Заказ не найден", 404);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  let extracted: ExtractedDocument, extraction_mode: "deterministic" | "replay" | "openai" | "unavailable";
  if (["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv", "application/csv", "text/plain"].includes(mime)) {
    try { extracted = extractDeterministic(buffer, mime); extraction_mode = "deterministic"; }
    catch { return bad("Таблицу не удалось прочитать: проверьте формат и заголовки"); }
  } else {
    const replay = replayExtraction(sha256);
    const result = replay || await extractWithModel(buffer, mime);
    extracted = result.extracted; extraction_mode = result.extraction_mode;
  }
  let inferred = po_id ? null : inferOrder(extracted);
  // Fixture without any matching order (fresh demo host): seed the synthetic IEK order and match against it.
  if (!po_id && source === "fixture" && (!inferred || inferred.ratio < 0.5)) { ensureDocumentsDemoOrder(); inferred = inferOrder(extracted); }
  po_id ||= inferred?.po_id || null;
  const supplier_id = po?.supplier_id || inferred?.supplier_id || null;
  // Uploads live next to the database (the only writable place on the demo host), never inside the release tree.
  const directory = join(dirname(dbPath()), "uploads");
  mkdirSync(directory, { recursive: true });
  const relative = join("uploads", randomUUID());
  const stored_path = join(directory, basename(relative));
  try {
    writeFileSync(stored_path, buffer, { flag: "wx", mode: 0o600 });
    const document = insertDocument({ po_id, supplier_id, kind, source, file_name: name, mime, sha256, stored_path: relative,
      size_bytes: buffer.length, extracted, extraction_mode, package_key });
    return Response.json({ ok: true, document, state_version: stateVersion() }, { status: 201 });
  } catch {
    try { unlinkSync(stored_path); } catch { /* no file to clean */ }
    return Response.json({ ok: false, code: "document_storage_failed", message: "Документ не сохранён" }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<Response> {
  const po_id = new URL(request.url).searchParams.get("po_id");
  // Without po_id: the whole inbox (newest first, bounded) — one request instead of a per-order fan-out.
  return Response.json({ ok: true, documents: po_id ? documentsForOrder(po_id) : listDocuments(), state_version: stateVersion() });
}
