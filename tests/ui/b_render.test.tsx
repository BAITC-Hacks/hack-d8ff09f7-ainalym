import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LABELS, TruthLabels } from "@/components/labels";
import { TimelineRows } from "@/components/purchase/AgentTimeline";
import { DemandChart, chartPoints } from "@/components/purchase/DemandChart";
import { Rationale, NeedFormula } from "@/components/purchase/Rationale";
import { SupplierTable } from "@/components/purchase/Replenishment";
import {
  money,
  number,
  type Recommendation,
} from "@/components/purchase/types";
import { OrderContent, ArtifactPreview } from "@/components/review/OrderDesk";
import {
  ProposalReview,
  ProposalStateNotice,
} from "@/components/review/ProposalDesk";
import { QueueContent } from "@/components/review/ReviewQueue";
import {
  approvalVerbs,
  changedLines,
  removedLines,
  pricePreview,
  decisionBody,
  type Proposal,
  type ProposalState,
} from "@/components/review/types";

const row: Recommendation = {
  id: "REC-TEST",
  code_1c: "TEST-01",
  name: "Тестовая позиция",
  supplier_id: "IEK",
  on_hand: "4",
  in_transit: "2",
  qty_recommended: 12,
  qty_adjusted: 9,
  urgency: "critical",
  rationale_ru: "Прогноз 15 + запас 3 − остаток 4 − в пути 2 = 12",
  version: 1,
  components: {
    horizon_days: 70,
    forecast_qty: 15,
    safety: 3,
    on_hand: 4,
    in_transit: 2,
    base_rate: 6,
    growth: 1.2,
    moq: 1,
    stockout_uplift: 2,
    stockout_months: ["2025-01"],
    outliers_excluded: [{ doc_no: "DOC-TEST", qty: 5000 }],
  },
};
const proposal: Proposal = {
  id: "PR-TEST",
  kind: "supplier_order",
  version: 1,
  state: "needs_review",
  rationale_ru: "Подготовленный заказ",
  payload: {
    supplier_id: "IEK",
    lines: [
      {
        code_1c: "TEST-01",
        name: "Тестовая позиция",
        qty: 12,
        unit_cost: null,
      },
    ],
  },
  sources: ["recommendation:REC-TEST"],
  affects: ["TEST-01"],
};

