import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import recorded from "../fixtures/ekt_api.json";
import { ektConfigured, fetchDetail, fetchPage, findByArticle, loadSnapshot, normalizeProduct } from "@/peers/ekt";
import { mapSkus, similarity } from "../../scripts/ekt/mapping.mjs";

const originalUser = process.env.EKT_API_USER, originalPassword = process.env.EKT_API_PASSWORD;
afterEach(() => {
  vi.unstubAllGlobals();
  if (originalUser === undefined) delete process.env.EKT_API_USER; else process.env.EKT_API_USER = originalUser;
  if (originalPassword === undefined) delete process.env.EKT_API_PASSWORD; else process.env.EKT_API_PASSWORD = originalPassword;
});

it("normalizes recorded page and detail while keeping unknown stock null", () => {
  const at = "2026-09-23T00:00:00.000Z";
  const page = normalizeProduct(recorded.page.items[0], "ekt_api_live", at);
  const detail = normalizeProduct(recorded.detail, "ekt_api_live", at);
  expect(page.stock_total).toBeNull();
  expect(page.price).toBe("1810");
  expect(detail.stock_total).toBe(0);
  expect(detail.stock_by_warehouse).toEqual({ "Основной склад": 0 });
  expect(detail.availability).toBe("out_of_stock");
  expect(detail.supplier_article).toBe("ярп4520");
});

it("loads a dated snapshot and finds articles without network", () => {
  const dir = mkdtempSync(join(tmpdir(), "ekt-test-"));
  try {
    const product = normalizeProduct(recorded.detail, "ekt_snapshot", "2026-09-23T00:00:00.000Z");
    const path = join(dir, "snapshot.json");
    writeFileSync(path, JSON.stringify({ fetched_at: product.as_of, complete: false, pages_fetched: 1, products: { [product.id]: product } }));
    const snapshot = loadSnapshot(path);
    expect(snapshot.pages_fetched).toBe(1);
    expect(findByArticle("ЯРП4520", snapshot)?.source).toBe("ekt_snapshot");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it("maps supplier article before code and only strong name matches", () => {
  const products = {
    "1": { id: "1", article: "A-1", supplier_article: null, name: "Автоматический выключатель 16А" },
    "2": { id: "2", article: "B-2", supplier_article: null, name: "Кабель медный 3х2.5" },
  };
  const skus = [
    { code_1c: "C-1", supplier_id: "IEK", article: "A-1", name: "Другое" },
    { code_1c: "B-2", supplier_id: "SE", article: "unknown", name: "Другое" },
    { code_1c: "C-3", supplier_id: "SE", article: null, name: "Кабель медный 3х2.5" },
  ];
  const result = mapSkus(skus, products);
  const mapped = result.map as Record<string, { id: string; match_kind: string }>;
  expect(mapped["C-1"]).toEqual({ id: "1", match_kind: "supplier_article" });
  expect(mapped["B-2"].match_kind).toBe("code_1c");
  expect(mapped["C-3"].match_kind).toBe("name");
  expect(similarity("кабель медный", "совсем другой товар")).toBeLessThan(0.9);
});

it("uses Basic for read-only page/detail and never calls network without env", async () => {
  delete process.env.EKT_API_USER; delete process.env.EKT_API_PASSWORD;
  const mocked = vi.fn(); vi.stubGlobal("fetch", mocked);
  expect(ektConfigured()).toBe(false);
  await expect(fetchPage(1)).rejects.toThrow("EKT_API_UNCONFIGURED");
  expect(mocked).not.toHaveBeenCalled();
  process.env.EKT_API_USER = "fixture-user"; process.env.EKT_API_PASSWORD = "fixture-password";
  mocked.mockResolvedValueOnce(Response.json(recorded.page)).mockResolvedValueOnce(Response.json(recorded.detail));
  const page = await fetchPage(1), detail = await fetchDetail(45357);
  expect(page.items[0].source).toBe("ekt_api_live");
  expect(detail.stock_total).toBe(0);
  expect(mocked.mock.calls[0][1].headers["User-Agent"]).toBe("Ainalym-HackAlem/1.0");
  expect(mocked.mock.calls[0][1].headers.Authorization).toMatch(/^Basic /);
});

it("live smoke", async ctx => {
  if (process.env.AINALYM_LIVE_SMOKE !== "1") ctx.skip("UNVERIFIED: live ekt.kz API not exercised (set AINALYM_LIVE_SMOKE=1)");
  if (!ektConfigured()) ctx.skip("UNVERIFIED: EKT API credentials missing");
  expect((await fetchPage(1)).items.length).toBeGreaterThan(0);
});
