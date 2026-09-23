// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { formatMoney, sumByCurrency } from "@/components/pulse/format";
import { TruthAxisLabels, ModeChip, TaskStateChip, AgentsLabel, WorldLabel } from "@/components/labels";
import { MoneyStrip } from "@/components/pulse/MoneyStrip";
import { AgentLedger } from "@/components/pulse/AgentLedger";
import { Commitments } from "@/components/pulse/Commitments";
afterEach(cleanup);
describe("a_money and result truth", () => {
  it("shows historical ledger axes without opening an explanation", () => {
    render(<AgentLedger loading={false} error={null} reload={() => {}} data={{ stats: { auto: 1, needs_you: 0 }, rows: [{ id: "ACT-test", run_id: "RUN-test", summary_ru: "Пересчитана потребность", at: "2026-09-23T08:00:00Z", autonomy: "auto", result: "done", sources: [], provenance: "partner_anonymised", ai: "rules", external: "export_only" }] }} />);
    for (const label of ["Данные партнёра · обезличены", "Правила без LLM", "Экспорт для 1С (файл)"]) expect(screen.getByText(label).closest("details:not([open])")).toBeNull();
  });
  it("preserves decimal precision and never combines currencies", () => {
    expect(sumByCurrency([{ amount: "9007199254740993.01", currency: "KZT" }, { amount: "0.09", currency: "KZT" }, { amount: "20.00", currency: "CNY" }])).toEqual([{ amount: "9007199254740993.10", currency: "KZT" }, { amount: "20.00", currency: "CNY" }]);
    expect(formatMoney({ amount: "1234.50", currency: "KZT" })).toBe("1\u2009234,50\u2009₸");
    expect(formatMoney({ amount: "20.00", currency: "CNY" })).toBe("20\u2009CNY");
    expect(formatMoney(null)).toBe("Себестоимость не задана");
  });
  it("renders all three truth axes using contract wording", () => {
    render(<TruthAxisLabels axes={{ provenance: "partner_anonymised", ai: "rules", external: "export_only" }} />);
    expect(screen.getByText("Данные партнёра · обезличены")).toBeTruthy(); expect(screen.getByText("Правила без LLM")).toBeTruthy(); expect(screen.getByText("Экспорт для 1С (файл)")).toBeTruthy();
  });
  it("does not infer live AI or external integration when axes are absent", () => {
    render(<TruthAxisLabels />); expect(screen.getByText("Режим AI не указан")).toBeTruthy(); expect(screen.getByText("Внешнее действие не указано")).toBeTruthy(); expect(screen.queryByText("Живой AI")).toBeNull();
  });
  it("uses text for modes, tasks, partner agents and synthetic world", () => {
    render(<><ModeChip mode="offline" /><TaskStateChip state="handover_failed" /><AgentsLabel /><WorldLabel /></>);
    expect(screen.getByText("Офлайн-режим · записанные решения")).toBeTruthy(); expect(screen.getByText("Ошибка передачи")).toBeTruthy(); expect(screen.getByText("Агенты · данные партнёра")).toBeTruthy(); expect(screen.getByText("Симулятор мира — синтетическое событие")).toBeTruthy();
  });
  it("keeps KZT and CNY visible separately and does not turn absent SE cost into zero", () => {
    render(<MoneyStrip money={{ cash: [], committed_by_supplier: [], next_60d: { out: [{ amount: "200", currency: "KZT", at: "2026-10-01", po_id: "PO-test" }, { amount: "50", currency: "CNY", at: "2026-10-01", po_id: "PO-test2" }] }, stock_value: null, risks: [] }} />);
    expect(screen.getByText("200\u2009₸", { normalizer: value => value })).toBeTruthy(); expect(screen.getByText("50\u2009CNY", { normalizer: value => value })).toBeTruthy(); expect(screen.queryByText("250\u2009₸")).toBeNull(); expect(screen.getByText("Не рассчитана")).toBeTruthy();
  });
  it("distinguishes loading, missing and empty commitments", () => {
    const view = render(<Commitments loading rows={undefined} />); expect(screen.getByLabelText("Загружаем данные")).toBeTruthy(); expect(screen.queryByText(/Заказов и расчётов пока нет/)).toBeNull();
    view.rerender(<Commitments loading={false} rows={undefined} />); expect(screen.getByText("Обязательства пока недоступны.")).toBeTruthy();
    view.rerender(<Commitments loading={false} rows={[]} />); expect(screen.getByText(/Заказов и расчётов пока нет/)).toBeTruthy();
  });
});
