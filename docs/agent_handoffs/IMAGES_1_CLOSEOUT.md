# IMAGES-1 closeout
Gate: GREEN — lane/images; no UI, calculation, schema or runtime dependency changes.
Assets: official 379; store 0; generated SKU 0; category 30 (Higgsfield); 409 JPEG, all 96×96, max 5 654 bytes.
Priority: 400/1 259 positive lines, supplier ASC / cost DESC / code ASC; this selects IEK only.
Hit rates: IEK 379/400 = 94.75%; EKT 0/21; SE not sampled (public Product page probe passed).
Coverage: 1 184/1 259 recommendation rows; remaining 75 return null; exact SKU > supplier category > null.
Credits: 45/1 200, 30 × 1.5; per-call chronological billing attribution, aggregate spend verified.
Evidence: docs/evidence/images/{fetch,categories,generation,verification,checks}.json; fixtures/PROVENANCE.md.
Checks: ETL + offline calc; 2 fetch tests, 7 API/smoke tests; tsc; scoped ESLint; all 3 909 SKU rows; unchanged recommendation response excluding image_url.
Files: docs/evidence/images/files.txt names every changed file; images/registry/scripts plus three API handlers and server lookup.
Caveats: mixed categories are illustrative assortments; category JPEGs landed in asset commit, registration in category commit; no exact SE photos in this capped run.
Fable tip: use image_url quietly in goods rows, hide null; category images are illustrative, not exact SKU claims.
Git tip: refs/heads/lane/images (resolve with git rev-parse lane/images); step commits remain separate.
