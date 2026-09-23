import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type EktSource = "ekt_api_live" | "ekt_snapshot";
export type EktProduct = {
  id: string; article: string | null; supplier_article: string | null; name: string;
  category: string | null; characteristics: Record<string, unknown> | null;
  certificates: unknown | null; price: string | null; currency: "KZT";
  stock_total: number | null; stock_by_warehouse: Record<string, number> | null;
  availability: string | null; image_url: string | null; product_url: string | null;
  source: EktSource; as_of: string;
};
export type EktPage = { page: number; per_page: number; count: number; items: EktProduct[]; source: EktSource; as_of: string };
export type EktSnapshot = { fetched_at: string | null; complete: boolean; pages_fetched: number; products: Record<string, EktProduct> };
export type EktMap = Record<string, { id: string; match_kind: string }>;

const base = "https://ekt.kz/api/products";
const userAgent = "Ainalym-HackAlem/1.0";
let nextRequestAt = 0;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export const ektConfigured = () => Boolean(process.env.EKT_API_USER && process.env.EKT_API_PASSWORD);

function fileJson<T>(name: string, fallback: T, path?: string): T {
  try { return JSON.parse(readFileSync(path || join(process.cwd(), "fixtures", name), "utf8")) as T; }
  catch { return fallback; }
}
let snapshotCache: { mtime: number; value: EktSnapshot } | null = null;
let mapCache: { mtime: number; value: EktMap } | null = null;
export function loadSnapshot(path?: string): EktSnapshot {
  const file = path || join(process.cwd(), "fixtures/ekt_snapshot.json");
  let mtime = 0; try { mtime = statSync(file).mtimeMs; } catch { /* missing snapshot */ }
  if (!path && snapshotCache?.mtime === mtime) return snapshotCache.value;
  const value = fileJson<EktSnapshot>("ekt_snapshot.json", { fetched_at: null, complete: false, pages_fetched: 0, products: {} }, file);
  for (const product of Object.values(value.products)) product.source = "ekt_snapshot";
  if (!path) snapshotCache = { mtime, value };
  return value;
}
export function loadMap(): EktMap {
  const file = join(process.cwd(), "fixtures/ekt_map.json");
  let mtime = 0; try { mtime = statSync(file).mtimeMs; } catch { /* missing map */ }
  if (mapCache?.mtime === mtime) return mapCache.value;
  const value = fileJson<EktMap>("ekt_map.json", {});
  mapCache = { mtime, value }; return value;
}

export function normalizeProduct(raw: Record<string, unknown>, source: EktSource, as_of: string): EktProduct {
  const props = raw.properties && typeof raw.properties === "object" && !Array.isArray(raw.properties) ? raw.properties as Record<string, unknown> : null;
  const stores = Array.isArray(raw.stores) ? raw.stores as Record<string, unknown>[] : null;
  const stock = stores ? Object.fromEntries(stores.filter(x => x.name && Number.isFinite(Number(x.quantity))).map(x => [String(x.name), Number(x.quantity)])) : null;
  const quantity = raw.quantity == null ? null : Number(raw.quantity);
  const article = raw.article == null ? null : String(raw.article).trim() || null;
  const url = typeof raw.url === "string" && raw.url.startsWith("https://ekt.kz/") ? raw.url : null;
  const category = typeof raw.category === "string" ? raw.category : url?.split("/")[4] || null;
  return {
    id: String(raw.id), article, supplier_article: props?.ARTIKULPOSTAVSHCHIKA == null ? null : String(props.ARTIKULPOSTAVSHCHIKA).trim() || null,
    name: String(raw.name || ""), category, characteristics: props,
    certificates: props ? Object.fromEntries(Object.entries(props).filter(([key]) => /cert|сертиф/i.test(key))) : null,
    price: raw.price == null || !Number.isFinite(Number(raw.price)) ? null : String(raw.price), currency: "KZT",
    stock_total: quantity !== null && Number.isFinite(quantity) ? quantity : null,
    stock_by_warehouse: stock, availability: quantity === null || !Number.isFinite(quantity) ? null : quantity > 0 ? "in_stock" : "out_of_stock",
    image_url: typeof raw.image === "string" && raw.image.startsWith("https://ekt.kz/") ? raw.image : null,
    product_url: url, source, as_of,
  };
}

