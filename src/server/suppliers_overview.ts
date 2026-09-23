import Decimal from "decimal.js";
import { db } from "@/db/client";
import { moneyView } from "@/domain/cashflow";
import { formatAmount } from "@/domain/money";
import { orgId } from "@/server/context";

/** Pure per-supplier aggregation over already-loaded rows; the DB-backed view below feeds it. */
export type SupplierParam = { id: string; name: string; lead_time_days: number; review_days: number; terms: Record<string, unknown>; currency: string };
export type OrderLite = { id: string; supplier_id: string; state: string; total_qty: number; total_cost: string | null; eta: string | null };
export type ProposalLite = { id: string; kind: string; state: string; supplier_id: string | null };
export type TransitLite = { supplier_id: string; qty: string; po_ref: string; expected_at: string | null };
export type CommittedLite = { supplier_id: string; amount: string | null; currency: string; lines: number; cost_known_lines: number };
export type ObligationLite = { supplier_id: string; kind: string; amount: string; currency: string; due_at: string | null };
export type ReplyLite = { supplier_id: string; po_id: string | null; at: string | null; text: string | null };

export type SupplierCard = {
  id: string; name: string; lead_time_days: number; review_days: number; currency: string;
  terms: { prepay_pct: number; balance_pct: number };
  origin_ru: string | null;
  open_orders: { count: number; draft: number; approved: number; exported: number; units: number; ids: string[] };
  proposals_waiting: number;
  in_transit: { units: number; shipments: number; next_eta: string | null };
  committed: { amount: string | null; currency: string; lines: number; cost_known_lines: number } | null;
  next_payment: { kind: string; amount: string; currency: string; at: string | null } | null;
  last_reply: { at: string | null; text: string | null; po_id: string | null } | null;
};

/** Origin is only shown where the owner's data states it; nothing is invented for other suppliers. */
const ORIGIN_RU: Record<string, string> = { IEK: "Россия" };
const OPEN_STATES = new Set(["draft", "approved", "exported"]);

export function aggregateSuppliers(input: { suppliers: SupplierParam[]; orders: OrderLite[]; proposals: ProposalLite[]; transit: TransitLite[]; committed: CommittedLite[]; obligations: ObligationLite[]; replies: ReplyLite[] }): SupplierCard[] {
  return input.suppliers.map(s => {
    const orders = input.orders.filter(o => o.supplier_id === s.id && OPEN_STATES.has(o.state));
    const transit = input.transit.filter(t => t.supplier_id === s.id);
    const units = transit.reduce((sum, t) => sum.plus(new Decimal(t.qty || "0")), new Decimal(0));
    const etas = transit.map(t => t.expected_at).filter((v): v is string => Boolean(v)).sort();
    const committed = input.committed.find(c => c.supplier_id === s.id) ?? null;
    const due = input.obligations.filter(o => o.supplier_id === s.id).sort((a, b) => String(a.due_at ?? "").localeCompare(String(b.due_at ?? "")));
    const replies = input.replies.filter(r => r.supplier_id === s.id).sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")));
    const prepay = Number(s.terms.prepay_pct ?? s.terms.prepayment_pct ?? s.terms.prepayment_percent ?? 30);
    return {
      id: s.id, name: s.name, lead_time_days: s.lead_time_days, review_days: s.review_days, currency: s.currency,
      terms: { prepay_pct: prepay, balance_pct: 100 - prepay },
      origin_ru: ORIGIN_RU[s.id] ?? null,
      open_orders: {
        count: orders.length, draft: orders.filter(o => o.state === "draft").length, approved: orders.filter(o => o.state === "approved").length,
        exported: orders.filter(o => o.state === "exported").length, units: orders.reduce((n, o) => n + Number(o.total_qty || 0), 0), ids: orders.map(o => o.id),
      },
      proposals_waiting: input.proposals.filter(p => p.supplier_id === s.id && p.state === "needs_review" && p.kind !== "param_change").length,
      in_transit: { units: units.toNumber(), shipments: new Set(transit.map(t => t.po_ref)).size, next_eta: etas[0] ?? null },
      committed: committed ? { amount: committed.amount, currency: committed.currency, lines: committed.lines, cost_known_lines: committed.cost_known_lines } : null,
      next_payment: due[0] ? { kind: due[0].kind, amount: formatAmount(new Decimal(due[0].amount)), currency: due[0].currency, at: due[0].due_at } : null,
      last_reply: replies[0] ? { at: replies[0].at, text: replies[0].text, po_id: replies[0].po_id } : null,
    };
  });
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

/** Read-only view: every number is a query over persisted rows, nothing is cached or estimated. */
export async function suppliersOverview(): Promise<{ suppliers: SupplierCard[] }> {
  const d = db();
  const suppliers = (d.prepare("SELECT id,name,lead_time_days,review_days,terms,currency FROM supplier ORDER BY id").all() as Row[]).map(r => {
    let terms: Record<string, unknown> = {};
    try { terms = JSON.parse(String(r.terms || "{}")); } catch { /* terms stay empty; the default 30 % applies */ }
    return { id: String(r.id), name: String(r.name), lead_time_days: Number(r.lead_time_days), review_days: Number(r.review_days), terms, currency: String(r.currency || "KZT") };
  });
  const orders = (d.prepare("SELECT id,supplier_id,state,total_qty,total_cost,eta FROM purchase_order").all() as Row[])
    .map(r => ({ id: String(r.id), supplier_id: String(r.supplier_id), state: String(r.state), total_qty: Number(r.total_qty || 0), total_cost: str(r.total_cost), eta: str(r.eta) }));
  const proposals = (d.prepare("SELECT id,kind,state,subject_type,subject_id,payload FROM proposal WHERE state='needs_review'").all() as Row[]).map(r => {
    let supplier: string | null = null;
    try { const p = JSON.parse(String(r.payload || "{}")) as { supplier_id?: string }; supplier = p.supplier_id ?? null; } catch { /* unreadable payload counts as no supplier */ }
    if (!supplier && r.subject_type === "supplier") supplier = str(r.subject_id);
    return { id: String(r.id), kind: String(r.kind), state: String(r.state), supplier_id: supplier };
  });
  const transit = (d.prepare("SELECT s.supplier_id,t.qty,t.po_ref,t.expected_at FROM in_transit t JOIN sku s ON s.code_1c=t.code_1c").all() as Row[])
    .map(r => ({ supplier_id: String(r.supplier_id), qty: String(r.qty ?? "0"), po_ref: String(r.po_ref ?? ""), expected_at: str(r.expected_at) }));
  const obligations = (d.prepare("SELECT supplier_id,kind,amount,currency,due_at FROM obligation WHERE state='open' AND supplier_id IS NOT NULL").all() as Row[])
    .map(r => ({ supplier_id: String(r.supplier_id), kind: String(r.kind), amount: String(r.amount), currency: String(r.currency || "KZT"), due_at: str(r.due_at) }));
  let replies: ReplyLite[] = [];
  try {
    replies = (d.prepare("SELECT actor_id,po_id,at,text FROM world_event WHERE kind='supplier_reply' AND actor_id IS NOT NULL ORDER BY at DESC").all() as Row[])
      .map(r => ({ supplier_id: String(r.actor_id), po_id: str(r.po_id), at: str(r.at), text: str(r.text) }));
  } catch { replies = []; }
  let committed: CommittedLite[] = [];
  try { committed = (await moneyView(orgId())).committed_by_supplier; } catch { committed = []; }
  return { suppliers: aggregateSuppliers({ suppliers, orders, proposals, transit, committed, obligations, replies }) };
}
