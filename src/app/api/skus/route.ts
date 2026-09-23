import { skuImageUrl } from "@/server/sku_images";
import { countSkus, listSkus } from "@/domain/skus";
import { SkuQuerySchema } from "@/server/contracts";
import { handle, ok } from "@/server/http";
import { loadMap, loadSnapshot } from "@/peers/ekt";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return handle(() => {
    const query = SkuQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const map = loadMap(), snapshot = loadSnapshot();
    const items = listSkus(query).map(item => {
      const product = snapshot.products[map[String(item.code_1c)]?.id];
      return { ...item, image_url: skuImageUrl(item) ?? product?.image_url ?? null, ekt_url: product?.product_url ?? null, ekt_stock_total: product?.stock_total ?? null };
    });
    return ok({ items, skus: items, total: countSkus(query) });
  });
}
