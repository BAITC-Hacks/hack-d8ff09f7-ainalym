import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import XLSX from 'xlsx';

const root = process.cwd();
const dbArg = process.argv.indexOf('--db');
const dbPath = dbArg < 0 ? join(root, 'data/partner.db') : process.argv[dbArg + 1];
if (!dbPath) throw new Error('--db requires a path');
mkdirSync(dirname(dbPath), { recursive: true });
const d = new DatabaseSync(dbPath);
d.exec(readFileSync(join(root, 'src/db/schema.sql'), 'utf8'));

const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const monthOf = h => { const v = String(h ?? '').trim().toLowerCase(); const m = v.match(/20\d\d/); if (!m) return null; const i = months.findIndex(x => v.startsWith(x)); return i < 0 ? null : `${m[0]}-${String(i + 1).padStart(2, '0')}`; };
const str = v => String(v ?? '').trim();
const num = v => { const s = str(v).replace(/[\s,\u00a0]/g, ''); if (!s || s === '-') return 0; const n = Number(s); if (!Number.isFinite(n)) throw new Error(`Invalid number: ${v}`); return n; };
const dec = v => String(num(v));
const files = Object.fromEntries(['IEK', 'SE'].map(s => [s, readdirSync(join(root, 'fixtures/partner', s)).map(n => ({ name:n, path:join(root, 'fixtures/partner', s, n) }))]));
const file = (s, starts) => { const f = files[s].find(x => x.name.startsWith(starts)); if (!f) throw new Error(`Missing ${s} ${starts}`); return f; };
const rows = (f, sheet) => { const w = XLSX.readFile(f.path, { cellDates:false }); const n = sheet || w.SheetNames[0]; if (!w.Sheets[n]) throw new Error(`Missing sheet ${n}: ${f.name}`); return XLSX.utils.sheet_to_json(w.Sheets[n], { header:1, raw:false, defval:'' }); };
const requireHeaders = (header, fields, f) => { for (const x of fields) if (!header.map(str).includes(x)) throw new Error(`Missing header ${x}: ${f.name}`); };
const at = value => { const m = str(value).match(/^(\d\d)\.(\d\d)\.(\d{4})\s+(\d{1,2}):(\d\d):(\d\d)$/); if (!m) throw new Error(`Bad sales date: ${value}`); return `${m[3]}-${m[2]}-${m[1]}T${m[4].padStart(2,'0')}:${m[5]}:${m[6]}`; };
const catalog = new Map();
function sku(s, code, fields={}) {
  code = str(code); if (!code || code === 'Итого') return;
  const old = catalog.get(code);
  if (old && old.supplier_id !== s) throw new Error(`Cross-supplier code collision: ${code}`);
  const v = old || { code_1c:code, supplier_id:s, article:null, name:code, unit:null, category:s === 'IEK' ? code.slice(0,4) : null, unit_cost:null, moq:1, weight:null };
  for (const [k, x] of Object.entries(fields)) if (x !== null && x !== undefined && str(x)) v[k] = x;
  catalog.set(code, v);
}
const source = f => relative(root, f.path);
const run = (sql, data) => d.prepare(sql).run(...data);