async function request(path: string, budgetMs = 8000): Promise<unknown> {
  if (!ektConfigured()) throw new Error("EKT_API_UNCONFIGURED");
  const deadline = Date.now() + budgetMs;
  for (let attempt = 0; attempt < 2; attempt++) {
    const wait = Math.max(0, nextRequestAt - Date.now());
    if (wait) await sleep(wait);
    nextRequestAt = Date.now() + 500;
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("EKT_API_TIMEOUT");
    const authorization = Buffer.from(`${process.env.EKT_API_USER}:${process.env.EKT_API_PASSWORD}`).toString("base64");
    const response = await fetch(`${base}${path}`, { headers: { "User-Agent": userAgent, Authorization: `Basic ${authorization}` }, signal: AbortSignal.timeout(Math.min(8000, remaining)), cache: "no-store" });
    if (response.status >= 500 && attempt === 0) continue;
    if (!response.ok) throw new Error(`EKT_API_HTTP_${response.status}`);
    return response.json();
  }
  throw new Error("EKT_API_UNAVAILABLE");
}

export async function fetchPage(n: number): Promise<EktPage> {
  if (!Number.isSafeInteger(n) || n < 1) throw new Error("Invalid EKT page");
  const as_of = new Date().toISOString();
  const raw = await request(`?page=${n}`) as Record<string, unknown>;
  if (!Array.isArray(raw.items)) throw new Error("EKT_API_BAD_PAGE");
  return { page: Number(raw.page), per_page: Number(raw.per_page), count: Number(raw.count), items: raw.items.map(x => normalizeProduct(x as Record<string, unknown>, "ekt_api_live", as_of)), source: "ekt_api_live", as_of };
}

export async function fetchDetail(id: string | number, budgetMs = 8000): Promise<EktProduct> {
  const key = String(id);
  if (!/^\d+$/.test(key)) throw new Error("Invalid EKT id");
  const as_of = new Date().toISOString();
  const raw = await request(`/detail?id=${key}`, budgetMs) as Record<string, unknown>;
  if (String(raw.id) !== key) throw new Error("EKT_API_BAD_DETAIL");
  return normalizeProduct(raw, "ekt_api_live", as_of);
}

export function findByArticle(article: string, snapshot = loadSnapshot()): EktProduct | null {
  const key = article.trim().toLocaleLowerCase();
  return Object.values(snapshot.products).find(p => p.article?.toLocaleLowerCase() === key || p.supplier_article?.toLocaleLowerCase() === key) || null;
}

export async function ektStatus(): Promise<{ configured: boolean; live_reachable: boolean; last_snapshot_at: string | null; products: number; mapped_skus: number; source: EktSource; as_of: string | null; label: string }> {
  const snapshot = loadSnapshot();
  let live_reachable = false;
  if (ektConfigured()) { try { await request("?page=1", 5000); live_reachable = true; } catch { /* snapshot stays authoritative for status */ } }
  return { configured: ektConfigured(), live_reachable, last_snapshot_at: snapshot.fetched_at, products: Object.keys(snapshot.products).length,
    mapped_skus: Object.keys(loadMap()).length, source: live_reachable ? "ekt_api_live" : "ekt_snapshot",
    as_of: live_reachable ? new Date().toISOString() : snapshot.fetched_at,
    label: live_reachable ? "Каталог ekt.kz · живой API" : `Снимок каталога ekt.kz от ${snapshot.fetched_at?.slice(0, 10) || "неизвестной даты"}` };
}

const detailCache = new Map<string, { until: number; value: EktProduct | null }>();
export async function ektForSku(code: string): Promise<EktProduct | null> {
  const id = loadMap()[code]?.id;
  if (!id) return null;
  const cached = detailCache.get(id);
  if (cached && cached.until > Date.now()) return cached.value;
  const fallback = loadSnapshot().products[id] || null;
  let value = fallback;
  if (ektConfigured()) { try { value = await fetchDetail(id, 5000); } catch { /* verified snapshot fallback */ } }
  detailCache.set(id, { until: Date.now() + 600_000, value });
  return value;
}