describe("b_render — purchase and review states", () => {
  it("keeps unknown numbers and costs distinct from zero and currencies separate", () => {
    expect(number(null)).toBe("Неизвестно");
    expect(number(0)).toBe("0");
    expect(money(null)).toBe("Себестоимость не задана");
    expect(money({ amount: "9007199254740993.01", currency: "KZT" })).toBe(
      "9\u202f007\u202f199\u202f254\u202f740\u202f993,01\u2009₸",
    );
    expect(money({ amount: "10.00", currency: "CNY" })).toBe("10,00\u2009CNY");
  });
  it("renders original recommendation beside owner quantity, rationale and urgency", () => {
    const html = renderToStaticMarkup(
      <SupplierTable
        group={{
          supplier_id: "IEK",
          total_qty: 9,
          total_cost: null,
          cost_known_lines: 0,
          rows: [row],
        }}
      />,
    );
    expect(html).toContain("Ваше: 9");
    expect(html).toContain("12");
    expect(html).toContain("критично");
    expect(html).toContain("/skus/TEST-01");
    expect(html).toContain("Изменить qty TEST-01");
    const rationale = renderToStaticMarkup(<Rationale row={row} />);
    for (const value of ["15", "3", "4", "2", "DOC-TEST", "2025-01"])
      expect(rationale).toContain(value);
  });
  it("shows agent kind, why, sources, autonomy and failed results", () => {
    const html = renderToStaticMarkup(
      <TimelineRows
        rows={[
          {
            id: "A-TEST",
            kind: "recompute",
            summary_ru: "Пересчитан TEST-01",
            rationale_ru: "Пришла поставка",
            sources: ["WE-TEST"],
            autonomy: "escalated",
            result: "failed",
            at: "2026-09-23T08:00:00Z",
          },
        ]}
      />,
    );
    for (const value of [
      "Пересчёт",
      "Пересчитан TEST-01",
      "Пришла поставка",
      "WE-TEST",
      "На ваше решение",
      "Ошибка",
    ])
      expect(html).toContain(value);
    expect(renderToStaticMarkup(<TimelineRows rows={[]} />)).toContain(
      "Действий агента пока нет",
    );
  });
  it("keeps missing chart samples missing and marks censored months/outliers", () => {
    const series = [
      {
        ym: "2026-01",
        qty_file: 25,
        qty_regular: 8,
        stock: 0,
        stockout: true,
        outliers: [{ doc_no: "DOC-TEST", qty: 17 }],
      },
      {
        ym: "2026-02",
        qty_file: null,
        qty_regular: null,
        stock: null,
        stockout: false,
      },
    ];
    const points = chartPoints(series, { "2026-03": 10 });
    expect(points[1].actual).toBeNull();
    expect(points[2].regular).toBeUndefined();
    const html = renderToStaticMarkup(
      <DemandChart series={series} forecast={{ "2026-03": 10 }} />,
    );
    for (const value of [
      "Факт",
      "Регулярный спрос",
      "Прогноз",
      "Без остатка",
      "DOC-TEST",
      "Неизвестно",
    ])
      expect(html).toContain(value);
  });
  it.each(Object.keys(LABELS.proposal) as ProposalState[])(
    "renders proposal state %s with exact label",
    (state) => {
      const html = renderToStaticMarkup(
        <ProposalReview proposal={{ ...proposal, state }} />,
      );
      expect(html).toContain(LABELS.proposal[state]);
      if (state !== "needs_review")
        expect(html).not.toContain(">Создать черновик заказа<");
    },
  );
  it("links stale to successor and makes prior version readable", () => {
    const html = renderToStaticMarkup(
      <ProposalStateNotice
        proposal={{ ...proposal, state: "stale" }}
        successor={{ ...proposal, id: "PR-NEXT" }}
      />,
    );
    expect(html).toContain("/review/PR-NEXT");
    expect(html).toContain("больше не утверждается");
  });
  it("emphasizes changed lines and collapses unchanged fields", () => {
    const old = {
      ...proposal,
      payload: {
        ...proposal.payload,
        lines: [
          { code_1c: "TEST-01", qty: 10, unit_cost: null },
          { code_1c: "TEST-02", qty: 8, unit_cost: "20.00" },
        ],
      },
    };
    const next = {
      ...proposal,
      payload: {
        ...proposal.payload,
        lines: [
          { code_1c: "TEST-01", qty: 12, unit_cost: null },
          { code_1c: "TEST-02", qty: 8, unit_cost: "20.00" },
        ],
      },
    };
    expect(
      changedLines(next.payload.lines, old.payload.lines).map((p) => p.changed),
    ).toEqual([true, false]);
    const html = renderToStaticMarkup(
      <ProposalReview proposal={next} previous={old} />,
    );
    expect(html).toContain("Без изменений: 1 позиций");
    expect(html).toContain("<del");
    expect(html).toContain("Затронет…");
    expect(html).toContain("recommendation:REC-TEST");
  });
  it("requires explicit outlier or parameter decision; does not imply unresolved values are zero", () => {
    const html = renderToStaticMarkup(
      <ProposalReview
        proposal={{
          ...proposal,
          kind: "outlier_review",
          payload: { code_1c: "TEST-01", doc_no: "DOC-TEST" },
        }}
      />,
    );
    expect(html).toContain("Результат не определён");
    expect(html).toContain('name="resolution"');
    expect(html).not.toContain(" checked=");
    expect(() =>
      decisionBody(3, { "TEST-01": "" }, proposal.payload.lines!),
    ).toThrow();
    expect(
      decisionBody(3, { "TEST-01": "0" }, proposal.payload.lines!),
    ).toEqual({
      proposal_version: 3,
      adjustments: [{ code_1c: "TEST-01", qty: 0 }],
    });
  });
  it("renders all truth axes and approved/exported orders with exact verbs", () => {
    const labels = renderToStaticMarkup(
      <TruthLabels
        provenance="partner_anonymised"
        ai="rules"
        external="export_only"
      />,
    );
    for (const value of [
      LABELS.provenance.partner_anonymised,
      LABELS.ai.rules,
      LABELS.external.export_only,
    ])
      expect(labels).toContain(value);
    const order = {
      id: "PO-TEST",
      supplier_id: "SE",
      state: "draft" as const,
      total_qty: 12,
      total_cost: null,
      cost_known_lines: 0,
      eta: "2026-11-01",
      version: 2,
      lines: proposal.payload.lines!,
    };
    expect(renderToStaticMarkup(<OrderContent order={order} />)).toContain(
      "Утвердить заказ",
    );
    const approved = renderToStaticMarkup(
      <OrderContent order={{ ...order, state: "approved" }} />,
    );
    expect(approved).toContain("Экспорт для 1С · XLSX");
    expect(approved).toContain("Черновик письма поставщику");
    const artifact = renderToStaticMarkup(
      <ArtifactPreview
        artifact={{
          id: "AR-TEST",
          title_ru: "Письмо",
          markdown: "Точный текст",
        }}
      />,
    );
    expect(artifact).toContain("Черновик заказа — не отправлен");
    expect(artifact).toContain("/api/artifacts/AR-TEST/download");
    for (const verb of Object.values(approvalVerbs))
      expect(verb).not.toMatch(/оплачено|подано|подписано|в 1С/i);
  });
  it("renders a real empty queue without an invented proposal", () => {
    const html = renderToStaticMarkup(<QueueContent data={{ items: [] }} />);
    expect(html).toContain("Новых решений нет");
    expect(html).not.toContain("Проверить");
  });
  it("does not report a pending domain as a completed review queue", () => {
    const html = renderToStaticMarkup(
      <QueueContent data={{ items: [], empty_reason: "domain pending" }} />,
    );
    expect(html).toContain("Очередь ещё не готова");
    expect(html).not.toContain("<h2>Всё проверено</h2>");
  });
  it("uses the structured need proof when legacy prose conflates raw and rounded quantities", () => {
    const html = renderToStaticMarkup(
      <Rationale
        row={{
          ...row,
          qty_recommended: 15,
          rationale_ru: "11 = 15",
          components: {
            forecast_qty: 11,
            safety: 0,
            on_hand: 0,
            in_transit: 0,
            raw_need: 11,
            moq: 5,
            season_source: "supplier",
          },
        }}
      />,
    );
    expect(html).not.toContain("11 = 15");
    expect(html).toContain("11 шт.");
    expect(html).toContain("15 шт.");
    expect(html).toContain("Сезонность: поставщика");
  });
  it("recalculates the price preview exactly and discloses partial cost", () => {
    const lines = [
      { code_1c: "A", qty: 12, unit_cost: "10.15" },
      { code_1c: "B", qty: 2, unit_cost: null },
    ];
    expect(pricePreview(lines, { A: "120" })).toEqual({
      money: { amount: "1218.00", currency: "KZT" },
      known: 1,
      count: 2,
    });
    expect(pricePreview(lines, { A: "" })).toBeNull();
  });
  it("shows removed SKUs in the main diff, including their previous quantity", () => {
    const previous = {
      ...proposal,
      payload: {
        lines: [
          ...proposal.payload.lines!,
          { code_1c: "REMOVED", qty: 25, unit_cost: "1.00" },
        ],
      },
    };
    expect(
      removedLines(proposal.payload.lines!, previous.payload.lines).map(
        (line) => line.code_1c,
      ),
    ).toEqual(["REMOVED"]);
    const html = renderToStaticMarkup(
      <ProposalReview proposal={proposal} previous={previous} />,
    );
    expect(html).toContain("Исключено из нового заказа");
    expect(html).toContain("<del>25 шт.</del>");
  });
  it("separates pre-rounding need from MOQ-rounded recommended quantity", () => {
    const html = renderToStaticMarkup(
      <NeedFormula
        components={{
          forecast_qty: 11,
          safety: 0,
          on_hand: 0,
          in_transit: 0,
          raw_need: 11,
          moq: 5,
        }}
        qty={15}
      />,
    );
    expect(html).toContain("до округления, не меньше нуля");
    expect(html).toContain("11 шт.");
    expect(html).toContain("с кратностью 5");
    expect(html).toContain("15 шт.");
    expect(html).not.toContain("= <strong>15");
  });
  it("shows a historical calculation as read only", () => {
    const html = renderToStaticMarkup(
      <SupplierTable
        historical
        group={{
          supplier_id: "IEK",
          total_qty: 12,
          cost_known_lines: 0,
          rows: [row],
        }}
      />,
    );
    expect(html).not.toContain("Изменить qty");
    expect(html).toContain("Почему");
  });
});
