import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { db, resetInstance, stateVersion } from "../../src/db/client";
import { composeEvent } from "../../src/world/compose";
import { POST as composeRoute } from "../../src/app/api/world/compose/route";

vi.mock("../../src/ai/worker", () => ({ processEvent: vi.fn(async () => ({ run_id: null })) }));

beforeEach(() => {
  process.env.DATABASE_PATH = ":memory:";
  resetInstance();
  db().prepare("INSERT INTO organization (id,name) VALUES (?,?)").run("ORG-A", "A");
});
afterEach(() => resetInstance());

it("returns 404 for an unknown SKU without writing or bumping state", async () => {
  const version = stateVersion();
  const input = { kind: "judge_message", code_1c: "UNKNOWN-SKU", text: "Разовый заказ 20 шт" };
  await expect(composeEvent(input as Parameters<typeof composeEvent>[0])).rejects.toMatchObject({ code: "unknown_sku", status: 404 });
  const response = await composeRoute(new Request("http://localhost/api/world/compose", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  }));
  expect(response.status).toBe(404);
  expect(db().prepare("SELECT COUNT(*) AS n FROM world_event").get()).toMatchObject({ n: 0 });
  expect(stateVersion()).toBe(version);
});

it("rejects a SKU from another supplier before writing a supplier event", async () => {
  const d = db();
  d.prepare("INSERT INTO supplier (id,name,lead_time_days) VALUES (?,?,?)").run("SUP-A", "A", 1);
  d.prepare("INSERT INTO supplier (id,name,lead_time_days) VALUES (?,?,?)").run("SUP-B", "B", 1);
  d.prepare("INSERT INTO sku (code_1c,supplier_id,name) VALUES (?,?,?)").run("SKU-A", "SUP-A", "A");
  d.prepare("INSERT INTO purchase_order (id,supplier_id) VALUES (?,?)").run("PO-B", "SUP-B");
  const version = stateVersion();
  await expect(composeEvent({ kind: "supplier_reply", po_id: "PO-B", code_1c: "SKU-A", actor_id: "SUP-B", text: "Confirmed" }))
    .rejects.toMatchObject({ code: "sku_supplier_mismatch", status: 404 });
  expect(d.prepare("SELECT COUNT(*) AS n FROM world_event").get()).toMatchObject({ n: 0 });
  expect(stateVersion()).toBe(version);
});
