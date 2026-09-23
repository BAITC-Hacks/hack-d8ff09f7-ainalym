import { beforeAll, describe, expect, it } from "vitest";
import { loadEnvConfig } from "@next/env";
import { decideChoice, type ChoiceQuestion } from "../../src/ai/provider";

const question: ChoiceQuestion = {
  id: "one_off_order",
  instructions: "Is this document a one-off large customer order or regular replenishment demand?",
  criteria: { one_off: "A special, nonrecurring large order", regular: "Ordinary recurring demand", unknown: "Evidence does not establish either" },
};
const context = { document_qty: 120, threshold: 100, text: "Разовый заказ одного клиента, 120 шт." };

beforeAll(() => {
  const env = process.env as Record<string, string | undefined>;
  const mode = env.NODE_ENV;
  // Next intentionally skips .env.local in NODE_ENV=test; these opt-in smokes need it.
  env.NODE_ENV = "development";
  loadEnvConfig(process.cwd(), true, undefined, true);
  if (mode === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = mode;
});

describe("live provider smoke", () => {
  it("direct TypeSafe choice", async () => {
    if (!process.env.TYPESAFE_API_KEY) { console.log("typesafe: externally-unverified (missing key)"); return; }
    const result = await decideChoice(question, context, "jev");
    expect(result).toMatchObject({ result_state: "decided", provider: "jev:typesafe" });
    expect(result.answer).toBeTruthy();
    expect(result.model_version).toBeTruthy();
    console.log(`one_off_order=${result.answer} provider=${result.provider} model=${result.model_version}`);
  }, 30_000);

  it("gateway choice", async () => {
    if (!process.env.AI_GATEWAY_API_KEY) { console.log("gateway: externally-unverified (missing key)"); return; }
    const direct = process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    try {
      const result = await decideChoice(question, context, "jev");
      expect(result).toMatchObject({ result_state: "decided", provider: "jev:gateway" });
      expect(result.answer).toBeTruthy();
      expect(result.model_version).toBeTruthy();
      console.log(`one_off_order=${result.answer} provider=${result.provider} model=${result.model_version}`);
    } finally { if (direct) process.env.TYPESAFE_API_KEY = direct; }
  }, 30_000);

  it("OpenAI structured choice", async () => {
    if (!process.env.OPENAI_API_KEY) { console.log("openai: externally-unverified (missing key)"); return; }
    const result = await decideChoice(question, context, "openai");
    expect(result).toMatchObject({ result_state: "decided", provider: "openai" });
    expect(result.answer).toBeTruthy();
    expect(result.model_version).toBeTruthy();
    console.log(`one_off_order=${result.answer} provider=${result.provider} model=${result.model_version}`);
  }, 30_000);

  it("rules choice", async () => {
    const result = await decideChoice(question, context, "rules");
    expect(result).toMatchObject({ result_state: "decided", provider: "rules", label: "Правила без LLM" });
    console.log(`one_off_order=${result.answer} provider=${result.provider} model=${result.model_version} label=${result.label}`);
  });
});
