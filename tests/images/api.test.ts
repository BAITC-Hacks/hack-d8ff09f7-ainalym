import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../../fixtures/sku_images.json', () => ({default: {
 '010300002_': {path:'/sku/exact.jpg'},
 'category:IEK:0103': {path:'/sku/category/iek-0103.jpg'},
 'category:SE:1': {path:'/sku/category/se-1.jpg'},
}}));
import { db, resetInstance } from '../../src/db/client';
import { skuImageUrl } from '../../src/server/sku_images';
import { GET as list } from '../../src/app/api/skus/route';
import { GET as detail } from '../../src/app/api/skus/[code]/route';
import { GET as recommendations } from '../../src/app/api/recommendations/route';
beforeEach(() => {
 resetInstance();
 db().exec(`INSERT INTO supplier(id,name,lead_time_days,review_days) VALUES ('IEK','IEK',40,30),('SE','SE',50,30);
 INSERT INTO sku(code_1c,supplier_id,name,category) VALUES ('010300002_','IEK','Exact','0103'),('010399999_','IEK','Fallback','0103'),('SE-1','SE','SE fallback','1'),('unknown','SE','No image',NULL);
 INSERT INTO calc_run(id,scope,params,started_at,skus) VALUES ('run','{}','{}','2026-09-23',4);
 INSERT INTO recommendation(id,run_id,code_1c,supplier_id,qty_recommended,on_hand,in_transit,urgency,rationale_ru,components) VALUES ('rec','run','010399999_','IEK',1,'0','0','normal','test','{}');`);
});
afterEach(() => resetInstance());
it('uses exact > supplier category > null, with IEK prefix and SE category rules', () => {
 expect(skuImageUrl({code_1c:'010300002_',supplier_id:'IEK'})).toBe('/sku/exact.jpg');
 expect(skuImageUrl({code_1c:'010399999_',supplier_id:'IEK'})).toBe('/sku/category/iek-0103.jpg');
 expect(skuImageUrl({code_1c:'SE-1',supplier_id:'SE',category:'1'})).toBe('/sku/category/se-1.jpg');
 expect(skuImageUrl({code_1c:'unknown',supplier_id:'SE'})).toBeNull();
});
it('adds image_url consistently to list, detail and recommendation without DB mutation', async () => {
 const before=db().prepare('SELECT * FROM sku ORDER BY code_1c').all();
 const items=(await (await list(new Request('http://localhost/api/skus'))).json()).items;
 expect(items.find((x:{code_1c:string})=>x.code_1c==='unknown').image_url).toBeNull();
 const single=await (await detail(new Request('http://localhost'),{params:Promise.resolve({code:'010300002_'})})).json();
 expect(single.sku.image_url).toBe('/sku/exact.jpg');
 const rec=await (await recommendations(new Request('http://localhost/api/recommendations'))).json();
 expect(rec.groups[0].rows[0].image_url).toBe('/sku/category/iek-0103.jpg');
 expect(db().prepare('SELECT * FROM sku ORDER BY code_1c').all()).toEqual(before);
});
