import { afterEach, expect, it } from "vitest";
import { truthAxes } from "../../src/server/http";
import { selectedProvider } from "../../src/ai/provider";
import { GET } from "../../src/app/api/health/route";
import { GET as modes } from "../../src/app/api/modes/route";
import { resetInstance } from "../../src/db/client";

const prior = { AI_PROVIDER: process.env.AI_PROVIDER, TYPESAFE_API_KEY: process.env.TYPESAFE_API_KEY,
  AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY, OPENAI_API_KEY: process.env.OPENAI_API_KEY, AINALYM_MODE: process.env.AINALYM_MODE };
afterEach(() => {
  for (const [key, value] of Object.entries(prior)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetInstance();
});

it("reports OpenAI as live when it is the only configured provider", async () => {
  delete process.env.AI_PROVIDER;
  delete process.env.TYPESAFE_API_KEY;
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.AINALYM_MODE;
  process.env.OPENAI_API_KEY = "test-key";
  expect(selectedProvider()).toBe("openai");
  expect(truthAxes().ai).toBe("live");
  expect(await (await GET()).json()).toMatchObject({ ai_provider: "openai", ai: "live" });
});

it("describes routing without model names in modes", async () => {
  const response = await modes();
  expect(await response.json()).toMatchObject({ ai_routing: "рассуждения — модель рассуждений, быстрые задачи — быстрая модель" });
});
