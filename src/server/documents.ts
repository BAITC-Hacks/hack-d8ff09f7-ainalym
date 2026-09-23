import { randomUUID } from "node:crypto";
import { db, bumpStateVersion, withTx } from "@/db/client";
import { orgId } from "@/server/context";
import { startRun, recordAction, finishRun } from "@/server/ledger";
import { draftsForPackage, matchDocumentToOrder, packageForRoute, type ExtractedDocument, type OrderLine, type SupplyRoute } from "@/domain/documents";

type RawDocument = { id: string; po_id: string | null; supplier_id: string | null; kind: string; source: string; file_name: string | null; mime: string | null;
  sha256: string | null; stored_path: string | null; extracted: string; extraction_mode: string | null; match: string; state: string; created_at: string; version: number };
export function documentById(id: string) {
  const row = db().prepare("SELECT * FROM document WHERE id=?").get(id) as RawDocument | undefined;
  return row ? { ...row, extracted: JSON.parse(row.extracted), match: JSON.parse(row.match) } : null;
}
export function documentsForOrder(po_id: string) {
  const rows = db().prepare("SELECT id FROM document WHERE po_id=? ORDER BY created_at DESC").all(po_id) as { id: string }[];
  return rows.map(row => documentById(row.id)!);
}
export function orderLines(po_id: string): OrderLine[] {
  return db().prepare(`SELECT l.code_1c,l.qty,l.unit_cost,s.article,s.name,s.unit FROM purchase_order_line l
    JOIN sku s ON s.code_1c=l.code_1c WHERE l.po_id=? ORDER BY l.id`).all(po_id) as OrderLine[];
}
export function inferOrder(extracted: ExtractedDocument): { po_id: string; supplier_id: string } | null {
  if (!extracted.lines.length) return null;
  const suppliers = db().prepare("SELECT id,name FROM supplier").all() as { id: string; name: string }[];
  const supplier = suppliers.find(s => extracted.supplier && (extracted.supplier.toLocaleLowerCase("ru-RU").includes(s.name.toLocaleLowerCase("ru-RU")) || extracted.supplier.toLocaleLowerCase("ru-RU").includes(s.id.toLocaleLowerCase("ru-RU"))));
  if (!supplier) return null;
  const orders = db().prepare("SELECT id,supplier_id FROM purchase_order WHERE supplier_id=? ORDER BY id").all(supplier.id) as { id: string; supplier_id: string }[];
  const ranked = orders.map(order => ({ ...order, match: matchDocumentToOrder(extracted, orderLines(order.id)).summary.matched }))
    .sort((a,b) => b.match - a.match);
  return ranked[0]?.match > 0 ? { po_id: ranked[0].id, supplier_id: ranked[0].supplier_id } : null;
}
export function insertDocument(input: { po_id: string | null; supplier_id: string | null; kind: string; source: "upload" | "fixture" | "world_event";
  file_name: string; mime: string; sha256: string; stored_path: string; extracted: ExtractedDocument; extraction_mode: string }) {
  const receipt = input.po_id && input.kind !== "receipt" ? documentsForOrder(input.po_id).find(x => x.kind === "receipt" && x.extracted.lines.length) : null;
  const match = input.po_id ? matchDocumentToOrder(input.extracted, orderLines(input.po_id), receipt ? receipt.extracted.lines.map(x => ({ code_1c: x.code_1c, article: x.article, name: x.name, qty: x.qty })) : undefined) : null;
  const state = input.extraction_mode === "unavailable" ? "received" : match ? match.summary.discrepancies ? "discrepancy" : "matched" : "extracted";
  const id = `DOC-${randomUUID()}`;
  const created_at = new Date().toISOString();
  withTx(tx => {
    tx.prepare(`INSERT INTO document(id,po_id,supplier_id,kind,source,file_name,mime,sha256,stored_path,extracted,extraction_mode,match,state,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,input.po_id,input.supplier_id,input.kind,input.source,input.file_name,input.mime,input.sha256,input.stored_path,
        JSON.stringify(input.extracted),input.extraction_mode,JSON.stringify(match || {}),state,created_at);
    if (input.kind === "receipt" && input.po_id && input.extracted.lines.length) {
      const prior = tx.prepare("SELECT id,extracted,state FROM document WHERE po_id=? AND kind='invoice' AND id<>?").all(input.po_id,id) as
        { id: string; extracted: string; state: string }[];
      for (const old of prior) {
        const refreshed = matchDocumentToOrder(JSON.parse(old.extracted) as ExtractedDocument, orderLines(input.po_id),
          input.extracted.lines.map(x => ({ code_1c: x.code_1c, article: x.article, name: x.name, qty: x.qty })));
        tx.prepare("UPDATE document SET match=?,state=?,version=version+1 WHERE id=?").run(JSON.stringify(refreshed),
          old.state === "accepted" ? "accepted" : refreshed.summary.discrepancies ? "discrepancy" : "matched",old.id);
      }
    }
    const run = startRun({ org_id: orgId(), trigger_type: "document_intake", trigger_ref: id }, tx, false);
    recordAction(run, { kind: "document_extracted", subject_ref: id, po_id: input.po_id || undefined,
      summary_ru: input.extraction_mode === "unavailable" ? `Документ ${input.file_name} сохранён; распознавание недоступно` :
        `Извлечён счёт № ${input.extracted.number || "без номера"}: ${input.extracted.lines.length} строк, ${match?.summary.discrepancies ?? 0} расхождений`,
      sources: [id] }, tx, false);
    finishRun(run, "done", tx, false);
    bumpStateVersion(tx);
  });
  return documentById(id)!;
}
export function routeForSupplier(supplier_id: string): { route: SupplyRoute; route_note_ru: string | null } | null {
  const supplier = db().prepare("SELECT route FROM supplier WHERE id=?").get(supplier_id) as { route: string | null } | undefined;
  if (!supplier) return null;
  if (["domestic", "eaeu", "import"].includes(supplier.route || "")) return { route: supplier.route as SupplyRoute, route_note_ru: null };
  return { route: "eaeu", route_note_ru: "Маршрут задан по умолчанию, уточните у менеджера" };
}
export function packageForOrder(po_id: string) {
  const po = db().prepare(`SELECT p.id,p.supplier_id,s.name AS supplier_name,o.name AS buyer_name
    FROM purchase_order p JOIN supplier s ON s.id=p.supplier_id LEFT JOIN organization o ON o.id=(SELECT id FROM organization LIMIT 1) WHERE p.id=?`).get(po_id) as
    { id: string; supplier_id: string; supplier_name: string; buyer_name: string | null } | undefined;
  if (!po) return null;
  const routeInfo = routeForSupplier(po.supplier_id)!;
  const docs = documentsForOrder(po_id);
  const invoice = docs.find(doc => doc.kind === "invoice" && doc.extraction_mode !== "unavailable");
  const drafts = draftsForPackage(routeInfo.route, { ...po, lines: orderLines(po_id) }, invoice?.extracted as ExtractedDocument | undefined);
  const items = packageForRoute(routeInfo.route).map(item => {
    const kinds: Record<string,string[]> = { payment_invoice: ["invoice"], invoice: ["invoice"], delivery_note: ["delivery_note"], transport: ["transport"], warehouse_receipt: ["receipt"], dt_draft: ["customs"] };
    const found = docs.find(doc => (kinds[item.key] || [item.key]).includes(doc.kind));
    const status = found ? found.state === "discrepancy" ? "discrepancy" : "present" :
      (item.key in drafts || (item.key === "tn_ved" && "dt_draft" in drafts)) ? "draft" : "missing";
    return { ...item, status, ...(found ? { document_id: found.id } : {}) };
  });
  const stage_rail = (["contract", "invoice", "transport", "import", "receipt"] as const).map(stage => {
    const relevant = items.filter(x => x.stage === stage);
    return { stage, state: relevant.some(x => x.status === "discrepancy") ? "discrepancy" : relevant.every(x => x.status === "present") ? "present" :
      relevant.some(x => x.status === "draft") ? "draft" : "missing" };
  });
  return { route: routeInfo.route, route_note_ru: routeInfo.route_note_ru, items, drafts, stage_rail };
}
