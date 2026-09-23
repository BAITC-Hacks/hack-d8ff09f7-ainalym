import { describe, expect, it } from "vitest";
import { contextTitle, encodeContext, pageContext, parseContext, suggestedPrompts } from "../../src/components/assistant/context";

describe("assistant page context", () => {
  it("reads the money page and offers the payment prompt", () => {
    const context = pageContext("/v2/money", "/v2");
    expect(context).toEqual({ route: "money", entity: {} });
    expect(suggestedPrompts(context).map(p => p.text)).toContain("Что заплатить на этой неделе?");
    expect(contextTitle(context)).toBe("Деньги");
  });
  it("extracts the supplier order id from the pathname", () => {
    const context = pageContext("/v2/supplier/PO-2026-0001", "/v2");
    expect(context.route).toBe("supplier");
    expect(context.entity.po_id).toBe("PO-2026-0001");
    expect(suggestedPrompts(context).map(p => p.text)).toEqual(expect.arrayContaining(["Почему заказ такой?", "Что срочно?"]));
  });
  it("extracts the SKU code and merges the page attribute", () => {
    const context = pageContext("/v2/skus/130300027_?x=1", "/v2", JSON.stringify({ supplier_id: "SE", summary: "Автомат ВА47-29", recommendation_id: "REC-9" }));
    expect(context).toEqual({ route: "sku", entity: { code_1c: "130300027_", supplier_id: "SE", recommendation_id: "REC-9" }, summary: "Автомат ВА47-29" });
    expect(suggestedPrompts(context).map(p => p.text)).toEqual(expect.arrayContaining(["Почему столько?", "Что изменится, если +100 в пути?"]));
    expect(contextTitle(context)).toBe("Позиция 130300027_");
  });
  it("ignores malformed or unsafe attributes and unknown routes", () => {
    expect(pageContext("/v2/today", "/v2", "{not json")).toEqual({ route: "today", entity: {} });
    expect(pageContext("/v2/skus/<script>", "/v2").entity.code_1c).toBeUndefined();
    expect(pageContext("/whatever", "/v2").route).toBe("other");
    expect(suggestedPrompts(pageContext("/v2/replenishment", "/v2")).map(p => p.text)).toContain("Что нужно от меня?");
  });
  it("round-trips a context through the URL", () => {
    const context = pageContext("/v2/supplier/PO-1", "/v2");
    const decoded = parseContext(decodeURIComponent(encodeContext(context)));
    expect(decoded).toEqual(context);
    expect(parseContext("[]")).toBeNull();
    expect(parseContext(JSON.stringify({ route: "nope" }))).toBeNull();
  });
});