d.exec('BEGIN');
try {
  for (const table of ['sales_line','sales_month','stock_month','in_transit','seasonality','season_index','sku','supplier']) d.exec(`DELETE FROM ${table}`);
  run('INSERT INTO supplier (id,name,lead_time_days,review_days,terms) VALUES (?,?,?,?,?)', ['IEK','IEK',40,30,JSON.stringify({prepay_pct:30})]);
  run('INSERT INTO supplier (id,name,lead_time_days,review_days,terms) VALUES (?,?,?,?,?)', ['SE','System Electric',50,30,JSON.stringify({prepay_pct:30})]);
  const lineInsert = d.prepare('INSERT INTO sales_line (code_1c,doc_no,doc_type,at,warehouse,qty,source) VALUES (?,?,?,?,?,?,?)');
  const monthInsert = d.prepare('INSERT INTO sales_month (code_1c,ym,qty_file,qty_lines) VALUES (?,?,?,?) ON CONFLICT(code_1c,ym) DO UPDATE SET qty_file=excluded.qty_file');
  const stockInsert = d.prepare('INSERT INTO stock_month (code_1c,ym,opening_qty,known) VALUES (?,?,?,?) ON CONFLICT(code_1c,ym) DO UPDATE SET opening_qty=excluded.opening_qty,known=excluded.known');
  const transitInsert = d.prepare('INSERT INTO in_transit (code_1c,po_ref,qty,expected_at,source_file) VALUES (?,?,?,?,?)');
  const seasonInsert = d.prepare('INSERT INTO seasonality (supplier_id,year,month,revenue_kzt) VALUES (?,?,?,?)');
  const lineMonths = new Map();
  for (const s of ['IEK','SE']) {
    let f = file(s, 'Динамика продаж'); let a = rows(f); requireHeaders(a[0], ['Дата','Номер','Документ','Код','Номенклатура','Ед.','Склад','Количество'],f);
    for (const r of a.slice(1)) {
      const code = str(r[3]); if (!code || str(r[4]) === 'Итого') continue;
      const date = at(r[0]), q = num(r[7]), doc = str(r[2]);
      const type = doc.startsWith('Расходная накладная') ? 'Расходная накладная' : doc.startsWith('Приходная накладная') ? 'Приходная накладная' : doc.startsWith('Заказ покупателя') ? 'Заказ покупателя' : doc.split(/\s+\d/)[0];
      sku(s,code,{name:str(r[4]),unit:str(r[5])});
      lineInsert.run(code,str(r[1]),type,date,str(r[6]),String(q),source(f));
      if (type === 'Расходная накладная' && q > 0) { const k = `${code}|${date.slice(0,7)}`; lineMonths.set(k, (lineMonths.get(k)||0)+q); }
    }
    f = file(s, 'Ежемесячные продажи'); a = rows(f); requireHeaders(a[0], ['Номенклатура','Номенклатура.Код'],f);
    const codeCol = a[0].indexOf('Номенклатура.Код');
    const articleCol = a[0].indexOf('Артикул'), moqCol = a[0].indexOf('Кратность');
    const cols = a[0].map((h,i)=>[i,monthOf(h)]).filter(x=>x[1]);
    if (cols.length !== 33) throw new Error(`Expected 33 sales months: ${f.name} got ${cols.length}`);
    for (const r of a.slice(2)) { const code=str(r[codeCol]); if (!code) continue; sku(s,code,{name:str(r[0]),article:articleCol<0?null:str(r[articleCol]),moq:moqCol<0?null:(num(r[moqCol])||1)}); for (const [i,ym] of cols) monthInsert.run(code,ym,dec(r[i]),null); }
    f = file(s, 'Ежемесячные остатки'); a = rows(f); requireHeaders(a[0], ['Номенклатура','Номенклатура.Код'],f);
    const nameCol=a[0].indexOf('Номенклатура'), stockCodeCol=a[0].indexOf('Номенклатура.Код'), unitCol=a[0].indexOf(s==='IEK'?'Ед.':'Ед.изм');
    const stockCols = a[0].map((h,i)=>[i,monthOf(h)]).filter(x=>x[1]);
    if (stockCols.length !== 33) throw new Error(`Expected 33 stock months: ${f.name} got ${stockCols.length}`);
    for (const r of a.slice(s==='IEK'?3:3)) { const code=str(r[stockCodeCol]); if (!code) continue; sku(s,code,{name:str(r[nameCol]),unit:str(r[unitCol])}); for (const [i,ym] of stockCols) { const known=str(r[i])!==''; stockInsert.run(code,ym,dec(r[i]),known?1:0); } }
    f = file(s,'MOQ'); a = rows(f); const head=a[0].map(str); const mc=head.indexOf(s==='IEK'?'Код 1с':'Номенклатура.Код'); const qcol=head.indexOf(s==='IEK'?'Мин. разр. к отгр.':'Кратность');
    if (mc<0 || qcol<0) throw new Error(`Bad MOQ header: ${f.name}`);
    for (const r of a.slice(1)) { const code=str(r[mc]); if (!code) continue; sku(s,code,{name:str(r[head.indexOf(s==='IEK'?'Наименование':'Номенклатура')]),article:str(r[head.indexOf(s==='IEK'?'Артикул поставщика':'Артикул')]),moq:num(r[qcol])||1}); }
    f = file(s,s==='IEK'?'Путь ИЭК':'Товар в пути'); a = rows(f,s==='SE'?'TDSheet':undefined);
    if (s==='IEK') {
      requireHeaders(a[0],['Код 1с','Артикул ИЭК'],f);
      for (const r of a.slice(1)) { const code=str(r[0]); if (!code) continue; sku(s,code,{article:str(r[1]),name:str(r[2])}); for(let i=3;i<a[0].length;i++){const q=num(r[i]);if(q>0)transitInsert.run(code,str(a[0][i]),String(q),'2026-11-01',source(f));} }
    } else {
      const h=a[1].map(str); requireHeaders(h,['Код 1с','СЭ в пути 24.09','Категория 2026','СС реал','Вес'],f);
      const pos=x=>h.indexOf(x);
      for (const r of a.slice(2)) { const code=str(r[pos('Код 1с')]); if (!code) continue; const cost=num(r[pos('СС реал')]); sku(s,code,{article:str(r[pos('Артикул поставщика')]),name:str(r[pos('Наименование')]),category:str(r[pos('Категория 2026')]),unit_cost:cost>0?String(cost):null,weight:str(r[pos('Вес')])}); const q=num(r[pos('СЭ в пути 24.09')]); if(q>0)transitInsert.run(code,'СЭ 24.09',String(q),'2026-11-11',source(f)); }
    }
    f = file(s,'Сезонность'); a=rows(f,s==='IEK'?'Сезонность':'Лист1'); const header=a.findIndex(r=>str(r[0])==='год'); if(header<0)throw new Error(`Bad seasonality header: ${f.name}`);
    for(const r of a.slice(header+1)){const year=Number(r[0]);if(year<2024||year>2026)continue;for(let m=1;m<=12;m++){if(str(r[m])==='')continue;seasonInsert.run(s,year,m,dec(r[m]));}}
  }
  for (const [k,q] of lineMonths) { const [code,ym]=k.split('|'); d.prepare('INSERT INTO sales_month (code_1c,ym,qty_lines) VALUES (?,?,?) ON CONFLICT(code_1c,ym) DO UPDATE SET qty_lines=excluded.qty_lines').run(code,ym,String(q)); }
  const skuInsert=d.prepare('INSERT INTO sku (code_1c,supplier_id,article,name,unit,category,unit_cost,moq,weight) VALUES (?,?,?,?,?,?,?,?,?)');
  for(const x of catalog.values()) skuInsert.run(x.code_1c,x.supplier_id,x.article,x.name,x.unit,x.category,x.unit_cost,x.moq,x.weight);
  d.exec('COMMIT');
} catch(e) { d.exec('ROLLBACK'); d.close(); throw e; }

for(const table of ['supplier','sku','sales_line','sales_month','stock_month','in_transit','seasonality']) console.log(`${table}: ${d.prepare(`SELECT count(*) n FROM ${table}`).get().n}`);
for(const s of ['IEK','SE']) {
  const row=d.prepare(`SELECT m.code_1c,m.ym,m.qty_file,m.qty_lines FROM sales_month m JOIN sku k ON k.code_1c=m.code_1c WHERE k.supplier_id=? AND m.qty_file IS NOT NULL AND m.qty_lines IS NOT NULL AND abs(CAST(m.qty_file AS REAL)-CAST(m.qty_lines AS REAL))>0.001 ORDER BY m.ym,m.code_1c LIMIT 1`).get(s);
  console.log(`${s} first qty mismatch: ${JSON.stringify(row||null)}`);
}
d.close();
if (process.env.ETL_SKIP_DERIVE !== '1') await import('./derive.mjs');
