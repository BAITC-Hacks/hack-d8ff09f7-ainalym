import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tables = ['supplier','sku','sales_line','sales_month','stock_month','in_transit','seasonality','season_index'] as const;
const expected = JSON.parse(readFileSync('tests/fixtures/eval/replenishment_expectations.json','utf8'));

describe('partner ETL reset', () => {
  it('rebuilds identical table counts twice and retains each eval SKU', () => {
    const dir=mkdtempSync(join(tmpdir(),'ainalym-etl-'));
    const path=join(dir,'partner.db');
    const run=() => {
      execFileSync('npm',['run','etl','--','--db',path],{cwd:process.cwd(),stdio:'pipe',timeout:60000});
      const d=new DatabaseSync(path);
      try {
        const counts=Object.fromEntries(tables.map(t=>[t,Number((d.prepare(`SELECT count(*) n FROM ${t}`).get() as {n:number}).n)]));
        for(const fixture of Object.values(expected.skus) as Array<{code_1c:string;supplier_id:string}>) {
          expect(d.prepare('SELECT supplier_id FROM sku WHERE code_1c=?').get(fixture.code_1c)).toEqual({supplier_id:fixture.supplier_id});
        }
        expect(d.prepare("SELECT on_hand_qty,on_hand_as_of FROM sku WHERE code_1c='300200745_'").get())
          .toEqual({on_hand_qty:'23',on_hand_as_of:'2026-09-22'});
        expect(d.prepare("SELECT on_hand_qty,on_hand_as_of FROM sku WHERE code_1c='010500008_'").get())
          .toEqual({on_hand_qty:'20434',on_hand_as_of:'2026-09-22'});
        expect(d.prepare("SELECT unit_cost FROM sku WHERE code_1c='300200428_'").get()).toEqual({unit_cost:'1050.61'});
        return counts;
      } finally { d.close(); }
    };
    try { const first=run(); expect(first).toEqual(expected.counts); expect(run()).toEqual(first); }
    finally { rmSync(dir,{recursive:true,force:true}); }
  }, 120000);
});
