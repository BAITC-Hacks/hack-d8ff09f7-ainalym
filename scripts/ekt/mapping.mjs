export const key = value => String(value || '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const grams = value => { const s = `  ${key(value)}  `; return new Set(Array.from({ length: Math.max(0, s.length - 2) }, (_, i) => s.slice(i, i + 3))); };
export function similarity(a, b) {
  const x = grams(a), y = grams(b);
  if (!x.size || !y.size) return 0;
  let common = 0; for (const gram of x) if (y.has(gram)) common++;
  return 2 * common / (x.size + y.size);
}
export function mapSkus(skus, products) {
  const values = Object.values(products);
  const article = new Map(), code = new Map(), names = new Map();
  for (const p of values) {
    for (const value of [p.article, p.supplier_article]) if (key(value)) {
      const k = key(value); if (!article.has(k)) article.set(k, p);
    }
    const n = key(p.name); if (n) { const prefix = n.slice(0, 12); if (!names.has(prefix)) names.set(prefix, []); names.get(prefix).push(p); }
    if (key(p.article)) code.set(key(p.article), p);
  }
  const result = {}, rates = {};
  for (const sku of skus) {
    const supplier = sku.supplier_id;
    rates[supplier] ||= { total: 0, mapped: 0, supplier_article: 0, name: 0, code_1c: 0 };
    rates[supplier].total++;
    let p = sku.article ? article.get(key(sku.article)) : null;
    let match_kind = 'supplier_article';
    if (!p) { p = code.get(key(sku.code_1c)); match_kind = 'code_1c'; }
    if (!p) {
      const n = key(sku.name), candidates = names.get(n.slice(0, 12)) || [];
      let best = 0;
      for (const candidate of candidates) { const score = similarity(n, candidate.name); if (score > best) { best = score; p = candidate; } }
      if (best < 0.9) p = null;
      match_kind = 'name';
    }
    if (p) { result[sku.code_1c] = { id: p.id, match_kind }; rates[supplier].mapped++; rates[supplier][match_kind]++; }
  }
  return { map: result, rates };
}
