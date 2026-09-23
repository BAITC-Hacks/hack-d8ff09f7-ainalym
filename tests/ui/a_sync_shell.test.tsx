// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiProvider, useApi, useApiSync } from "@/components/shell/api";
import { AppShell } from "@/components/shell/AppShell";
const push = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => "/today", useRouter: () => ({ push }) }));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function Probe() {
  const { data, error, loading } = useApi<{ value: string }>("/api/today"); const sync = useApiSync();
  return <><input aria-label="Черновик" defaultValue="мой текст" /><p>{loading ? "loading" : data?.value}</p><p>{error?.message}</p><p>{sync.offline ? "offline" : "online"}</p><button onClick={sync.refresh}>Обновить</button></>;
}
beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); Object.defineProperty(document, "hidden", { configurable: true, value: false }); Object.defineProperty(navigator, "onLine", { configurable: true, value: true }); HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); }; });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("a_live snapshots and shell", () => {
  it("polls at five seconds, refreshes changed state, keeps the input node and focus", async () => {
    vi.useFakeTimers(); let version = 1;
    vi.mocked(fetch).mockImplementation(async path => json(path === "/api/state" ? { state_version: version } : { value: `snapshot ${version}` }));
    render(<ApiProvider><Probe /></ApiProvider>); await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const input = screen.getByLabelText("Черновик"); input.focus(); fireEvent.change(input, { target: { value: "не потерять" } }); version = 2;
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.getByText("snapshot 2")).toBeTruthy(); expect(document.activeElement).toBe(input); expect((input as HTMLInputElement).value).toBe("не потерять");
    expect(vi.mocked(fetch).mock.calls.filter(c => c[0] === "/api/state")).toHaveLength(2);
  });
  it("pauses polling when hidden and refreshes immediately on visibility return", async () => {
    vi.useFakeTimers(); vi.mocked(fetch).mockImplementation(async path => json(path === "/api/state" ? { state_version: 1 } : { value: "persisted" })); render(<ApiProvider><Probe /></ApiProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); }); const calls = vi.mocked(fetch).mock.calls.length;
    Object.defineProperty(document, "hidden", { value: true }); fireEvent(document, new Event("visibilitychange")); await act(async () => { await vi.advanceTimersByTimeAsync(20000); }); expect(fetch).toHaveBeenCalledTimes(calls);
    Object.defineProperty(document, "hidden", { value: false }); await act(async () => { fireEvent(document, new Event("visibilitychange")); await vi.advanceTimersByTimeAsync(0); }); expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(calls);
  });
  it("retains the last successful snapshot after a failed refresh", async () => {
    vi.mocked(fetch).mockImplementation(async path => json(path === "/api/state" ? { state_version: 1 } : { value: "persisted" })); render(<ApiProvider><Probe /></ApiProvider>); await screen.findByText("persisted");
    vi.mocked(fetch).mockRejectedValue(new TypeError("network")); fireEvent.click(screen.getByRole("button", { name: "Обновить" })); await screen.findByText("Нет связи — показываю последнее"); expect(screen.getByText("persisted")).toBeTruthy(); expect(screen.getByText("offline")).toBeTruthy();
  });
  it("shows offline replay and restores focus after closing the keyboard palette", async () => {
    vi.mocked(fetch).mockImplementation(async path => json(path === "/api/modes" ? { mode: "offline", ai: "replay", provenance: "partner_anonymised", external: "export_only" } : { state_version: 1 })); render(<AppShell><h1>Сегодня</h1></AppShell>);
    await screen.findByText(/Офлайн-режим · записанные решения\. Живой AI недоступен/);
    const trigger = screen.getByRole("button", { name: /Поиск раздела/ }); trigger.focus(); fireEvent.click(trigger); expect(screen.getByRole("dialog")).toBeTruthy(); expect(document.activeElement).toBe(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" })); await waitFor(() => expect(document.activeElement).toBe(trigger)); expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("does not capture shortcut letters while typing", async () => {
    push.mockClear(); vi.mocked(fetch).mockImplementation(async path => json(path === "/api/modes" ? { mode: "live", ai: "rules" } : { state_version: 1 })); render(<AppShell><input aria-label="Текст" /></AppShell>);
    const input = screen.getByLabelText("Текст"); input.focus(); fireEvent.keyDown(input, { key: "g" }); fireEvent.keyDown(input, { key: "t" }); fireEvent.keyDown(input, { key: "/" }); expect(push).not.toHaveBeenCalled(); expect(screen.queryByRole("dialog")).toBeNull();
  });
});
