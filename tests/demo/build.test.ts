import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("production container", () => {
  it("builds from a Dockerfile with a health check", () => {
    const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");
    expect(dockerfile).toMatch(/FROM node:24-(alpine|slim)/);
    expect(dockerfile).toMatch(/npm ci/);
    expect(dockerfile).toMatch(/npm run build/);
    expect(dockerfile).toMatch(/HEALTHCHECK/);
    expect(dockerfile).toMatch(/\/api\/health/);
  });

  it("never sends local environment files into the image", () => {
    const ignore = readFileSync(join(root, ".dockerignore"), "utf8");
    expect(ignore).toMatch(/^\.env\*/m);
    expect(ignore).toMatch(/^node_modules\/?$/m);
    expect(ignore).toMatch(/^\.next\/?$/m);
    expect(ignore).toMatch(/^data\/?$/m);
    expect(ignore).toMatch(/^docs\/evidence\/?$/m);
  });
});
