import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../../src/app/api/health/route";
import { middleware } from "../../src/middleware";
import { NextRequest } from "next/server";
import { resetInstance } from "../../src/db/client";

const priorPath = process.env.DATABASE_PATH;
const priorGuard = process.env.DEMO_ACCESS_CODE;
afterEach(() => { resetInstance(); process.env.DATABASE_PATH = priorPath; process.env.DEMO_ACCESS_CODE = priorGuard; });

describe("skeleton", () => {
  it("GET /api/health reports an available database", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
  });

  it("lets the route report contracted fields through the demo guard", async () => {
    process.env.DEMO_ACCESS_CODE = "test";
    const response = await middleware(new NextRequest("http://localhost/api/health"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    const health = await GET();
    expect(await health.json()).toMatchObject({ ok: true, db: "ok", demo_guard: "on", version: expect.any(Number), providers: expect.any(Object) });
  });

  it("reports SQLite failure rather than success", async () => {
    resetInstance();
    process.env.DATABASE_PATH = "/dev/null";
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, code: "database_unavailable" });
  });
});
