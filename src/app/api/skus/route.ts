import { skuImageUrl } from "@/server/sku_images";
import { countSkus, listSkus } from "@/domain/skus";
import { SkuQuerySchema } from "@/server/contracts";
import { handle, ok } from "@/server/http";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return handle(() => {
    const query = SkuQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const items = listSkus(query).map(sku => ({ ...sku, image_url: skuImageUrl(sku) }));
    return ok({ items, skus: items, total: countSkus(query) });
  });
}
