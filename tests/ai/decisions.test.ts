import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetInstance, db } from "../../src/db/client";
import { decide } from "../../src/ai/decisions";
import { loadCatalog } from "../../src/ai/catalog";

const directory = mkdtempSync(join(tmpdir(), "ainalym-ai-decisions-"));
const prior = { DATABASE_PATH: process.env.DATABASE_PATH, AINALYM_MODE: process.env.AINALYM_MODE, AI_PROVIDER: process.env.AI_PROVIDER };
beforeAll(() => {
  process.env.DATABASE_PATH = join(directory, "test.db");
  process.env.AINALYM_MODE = "offline";
  process.env.AI_PROVIDER = "offline";
});
afterAll(() => {
  resetInstance();
  for (const [key, value] of Object.entries(prior)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  rmSync(directory, { recursive: true, force: true });
});

describe("typed decision service", () => {
  it("validates the six-question catalog", () => {
    expect(loadCatalog().questions.map(q => q.id)).toEqual([
      "supplier_fulfilment", "one_off_order", "category_hint", "urgency_override_reason", "change_summary", "supplier_terms_hint",
    ]);
  });

  it("persists a labelled replay judgment with the full distribution", async () => {
    const result = await decide("one_off_order", "DEMO-ONEOFF", { document_qty: 120, threshold: 100 });
    expect(result).toMatchObject({ answer: "one_off", provider: "offline", mode: "replay", result_state: "decided" });
    expect(Object.keys(result.distribution)).toEqual(["one_off", "regular", "unknown"]);
    const row = db().prepare("SELECT * FROM decision_record WHERE id = ?").get(result.id) as Record<string, unknown>;
    expect(row.cache_key).toBe(result.cache_key);
    expect(row.rubric_version).toBe("replenishment-v1");
  });

  it("keeps insufficient, unsupported, and an unrecorded replay distinct", async () => {
    const insufficient = await decide("one_off_order", "DEMO-ONEOFF", { document_qty: 120 });
    const unsupported = await decide("not_in_catalog", "DEMO-ONEOFF", {});
    const unrecorded = await decide("one_off_order", "UNRECORDED", { document_qty: 120, threshold: 100 });
    expect(insufficient.result_state).toBe("insufficient");
    expect(unsupported.result_state).toBe("unsupported");
    expect(unrecorded.result_state).toBe("unsupported");
    expect(insufficient.answer).toBeNull();
    expect(unrecorded.answer).toBeNull();
  });

  it("maps an increasing worker summary to the recorded replay subject", async () => {
    const increased = await decide("change_summary", "RUN-RANDOM", { previous: { qty: 10 }, current: { qty: 20 } });
    expect(increased).toMatchObject({ answer: "increased", mode: "replay", result_state: "decided" });
    const decreased = await decide("change_summary", "RUN-OTHER", { previous: { qty: 20 }, current: { qty: 10 } });
    expect(decreased.result_state).toBe("unsupported");
  });
});
