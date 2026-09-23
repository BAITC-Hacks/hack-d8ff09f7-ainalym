import { expect, it } from "vitest";
import { dbPath } from "../../src/db/client";

it("uses the configured mounted database without rewriting its filename", () => {
  const previous = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = "/data/ainalym.db";
  try {
    expect(dbPath()).toBe("/data/ainalym.db");
  } finally {
    if (previous === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previous;
  }
});
