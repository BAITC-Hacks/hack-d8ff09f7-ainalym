import { afterEach, describe, expect, it } from "vitest";
import { db, resetInstance, stateVersion } from "@/db/client";
import { GET } from "@/app/api/search/route";
afterEach(() => { resetInstance(); });
describe("c_search read-only API", () => {
  it("finds partner SKU codes without changing records or normalising the identity", async () => {
    const d = db();
    d.prepare("INSERT INTO supplier(id,name,lead_time_days,review_days,terms,currency) VALUES(?,?,?,?,?,?)").run("SE", "SE", 50, 30, "{}", "KZT");
    d.prepare("INSERT INTO sku(code_1c,supplier_id,name) VALUES(?,?,?)").run("000123_", "SE", "Тестовый выключатель");
    const before = stateVersion();
    const response = await GET(new Request("http://localhost/api/search?q=000123_"));
    expect(response.headers.get("cache-control")).toBe("no-store");
    const data = await response.json();
    expect(data.items).toMatchObject([{ id: "000123_", kind: "sku", href: "/skus/000123_" }]);
    expect(stateVersion()).toBe(before);
    expect(d.prepare("SELECT code_1c FROM sku").get()?.code_1c).toBe("000123_");
  });
  it("rejects excessive queries and treats SQL syntax as text", async () => {
    expect((await GET(new Request(`http://localhost/api/search?q=${"a".repeat(121)}`))).status).toBe(400);
    const result = await (await GET(new Request(`http://localhost/api/search?q=${encodeURIComponent("' OR 1=1 --")}`))).json();
    expect(result.items).toEqual([]);
  });
});
