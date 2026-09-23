import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { db, resetInstance } from "../../src/db/client";
import { approveOrder } from "../../src/domain/orders";
import { decideProposal } from "../../src/domain/apply";
import { moneyView } from "../../src/domain/cashflow";
import { queueView } from "../../src/domain/views";
import { interpretSupplierReply } from "../../src/ai/interpret";
import { composeEvent } from "../../src/world/compose";
import { feed } from "../../src/world/feed";

const oldPath = process.env.DATABASE_PATH;
const oldProvider = process.env.AI_PROVIDER;

beforeEach(() => {
  resetInstance();
  process.env.DATABASE_PATH = ":memory:";
  process.env.AI_PROVIDER = "rules";
  const d = db();
  d.prepare("INSERT INTO organization(id,name,payload) VALUES ('partner','Демо','{}')").run();
  d.prepare("INSERT INTO supplier(id,name,lead_time_days,terms) VALUES ('SE','Поставщик',21,'{\"prepay_pct\":30}')").run();
  d.prepare("INSERT INTO sku(code_1c,supplier_id,name,unit_cost) VALUES ('SKU-1','SE','Товар','10.00')").run();
  d.prepare("INSERT INTO purchase_order(id,supplier_id,state,eta) VALUES ('PO-1','SE','draft','2026-10-01T00:00:00Z')").run();
  d.prepare("INSERT INTO purchase_order_line(po_id,code_1c,qty,unit_cost) VALUES ('PO-1','SKU-1',100,'10.00')").run();
  approveOrder("PO-1", 1);
});
afterEach(() => {
  resetInstance();
  if (oldPath === undefined) delete process.env.DATABASE_PATH; else process.env.DATABASE_PATH = oldPath;
  if (oldProvider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = oldProvider;
});

describe("supplier reply consequence", () => {
  it.each([
    ["Отгрузим 60 %, остальное через 3 недели.", "0.6", null, 21, "2026-10-14"],
    ["Поставим 40 шт, остальное до 15.10.", null, 40, 22, "2026-10-15"],
    ["Отгрузим 60 из 100 через 2 недели.", null, 60, 14, "2026-10-07"],
  ])("interprets a partial reply with rules: %s", async (text, share, qty, days, eta) => {
    const result = await interpretSupplierReply({ text, at: "2026-09-23T09:03:00Z", po_id: "PO-1", org_id: "partner", affected_lines: ["SKU-1"] });
    expect(result).toMatchObject({ action: "split", partial_share: share, partial_qty: qty,
      delay_days: days, affected_lines: ["SKU-1"] });
    expect(result.promised_eta?.slice(0, 10)).toBe(eta);
  });

  it("creates one review proposal, then splits the money only after approval", async () => {
    const input = { kind: "supplier_reply" as const, actor_id: "SE", po_id: "PO-1",
      text: "Отгрузим 60 %, остальное через 3 недели.", payload: { po_id: "PO-1", supplier_id: "SE" } };
    const first = await composeEvent(input);
    const again = await composeEvent(input);
    expect(first.replayed).toBe(false);
    expect(again.replayed).toBe(true);
    expect(again.event.id).toBe(first.event.id);
    const proposal = db().prepare("SELECT id,version,state,payload FROM proposal WHERE kind='supplier_split'").get() as
      { id: string; version: number; state: string; payload: string };
    expect(proposal.state).toBe("needs_review");
    expect((db().prepare("SELECT COUNT(*) AS n FROM proposal WHERE kind='supplier_split'").get() as { n: number }).n).toBe(1);
    expect((await queueView("partner")).items.find(item => item.id === proposal.id)).toMatchObject({
      title: expect.stringContaining("Разделить поставку"), href: `/review/${proposal.id}`,
    });
    const parts = (JSON.parse(proposal.payload) as { parts: { now: { total_qty: number; total_cost: string }; later: { total_qty: number; total_cost: string } } }).parts;
    expect([parts.now.total_qty, parts.later.total_qty]).toEqual([60, 40]);
    expect(new Decimal(parts.now.total_cost).plus(parts.later.total_cost).toFixed(2)).toBe("1000.00");
    expect(feed().rows.find(row => row.id === first.event.id)?.text).toContain("Предложение: разделить заказ");
    expect((db().prepare("SELECT COUNT(*) AS n FROM obligation").get() as { n: number }).n).toBe(2);
    const approved = await decideProposal(proposal.id, proposal.version, "approve");
    expect(approved.split_po_ids).toHaveLength(2);
    expect((db().prepare("SELECT COUNT(*) AS n FROM obligation").get() as { n: number }).n).toBe(4);
    const obligations = db().prepare("SELECT po_id,kind,amount FROM obligation ORDER BY po_id,kind").all() as
      { po_id: string; kind: string; amount: string }[];
    expect(new Decimal(obligations.reduce((sum, row) => sum.plus(row.amount), new Decimal(0))).toFixed(2)).toBe("1000.00");
    for (const poId of approved.split_po_ids!) {
      const rows = obligations.filter(row => row.po_id === poId);
      const total = rows.reduce((sum, row) => sum.plus(row.amount), new Decimal(0));
      expect(new Decimal(rows.find(row => row.kind === "supplier_prepayment")!.amount).toFixed(2)).toBe(total.times(0.3).toFixed(2));
      expect(new Decimal(rows.find(row => row.kind === "supplier_balance")!.amount).toFixed(2)).toBe(total.times(0.7).toFixed(2));
    }
    expect((await moneyView("partner", new Date("2026-09-23T00:00:00Z"))).next_60d.out).toHaveLength(4);
    expect(db().prepare("SELECT 1 FROM ledger_peer_record").get()).toBeUndefined();
    expect(await composeEvent(input)).toMatchObject({ replayed: true });
  });

  it("proposes an internal urgency task when the whole delivery is delayed", async () => {
    const result = await composeEvent({ kind: "supplier_reply", actor_id: "SE", po_id: "PO-1",
      text: "Вся поставка задержится, доставим через 3 недели.", payload: { po_id: "PO-1", supplier_id: "SE" } });
    expect(result.event.state).toBe("processed");
    const proposal = db().prepare("SELECT id,version,kind FROM proposal WHERE kind='supplier_expedite'").get() as
      { id: string; version: number; kind: string };
    expect(proposal.kind).toBe("supplier_expedite");
    await decideProposal(proposal.id, proposal.version, "approve");
    expect(db().prepare("SELECT title FROM task WHERE state='needs_review'").get()).toMatchObject({ title: expect.stringContaining("ускорение") });
    expect((db().prepare("SELECT COUNT(*) AS n FROM obligation").get() as { n: number }).n).toBe(2);
    expect(db().prepare("SELECT 1 FROM ledger_peer_record").get()).toBeUndefined();
  });
});
