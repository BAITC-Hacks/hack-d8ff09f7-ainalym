import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fetchPage, fetchDetail, loadSnapshot } from '../../src/peers/ekt.ts';
import { mapSkus } from './mapping.mjs';
import { databasePath } from '../../src/db/path.mjs';

const root = process.cwd();
const cap = Math.min(1500, Math.max(1, Number(process.env.EKT_SNAPSHOT_REQUEST_CAP || 1500)));
const pageCap = Math.max(1, Number(process.env.EKT_SNAPSHOT_PAGE_CAP || Infinity));
const snapshotPath = join(root, 'fixtures/ekt_snapshot.json');
const mapPath = join(root, 'fixtures/ekt_map.json');
const imageMapPath = join(root, 'fixtures/sku_images.json');
const dbPath = databasePath();
const imagesOnly = process.env.EKT_SNAPSHOT_IMAGES_ONLY === '1';
const database = new DatabaseSync(dbPath, { readOnly: true });
const skus = database.prepare('SELECT code_1c,supplier_id,article,name FROM sku').all();
let snapshot = loadSnapshot();
let requests = 0;
let page = snapshot.complete ? 1 : snapshot.pages_fetched + 1;
let done = false;
const save = () => writeFileSync(snapshotPath, JSON.stringify(snapshot));
while (!imagesOnly && requests < cap && page <= pageCap) {
  let data;
  try { data = await fetchPage(page); requests++; }
  catch (error) { console.error(`EKT page ${page} stopped: ${error.message}`); break; }
  if (!data.items.length) { done = true; break; }
  for (const item of data.items) snapshot.products[item.id] = item;
  snapshot.fetched_at = data.as_of;
  snapshot.pages_fetched = page;
  snapshot.complete = data.items.length < data.per_page;
  if (page % 50 === 0) { save(); console.log(`pages=${page} products=${Object.keys(snapshot.products).length} requests=${requests}`); }
  if (snapshot.complete) { done = true; break; }
  page++;
}
if (!imagesOnly) save();
let { map, rates } = imagesOnly ? { map: JSON.parse(readFileSync(mapPath, 'utf8')), rates: {} } : mapSkus(skus, snapshot.products);
// Detail records reveal the supplier article and warehouse stock absent from page rows.
const recommended = database.prepare('SELECT DISTINCT code_1c FROM recommendation WHERE COALESCE(qty_adjusted,qty_recommended)>0').all().map(x => x.code_1c);
const ids = [...new Set([...recommended.map(code => map[code]?.id).filter(Boolean), ...Object.values(map).map(x => x.id)])];
for (const id of imagesOnly ? [] : ids) {
  if (requests >= cap) break;
  if (snapshot.products[id]?.stock_total !== null) continue;
  try { snapshot.products[id] = await fetchDetail(id); requests++; }
  catch (error) { console.error(`EKT detail ${id}: ${error.message}`); requests++; }
  if (requests % 50 === 0) save();
}
if (!imagesOnly) {
  save();
  ({ map, rates } = mapSkus(skus, snapshot.products));
  writeFileSync(mapPath, JSON.stringify(map));
  console.log(`EKT snapshot: pages=${snapshot.pages_fetched} products=${Object.keys(snapshot.products).length} complete=${snapshot.complete || done} requests=${requests}`);
  console.log(`EKT mapping: ${JSON.stringify(rates)}`);
}

// Images are restricted to SKUs in a persisted recommendation and a verified map.
const images = existsSync(imageMapPath) ? JSON.parse(readFileSync(imageMapPath, 'utf8')) : {};
const imageDir = join(root, 'public/sku'); mkdirSync(imageDir, { recursive: true });
let downloaded = 0;
for (const code of recommended) {
  if (downloaded >= 600) break;
  const mapped = map[code], product = mapped && snapshot.products[mapped.id];
  if (!mapped || !product?.image_url || images[code]?.kind && images[code].kind !== 'store') continue;
  if (!/^[\w-]+$/.test(code)) continue;
  const target = join(imageDir, `${code}.jpg`);
  if (existsSync(target) && statSync(target).size <= 12288 && images[code]?.kind === 'store') continue;
  try {
    const response = await fetch(product.image_url, { headers: { 'User-Agent': 'Ainalym-HackAlem/1.0' }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) continue;
    writeFileSync(target, Buffer.from(await response.arrayBuffer()));
    execFileSync('sips', ['-s','format','jpeg','-s','formatOptions','65','--resampleHeightWidth','96','96',target], { stdio: 'ignore' });
    if (statSync(target).size > 12288) execFileSync('sips', ['-s','formatOptions','35',target], { stdio: 'ignore' });
    if (statSync(target).size > 12288) { unlinkSync(target); continue; }
    images[code] = { path: `/sku/${code}.jpg`, source: product.image_url, kind: 'store', fetched_at: new Date().toISOString() };
    downloaded++;
    if (downloaded % 25 === 0) writeFileSync(imageMapPath, JSON.stringify(images));
  } catch { if (existsSync(target)) unlinkSync(target); }
  await new Promise(resolve => setTimeout(resolve, 500));
}
writeFileSync(imageMapPath, JSON.stringify(images));
console.log(`EKT thumbnails: ${downloaded}`);
database.close();
