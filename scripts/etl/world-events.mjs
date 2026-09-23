import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const i=process.argv.indexOf('--db');
const path=i<0?join(process.cwd(),'data/partner.db'):process.argv[i+1];
if(!path)throw new Error('--db requires a path');
const d=new DatabaseSync(path);
const events=[];
const org_id='partner';
for(const supplier_id of ['IEK','SE']){
  const days=d.prepare('SELECT DISTINCT substr(l.at,1,10) day FROM sales_line l JOIN sku k ON k.code_1c=l.code_1c WHERE k.supplier_id=? ORDER BY day DESC LIMIT 20').all(supplier_id).map(r=>r.day);
  if(days.length!==20)throw new Error(`Fewer than 20 sales days: ${supplier_id}`);
  const lines=d.prepare('SELECT code_1c,doc_no,doc_type,at,warehouse,qty FROM sales_line WHERE substr(at,1,10)=? AND code_1c IN (SELECT code_1c FROM sku WHERE supplier_id=?) ORDER BY at,id');
  for(const day of days){
    events.push({kind:'sales_day',org_id,source_id:`SALES-${supplier_id}-${day}`,at:`${day}T23:59:59`,payload:{supplier_id,date:day,lines:lines.all(day,supplier_id)}});
  }
}
const ym=d.prepare('SELECT max(ym) ym FROM stock_month').get().ym;
const stocks=d.prepare('SELECT s.code_1c,k.supplier_id,s.opening_qty,s.known FROM stock_month s JOIN sku k ON k.code_1c=s.code_1c WHERE s.ym=? ORDER BY s.code_1c').all(ym);
events.push({kind:'stock_snapshot',org_id,source_id:`STOCK-${ym}`,at:`${ym}-01T00:00:00`,payload:{ym,stocks}});
const transit=d.prepare("SELECT t.code_1c,t.po_ref,t.qty,t.expected_at,t.source_file FROM in_transit t JOIN sku k ON k.code_1c=t.code_1c WHERE k.supplier_id='SE' ORDER BY t.code_1c,t.po_ref").all();
events.push({kind:'in_transit_update',org_id,source_id:'TRANSIT-SE-2026-09-22',at:'2026-09-22T18:00:00',payload:{supplier_id:'SE',rows:transit}});
events.push({kind:'judge_message',org_id,source_id:'JUDGE-ONEOFF-5000',at:'2026-09-23T09:00:00',code_1c:'010500008_',text:'Добавьте разовый документ на 5000 шт. за прошлый месяц и покажите исключение.',payload:{preset:'oneoff',action:'inject_sales_line',line:{code_1c:'010500008_',doc_no:'JUDGE-ONEOFF-5000',doc_type:'Расходная накладная',at:'2026-08-22T12:00:00',warehouse:'Алматы',qty:'5000'}}});
events.push({kind:'judge_message',org_id,source_id:'JUDGE-TRANSIT-PLUS-100',at:'2026-09-23T09:01:00',code_1c:'010500006_',text:'Увеличьте товар в пути для этого кода на 100 шт. и пересчитайте потребность.',payload:{preset:'intransit',action:'adjust_in_transit',code_1c:'010500006_',delta_qty:100}});
events.push({kind:'judge_message',org_id,source_id:'JUDGE-SE-PRICE',at:'2026-09-23T09:02:00',code_1c:'130300027_',text:'Обновите себестоимость товара СЭ с 327 до 360 KZT.',payload:{preset:'price_update',action:'update_unit_cost',code_1c:'130300027_',from:'327',to:'360',currency:'KZT'}});
events.sort((a,b)=>a.at.localeCompare(b.at)||a.source_id.localeCompare(b.source_id));
const ids=new Set();
for(let j=0;j<events.length;j++){const e=events[j];if(ids.has(e.source_id))throw new Error(`Duplicate source_id ${e.source_id}`);ids.add(e.source_id);e.seq=j+1;e.id=`WE-${String(j+1).padStart(3,'0')}`;e.state='scripted';}
writeFileSync(join(process.cwd(),'fixtures/world_events.jsonl'),events.map(e=>JSON.stringify(e)).join('\n')+'\n');
console.log(`world events: ${events.length} (sales days ${events.filter(e=>e.kind==='sales_day').length})`);
d.close();
