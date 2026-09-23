import { afterEach, expect, it } from "vitest";
import { db, resetInstance } from "../../src/db/client";
import { summarizeChanges } from "../../src/ai/interpret";

afterEach(() => resetInstance());

it("compares the same article and unit across partial runs without adding packages to metres", async () => {
  resetInstance();
  const d = db();
  d.prepare("INSERT INTO supplier(id,name,lead_time_days) VALUES ('SE','SE',30)").run();
  d.prepare("INSERT INTO sku(code_1c,supplier_id,name,unit) VALUES ('METRE','SE','Cable','м')").run();
  d.prepare("INSERT INTO sku(code_1c,supplier_id,name,unit) VALUES ('PACK','SE','Pack','уп')").run();
  for (const id of ["OLD", "NEW"]) d.prepare("INSERT INTO calc_run(id,started_at) VALUES (?,?)").run(id, id === "OLD" ? "2025-01-01" : "2025-01-02");
  d.prepare("INSERT INTO recommendation(id,run_id,code_1c,supplier_id,qty_recommended) VALUES ('OLD-M','OLD','METRE','SE',10)").run();
  d.prepare("INSERT INTO recommendation(id,run_id,code_1c,supplier_id,qty_recommended) VALUES ('OLD-P','OLD','PACK','SE',20)").run();
  d.prepare("INSERT INTO recommendation(id,run_id,code_1c,supplier_id,qty_recommended) VALUES ('NEW-M','NEW','METRE','SE',15)").run();
  const summary = await summarizeChanges("NEW");
  expect(summary).toContain("10 → 15 м");
  expect(summary).not.toContain("20");
  expect(summary).not.toContain("шт");
});
