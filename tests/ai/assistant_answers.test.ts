import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, resetInstance } from "../../src/db/client";
import { answerInContext, detectKind } from "../../src/server/assistant_answers";
import { pageContext, suggestedPrompts } from "../../src/components/assistant/context";

const LEAK = /LLM|provider|провайдер|HTTP|JSON|rules|state_version|ETL|adapter|stack|undefined|null/i;

beforeEach(() => {
  process.env.AI_PROVIDER = "rules";
  resetInstance();
  const d = db();
  d.prepare("INSERT INTO organization(id,name) VALUES ('partner','Partner')").run();
  d.prepare("INSERT INTO supplier(id,name,lead_time_days) VALUES ('SE','SE',50)").run();
  d.prepare("INSERT INTO sku(code_1c,supplier_id,name,unit_cost,moq) VALUES ('130300027_','SE','Автомат ВА47-29 1P 16А','12.50',1)").run();
  d.prepare("INSERT INTO sku(code_1c,supplier_id,name,unit_cost) VALUES ('SE-2','SE','Розетка','2.00')").run();
  d.prepare("INSERT INTO agent_run(id,org_id,trigger_type,started_at) VALUES ('AR-1','partner','calc_request','2026-09-23')").run();
  d.prepare("INSERT INTO calc_run(id,started_at,agent_run_id) VALUES ('RUN-1','2026-09-23','AR-1')").run();
  d.prepare(`INSERT INTO proposal(id,kind,subject_type,subject_id,payload,money_at_stake,created_at) VALUES ('PR-1','supplier_order','supplier','SE',?,'{"amount":"145.00","currency":"KZT"}','2026-09-23')`)
    .run(JSON.stringify({ run_id: "RUN-1", supplier_id: "SE", lines: [{ recommendation_id: "REC-1", code_1c: "130300027_", qty: 140, unit_cost: "12.50" }], cost_known_lines: 1 }));
  d.prepare("INSERT INTO recommendation(id,run_id,code_1c,supplier_id,qty_recommended,proposal_id,urgency,rationale_ru,components) VALUES ('REC-1','RUN-1','130300027_','SE',140,'PR-1','critical','Запас закончится до прихода поставки.',?)")
    .run(JSON.stringify({ forecast_qty: 180, safety: 20, on_hand: 40, in_transit: 20, horizon_days: 60, stockout_months: ["2026-06"], outliers_excluded: [{ doc_no: "D1" }] }));
  d.prepare("INSERT INTO recommendation(id,run_id,code_1c,supplier_id,qty_recommended,urgency) VALUES ('REC-2','RUN-1','SE-2','SE',5,'normal')").run();
});
afterEach(() => resetInstance());

describe("keyless assistant answers", () => {
  it("explains a SKU quantity from the saved recommendation components", async () => {
    const context = pageContext("/v2/skus/130300027_", "/v2");
    const answer = await answerInContext({ text: "Почему столько?", context, base: "/v2", org_id: "partner" });
    expect(answer.ok).toBe(true);
    expect(answer.kind).toBe("why_qty");
    expect(answer.reply_ru).toContain("140 шт");
    expect(answer.reply_ru).toContain("прогноз продаж на 60 дн. — 180 шт");
    expect(answer.reply_ru).toContain("Запас закончится до прихода поставки.");
    expect(answer.reply_ru).toContain("1 месяц с дефицитом");
    expect(answer.reply_ru).not.toMatch(LEAK);
    expect(answer.items?.map(i => i.href)).toEqual(["/v2/skus/130300027_", "/v2/replenishment"]);
  });
  it("answers the +100 in transit what-if without recalculating", async () => {
    const context = pageContext("/v2/skus/130300027_", "/v2");
    const answer = await answerInContext({ text: "Что изменится, если +100 в пути?", context, base: "/v2", org_id: "partner" });
    expect(answer.kind).toBe("what_if_transit");
    expect(answer.reply_ru).toContain("снизится с 140 до 40 шт");
    expect(answer.reply_ru).not.toMatch(LEAK);
    const all = await answerInContext({ text: "если +200 в пути", context, base: "/v2", org_id: "partner" });
    expect(all.reply_ru).toContain("до 0 шт — пока партия едет, заказывать не нужно");
  });
  it("lists urgent positions with links to the SKU screens", async () => {
    const answer = await answerInContext({ text: "Что срочно?", context: pageContext("/v2/money", "/v2"), base: "/v2", org_id: "partner" });
    expect(answer.kind).toBe("urgent");
    expect(answer.reply_ru).toContain("1 критичная");
    expect(answer.items).toHaveLength(1);
    expect(answer.items?.[0]).toMatchObject({ title: "Автомат ВА47-29 1P 16А", href: "/v2/skus/130300027_", meta: "140 шт · критично" });
  });
  it("answers the money question from the cash-flow view even with no approved orders", async () => {
    const answer = await answerInContext({ text: "Что заплатить на этой неделе?", context: pageContext("/v2/money", "/v2"), base: "/v2", org_id: "partner" });
    expect(answer.ok).toBe(true);
    expect(answer.kind).toBe("pay_week");
    expect(answer.reply_ru).toMatch(/платежей поставщикам нет|к оплате/);
    expect(answer.reply_ru).not.toMatch(LEAK);
  });
  it("every suggested prompt on every page gets a real answer, never the failure copy", async () => {
    for (const path of ["/v2/money", "/v2/skus/130300027_", "/v2/supplier/PO-missing", "/v2/today", "/v2/replenishment"]) {
      const context = pageContext(path, "/v2");
      for (const prompt of suggestedPrompts(context)) {
        const answer = await answerInContext({ text: prompt.text, context, base: "/v2", org_id: "partner" });
        expect(answer.ok, `${path} · ${prompt.text}`).toBe(true);
        expect(answer.reply_ru, `${path} · ${prompt.text}`).not.toMatch(LEAK);
        expect(answer.reply_ru.length).toBeGreaterThan(20);
      }
    }
  });
  it("routes free text by page and falls back to plain Russian", async () => {
    expect(detectKind("почему", pageContext("/v2/skus/130300027_", "/v2"))).toBe("why_qty");
    expect(detectKind("почему заказ такой", pageContext("/v2/supplier/PO-1", "/v2"))).toBe("why_order");
    const answer = await answerInContext({ text: "погода в Астане", context: pageContext("/v2/money", "/v2"), base: "/v2", org_id: "partner" });
    expect(answer).toMatchObject({ ok: false, reply_ru: "Не могу ответить по этим данным. Попробуйте открыть карточку товара." });
  });
});
