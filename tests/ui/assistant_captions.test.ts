import { describe, expect, it } from "vitest";
import { cleanCaption } from "../../src/components/assistant/thread";
import { isRenderSpec } from "../../src/components/assistant/StructuredCard";

describe("voice transcript hygiene", () => {
  it("keeps Russian, Latin and numbers; drops other scripts", () => {
    expect(cleanCaption(" Срочно: 200 позиций, IEK и SE — 130200122_ ")).toBe("Срочно: 200 позиций, IEK и SE — 130200122_");
    expect(cleanCaption("네, 알겠습니다")).toBeNull();
    expect(cleanCaption("Проверяю 안녕")).toBeNull();
    expect(cleanCaption("   ")).toBeNull();
  });
  it("accepts a render hint only when it has a kind or items", () => {
    expect(isRenderSpec({ kind: "urgent_list", items: [] })).toBe(true);
    expect(isRenderSpec({ items: [{ code_1c: "130200122_", qty: 20 }] })).toBe(true);
    expect(isRenderSpec({ foo: 1 })).toBe(false);
    expect(isRenderSpec(null)).toBe(false);
  });
});
