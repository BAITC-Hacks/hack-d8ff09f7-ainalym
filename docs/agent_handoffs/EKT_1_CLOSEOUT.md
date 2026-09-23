# EKT-1 closeout

- Auth: HTTP Basic request with environment credentials returned 200 JSON; anonymous request returned 401.
- Catalog: complete 752 pages, 15,037 products, 698 detailed products. Out-of-range pages repeat page 1.
- SKU map: IEK 2,776/3,185 (87.2%); SE 607/724 (83.8%). Exact supplier article, exact 1C code, then name ≥0.9.
- Images: 600 mapped recommendation thumbnails, each 96×96 and ≤12 KB; 698 mapped product details have warehouse stock.
- Files: `src/peers/ekt.ts`, `scripts/ekt/{snapshot,mapping}.mjs`, three existing API routes plus `/api/ekt/status`, `fixtures/{ekt_snapshot,ekt_map,sku_images}.json`, `public/sku/`, tests, deploy allowlist, env example, contracts, provenance.
- Checks: `npm run etl && npm run check` — 229 passed, 0 failed, 7 externally unverified; `npm run build` — passed; EKT live smoke 5/5; live `/api/skus/:code` returned `ekt_api_live` in 1.1 s.
- Unverified: list-only stock and unmatched SKU identity; both remain null rather than inferred.
- Tip: refresh with `DATABASE_PATH=./data/partner.db npm run ekt:snapshot`; the command resumes from the last page and uses the environment credentials. Keep the snapshot labeled with its date.
