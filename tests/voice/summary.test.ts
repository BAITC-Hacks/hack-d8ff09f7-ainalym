import { describe, expect, it } from "vitest";
import { compactVoiceToolResult, spokenFollowUpResponse, SPOKEN_SUMMARY_INSTRUCTIONS } from "../../src/voice/summary";

describe("spoken voice payload", () => {
  it("keeps quantities and units for only the three most important calculated positions", () => {
    const items = Array.from({ length: 20 }, (_, index) => ({
      code_1c: `SKU-${index}`, name: `Деталь ${index}`, qty: 20 - index, unit: "шт", urgency: index ? "soon" : "critical",
    }));
    const compact = compactVoiceToolResult("recommend_for", {
      ok: true, state_version: 1, labels: {},
      render: { kind: "calc_result", total: 20, items, proposal_ids: ["PR-1"] },
    });
    expect(compact).toMatchObject({ total: { count: 20, unit: "позиций" }, top_items: [
      { name: "Деталь 0", qty: 20, unit: "шт", urgency: "critical" },
      { name: "Деталь 1", qty: 19, unit: "шт", urgency: "soon" },
      { name: "Деталь 2", qty: 18, unit: "шт", urgency: "soon" },
    ] });
    expect(JSON.stringify(compact)).not.toContain("Деталь 19");
    expect(spokenFollowUpResponse()).toMatchObject({ output_modalities: ["audio"], instructions: SPOKEN_SUMMARY_INSTRUCTIONS });
  });
  it("keeps one short factual rationale for a SKU explanation", () => {
    const compact = compactVoiceToolResult("explain_sku", {
      ok: true, state_version: 1, labels: {}, render: {
        kind: "sku_explain", code_1c: "SKU-1", name: "Кабель", qty: 12, unit: "м", urgency: "critical",
        rationale_ru: "Запас закончится до следующей поставки.", components: { internal: "not spoken" },
        outliers_excluded: [], stockout_months: [], forecast: null,
      },
    });
    expect(compact).toMatchObject({ top_items: [{ name: "Кабель", qty: 12, unit: "м" }], reason: "Запас закончится до следующей поставки." });
    expect(JSON.stringify(compact)).not.toContain("internal");
  });
});
