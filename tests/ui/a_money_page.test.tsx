// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MoneyPage } from "@/components/pulse/MoneyPage";
import { MoneyStrip } from "@/components/pulse/MoneyStrip";
import type { MoneyView } from "@/components/pulse/types";
const money: MoneyView = { ai: "rules", provenance: "partner_anonymised", external: "export_only", cash: [], committed_by_supplier: [{ supplier_id: "IEK", amount: "0.00", currency: "KZT", lines: 4, cost_known_lines: 0 }], next_60d: { out: [{ at: "2026-10-02", amount: "30.00", currency: "CNY", po_id: "PO-two", kind: "supplier_balance" }, { at: "2026-10-01", amount: "10.50", currency: "KZT", po_id: "PO-one", kind: "supplier_prepayment" }] }, stock_value: null, risks: [{ code: "cost_unknown", count: 4, label_ru: "Себестоимость не задана" }] };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("a_money page", () => {
  it("does not turn a domain-pending response into claims of no payments or approved orders", async () => {
    const pending = { cash: [], committed_by_supplier: [], next_60d: { out: [] }, risks: [], empty_reason: "domain pending" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(pending)))); render(<MoneyPage initial={pending} />);
    expect(screen.getByText("Денежный расчёт пока недоступен.")).toBeTruthy(); expect(screen.queryByText(/Утверждённых заказов пока нет/)).toBeNull(); expect(screen.queryByText(/платежи не запланированы/)).toBeNull(); expect(screen.getByText("График пока недоступен.")).toBeTruthy(); expect(screen.queryByText("Остатки не заданы")).toBeNull(); expect(screen.queryByText("Не рассчитана")).toBeNull();
  });
  it("renders unknown IEK cost as unknown, not a zero-valued commitment", () => {
    render(<MoneyStrip money={money} />); expect(screen.getByText("Не задана")).toBeTruthy(); expect(screen.queryByText("0 ₸")).toBeNull();
  });
  it("sorts persisted payments by date and keeps currency totals separate", async () => {
    vi.stubGlobal("fetch", vi.fn(async path => new Response(JSON.stringify(path === "/api/money" ? money : { ai: "rules", provenance: "partner_anonymised", external: "export_only" }))));
    render(<MoneyPage initial={money} />); expect(screen.getByText("Остатки не заданы")).toBeTruthy(); const links = screen.getAllByRole("link").filter(link => link.getAttribute("href")?.startsWith("/orders/")); expect(links.map(link => link.textContent)).toEqual(["PO-one", "PO-two"]); expect(screen.getAllByText("30 CNY")).toHaveLength(2); expect(screen.getAllByText("10,50 ₸")).toHaveLength(2); await screen.findByText("Правила без LLM");
  });
});
