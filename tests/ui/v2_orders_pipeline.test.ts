import { describe, expect, it } from "vitest";
import { arrivalFromHeader, buildPipeline, CUSTOMS_LINE, daysUntil, mapPartnerTransit, mapSystemOrder } from "@/app/(v2)/orders/pipeline";

const now = new Date("2026-09-23T10:00:00Z");
const byKey = (steps: { key: string; state: string }[]) => Object.fromEntries(steps.map(s => [s.key, s.state]));

describe("orders pipeline mapper — real states only", () => {
  it("draft order: only the draft step is reached, later docs are «не требуется», no customs line", () => {
    const row = mapSystemOrder({ id: "PO-1", supplier_id: "IEK", state: "draft", total_qty: 12, lines: [{}, {}] }, [], [], [], now);
    expect(byKey(row.steps)).toEqual({ draft: "current", approved: "pending", letter: "pending", reply: "pending", transit: "pending", received: "pending" });
    expect(row.docs.find(d => d.label === "Ответ поставщика")?.state).toBe("не требуется");
    expect(row.customs).toBeNull(); expect(row.arrival.date).toBeNull(); expect(row.arrival.days).toBeNull();
  });
  it("approved order with letter and supplier reply: reply is the current step, missing export is «не получен»", () => {
    const row = mapSystemOrder({ id: "PO-2", supplier_id: "SE", state: "approved", total_qty: 5, lines: [{}], eta: "2026-11-12" },
      [{ kind: "supplier_reply", po_id: "PO-2", text: "Подтверждаем получение заказа PO-2.", at: "2026-09-23T09:00:00Z" }],
      [{ kind: "order_drafted", po_id: "PO-2", at: "2026-09-23T08:00:00Z", summary_ru: "Подготовлено письмо поставщику по PO-2; не отправлено" }],
      [{ at: "2026-09-23", amount: "300.00", currency: "KZT", po_id: "PO-2", kind: "supplier_prepayment" }], now);
    expect(byKey(row.steps)).toMatchObject({ draft: "done", approved: "done", letter: "done", reply: "current", transit: "pending", received: "pending" });
    expect(row.reply.text).toContain("Подтверждаем");
    expect(row.docs.map(d => [d.label, d.state])).toEqual([["Черновик заказа", "получен"], ["Письмо поставщику (черновик)", "получен"], ["Ответ поставщика", "получен"], ["Экспорт для 1С (файл)", "не получен"], ["Предоплата 30 %", "не получен"]]);
    expect(row.customs).toBeNull();
  });
  it("approved order without a reply says «ответа пока нет» and never shows a transit date from the plan eta", () => {
    const row = mapSystemOrder({ id: "PO-3", supplier_id: "IEK", state: "approved", eta: "2026-11-02" }, [], [], [], now);
    expect(row.steps.find(s => s.key === "reply")).toMatchObject({ state: "pending", note: "ответа пока нет" });
    expect(row.arrival).toEqual({ date: null, days: null, label: "ещё не отправлен" });
    expect(row.plan_eta).toBe("2026-11-02");
  });
  it("partner IEK header with a real date gives «поступление до dd.mm», days until receipt, and the customs policy line only for «РФ»", () => {
    const rf = mapPartnerTransit({ po_ref: "РФ УТ-7583 от 31 августа 2026 г. (поступление до 10.10.2026)", supplier_id: "IEK", source_file: "Путь ИЭК 22.09.2026.xlsx", file_date: "2026-09-22", lines: 11, qty: 1325 }, now);
    expect(rf.arrival).toEqual({ date: "2026-10-10", days: 17, label: "поступление до 10.10" });
    expect(rf.customs).toBe(CUSTOMS_LINE);
    expect(byKey(rf.steps)).toEqual({ draft: "done", approved: "done", letter: "unknown", reply: "unknown", transit: "current", received: "pending" });
    const kz = mapPartnerTransit({ po_ref: "УТ-8231 от 18 сентября 2026 г. (поступление до 30.09.2026)", supplier_id: "IEK", source_file: "x.xlsx", lines: 1, qty: 10 }, now);
    expect(kz.customs).toBeNull(); expect(kz.arrival.days).toBe(7);
  });
  it("SE «СЭ 24.09» carries no arrival date: «в пути» without a date, no days, no customs, placeholder expected_at ignored", () => {
    const se = mapPartnerTransit({ po_ref: "СЭ 24.09", supplier_id: "SE", expected_at: "2026-11-11", source_file: "Товар в пути_SystemElectric на 22.09.2026.xlsx", lines: 7, qty: 50160 }, now);
    expect(se.arrival).toEqual({ date: null, days: null, label: "в пути" });
    expect(se.customs).toBeNull();
    expect(se.docs.every(d => d.state !== undefined && d.state !== ("" as string))).toBe(true);
  });
  it("helpers: header date parsing and day arithmetic", () => {
    expect(arrivalFromHeader("ПП УТ-7848 от 7 сентября 2026 г. (поступление до 01.10.2026)")).toBe("2026-10-01");
    expect(arrivalFromHeader("СЭ 24.09")).toBeNull();
    expect(daysUntil("2026-09-23", now)).toBe(0); expect(daysUntil("2026-09-20", now)).toBe(-3); expect(daysUntil(null, now)).toBeNull();
    const rows = buildPipeline({ orders: [], feed: [], ledger: [], money: [], transit: [
      { po_ref: "УТ-1 (поступление до 15.10.2026)", supplier_id: "IEK", source_file: "a.xlsx", lines: 1, qty: 1 },
      { po_ref: "УТ-2 (поступление до 01.10.2026)", supplier_id: "IEK", source_file: "a.xlsx", lines: 1, qty: 1 }] }, now);
    expect(rows.map(r => r.arrival.date)).toEqual(["2026-10-01", "2026-10-15"]);
  });
});

describe("orders pipeline mapper — letter detection", () => {
  it("the draft-order ledger row alone does not count as a prepared letter", () => {
    const row = mapSystemOrder({ id: "PO-9", supplier_id: "IEK", state: "approved" }, [], [{ kind: "order_drafted", po_id: "PO-9", at: "2026-09-23T08:00:00Z", summary_ru: "Черновик заказа PO-9 подготовлен" }], [], now);
    expect(row.steps.find(s => s.key === "letter")?.state).toBe("pending");
    expect(row.docs.find(d => d.label.startsWith("Письмо"))?.state).toBe("не получен");
  });
});
