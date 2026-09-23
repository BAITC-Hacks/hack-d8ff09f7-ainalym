// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CalculationComposer } from "@/components/pulse/CalculationComposer";
import { QueueRow, DecisionQueue } from "@/components/pulse/DecisionQueue";
import { WorldFeed } from "@/components/feed/WorldFeed";
import type { QueueItem } from "@/components/pulse/types";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const item: QueueItem = { id: "PR-test", version: 7, kind: "proposal", title: "Заказ поставщику SE", why: "Изменился товар в пути. Подготовлен новый расчёт.", since: "2026-09-23T08:00:00Z", sources: ["in_transit"], options: [{ key: "approve", label: "Утвердить" }, { key: "reject", label: "Отклонить" }], href: "/review/PR-test" };
beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("a_real action boundaries", () => {
  it("posts calculation scope once, paints busy, and preserves input on provider failure", async () => {
    let resolve!: (response: Response) => void; const pending = new Promise<Response>(r => resolve = r); vi.mocked(fetch).mockReturnValue(pending);
    render(<CalculationComposer />); fireEvent.change(screen.getByLabelText("Поставщик"), { target: { value: "SE" } }); fireEvent.change(screen.getByLabelText("Категория"), { target: { value: "0302" } });
    const button = screen.getByRole("button", { name: "Запустить расчёт" }); fireEvent.click(button); fireEvent.click(button);
    expect(button.getAttribute("aria-busy")).toBe("true"); expect(fetch).toHaveBeenCalledTimes(1); expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ scope: { supplier: "SE", category: "0302" } });
    await act(async () => resolve(json({ ok: false, code: "provider_unavailable", message: "Провайдер недоступен" }, 503)));
    expect(await screen.findByText("Провайдер недоступен")).toBeTruthy(); expect((screen.getByLabelText("Категория") as HTMLInputElement).value).toBe("0302"); expect(button.getAttribute("aria-busy")).toBeNull(); expect(screen.queryByText(/Расчёт завершён/)).toBeNull();
  });
  it("binds approvals to the displayed version and reports 409 inline", async () => {
    vi.mocked(fetch).mockResolvedValue(json({ ok: false, code: "stale", message: "stale" }, 409)); render(<ul><QueueRow item={item} /></ul>);
    fireEvent.click(screen.getByRole("button", { name: "Утвердить" })); await screen.findByText(/Версия устарела/);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/proposals/PR-test/approve"); expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ proposal_version: 7 });
  });
  it("never guesses a proposal version when the queue omits it", async () => {
    vi.mocked(fetch).mockResolvedValue(json({ proposals: [] })); render(<ul><QueueRow item={{ ...item, version: undefined }} /></ul>); fireEvent.click(screen.getByRole("button", { name: "Отклонить" })); await screen.findByText(/Версия устарела/);
    expect(fetch).toHaveBeenCalledTimes(1); expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/proposals?state=needs_review");
  });
  it("keeps the last decision readable on refresh failure", () => {
    render(<DecisionQueue data={{ items: [item] }} loading={false} error={Object.assign(new Error("network"), { status: 0, code: "network" })} reload={() => {}} axes={{ provenance: "partner_anonymised", ai: "rules", external: "export_only" }} />);
    expect(screen.getByText(item.title)).toBeTruthy(); expect(screen.getByText(/показываю последнее известное/)).toBeTruthy(); expect(screen.getByRole("link", { name: /Проверить изменения/ }).getAttribute("href")).toBe(item.href);
  });
  it("plays one event with an immediate busy state and an honest replay receipt", async () => {
    let resolve!: (value: Response) => void;
    vi.mocked(fetch).mockImplementation(async (_path, options) => options?.method === "POST" ? await new Promise<Response>(r => resolve = r) : json({ events: [] }));
    render(<WorldFeed />); await screen.findByText(/Следующих событий нет/); const button = screen.getByRole("button", { name: "Воспроизвести" }); fireEvent.click(button);
    expect(button.getAttribute("aria-busy")).toBe("true"); const call = vi.mocked(fetch).mock.calls.find(call => call[0] === "/api/world/play")!; expect(JSON.parse(call[1]!.body as string)).toEqual({ steps: 1 });
    await act(async () => resolve(json({ processed: 0, replayed: true }))); expect(await screen.findByText("Уже обработано — без эффекта")).toBeTruthy();
  });
  it("composes through the API and retains typed input on rejection", async () => {
    vi.mocked(fetch).mockImplementation(async (_path, options) => options?.method === "POST" ? json({ ok: false, code: "invalid", message: "Укажите известный код товара" }, 422) : json({ events: [] }));
    render(<WorldFeed />); fireEvent.click(screen.getByRole("button", { name: "Сочинить событие" })); fireEvent.change(screen.getByLabelText("Код 1С"), { target: { value: "CODE-test" } }); fireEvent.change(screen.getByLabelText("Что изменилось?"), { target: { value: "Разовый заказ 5000 шт" } }); fireEvent.click(screen.getByRole("button", { name: "Добавить событие" }));
    await screen.findByText("Укажите известный код товара"); expect((screen.getByLabelText("Что изменилось?") as HTMLTextAreaElement).value).toBe("Разовый заказ 5000 шт");
    const call = vi.mocked(fetch).mock.calls.find(call => call[0] === "/api/world/compose")!; expect(JSON.parse(call[1]!.body as string)).toEqual({ kind: "judge_message", code_1c: "CODE-test", text: "Разовый заказ 5000 шт" });
  });
  it("a missing service produces unavailable feedback, not success", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("not found", { status: 404 })); render(<CalculationComposer />); fireEvent.click(screen.getByRole("button", { name: "Запустить расчёт" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("пока недоступен")); expect(screen.queryByText(/Расчёт завершён/)).toBeNull();
  });
});
