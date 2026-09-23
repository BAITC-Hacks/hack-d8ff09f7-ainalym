import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogQuestion } from "../../src/ai/catalog";
import { decisionRoute, routeForQuestion } from "../../src/ai/decisions";
import { draftingRoute } from "../../src/ai/drafting";
import { decideChoice, jevModel, openAIModel } from "../../src/ai/provider";
import { intentTaskClass, structuredIntent } from "../../src/voice/typed";

const generated = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ generateObject: generated }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: () => (id: string) => ({ id }) }));

const names = ["OPENAI_MODEL", "OPENAI_REASONING_MODEL", "OPENAI_FAST_MODEL", "OPENAI_API_KEY", "TYPESAFE_API_KEY", "AI_GATEWAY_API_KEY",
  "TYPESAFE_REASONING_MODEL", "TYPESAFE_FAST_MODEL", "AI_GATEWAY_REASONING_MODEL", "AI_GATEWAY_FAST_MODEL"] as const;
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
afterEach(() => {
  generated.mockReset();
  vi.unstubAllGlobals();
  for (const name of names) {
    const value = prior[name];
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});

describe("offline task routing", () => {
  it("declares judgment, label, drafting, and intent classes at their call sites", () => {
    expect(decisionRoute).toEqual({ taskClass: "reasoning", reasoningEffort: "high" });
    expect(routeForQuestion("one_off_order")).toEqual(decisionRoute);
    expect(routeForQuestion("supplier_fulfilment")).toEqual(decisionRoute);
    for (const id of ["category_hint", "urgency_override_reason", "change_summary", "supplier_terms_hint"])
      expect(routeForQuestion(id)).toEqual({ taskClass: "fast" });
    expect(draftingRoute).toEqual({ taskClass: "reasoning", reasoningEffort: "medium" });
    expect(intentTaskClass).toBe("fast");
  });

  it("selects repo class defaults and explicit class overrides", () => {
    for (const name of names) delete process.env[name];
    expect(openAIModel("reasoning")).toBe("gpt-5-mini");
    expect(openAIModel("fast")).toBe("gpt-4o-mini");
    process.env.OPENAI_MODEL = "legacy-model";
    expect(openAIModel("reasoning")).toBe("gpt-5-mini");
    expect(openAIModel("fast")).toBe("gpt-4o-mini");
    process.env.OPENAI_REASONING_MODEL = "reasoning-model";
    process.env.OPENAI_FAST_MODEL = "fast-model";
    expect(openAIModel("reasoning")).toBe("reasoning-model");
    expect(openAIModel("fast")).toBe("fast-model");
    expect(jevModel("reasoning", "typesafe")).toBe("jev-latest");
    expect(jevModel("fast", "gateway")).toBe("typesafe-ai/jev");
    process.env.TYPESAFE_REASONING_MODEL = "jev-reasoning";
    process.env.AI_GATEWAY_FAST_MODEL = "jev-fast";
    expect(jevModel("reasoning", "typesafe")).toBe("jev-reasoning");
    expect(jevModel("fast", "gateway")).toBe("jev-fast");
  });

  it("sends the chosen OpenAI model and high effort only for judgment", async () => {
    process.env.OPENAI_API_KEY = "test-only-key";
    process.env.OPENAI_REASONING_MODEL = "reasoning-model";
    process.env.OPENAI_FAST_MODEL = "fast-model";
    generated.mockResolvedValueOnce({ object: { answer: "one_off", distribution: { one_off: 0.8, regular: 0.1, unknown: 0.1 } }, response: {} });
    await decideChoice(catalogQuestion("one_off_order")!, { document_qty: 120, threshold: 100 }, decisionRoute, "openai");
    expect(generated.mock.calls[0][0]).toMatchObject({ model: { id: "reasoning-model" }, providerOptions: { openai: { reasoningEffort: "high" } } });
    generated.mockResolvedValueOnce({ object: { answer: "cables", distribution: { circuit_breakers: 0.05, cables: 0.85, sockets: 0.05, unknown: 0.05 } }, response: {} });
    await decideChoice(catalogQuestion("category_hint")!, { name: "Кабель" }, routeForQuestion("category_hint"), "openai");
    expect(generated.mock.calls[1][0].model).toEqual({ id: "fast-model" });
    expect(generated.mock.calls[1][0].providerOptions).toBeUndefined();
  });

  it("passes through Jev defaults and uses configured class models on both transports", async () => {
    const requestModels: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
      const request = JSON.parse(init.body) as { model: string };
      requestModels.push(request.model);
      return { ok: true, json: async () => ({ model: request.model, answers: { one_off_order: {
        type: "choice", choice: "one_off", probabilities: { one_off: 0.8, regular: 0.1, unknown: 0.1 },
      } } }) };
    }));
    process.env.TYPESAFE_API_KEY = "test-only-key";
    process.env.TYPESAFE_REASONING_MODEL = "jev-reasoning";
    await decideChoice(catalogQuestion("one_off_order")!, { document_qty: 120, threshold: 100 }, decisionRoute, "jev");
    delete process.env.TYPESAFE_API_KEY;
    process.env.AI_GATEWAY_API_KEY = "test-only-key";
    process.env.AI_GATEWAY_FAST_MODEL = "jev-fast";
    await decideChoice(catalogQuestion("one_off_order")!, { document_qty: 120, threshold: 100 }, { taskClass: "fast" }, "jev");
    expect(requestModels).toEqual(["jev-reasoning", "jev-fast"]);
    delete process.env.AI_GATEWAY_API_KEY;
  });

  it("uses the fast model for typed assistant intent", async () => {
    process.env.OPENAI_FAST_MODEL = "fast-model";
    let body: { model: string } | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
      body = JSON.parse(init.body);
      return { ok: true, json: async () => ({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ tool: "clarify", supplier_id: null, category: null, code_1c: null }) }] }] }) };
    }));
    expect((await structuredIntent("Здравствуйте", { org_id: "partner" }, "test-only-key")).tool).toBe("clarify");
    expect(body?.model).toBe("fast-model");
  });
});
