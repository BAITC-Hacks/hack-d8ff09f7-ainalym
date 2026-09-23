// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EVENT_STATES, WorldEventList } from "@/components/world-console/WorldEventList";
import { composeBody, WorldControls } from "@/components/world-console/WorldControls";
import { button, click, json, mount, type } from "./c_helpers";
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const clean of cleanups.splice(0)) await clean(); vi.unstubAllGlobals(); });
describe("c_world — complete API history", () => {
  it("renders all five event states with a run link and preserves filter focus on refresh", async () => {
    const rows = Object.keys(EVENT_STATES).map((state, index) => ({ id: `WE-TEST-${index}`, seq: index + 1, kind: "judge_message", state, text: `Событие ${index}`, code_1c: `SKU-${index}`, run_id: state === "processed" ? "RUN-TEST" : null, label: "Симулятор мира — синтетическое событие", external: "local_simulator" }));
    vi.stubGlobal("fetch", vi.fn(async () => json({ ok: true, rows })));
    const { host, cleanup } = await mount(<WorldEventList />); cleanups.push(cleanup);
    for (const title of Object.values(EVENT_STATES)) expect(host.querySelector("ol")?.textContent).toContain(title);
    expect(host.querySelector('a[href*="RUN-TEST"]')).not.toBeNull();
    expect(host.querySelector("ol")?.textContent).toContain("Симулятор мира — синтетическое событие");
    const filter = host.querySelector("select")!;
    await act(async () => { filter.value = "processed"; filter.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.querySelectorAll("ol > li")).toHaveLength(1);
    filter.focus(); await click(button(host, "Обновить"));
    expect(document.activeElement).toBe(filter);
    expect(filter.value).toBe("processed");
    await type(host.querySelector("input")!, "absent");
    expect(host.textContent).toContain("Событий по этим условиям нет.");
    await click(button(host, "Сбросить фильтры"));
    expect(host.querySelectorAll("ol > li")).toHaveLength(5);
  });
  it("renders route failure rather than fictitious empty history", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ ok: false, message: "Лента недоступна" }, 503)));
    const { host, cleanup } = await mount(<WorldEventList />); cleanups.push(cleanup);
    expect(host.textContent).toContain("Лента недоступна");
    expect(host.textContent).not.toContain("Лента пуста");
    expect(button(host, "Повторить")).not.toBeNull();
  });
  it("sends explicit source changes, preserves rejected inputs, and reports the saved event state", async () => {
    expect(composeBody({ kind: "in_transit_update", code: " SKU-TEST ", value: "100", text: "В пути" })).toMatchObject({ code_1c: "SKU-TEST", payload: { code_1c: "SKU-TEST", delta: "100" } });
    expect(composeBody({ kind: "price_update", code: "SKU-TEST", value: "1.23", text: "Цена" }).payload).toEqual({ code_1c: "SKU-TEST", unit_cost: "1.23" });
    const fetcher = vi.fn().mockResolvedValueOnce(json({ ok: false, message: "Обработчик временно недоступен" }, 503)).mockResolvedValueOnce(json({ ok: true, event: { id: "WE-TEST", state: "pending" } }));
    vi.stubGlobal("fetch", fetcher);
    const { host, cleanup } = await mount(<WorldControls />); cleanups.push(cleanup);
    await click(button(host, "Сочинить событие"));
    await type(host.querySelector("input")!, "SKU-TEST");
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(host.querySelector("input")?.value).toBe("SKU-TEST");
    expect(host.textContent).toContain("Обработчик временно недоступен");
    expect(host.textContent).not.toContain("Событие сохранено");
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(host.textContent).toContain("Событие сохранено · Ждёт обработки");
    expect(host.textContent).not.toContain("Расчёт завершён");
  });
});
