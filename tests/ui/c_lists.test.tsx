// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderList } from "@/components/lists/OrderList";
import { DocumentList } from "@/components/lists/DocumentList";
import { axes, button, click, json, mount } from "./c_helpers";
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const clean of cleanups.splice(0)) await clean(); vi.unstubAllGlobals(); });
describe("c_lists — persisted purchase records", () => {
  it("preserves unknown cost/currency and the last successful order snapshot", async () => {
    let fails = false;
    vi.stubGlobal("fetch", vi.fn(async (path: string) => path === "/api/notifications" ? json({ total: 0, items: [] }) : fails ? json({ ok: false, message: "offline" }, 503) : json({ orders: [{ id: "PO-TEST", supplier_id: "IEK", state: "draft", total_qty: 100, total_cost: null, version: 2 }, { id: "PO-COST", supplier_id: "SE", state: "approved", total_qty: 1, total_cost: "10.25", version: 1 }], axes })));
    const { host, cleanup } = await mount(<OrderList />); cleanups.push(cleanup);
    expect(host.textContent).toContain("Себестоимость не задана");
    expect(host.textContent).toContain("10.25 · валюта не указана");
    expect(host.textContent).toContain("Черновик заказа — не отправлен");
    expect(host.querySelector('a[href="/orders/PO-TEST"]')).not.toBeNull();
    fails = true; await click(button(host, "Обновить"));
    expect(host.textContent).toContain("показываю последнее");
    expect(host.querySelector('a[href="/orders/PO-TEST"]')).not.toBeNull();
  });
  it("does not claim an empty order list when the endpoint is missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ ok: false, message: "Список пока недоступен" }, 404)));
    const { host, cleanup } = await mount(<OrderList />); cleanups.push(cleanup);
    expect(host.textContent).toContain("Список пока недоступен");
    expect(host.textContent).not.toContain("Заказов пока нет");
  });
  it("shows recorded file download links while separately disclosing a missing artifact list", async () => {
    vi.stubGlobal("fetch", vi.fn(async (path: string) => path === "/api/notifications" ? json({ total: 0, items: [] }) : path === "/api/artifacts" ? json({ ok: false, message: "Unavailable" }, 404) : json({ rows: [{ id: "EX-TEST", external_identity: "PO-TEST", state: "exported", version: 1, as_of: "2026-09-23T08:00:00Z", external: "export_only" }] })));
    const { host, cleanup } = await mount(<DocumentList />); cleanups.push(cleanup);
    expect(host.querySelectorAll('a[href^="/api/peers/onec-export/PO-TEST"]')).toHaveLength(2);
    expect(host.textContent).toContain("Список материалов пока недоступен");
    expect(host.textContent).not.toContain("Материалы ещё не подготовлены");
    expect(host.textContent).toContain("Экспорт для 1С (файл)");
  });
});
