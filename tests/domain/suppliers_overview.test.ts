import { describe, expect, it } from "vitest";
import { aggregateSuppliers } from "../../src/server/suppliers_overview";

const suppliers = [
  { id: "IEK", name: "IEK", lead_time_days: 40, review_days: 30, terms: { prepay_pct: 30 }, currency: "KZT" },
  { id: "SE", name: "System Electric", lead_time_days: 50, review_days: 30, terms: {}, currency: "KZT" },
];

describe("suppliers overview aggregation", () => {
  it("counts open orders, sums transit units per supplier and carries committed money", () => {
    const cards = aggregateSuppliers({
      suppliers,
      orders: [
        { id: "PO-1", supplier_id: "IEK", state: "draft", total_qty: 120, total_cost: null, eta: null },
        { id: "PO-2", supplier_id: "IEK", state: "approved", total_qty: 30, total_cost: "1500.00", eta: "2026-11-02" },
        { id: "PO-3", supplier_id: "IEK", state: "received", total_qty: 99, total_cost: null, eta: null },
        { id: "PO-4", supplier_id: "SE", state: "exported", total_qty: 8, total_cost: "80.00", eta: null },
      ],
      proposals: [
        { id: "PR-1", kind: "order", state: "needs_review", supplier_id: "SE" },
        { id: "PR-2", kind: "param_change", state: "needs_review", supplier_id: "SE" },
        { id: "PR-3", kind: "order", state: "approved", supplier_id: "SE" },
      ],
      transit: [
        { supplier_id: "IEK", qty: "3000", po_ref: "УТ-8234", expected_at: "2026-11-01" },
        { supplier_id: "IEK", qty: "48", po_ref: "УТ-8234", expected_at: "2026-11-01" },
        { supplier_id: "IEK", qty: "12", po_ref: "УТ-7583", expected_at: "2026-10-10" },
        { supplier_id: "SE", qty: "50160", po_ref: "SE-1", expected_at: "2026-11-11" },
      ],
      committed: [{ supplier_id: "IEK", amount: "1500.00", currency: "KZT", lines: 2, cost_known_lines: 1 }],
      obligations: [
        { supplier_id: "IEK", kind: "supplier_balance", amount: "1050.00", currency: "KZT", due_at: "2026-11-02" },
        { supplier_id: "IEK", kind: "supplier_prepayment", amount: "450.00", currency: "KZT", due_at: "2026-09-23" },
      ],
      replies: [
        { supplier_id: "SE", po_id: "PO-4", at: "2026-09-22T10:00:00Z", text: "Старый ответ" },
        { supplier_id: "SE", po_id: "PO-4", at: "2026-09-23T08:00:00Z", text: "Подтверждаем получение заказа PO-4." },
      ],
    });
    const iek = cards.find(c => c.id === "IEK")!, se = cards.find(c => c.id === "SE")!;
    expect(iek.open_orders).toEqual({ count: 2, draft: 1, approved: 1, exported: 0, units: 150, ids: ["PO-1", "PO-2"] });
    expect(iek.in_transit).toEqual({ units: 3060, shipments: 2, next_eta: "2026-10-10" });
    expect(iek.committed).toEqual({ amount: "1500.00", currency: "KZT", lines: 2, cost_known_lines: 1 });
    expect(iek.next_payment).toEqual({ kind: "supplier_prepayment", amount: "450.00", currency: "KZT", at: "2026-09-23" });
    expect(iek.terms).toEqual({ prepay_pct: 30, balance_pct: 70 });
    expect(iek.origin_ru).toBe("Россия");
    expect(iek.last_reply).toBeNull();
    expect(se.open_orders.count).toBe(1);
    expect(se.proposals_waiting).toBe(1);
    expect(se.in_transit).toEqual({ units: 50160, shipments: 1, next_eta: "2026-11-11" });
    expect(se.committed).toBeNull();
    expect(se.origin_ru).toBeNull();
    expect(se.last_reply?.text).toBe("Подтверждаем получение заказа PO-4.");
  });

  it("is honest on an empty world: zero counts, no invented reply or origin", () => {
    const [iek, se] = aggregateSuppliers({ suppliers, orders: [], proposals: [], transit: [], committed: [], obligations: [], replies: [] });
    expect(iek.open_orders.count).toBe(0); expect(iek.in_transit.units).toBe(0); expect(iek.committed).toBeNull(); expect(iek.last_reply).toBeNull();
    expect(se.terms).toEqual({ prepay_pct: 30, balance_pct: 70 }); expect(se.origin_ru).toBeNull();
  });
});
