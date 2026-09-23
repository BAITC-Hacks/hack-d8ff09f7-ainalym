import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { middleware } from "../../src/middleware";
import { allowApiRequest, guardedProviderFetch, hasAccess, issueAccessCookie, remainingDailyCalls, reserveLiveCall } from "../../src/server/demo_guard";

let temporary: string;
const previous = { ...process.env };

beforeEach(() => {
  temporary = mkdtempSync(join(tmpdir(), "ainalym-demo-"));
  process.env.DATABASE_PATH = join(temporary, "ainalym.db");
  process.env.DEMO_ACCESS_CODE = "test";
  process.env.DEMO_DAILY_LIVE_CALLS = "2";
  process.env.AINALYM_MODE = "live";
  process.env.DEMO_PROXY = "caddy";
});

afterEach(() => {
  process.env.DATABASE_PATH = previous.DATABASE_PATH;
  process.env.DEMO_ACCESS_CODE = previous.DEMO_ACCESS_CODE;
  process.env.DEMO_DAILY_LIVE_CALLS = previous.DEMO_DAILY_LIVE_CALLS;
  process.env.AINALYM_MODE = previous.AINALYM_MODE;
  process.env.DEMO_PROXY = previous.DEMO_PROXY;
  rmSync(temporary, { recursive: true, force: true });
});

describe("demo access", () => {
  it("shows a RU/EN code page once, then accepts the signed cookie", async () => {
    const redirect = await middleware(new NextRequest("http://localhost:3000/"));
    expect(redirect.status).toBe(307);
    const page = await middleware(new NextRequest("http://localhost:3000/__demo_access?next=%2F"));
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("Код доступа · Access code");

    const body = new URLSearchParams({ code: "test", next: "/" });
    const accepted = await middleware(new NextRequest("http://localhost:3000/__demo_access", { method: "POST", body }));
    expect(accepted.status).toBe(303);
    const cookie = accepted.headers.get("set-cookie")?.match(/ainalym_demo_access=([^;]+)/)?.[1];
    expect(hasAccess(cookie, "test")).toBe(true);
    expect((await middleware(new NextRequest("http://localhost:3000/", { headers: { cookie: `ainalym_demo_access=${cookie}` } }))).status).toBe(200);
    expect(hasAccess(issueAccessCookie("test", 0), "test", 8 * 86_400_000)).toBe(false);
    const unsafe = await middleware(new NextRequest("http://localhost:3000/__demo_access", {
      method: "POST", body: new URLSearchParams({ code: "test", next: "/\\outside.invalid" }),
    }));
    expect(unsafe.headers.get("location")).toBe("http://localhost:3000/");
    const secure = await middleware(new NextRequest("http://localhost:3000/__demo_access", {
      method: "POST", body, headers: { "x-forwarded-proto": "https" },
    }));
    expect(secure.headers.get("set-cookie")).toContain("Secure");
  });

  it("limits all API requests to a refillable 60 per IP", async () => {
    let spoof = 0;
    const request = () => new NextRequest("http://localhost:3000/api/decisions", { headers: { "x-forwarded-for": "test-api-ip", "cf-connecting-ip": `spoof-${spoof++}` } });
    for (let i = 0; i < 60; i++) expect((await middleware(request())).status).toBe(401);
    expect((await middleware(request())).status).toBe(429);
    expect(allowApiRequest("test-api-ip", Date.now() + 1000)).toBe(true);
  });
});

describe("persistent daily live budget", () => {
  it("denies the third live reservation and resets on the next UTC day", () => {
    const today = Date.UTC(2026, 8, 23, 12);
    expect(remainingDailyCalls(today)).toBe(2);
    expect(reserveLiveCall(today)).toEqual({ allowed: true, remaining: 1 });
    expect(reserveLiveCall(today)).toEqual({ allowed: true, remaining: 0 });
    expect(reserveLiveCall(today)).toEqual({ allowed: false, remaining: 0 });
    expect(remainingDailyCalls(today + 86_400_000)).toBe(2);
  });

  it("returns the honest unavailable response after exhaustion", async () => {
    reserveLiveCall();
    reserveLiveCall();
    const cookie = issueAccessCookie("test");
    const response = await middleware(new NextRequest("http://localhost:3000/api/decisions", {
      method: "POST", headers: { cookie: `ainalym_demo_access=${cookie}` },
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "Provider unavailable", ai: "unavailable" });
  });

  it("counts each outgoing provider request, including a retry", async () => {
    let sent = 0;
    const upstream = (async () => { sent++; return new Response("ok"); }) as typeof fetch;
    const request = "https://provider.invalid/evaluate";
    expect((await guardedProviderFetch(request, undefined, upstream)).status).toBe(200);
    expect((await guardedProviderFetch(request, undefined, upstream)).status).toBe(200);
    expect((await guardedProviderFetch(request, undefined, upstream)).status).toBe(503);
    expect(sent).toBe(2);
  });
});
