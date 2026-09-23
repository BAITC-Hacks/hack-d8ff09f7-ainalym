import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../src/app/api/voice/session/route";

const priorKey = process.env.OPENAI_API_KEY;
afterEach(() => {
  if (priorKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = priorKey;
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
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ value: "ephemeral-test", expires_at: now + 60 }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const response = await POST();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ client_secret: "ephemeral-test", model: "gpt-realtime-2.1" });
    expect(body.expires_at).toBeLessThanOrEqual(now + 60);
    expect(body.tools.map((tool: { name: string }) => tool.name).sort()).toEqual(["explain_sku", "recommend_for", "what_changed", "what_needs_me"]);
    expect(fetcher.mock.calls[0][0]).toBe("https://api.openai.com/v1/realtime/client_secrets");
    expect(JSON.parse(fetcher.mock.calls[0][1].body).session.tools).toHaveLength(4);
    expect(JSON.stringify(body)).not.toContain("unit-test-only");
  });
});
