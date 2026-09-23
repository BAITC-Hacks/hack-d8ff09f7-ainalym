// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import JudgeCompose from "../../src/app/(peers)/world/[code_1c]/JudgeCompose";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("derives event text and numeric payload from the edited quantity", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ event: { id: "WE-1", state: "processed" }, replayed: false }), {
    status: 200, headers: { "content-type": "application/json" },
  })));
  render(<JudgeCompose code="010500008_" threshold={100} />);
  fireEvent.change(screen.getByLabelText("Количество, шт"), { target: { value: "7250" } });
  const text = screen.getByLabelText("Текст события (из полей выше)") as HTMLTextAreaElement;
  expect(text.readOnly).toBe(true);
  expect(text.value).toBe("Разовый заказ 7250 шт по коду 010500008_");
  fireEvent.click(screen.getByRole("button", { name: "Добавить событие" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
  expect(body.text).toBe(text.value);
  expect(body.payload).toMatchObject({ qty: 7250, document_qty: 7250 });
});
