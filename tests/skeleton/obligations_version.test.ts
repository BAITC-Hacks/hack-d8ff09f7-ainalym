import { afterEach, beforeEach, expect, it } from "vitest";
import { db, resetInstance, stateVersion } from "../../src/db/client";
import { approveOrder } from "../../src/domain/orders";
import { syncOrderObligations } from "../../src/domain/obligations";

beforeEach(() => {
  resetInstance();
  const d = db();
  d.prepare("INSERT INTO supplier(id,name,lead_time_days,terms) VALUES ('SE','SE',50,?)").run('{"prepay_pct":30}');
  d.prepare("INSERT INTO sku(code_1c,supplier_id,name) VALUES ('SE-1','SE','Item')").run();
  d.prepare("INSERT INTO calc_run(id,started_at) VALUES ('RUN-1','2026-09-23T00:00:00Z')").run();
  d.prepare("INSERT INTO purchase_order(id,supplier_id,run_id,state,eta,version) VALUES ('PO-1','SE','RUN-1','draft','2026-10-10T00:00:00Z',1)").run();
  d.prepare("INSERT INTO purchase_order_line(po_id,code_1c,qty,unit_cost) VALUES ('PO-1','SE-1',10,'100.00')").run();
});
afterEach(() => resetInstance());

it("bumps state_version once for approval and both obligation rows", () => {
  const before = stateVersion();
  approveOrder("PO-1", 1);
  expect(db().prepare("SELECT COUNT(*) AS n FROM obligation WHERE po_id='PO-1'").get()).toEqual({ n: 2 });
  expect(stateVersion()).toBe(before + 1);
  syncOrderObligations("PO-1");
  expect(stateVersion()).toBe(before + 1);
});
