import { beforeEach, describe, expect, it } from "vitest";
import { db, resetInstance } from "../../src/db/client";
import { moneyView } from "../../src/domain/cashflow";
import { GET, PATCH, PUT } from "../../src/app/api/params/route";

const q = (sql: string, ...args: (string | number | null)[]) => db().prepare(sql).run(...args);
const patch = (body: unknown) => PATCH(new Request("http://x/api/params", { method: "PATCH", body: JSON.stringify(body) }));

beforeEach(() => {
  resetInstance();
  process.env.DATABASE_PATH = ":memory:";
  q("INSERT INTO organization(id,name,payload) VALUES ('partner','Partner',?)", JSON.stringify({ etl_fetched_at: "2026-09-23T10:00:00Z" }));
  q("INSERT INTO supplier(id,name,lead_time_days,review_days,terms,currency) VALUES ('IEK','IEK',40,30,?,'KZT')", JSON.stringify({ prepay_pct: 30 }));
  q("INSERT INTO supplier(id,name,lead_time_days,review_days,terms,currency) VALUES ('SE','SE',50,30,?,'KZT')", JSON.stringify({ prepay_pct: 30 }));
  q("INSERT INTO sku(code_1c,supplier_id,name,unit_cost,moq) VALUES ('SE-1','SE','Known','100.00',1)");
  q("INSERT INTO sku(code_1c,supplier_id,name,unit_cost,moq) VALUES ('IEK-1','IEK','Unknown',NULL,1)");
});

describe("uxfix_b settings — params save/read round trip", () => {
  it("reads gaps honestly: no opening cash, one SKU without cost, ETL date kept", async () => {
    const body = await (await GET()).json();
    expect(body.org.opening_cash).toBeNull();
    expect(body.cost).toEqual({ skus_total: 2, skus_without_cost: 1 });
    expect(body.org.data_as_of).toBe("2026-09-23T10:00:00Z");
    expect(body.suppliers.map((s: { id: string; prepay_pct: number }) => [s.id, s.prepay_pct])).toEqual([["IEK", 30], ["SE", 30]]);
  });
  it("saves opening cash + terms directly and the money view reflects it", async () => {
    const before = await moneyView("partner");
    expect(before.cash).toEqual([]);
    expect(before.risks.some(r => r.code === "opening_cash_unknown")).toBe(true);
    const res = await patch({ opening_cash: { amount: "12500000.00", currency: "KZT", as_of: "2026-09-23" }, currency: "KZT", suppliers: [{ id: "IEK", prepay_pct: 40 }] });
    expect(res.status).toBe(200);
    const saved = await res.json();
    expect(saved.saved).toBe(true);
    expect(saved.org.opening_cash).toEqual({ amount: "12500000.00", currency: "KZT", as_of: "2026-09-23" });
    const again = await (await GET()).json();
    expect(again.org.opening_cash.amount).toBe("12500000.00");
    expect(again.suppliers.find((s: { id: string }) => s.id === "IEK").prepay_pct).toBe(40);
    expect(again.suppliers.find((s: { id: string }) => s.id === "SE").prepay_pct).toBe(30);
    const after = await moneyView("partner");
    expect(after.cash).toEqual([{ amount: "12500000.00", currency: "KZT" }]);
    expect(after.risks.some(r => r.code === "opening_cash_unknown")).toBe(false);
    const org = db().prepare("SELECT payload FROM organization WHERE id='partner'").get() as { payload: string };
    expect(JSON.parse(org.payload).etl_fetched_at).toBe("2026-09-23T10:00:00Z");
  });
  it("rejects an empty or malformed save and clears the opening cash on null", async () => {
    expect((await patch({})).status).toBe(400);
    expect((await patch({ opening_cash: { amount: "abc", currency: "KZT", as_of: "2026-09-23" } })).status).toBe(400);
    await patch({ opening_cash: { amount: "1.00", currency: "KZT", as_of: "2026-09-23" } });
    await patch({ opening_cash: null });
    expect((await (await GET()).json()).org.opening_cash).toBeNull();
  });
  it("keeps supplier calculation parameters on the proposal path", async () => {
    const res = await PUT(new Request("http://x/api/params", { method: "PUT", body: JSON.stringify({ supplier_id: "SE", lead_time_days: 45 }) }));
    expect(res.status).toBe(202);
    expect((await res.json()).state).toBe("needs_review");
    expect((db().prepare("SELECT lead_time_days FROM supplier WHERE id='SE'").get() as { lead_time_days: number }).lead_time_days).toBe(50);
  });
});
