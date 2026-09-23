import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { bumpStateVersion, db, dbPath, stateVersion, withTx } from "../db/client";
import { activeOrg, WorldError } from "../world/feed";
import { urgencyLabelRu } from "../domain/urgency";
import { poXlsx } from "./xlsx";

export const EXPORT_LABEL = "Экспорт для 1С (файл)";
export const ONEC_EXPORT_HEADERS = ["Номенклатура.Код", "Номенклатура", "Артикул", "Ед.", "Количество", "Цена", "Поставщик", "Дата поставки (ETA)", "Срочность", "Обоснование"];
interface Order { id: string; state: string; version: number; supplier_id: string; eta: string | null }
interface ExportLine { code_1c: string; article: string | null; name: string; unit: string | null; qty: number; unit_cost: string | null; urgency: string | null; rationale_ru: string | null }
interface PeerRecord { id: string; payload: string; state: string }

export function exportDownloadDisposition(poId: string, format: "csv" | "xlsx"): string {
  const row = db().prepare("SELECT o.supplier_id, p.as_of FROM purchase_order o LEFT JOIN ledger_peer_record p ON p.peer = 'onec_export' AND p.external_identity = o.id WHERE o.id = ?")
    .get(poId) as { supplier_id: string; as_of: string | null } | undefined;
  if (!row) throw new WorldError("unknown_po", 404);
  const supplier = row.supplier_id.replace(/[^A-Za-z0-9_-]/g, "_");
  const day = row.as_of?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const stem = `Заказ_поставщику_${supplier}_${day}`;
  return `attachment; filename="Order_${supplier}_${day}.${format}"; filename*=UTF-8''${encodeURIComponent(`${stem}.${format}`)}`;
}

function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function writeAtomic(path: string, data: string | Buffer) {
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, data);
  renameSync(temp, path);
}

export function exportOrder(poId: string) {
  activeOrg();
  const order = db().prepare("SELECT id,state,version,supplier_id,eta FROM purchase_order WHERE id = ?").get(poId) as Order | undefined;
  if (!order) throw new WorldError("unknown_po", 404);
  const peer = db().prepare("SELECT id,payload,state FROM ledger_peer_record WHERE peer = 'onec_export' AND external_identity = ?").get(poId) as PeerRecord | undefined;
  const existing = peer ? JSON.parse(peer.payload) as { csv_path: string; xlsx_path: string } : null;
  if (existing && existsSync(existing.csv_path) && existsSync(existing.xlsx_path)) {
    return { peer_record_id: peer!.id, po_id: poId, csv_path: existing.csv_path, xlsx_path: existing.xlsx_path, state: "exported" as const, replayed: true, label: EXPORT_LABEL, provenance: "partner_anonymised" as const, ai: "none" as const, external: "export_only" as const, state_version: stateVersion() };
  }
  if (order.state !== "approved" && order.state !== "exported") throw new WorldError("po_not_approved", 403);
  const supplier = db().prepare("SELECT name FROM supplier WHERE id = ?").get(order.supplier_id) as { name: string } | undefined;
  const lines = db().prepare("SELECT l.code_1c, s.article, s.name, s.unit, l.qty, COALESCE(l.unit_cost, s.unit_cost) AS unit_cost, r.urgency, COALESCE(l.rationale_ru, r.rationale_ru) AS rationale_ru FROM purchase_order_line l JOIN sku s ON s.code_1c = l.code_1c LEFT JOIN recommendation r ON r.id = l.recommendation_id AND r.code_1c = l.code_1c WHERE l.po_id = ? ORDER BY l.id")
    .all(poId) as unknown as ExportLine[];
  if (!lines.length) throw new WorldError("empty_po", 422);
  const rows: (string | number)[][] = [ONEC_EXPORT_HEADERS, ...lines.map((line) => [line.code_1c, line.name, line.article ?? "", line.unit ?? "", line.qty, line.unit_cost ?? "", supplier?.name ?? order.supplier_id, order.eta ?? "", urgencyLabelRu(line.urgency), line.rationale_ru ?? ""] as (string | number)[])];
  const slug = `${poId.replace(/[^A-Za-z0-9_-]/g, "_")}-${createHash("sha256").update(poId).digest("hex").slice(0, 8)}`;
  const dir = process.env.EXPORT_DIR || join(dirname(dbPath()), "exports");
  mkdirSync(dir, { recursive: true });
  const csvPath = existing?.csv_path ?? join(dir, `${slug}.csv`);
  const xlsxPath = existing?.xlsx_path ?? join(dir, `${slug}.xlsx`);
  const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
  writeAtomic(csvPath, csv);
  writeAtomic(xlsxPath, poXlsx(rows));
  const peerId = peer?.id ?? `PR-${randomUUID()}`;
  if (!peer) withTx((d) => {
    const now = new Date().toISOString();
    d.prepare("INSERT INTO ledger_peer_record (id,peer,external_identity,kind,payload,version,state,as_of) VALUES (?,?,?,?,?,?,?,?)")
      .run(peerId, "onec_export", poId, "po_file", JSON.stringify({ csv_path: csvPath, xlsx_path: xlsxPath }), order.version, "exported", now);
    d.prepare("UPDATE purchase_order SET state = 'exported', export_path = ?, version = version + 1 WHERE id = ?").run(xlsxPath, poId);
    bumpStateVersion(d);
  });
  return { peer_record_id: peerId, po_id: poId, csv_path: csvPath, xlsx_path: xlsxPath, state: "exported" as const, replayed: Boolean(peer), label: EXPORT_LABEL, provenance: "partner_anonymised" as const, ai: "none" as const, external: "export_only" as const, state_version: stateVersion() };
}
