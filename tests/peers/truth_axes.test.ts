import { afterEach, beforeEach, expect, it } from "vitest";
import { db, resetInstance } from "../../src/db/client";
import { feed } from "../../src/world/feed";
import { supplierChannel } from "../../src/peers/supplier";

beforeEach(() => {
  process.env.DATABASE_PATH = ":memory:";
  resetInstance();
  const d = db();
  d.prepare("INSERT INTO organization (id,name) VALUES (?,?)").run("ORG-A", "A");
});
afterEach(() => resetInstance());

it("attaches all truth axes to partner and synthetic world rows", () => {
  const insert = db().prepare("INSERT INTO world_event (id,org_id,seq,kind,source_id,state) VALUES (?,?,?,?,?,?)");
  insert.run("WE-P", "ORG-A", 1, "sales_day", "SALES-IEK-2026-01-01", "scripted");
  insert.run("WE-J", "ORG-A", 2, "judge_message", "JUDGE-ONEOFF", "scripted");
  expect(feed().rows.map(({ provenance, ai, external }) => ({ provenance, ai, external }))).toEqual([
    { provenance: "partner_anonymised", ai: "none", external: "local_simulator" },
    { provenance: "synthetic", ai: "none", external: "local_simulator" },
  ]);
});

it("attaches all truth axes to the supplier channel", () => {
  const d = db();
  d.prepare("INSERT INTO supplier (id,name,lead_time_days) VALUES (?,?,?)").run("IEK", "IEK", 1);
  d.prepare("INSERT INTO purchase_order (id,supplier_id) VALUES (?,?)").run("PO-1", "IEK");
  const result = supplierChannel("PO-1");
  expect(result).toMatchObject({ provenance: "synthetic", ai: "none", external: "local_simulator" });
  expect(result.channel).toMatchObject({ provenance: "synthetic", ai: "none", external: "local_simulator" });
});
