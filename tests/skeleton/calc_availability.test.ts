import { afterEach, beforeEach, expect, it } from "vitest";
import { db, resetInstance } from "../../src/db/client";
import { POST } from "../../src/app/api/calc/run/route";

beforeEach(() => resetInstance());
afterEach(() => resetInstance());

it("returns 503 and writes no run on an uninitialised database", async () => {
  const response = await POST(new Request("http://localhost/api/calc", { method: "POST", body: JSON.stringify({ scope: {} }) }));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "data_unavailable", missing: ["organization", "supplier", "sku", "sales_line", "sales_month", "stock_month"] });
  expect(db().prepare("SELECT COUNT(*) AS n FROM agent_run").get()).toEqual({ n: 0 });
  expect(db().prepare("SELECT COUNT(*) AS n FROM calc_run").get()).toEqual({ n: 0 });
});

it("reports empty source tables before creating a run", async () => {
  db().prepare("INSERT INTO organization (id,name) VALUES ('partner','Partner')").run();
  const response = await POST(new Request("http://localhost/api/calc", { method: "POST", body: JSON.stringify({ scope: {} }) }));
  expect(response.status).toBe(503);
  expect((await response.json()).missing).not.toContain("organization");
  expect(db().prepare("SELECT COUNT(*) AS n FROM agent_run").get()).toEqual({ n: 0 });
});

it("reports partial calculation for valid X and broken Y", async () => {
  const d = db();
  d.prepare("INSERT INTO organization(id,name) VALUES ('ORG','Partner')").run();
  d.prepare("INSERT INTO supplier(id,name,lead_time_days) VALUES ('SE','SE',30)").run();
  for (const code of ["X", "Y"]) {
    d.prepare("INSERT INTO sku(code_1c,supplier_id,name) VALUES (?,'SE',?)").run(code, code);
    d.prepare("INSERT INTO sales_month(code_1c,ym,qty_file) VALUES (?,'2025-01','30')").run(code);
    d.prepare("INSERT INTO sales_line(code_1c,doc_no,doc_type,at,qty) VALUES (?,?,'Расходная накладная','2025-01-15','30')").run(code, `DOC-${code}`);
  }
  d.prepare("INSERT INTO stock_month(code_1c,ym,opening_qty) VALUES ('X',?,'0')").run(new Date().toISOString().slice(0, 7));
  const response = await POST(new Request("http://localhost/api/calc/run", { method: "POST", body: JSON.stringify({ scope: {} }) }));
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result).toMatchObject({ skus: 2, partial: true, unresolved: [{ code_1c: "Y", reason: "нет подтверждённого остатка" }] });
  expect(d.prepare("SELECT code_1c FROM recommendation WHERE run_id=?").all(result.run_id)).toEqual([{ code_1c: "X" }]);
});
