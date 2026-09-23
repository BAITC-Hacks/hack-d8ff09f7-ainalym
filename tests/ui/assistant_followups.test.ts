import { describe, expect, it } from "vitest";
import { clarifyingQuestion, followUpsFor } from "../../src/server/assistant_answers";

const ctx = { route: "assistant" as const, entity: {} };

describe("assistant follow-ups (ASSIST-4)", () => {
  it("asks one clarifying question for high-stakes or under-specified requests", () => {
    expect(clarifyingQuestion("утверди заказ", ctx)).toMatch(/поставщика или номер заказа/);
    expect(clarifyingQuestion("закажи", ctx)).toMatch(/IEK или Systeme Electric/);
    expect(clarifyingQuestion("закажи ещё", { ...ctx, entity: { code_1c: "130200122_" } })).toMatch(/Сколько единиц/);
    expect(clarifyingQuestion("что срочно?", ctx)).toBeNull();
    expect(clarifyingQuestion("почему столько?", { ...ctx, entity: { code_1c: "130200122_" } })).toBeNull();
  });
  it("ends every answer with one or two data-tied offers", () => {
    const urgent = followUpsFor({ ok: true, kind: "urgent", reply_ru: "…", items: [{ id: "130200122_", title: "Автомат", code: "130200122_" }] }, ctx);
    expect(urgent).toEqual(["Почему столько по коду 130200122_?", "Что нужно от меня?"]);
    expect(followUpsFor({ ok: true, kind: "why_qty", reply_ru: "…" }, { ...ctx, entity: { code_1c: "130200122_" } })[0]).toBe("Что если в пути +10 по коду 130200122_?");
    for (const kind of ["pay_week", "needs_me", "changed", "unknown"] as const) {
      const list = followUpsFor({ ok: true, kind, reply_ru: "…" }, ctx);
      expect(list.length).toBeGreaterThanOrEqual(1); expect(list.length).toBeLessThanOrEqual(2);
    }
  });
});
