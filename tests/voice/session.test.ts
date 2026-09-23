import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../src/app/api/voice/session/route";

const priorKey = process.env.OPENAI_API_KEY;
const priorGuard = process.env.DEMO_ACCESS_CODE;
const priorMode = process.env.AINALYM_MODE;
const priorBudget = process.env.DEMO_DAILY_LIVE_CALLS;
afterEach(() => {
  if (priorKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = priorKey;
  if (priorGuard === undefined) delete process.env.DEMO_ACCESS_CODE; else process.env.DEMO_ACCESS_CODE = priorGuard;
  if (priorMode === undefined) delete process.env.AINALYM_MODE; else process.env.AINALYM_MODE = priorMode;
  if (priorBudget === undefined) delete process.env.DEMO_DAILY_LIVE_CALLS; else process.env.DEMO_DAILY_LIVE_CALLS = priorBudget;
  vi.unstubAllGlobals();
});

describe("ephemeral voice session", () => {
  it("labels missing provider without invoking it", async () => {
    delete process.env.OPENAI_API_KEY;
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const response = await POST();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "provider_unavailable", label: "Provider unavailable" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("mints a bounded secret with the four case tools", async () => {
    process.env.OPENAI_API_KEY = "unit-test-only";
    const now = Math.floor(Date.now() / 1000);
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ value: "ephemeral-test", expires_at: now + 50 }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const response = await POST();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ client_secret: "ephemeral-test", model: "gpt-realtime-2.1" });
    expect(body.expires_at).toBeLessThanOrEqual(now + 60);
    expect(body.tools.map((tool: { name: string }) => tool.name).sort()).toEqual(["explain_sku", "recommend_for", "what_changed", "what_needs_me"]);
    expect(fetcher.mock.calls[0][0]).toBe("https://api.openai.com/v1/realtime/client_secrets");
    expect(fetcher.mock.calls[0][1].headers["OpenAI-Safety-Identifier"]).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).expires_after).toEqual({ anchor: "created_at", seconds: 50 });
    expect(JSON.parse(fetcher.mock.calls[0][1].body).session.tools).toHaveLength(4);
    expect(JSON.stringify(body)).not.toContain("unit-test-only");
  });

  it("rejects a secret whose actual provider expiry exceeds sixty seconds", async () => {
    process.env.OPENAI_API_KEY = "unit-test-only";
    const fetcher = vi.fn().mockResolvedValue(Response.json({ value: "ephemeral-test", expires_at: Math.floor(Date.now() / 1000) + 600 }));
    vi.stubGlobal("fetch", fetcher);
    const response = await POST();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("ephemeral-test");
  });

  it("does not call the provider after the live demo budget is exhausted", async () => {
    process.env.OPENAI_API_KEY = "unit-test-only";
    process.env.DEMO_ACCESS_CODE = "unit-test-only";
    process.env.AINALYM_MODE = "live";
    process.env.DEMO_DAILY_LIVE_CALLS = "0";
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const response = await POST();
    expect(response.status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
