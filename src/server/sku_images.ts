import manifest from '../../fixtures/sku_images.json';

type ImageEntry = { path: string; source: string; kind: string; fetched_at: string };
const images: Record<string, ImageEntry> = manifest;

/** Illustrative metadata only: never used by the calculation or persisted SKU rows. */
export function skuImageUrl(sku: { code_1c?: unknown; supplier_id?: unknown; category?: unknown }): string | null {
  const code = String(sku.code_1c ?? '');
  const category = sku.supplier_id === 'IEK' ? code.slice(0, 4) : sku.category;
  const entry = images[code] ?? (category == null ? undefined : images[`category:${sku.supplier_id}:${category}`]);
  return entry?.path ?? null;
}
