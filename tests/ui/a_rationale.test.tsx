// @vitest-environment jsdom
import React from "react";
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NeedFormula } from "@/components/purchase/Rationale";

it("shows the approved 30 deduction in the 80 to 50 need formula", () => {
  render(<NeedFormula components={{ forecast_qty: 80, safety: 0, on_hand: 0, in_transit: 0, approved_order_qty: 30 }} qty={50} />);
  const formula = screen.getByLabelText("Расчёт потребности");
  expect(formula.textContent).toContain("− утверждённый заказ 30");
  expect(formula.textContent).toContain("Прогноз 80");
  expect(formula.textContent).toContain("= 50 шт.");
});
