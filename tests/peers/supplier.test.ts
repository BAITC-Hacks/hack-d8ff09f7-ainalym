import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, resetInstance } from "../../src/db/client";
import { supplierChannel, supplierReply } from "../../src/peers/supplier";

beforeEach(() => {
  process.env.DATABASE_PATH = ":memory:";
  resetInstance();
  const d = db();
  d.prepare("INSERT INTO organization (id,name) VALUES (?,?)").run("ORG-TEST", "Test");
  d.prepare("INSERT INTO supplier (id,name,lead_time_days) VALUES (?,?,?)").run("IEK", "IEK", 40);
  d.prepare("INSERT INTO sku (code_1c,supplier_id,name,moq) VALUES (?,?,?,?)").run("C-1", "IEK", "Cable", 10);
  d.prepare("INSERT INTO purchase_order (id,supplier_id,state,total_qty) VALUES (?,?,?,?)").run("PO-1", "IEK", "approved", 20);
  d.prepare("INSERT INTO purchase_order_line (po_id,code_1c,qty,rationale_ru) VALUES (?,?,?,?)").run("PO-1", "C-1", 20, "Need");
});
afterEach(() => resetInstance());

describe("controlled supplier channel", () => {
  it("holds a draft, records a local send, and preserves the reply verbatim", async () => {
    expect(supplierChannel("PO-1").channel.state).toBe("draft");
    const sent = await supplierReply("PO-1", { action: "send_demo" });
    expect(sent.channel.state).toBe("sent");
    expect(db().prepare("SELECT COUNT(*) AS n FROM world_event").get()).toMatchObject({ n: 0 });
    const first = await supplierReply("PO-1", { action: "confirm", text: "Получено. Подтверждаем 20 шт." });
    const second = await supplierReply("PO-1", { action: "confirm", text: "Получено. Подтверждаем 20 шт." });
    expect(first.channel.state).toBe("confirmed");
    expect(first.event?.text).toBe("Получено. Подтверждаем 20 шт.");
    expect(second.replayed).toBe(true);
    expect(db().prepare("SELECT COUNT(*) AS n FROM world_event").get()).toMatchObject({ n: 1 });
  });

  it("rejects unknown and unapproved POs without leaking a channel", async () => {
    expect(() => supplierChannel("PO-OTHER")).toThrow("unknown_po");
    db().prepare("UPDATE purchase_order SET state = 'draft' WHERE id = 'PO-1'").run();
    await expect(supplierReply("PO-1", { action: "send_demo" })).rejects.toThrow("po_not_approved");
  });
});
