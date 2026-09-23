#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { saveJson } from './fetch_sku_images.mjs';
const manifest = JSON.parse(readFileSync('fixtures/sku_images.json', 'utf8'));
function jpegSize(b) {
 assert.equal(b.readUInt16BE(0),0xffd8,'JPEG header');
 for(let i=2;i<b.length;) {
  assert.equal(b[i++],0xff,'JPEG marker'); const marker=b[i++];
  if(marker===0xd9||marker===0xda)break;
  const length=b.readUInt16BE(i);
  if([0xc0,0xc1,0xc2].includes(marker))return [b.readUInt16BE(i+5),b.readUInt16BE(i+3)];
  i+=length;
 }
 throw Error('JPEG dimensions not found');
}
const counts={official:0,store:0,generated:0,category:0};let maxBytes=0;
for(const [key,entry] of Object.entries(manifest)) {
 assert.match(entry.path,/^\/sku\/(?:category\/)?[\w-]+\.jpg$/);
 assert.ok(entry.kind in counts);counts[entry.kind]++;
 assert.ok(Number.isFinite(Date.parse(entry.fetched_at)));
 assert.equal(new URL(entry.source).protocol,'https:');
 if(key.startsWith('category:')) assert.equal(entry.kind,'category');
 else assert.equal(entry.path,`/sku/${key}.jpg`);
 const path='public'+entry.path;assert.ok(existsSync(path));const bytes=statSync(path).size;
 assert.ok(bytes<=12000,`${path}: ${bytes}`);maxBytes=Math.max(maxBytes,bytes);
 assert.deepEqual(jpegSize(readFileSync(path)),[96,96],path);
}
const base=process.env.IMAGES_API||'http://localhost:3410';
const expected = s => manifest[s.code_1c]?.path ?? manifest[`category:${s.supplier_id}:${s.supplier_id==='IEK'?s.code_1c.slice(0,4):s.category}`]?.path ?? null;
let skus=[];
for(let offset=0;;offset+=500){const r=await(await fetch(`${base}/api/skus?limit=500&offset=${offset}`)).json();assert.ok(r.ok);skus.push(...r.items);assert.deepEqual(r.skus,r.items);if(skus.length>=r.total)break;}
for(const sku of skus) assert.equal(sku.image_url,expected(sku),sku.code_1c);
const selected=[skus.find(s=>manifest[s.code_1c]),skus.find(s=>!manifest[s.code_1c]&&s.image_url),skus.find(s=>s.image_url===null)].filter(Boolean);
for(const sku of selected){const r=await(await fetch(`${base}/api/skus/${encodeURIComponent(sku.code_1c)}`)).json();assert.equal(r.sku.image_url,expected(sku));}
const rec=await(await fetch(base+'/api/recommendations')).json();
const byCode=new Map(skus.map(s=>[s.code_1c,s]));let covered=0,total=0;
for(const g of rec.groups)for(const r of g.rows){assert.equal(r.image_url,expected(byCode.get(r.code_1c)));total++;if(r.image_url)covered++;}
const categoryCounts = new Map();
for (const group of rec.groups) for (const row of group.rows) {
 const sku = byCode.get(row.code_1c); if (!sku.category) continue;
 const key = `category:${sku.supplier_id}:${sku.category}`;
 categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
}
const ranked = [...categoryCounts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,30);
const recorded = JSON.parse(readFileSync('docs/evidence/images/categories.json','utf8'));
assert.deepEqual(recorded.map(c=>[c.key,c.count]),ranked,'top 30 category ranking');
const fetchReport = JSON.parse(readFileSync('docs/evidence/images/fetch.json','utf8'));
const priority = rec.groups.flatMap(g=>g.rows).filter(r=>r.qty_recommended>0).map(r=>byCode.get(r.code_1c)).sort((a,b)=>a.supplier_id.localeCompare(b.supplier_id)||Number(b.unit_cost)-Number(a.unit_cost)||a.code_1c.localeCompare(b.code_1c));
assert.deepEqual(fetchReport.selected,priority.slice(0,400).map(s=>s.code_1c));
assert.equal(new Set(fetchReport.rows.map(r=>r.code_1c)).size,400);
assert.ok(fetchReport.finished_at,'fetch completed');
// Fresh response refutes accidental calculation changes: all pre-image response fields must match.
const stripped=structuredClone(rec);for(const g of stripped.groups)for(const r of g.rows)delete r.image_url;
const baseline=JSON.parse(readFileSync('data/images/recommendations.json','utf8'));
for(const g of baseline.groups)for(const r of g.rows)delete r.image_url;
assert.deepEqual(stripped,baseline);
for(const path of new Set(selected.map(s=>s.image_url).filter(Boolean))){const r=await fetch(base+path);assert.equal(r.status,200);assert.equal(r.headers.get('content-type')?.split(';')[0],'image/jpeg');assert.deepEqual(jpegSize(Buffer.from(await r.arrayBuffer())),[96,96]);}
const ledger=JSON.parse(readFileSync('docs/evidence/images/generation.json','utf8'));assert.ok(ledger.credits_used<=1200);assert.equal(ledger.calls.filter(x=>x.status==='completed').length,30);
const report={verified_at:new Date().toISOString(),counts,max_bytes:maxBytes,dimensions:'all 96x96 JPEG',sku_api_rows:skus.length,recommended_rows:total,recommended_with_image:covered,detail_cases:selected.map(s=>({code_1c:s.code_1c,image_url:s.image_url})),calculation_response_unchanged:true,priority_and_top_30_categories_verified:true,credits_used:ledger.credits_used,checks:'fixture integrity; list + alias; exact/category/null detail; every recommendation URL; served JPEG bytes; baseline recommendation response deep equality'};
saveJson('docs/evidence/images/verification.json',report);console.log(JSON.stringify(report,null,2));
