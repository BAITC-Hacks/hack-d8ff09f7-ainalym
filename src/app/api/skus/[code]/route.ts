import { db } from "@/db/client";
import { skuView } from "@/domain/skus";
import { handle, HttpError, ok } from "@/server/http";
import { ektForSku } from "@/peers/ekt";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ code: string }> }): Promise<Response> {
  return handle(async () => {
    const { code } = await context.params;
    const sku = db().prepare("SELECT * FROM sku WHERE code_1c = ?").get(code);
    if (!sku) throw new HttpError(404, "not_found", "SKU not found");
    const product = await ektForSku(code);
    const ekt = product ? { id: product.id, url: product.product_url, price: product.price, currency: product.currency,
      stock_total: product.stock_total, stock_by_warehouse: product.stock_by_warehouse, availability: product.availability,
      image_url: product.image_url, as_of: product.as_of, source: product.source } : null;
    const view = await skuView(code);
    if (view) return ok({ ...view, ekt });
    const series = db().prepare(`SELECT sm.ym, sm.qty_file, sm.qty_regular, st.opening_qty AS stock, sm.stockout
      FROM sales_month sm LEFT JOIN stock_month st ON st.code_1c=sm.code_1c AND st.ym=sm.ym WHERE sm.code_1c=? ORDER BY sm.ym`).all(code);
    const forecast = db().prepare("SELECT * FROM forecast WHERE code_1c = ? ORDER BY rowid DESC LIMIT 1").get(code) || null;
    const recommendation = db().prepare("SELECT * FROM recommendation WHERE code_1c = ? ORDER BY rowid DESC LIMIT 1").get(code) || null;
    const in_transit = db().prepare("SELECT * FROM in_transit WHERE code_1c = ?").all(code);
    const timeline = db().prepare("SELECT * FROM agent_action WHERE code_1c = ? ORDER BY at DESC LIMIT 100").all(code);
    return ok({ sku, series, forecast, recommendation, in_transit, timeline, ekt });
  });
}
