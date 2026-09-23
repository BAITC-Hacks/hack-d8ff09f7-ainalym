import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db, resetInstance } from "../../src/db/client";
import { DraftProviderUnavailable, prepareSupplierEmail, readArtifact } from "../../src/ai/drafting";
import { POST as postDraft } from "../../src/app/api/drafts/route";
import { GET as getArtifact } from "../../src/app/api/artifacts/[id]/route";
import { GET as downloadArtifact } from "../../src/app/api/artifacts/[id]/download/route";

const generated = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ generateObject: generated }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: () => (_model: string) => ({}) }));
const directory = mkdtempSync(join(tmpdir(), "ainalym-artifacts-"));
const prior = { ARTIFACT_PATH: process.env.ARTIFACT_PATH, OPENAI_API_KEY: process.env.OPENAI_API_KEY };

beforeAll(() => {
  resetInstance();
  process.env.ARTIFACT_PATH = directory;
  db().prepare("INSERT INTO supplier(id,name,lead_time_days) VALUES ('SE','System Electric',50)").run();
  db().prepare("INSERT INTO sku(code_1c,supplier_id,name,article) VALUES ('SE-TEST','SE','Автоматический выключатель','A-123')").run();
  db().prepare("INSERT INTO purchase_order(id,supplier_id,state,total_qty) VALUES ('PO-APPROVED','SE','approved',12)").run();
  db().prepare("INSERT INTO purchase_order(id,supplier_id,state,total_qty) VALUES ('PO-DRAFT','SE','draft',12)").run();
  db().prepare("INSERT INTO purchase_order_line(po_id,code_1c,qty) VALUES ('PO-APPROVED','SE-TEST',12)").run();
});
afterAll(() => {
  resetInstance();
  for (const [key, value] of Object.entries(prior)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  rmSync(directory, { recursive: true, force: true });
});

describe("supplier draft", () => {
  it("requires approval before any model call", async () => {
    process.env.OPENAI_API_KEY = "test-only-key";
    await expect(prepareSupplierEmail("PO-DRAFT")).rejects.toThrow("purchase_order_not_approved");
    expect(generated).not.toHaveBeenCalled();
  });

  it("labels a missing drafting provider", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(prepareSupplierEmail("PO-APPROVED")).rejects.toBeInstanceOf(DraftProviderUnavailable);
  });

  it("revises overclaimed text and preserves exact line sources", async () => {
    process.env.OPENAI_API_KEY = "test-only-key";
    generated.mockResolvedValueOnce({ object: { greeting_ru: "Заказ отправлен поставщику.", closing_ru: "Спасибо." }, response: { modelId: "test-model" } });
    const artifact = await prepareSupplierEmail("PO-APPROVED");
    expect(artifact).toMatchObject({ state: "needs_review", consistency: "revised", model_version: "test-model", label: "Подготовить, не отправлять" });
    expect(artifact.markdown).toContain("SE-TEST");
    expect(artifact.markdown).toContain("12 шт");
    expect(artifact.markdown).not.toContain("Заказ отправлен");
    expect(readArtifact(artifact.id)?.markdown).toBe(artifact.markdown);
    const params = { params: Promise.resolve({ id: artifact.id }) };
    expect((await getArtifact(new Request("http://localhost"), params)).status).toBe(200);
    const download = await downloadArtifact(new Request("http://localhost"), params);
    expect(download.headers.get("content-type")).toContain("text/markdown");
    expect(await download.text()).toBe(artifact.markdown);
  });

  it("removes invented quantities from generated prose", async () => {
    process.env.OPENAI_API_KEY = "test-only-key";
    generated.mockResolvedValueOnce({ object: { greeting_ru: "Просим 9999 штук.", closing_ru: "Спасибо." }, response: { modelId: "test-model" } });
    const artifact = await prepareSupplierEmail("PO-APPROVED");
    expect(artifact.consistency).toBe("revised");
    expect(artifact.markdown).not.toContain("9999");
    expect(artifact.markdown).toContain("12 шт");
  });

  it("prepares a reviewable supplier artifact through POST /api/drafts", async () => {
    process.env.OPENAI_API_KEY = "test-only-key";
    generated.mockResolvedValueOnce({ object: { greeting_ru: "Здравствуйте.", closing_ru: "С уважением, отдел закупок." }, response: { modelId: "test-model" } });
    const response = await postDraft(new Request("http://localhost/api/drafts", {
      method: "POST", body: JSON.stringify({ kind: "supplier_email", po_id: "PO-APPROVED" }),
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.artifact).toMatchObject({ kind: "supplier_email", state: "needs_review", provider: "openai" });
    expect(body.artifact.markdown).toContain("SE-TEST");
    expect(body.artifact.markdown).toContain("12 шт");
    expect(body.artifact.sources).toEqual(["PO-APPROVED", "sku:SE-TEST"]);
  });
});
