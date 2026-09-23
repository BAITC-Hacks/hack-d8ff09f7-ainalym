import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) return nextResolve(pathToFileURL(resolve(root, "src", `${specifier.slice(2)}.ts`)).href, context);
    if (specifier.startsWith(".")) {
      const target = resolve(dirname(fileURLToPath(context.parentURL)), specifier);
      if (existsSync(`${target}.ts`)) return nextResolve(pathToFileURL(`${target}.ts`).href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts")) {
      const source = readFileSync(fileURLToPath(url), "utf8");
      return { format: "module", source: ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const temp = mkdtempSync(join(tmpdir(), "ainalym-scenario-"));
const basePath = join(temp, "base.db");
let failed = 0;
function report(id, property, passed, detail = "") {
  console.log(`[${passed ? "PASS" : "FAIL"}] ${id} — ${property}${detail ? ` (${detail})` : ""}`);
  if (!passed) failed++;
}
function component(result, key) { return Number(result.components[key]); }
function netNeed(result) { return component(result, "forecast_qty") + component(result, "safety") - component(result, "on_hand") - component(result, "in_transit"); }
function params(d, code) {
  const row = d.prepare("SELECT sup.lead_time_days,sup.review_days FROM sku s JOIN supplier sup ON sup.id=s.supplier_id WHERE s.code_1c=?").get(code);
  if (!row) throw new Error(`SKU ${code} missing from partner ETL`);
  return { lead_time_days: row.lead_time_days, review_days: row.review_days, service_level: 0.9, growth_cap: 0.5, outlier: { k_month: 3, k_doc: 5, min_units: 20 } };
}

try {
  if (process.argv.includes("--via-api")) {
    const origin = process.env.SCENARIO_BASE_URL || "http://localhost:3000";
    const call = async (path, body) => {
      const response = await fetch(new URL(path, origin), body === undefined ? {} : {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(`${path}: ${payload.code || response.status}`);
      return payload;
    };
    const reset = await call("/api/demo/reset", {});
    report("API-reset", "Офлайн-сброс загрузил данные партнёра", (reset.counts?.sku ?? 0) > 0);
    const before = await call("/api/money");
    const world = await call("/api/world/play", { steps: 45 });
    const after = await call("/api/money");
    report("API-world", "Сценарные события прошли через API и worker", world.processed === 45, `processed=${world.processed}`);
    report("API-money", "API отдаёт деньги по валютам и график 60 дней", Array.isArray(before.cash) && Array.isArray(after.cash) && Array.isArray(after.next_60d?.out));
    console.log("Money view before world:", JSON.stringify(before));
    console.log("Money view after world:", JSON.stringify(after));
  } else {
  const loader = join(root, "scripts/etl/load.mjs");
  const expectedPath = join(root, "tests/fixtures/eval/replenishment_expectations.json");
  if (!existsSync(loader) || !existsSync(expectedPath)) throw new Error("partner ETL or replenishment expectations have not landed");
  const etl = spawnSync(process.execPath, [loader, "--db", basePath], { cwd: root, encoding: "utf8", env: { ...process.env, AINALYM_MODE: "offline" }, maxBuffer: 8 * 1024 * 1024 });
  if (etl.status !== 0) throw new Error(`ETL failed: ${(etl.stderr || etl.stdout).trim().slice(-500)}`);
  const expected = JSON.parse(readFileSync(expectedPath, "utf8"));
  process.env.AINALYM_MODE = "offline";
  const { db, resetInstance } = await import("../src/db/client.ts");
  const { computeNeed } = await import("../src/domain/engine.ts");
  const { runCalculation } = await import("../src/domain/apply.ts");
  const { applyWorldEvent } = await import("../src/domain/events.ts");
  const { moneyView } = await import("../src/domain/cashflow.ts");
  const { approveOrder } = await import("../src/domain/orders.ts");
  const asOf = expected.as_of;
  const setup = (name) => {
    resetInstance();
    const path = join(temp, `${name}.db`);
    copyFileSync(basePath, path);
    process.env.DATABASE_PATH = path;
    return db();
  };
  const code = (name) => expected.skus[name].code_1c;
  const calculate = (d, name, date = asOf) => computeNeed(code(name), params(d, code(name)), { database: d, as_of: date });

  {
    const d = setup("m1");
    const before = await calculate(d, "intransit");
    await applyWorldEvent({ id: "WE-SCENARIO-TRANSIT", kind: "in_transit_update", org_id: "partner", code_1c: code("intransit"), payload: { delta_qty: 100 } });
    const after = await calculate(d, "intransit");
    const drop = netNeed(before) - netNeed(after);
    report("M1", "Товар в пути +100 уменьшает чистую потребность до ограничения нулём", Math.abs(drop - 100) < 0.01,
      `Δ=${drop.toFixed(3)}, заказ ${before.need}→${after.need} из-за достаточного запаса`);
    d.prepare("DELETE FROM stock_month WHERE code_1c=?").run(code("intransit"));
    let named = false;
    try { await calculate(d, "intransit"); } catch (error) { named = /stock source missing/.test(String(error)); }
    report("M1-source", "Отсутствующий обязательный источник назван", named);
  }
  {
    const d = setup("m2");
    const result = await calculate(d, "seasonal");
    const season = Object.values(result.components.season).map(Number).filter(n => n > 0);
    const ratio = Math.max(...season) / Math.min(...season);
    const quarters = [0, 1, 2, 3].map(q => season.slice(q * 3, q * 3 + 3).reduce((sum, n) => sum + n, 0));
    const peakQuarter = quarters.indexOf(Math.max(...quarters)) + 1;
    report("M2", "Сезонный профиль SKU меняет прогноз по месяцам", ratio >= 1.3, `max/min=${ratio.toFixed(2)}`);
    report("M2-peak", "Пик профиля соответствует Q3 в двух полных годах", peakQuarter === 3, `peak quarter=${peakQuarter}`);
  }
  {
    const d = setup("m3");
    const adjusted = await calculate(d, "stockout");
    const original = d.prepare("SELECT ym FROM sales_month WHERE code_1c=? AND stockout=1").all(code("stockout"));
    d.prepare("UPDATE sales_month SET stockout=0 WHERE code_1c=?").run(code("stockout"));
    const raw = await calculate(d, "stockout");
    report("M3", "Компенсация дефицита повышает расчётную потребность", original.length > 0 && component(adjusted, "raw_need") > component(raw, "raw_need"),
      `raw=${component(raw, "raw_need")}, adjusted=${component(adjusted, "raw_need")}`);
  }
  {
    const d = setup("m4");
    const before = await calculate(d, "oneoff");
    const eventsPath = join(root, "fixtures/world_events.jsonl");
    const judge = readFileSync(eventsPath, "utf8").split(/\r?\n/).filter(Boolean).map(JSON.parse)
      .find(e => e.kind === "judge_message" && e.payload?.action === "inject_sales_line");
    if (!judge) throw new Error("judge one-off event missing");
    await applyWorldEvent({ ...judge, payload: judge.payload });
    const after = await calculate(d, "oneoff");
    const base = component(before, "base_rate");
    const change = base ? Math.abs(component(after, "base_rate") - base) / base : Infinity;
    const excluded = after.components.outliers_excluded.some(item => item.doc_no === judge.payload.line.doc_no);
    report("M4", "Разовый документ 5000 шт исключён из регулярного спроса", change < 0.1 && excluded, `change=${(change * 100).toFixed(2)}%, excluded=${excluded}`);
  }
  {
    const d = setup("m5");
    let result;
    try {
      result = await runCalculation({ supplier: "SE" }, {}, { database: d, as_of: asOf, org_id: "partner" });
      report("M5-full", "Полный расчёт SE завершён", true);
    } catch (error) {
      report("M5-full", "Полный расчёт SE завершён", false, error instanceof Error ? error.message : String(error));
      const eligible = [];
      for (const { code_1c } of d.prepare("SELECT code_1c FROM sku WHERE supplier_id='SE' ORDER BY code_1c").all()) {
        try { await computeNeed(code_1c, params(d, code_1c), { database: d, as_of: asOf }); eligible.push(code_1c); }
        catch { /* inactive SKUs lack a required source */ }
        if (eligible.length === 10) break;
      }
      result = await runCalculation({ supplier: "SE", codes: eligible }, {}, { database: d, as_of: asOf, org_id: "partner" });
    }
    const rows = d.prepare("SELECT r.code_1c,r.supplier_id,r.rationale_ru,r.qty_recommended,s.unit_cost FROM recommendation r JOIN sku s ON s.code_1c=r.code_1c WHERE r.run_id=?").all(result.run_id);
    const groups = new Set(rows.filter(r => r.qty_recommended > 0).map(r => r.supplier_id));
    report("M5", "Рекомендации SE сгруппированы по поставщику и обоснованы", rows.length > 0 && groups.size === 1 && groups.has("SE") && rows.every(r => r.supplier_id && r.rationale_ru?.trim()), `rows=${rows.length}`);
    const before = await moneyView("partner", new Date(`${asOf}T00:00:00Z`));
    const selected = rows.find(r => r.qty_recommended > 0 && r.unit_cost !== null);
    if (selected) {
      const eta = new Date(`${asOf}T00:00:00Z`); eta.setUTCDate(eta.getUTCDate() + 50);
      d.prepare("INSERT INTO purchase_order(id,supplier_id,run_id,state,eta) VALUES ('PO-SCENARIO','SE',?,'draft',?)").run(result.run_id, eta.toISOString());
      d.prepare("INSERT INTO purchase_order_line(po_id,code_1c,qty,unit_cost,rationale_ru) VALUES ('PO-SCENARIO',?,?,?,?)")
        .run(selected.code_1c, selected.qty_recommended, selected.unit_cost, selected.rationale_ru);
      approveOrder("PO-SCENARIO", 1);
    }
    const after = await moneyView("partner", new Date(`${asOf}T00:00:00Z`));
    console.log("Money view before approval:", JSON.stringify(before));
    console.log("Money view after approval:", JSON.stringify(after));
    report("Money", "Утверждение создаёт обязательства 30/70 без выдуманной себестоимости", !!selected && after.committed_by_supplier.some(r => r.supplier_id === "SE" && Number(r.amount) > 0) && after.next_60d.out.length === 2);
  }
  {
    const d = setup("world");
    const events = readFileSync(join(root, "fixtures/world_events.jsonl"), "utf8").split(/\r?\n/).filter(Boolean).map(JSON.parse);
    let applied = 0;
    for (const event of events) {
      const result = await applyWorldEvent(event);
      if (result.applied) applied++;
    }
    const repeated = await applyWorldEvent(events[0]);
    const processed = d.prepare("SELECT count(*) AS n FROM world_event WHERE state='processed'").get().n;
    report("World", "Лента событий применяется один раз по source_id", applied === events.length && processed === events.length && !repeated.applied,
      `applied=${applied}/${events.length}, processed=${processed}`);
  }
  }
} catch (error) {
  report("scenario", "Сценарий выполняется на данных партнёра", false, error instanceof Error ? error.message : String(error));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
if (failed) process.exitCode = 1;
