import { randomUUID } from "node:crypto";
import { composeEvent } from "../world/compose";
import { activeOrg, WorldError, type WorldRow } from "../world/feed";
import { bumpStateVersion, db, stateVersion, withTx } from "../db/client";

export type SupplierChannelState = "draft" | "sent" | "confirmed";
const LABELS: Record<SupplierChannelState, string> = {
  draft: "Draft",
  sent: "Sent (controlled demo channel)",
  confirmed: "Confirmed",
};

interface PurchaseOrderRow { id: string; supplier_id: string; supplier_name: string; state: string; total_qty: number; eta: string | null; version: number }
interface PurchaseOrderLine { code_1c: string; article: string | null; name: string; qty: number; rationale_ru: string | null }
interface PeerRow { id: string; state: SupplierChannelState; payload: string; as_of: string }

export function supplierChannel(poId: string) {
  activeOrg();
  const order = db().prepare("SELECT po.*, s.name AS supplier_name FROM purchase_order po JOIN supplier s ON s.id = po.supplier_id WHERE po.id = ?")
    .get(poId) as PurchaseOrderRow | undefined;
  if (!order) throw new WorldError("unknown_po", 404);
  const lines = db().prepare("SELECT l.code_1c, sk.article, sk.name, l.qty, l.rationale_ru FROM purchase_order_line l JOIN sku sk ON sk.code_1c = l.code_1c WHERE l.po_id = ? ORDER BY l.id")
    .all(poId) as unknown as PurchaseOrderLine[];
  const peer = db().prepare("SELECT * FROM ledger_peer_record WHERE peer = 'supplier_channel' AND external_identity = ?").get(poId) as PeerRow | undefined;
  const state = peer?.state ?? "draft";
  const payload = peer ? JSON.parse(peer.payload) as { reply_text?: string; event_id?: string } : {};
  return {
    order, lines,
    channel: { state, label: LABELS[state], provenance: "synthetic" as const, ai: "none" as const, external: "local_simulator" as const, as_of: peer?.as_of ?? null, reply_text: payload.reply_text ?? null, event_id: payload.event_id ?? null },
    state_version: stateVersion(),
  };
}

export async function supplierReply(poId: string, input: { action: "send_demo" | "confirm"; text?: string }): Promise<ReturnType<typeof supplierChannel> & { event?: WorldRow; replayed?: boolean }> {
  const current = supplierChannel(poId);
  if (input.action === "send_demo") {
    if (current.order.state !== "approved" && current.order.state !== "exported") throw new WorldError("po_not_approved", 403);
    if (current.channel.state !== "draft") return { ...current, replayed: true };
    withTx((d) => {
      const now = new Date().toISOString();
      d.prepare("INSERT INTO ledger_peer_record (id,peer,external_identity,kind,payload,state,as_of) VALUES (?,?,?,?,?,?,?) ON CONFLICT (peer,external_identity) DO NOTHING")
        .run(`PR-${randomUUID()}`, "supplier_channel", poId, "order_email", "{}", "sent", now);
      bumpStateVersion(d);
    });
    return supplierChannel(poId);
  }
  if (input.action !== "confirm") throw new WorldError("invalid_action", 400);
  if (current.channel.state === "draft") throw new WorldError("channel_not_sent", 409);
  const text = input.text ?? `Подтверждаем получение заказа ${poId}.`;
  if (current.channel.state === "confirmed" && current.channel.reply_text !== text) throw new WorldError("already_confirmed", 409);
  const result = await composeEvent({ kind: "supplier_reply", actor_id: current.order.supplier_id, po_id: poId, text, payload: { po_id: poId, confirmation: true } });
  if (current.channel.state !== "confirmed") {
    withTx((d) => {
      d.prepare("UPDATE ledger_peer_record SET state = 'confirmed', payload = ?, version = version + 1, as_of = ? WHERE peer = 'supplier_channel' AND external_identity = ? AND state = 'sent'")
        .run(JSON.stringify({ reply_text: text, event_id: result.event.id }), new Date().toISOString(), poId);
      bumpStateVersion(d);
    });
  }
  return { ...supplierChannel(poId), event: result.event, replayed: result.replayed };
}
