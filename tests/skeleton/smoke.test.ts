import { describe, expect, it } from "vitest";
import { GET } from "../../src/app/api/health/route";

describe("skeleton", () => {
  it("GET /api/health reports an available database", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
  });
});
