import { afterEach, expect, it } from "vitest";
import { db, resetInstance } from "../../src/db/client";
import { runCalculation } from "../../src/domain/apply";
import { GET as today } from "../../src/app/api/today/route";
import { GET as queue } from "../../src/app/api/queue/route";

afterEach(() => resetInstance());

it("bounds today and queue after four runs and retains superseded proposals", async () => {
  resetInstance();
  const d = db();
  d.prepare("INSERT INTO organization(id,name,payload) VALUES ('partner','Partner','{}')").run();
  d.prepare("INSERT INTO supplier(id,name,lead_time_days) VALUES ('SE','SE',30)").run();
  d.prepare("INSERT INTO sku(code_1c,supplier_id,name,unit_cost) VALUES ('SKU-0','SE','Item','10')").run();
  for (let month = 1; month <= 12; month++) {
    const ym = `2024-${String(month).padStart(2, "0")}`;
    d.prepare("INSERT INTO sales_month(code_1c,ym,qty_file) VALUES ('SKU-0',?,'30')").run(ym);
  }
  d.prepare("INSERT INTO stock_month(code_1c,ym,opening_qty) VALUES ('SKU-0','2024-12','0')").run();
  d.exec("BEGIN");
  const sku = d.prepare("INSERT INTO sku(code_1c,supplier_id,name) VALUES (?,'SE','Item')");
  for (let i = 1; i < 1259; i++) sku.run(`SKU-${i}`);
  d.exec("COMMIT");

  const rec = d.prepare(`INSERT INTO recommendation(id,run_id,code_1c,supplier_id,qty_recommended,urgency)
    VALUES (?,? ,?,'SE',1,'critical')`);
  for (let run = 1; run <= 4; run++) {
    const result = await runCalculation({ codes: ["SKU-0"] }, {}, { database: d, org_id: "partner", as_of: `2025-01-0${run}` });
    d.exec("BEGIN");
    for (let i = 1; i < 1259; i++) rec.run(`REC-${run}-${i}`, result.run_id, `SKU-${i}`);
    d.exec("COMMIT");
  }

  const startToday = performance.now();
  const todayBody = await (await today()).json();
  const todayMs = performance.now() - startToday;
  const startQueue = performance.now();
  const queueBody = await (await queue()).json();
  const queueMs = performance.now() - startQueue;
  expect(todayBody.ok).toBe(true);
  expect(queueBody.ok).toBe(true);
  expect(todayMs).toBeLessThan(500);
  expect(queueMs).toBeLessThan(300);
  expect(queueBody.items.filter((item: { kind: string }) => item.kind === "proposal")).toHaveLength(1);
  expect(queueBody.items[0]).toMatchObject({ supplier: "SE", lines_count: 1, state: "needs_review", version: 4 });
  expect((d.prepare("SELECT COUNT(*) AS n FROM proposal WHERE state='stale'").get() as { n: number }).n).toBe(3);
  expect((d.prepare("SELECT COUNT(*) AS n FROM proposal WHERE state='needs_review'").get() as { n: number }).n).toBe(1);
});
