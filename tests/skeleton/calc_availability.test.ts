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
