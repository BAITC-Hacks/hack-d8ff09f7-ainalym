import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { databasePath } from '../../src/db/path.mjs';

const i = process.argv.indexOf('--db');
const path = i < 0 ? databasePath() : process.argv[i+1];
if (!path) throw new Error('--db requires a path');
const d = new DatabaseSync(path);
const median = sorted => sorted.length ? (sorted[Math.floor((sorted.length-1)/2)] + sorted[Math.floor(sorted.length/2)])/2 : null;
const p95 = sorted => sorted.length ? sorted[Math.ceil(sorted.length*.95)-1] : null;
const prev = (ym,n) => { const [y,m]=ym.split('-').map(Number); const z=y*12+m-1-n; return `${Math.floor(z/12)}-${String(z%12+1).padStart(2,'0')}`; };

d.exec('BEGIN');
try {
  d.exec('DELETE FROM season_index');
  const seasonRows=d.prepare('SELECT supplier_id,year,month,CAST(revenue_kzt AS REAL) revenue FROM seasonality WHERE year IN (2024,2025)').all();
  const groups=new Map();
  for(const r of seasonRows){const key=`${r.supplier_id}|${r.year}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
  const bySupplier=new Map();
  for(const [key,rs] of groups){if(rs.length!==12)throw new Error(`Incomplete full-year seasonality: ${key}`);const sum=rs.reduce((a,r)=>a+r.revenue,0);if(sum<=0)throw new Error(`Zero revenue: ${key}`);const s=key.split('|')[0];if(!bySupplier.has(s))bySupplier.set(s,new Map());for(const r of rs){const map=bySupplier.get(s);if(!map.has(r.month))map.set(r.month,[]);map.get(r.month).push(r.revenue*12/sum);}}
  const indexInsert=d.prepare('INSERT INTO season_index (supplier_id,month,idx) VALUES (?,?,?)');
  for(const [s,months] of bySupplier){const raw=[...Array(12)].map((_,i)=>{const a=months.get(i+1);if(a?.length!==2)throw new Error(`Missing season year: ${s} ${i+1}`);return a.reduce((x,y)=>x+y,0)/2;});const mean=raw.reduce((x,y)=>x+y,0)/12;raw.forEach((x,i)=>indexInsert.run(s,i+1,String(x/mean)));}

  const monthRows=d.prepare('SELECT code_1c,ym,qty_file,qty_lines FROM sales_month ORDER BY code_1c,ym').all();
  const sales=new Map(), stats=new Map();
  for(const r of monthRows){const qty=Number(r.qty_file ?? r.qty_lines ?? 0);sales.set(`${r.code_1c}|${r.ym}`,qty);if(qty>0){if(!stats.has(r.code_1c))stats.set(r.code_1c,{months:[],first:r.ym});stats.get(r.code_1c).months.push(qty);}}
  const observedUpdate=d.prepare("UPDATE sales_month SET stockout=1,stockout_kind='observed' WHERE code_1c=? AND ym=?");
  const inferredUpdate=d.prepare("UPDATE sales_month SET stockout=1,stockout_kind='inferred' WHERE code_1c=? AND ym=?");
  d.exec('UPDATE sales_month SET stockout=0,stockout_kind=NULL');
  for(const r of d.prepare('SELECT code_1c,ym,opening_qty,known FROM stock_month').iterate()){
    const prior=[1,2,3].filter(n=>(sales.get(`${r.code_1c}|${prev(r.ym,n)}`)||0)>0).length;
    if(prior<2)continue;
    if(r.known===1 && r.opening_qty!==null && Number(r.opening_qty)===0)observedUpdate.run(r.code_1c,r.ym);
    else if(r.known!==1 || r.opening_qty===null)inferredUpdate.run(r.code_1c,r.ym);
  }
  const docQty=new Map();
  for(const r of d.prepare("SELECT code_1c,SUM(CAST(qty AS REAL)) qty FROM sales_line WHERE doc_type='Расходная накладная' GROUP BY code_1c,COALESCE(doc_no,'line:'||id),substr(at,1,7) HAVING qty>0 ORDER BY code_1c").iterate()){
    if(!docQty.has(r.code_1c))docQty.set(r.code_1c,[]);docQty.get(r.code_1c).push(r.qty);
  }
  const updateSku=d.prepare('UPDATE sku SET first_sale_ym=?,months_with_sales=?,median_month_qty=?,p95_doc_qty=? WHERE code_1c=?');
  for(const r of d.prepare('SELECT code_1c FROM sku').iterate()){
    const st=stats.get(r.code_1c), m=st?.months||[], docs=docQty.get(r.code_1c)||[];
    m.sort((a,b)=>a-b);docs.sort((a,b)=>a-b);
    updateSku.run(st?.first||null,m.length,median(m)?.toString()||null,p95(docs)?.toString()||null,r.code_1c);
  }
  d.exec('COMMIT');
}catch(e){d.exec('ROLLBACK');d.close();throw e;}
console.log(`season_index: ${d.prepare('SELECT count(*) n FROM season_index').get().n}`);
console.log(`stockout months: ${d.prepare('SELECT count(*) n FROM sales_month WHERE stockout=1').get().n}`);
d.close();
