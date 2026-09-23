// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectionsPage } from "@/components/connections/ConnectionsPage";
import { axes, button, click, json, labels, mount } from "./c_helpers";
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const clean of cleanups.splice(0)) await clean(); vi.unstubAllGlobals(); });

describe("c_connections — server labels", () => {
  it.each(["live", "rules", "replay", "unavailable"])("shows the server's %s label and verbatim 1C meta without a badge", async ai => {
    vi.stubGlobal("fetch", vi.fn(async (path: string) => path === "/api/modes" ? json({ ok: true, axes: { ...axes, ai }, labels, sources: [{ name: "Партнёр SE.xlsx", as_of: "2026-09-22", anonymised: true, supplier_id: "SE" }] }) : json({ ok: true, ai_provider: "rules", providers: { voice: "missing" } })));
    const { host, cleanup } = await mount(<ConnectionsPage />); cleanups.push(cleanup);
    for (const key of ["provenance", `ai_${ai}`, "external", "supplier_draft", "world", "voice_unavailable", "agents"]) expect(host.textContent).toContain(labels[key as keyof typeof labels]);
    expect(host.textContent).toContain("22.09.2026");
    const row = host.querySelector('[data-testid="onec-row"]')!;
    expect(row.textContent).toContain("Ранее выполнен доступ к тестовой базе 1С и диагностика живой интеграции; бизнес-коннектор не подтверждён.");
    expect(row.querySelector("h3")?.textContent).toBe(labels.external);
    expect(row.querySelector('[class*="chip"]')).toBeNull();
    expect(host.textContent).not.toMatch(/1С подключена|connected|оплачено|подано|подписано/i);
  });
  it("retains the last confirmed modes after refresh failure", async () => {
    let fail = false;
    vi.stubGlobal("fetch", vi.fn(async (path: string) => path === "/api/modes" ? fail ? json({ ok: false, message: "Недоступно" }, 503) : json({ axes, labels }) : json({ providers: { voice: "missing" } })));
    const { host, cleanup } = await mount(<ConnectionsPage />); cleanups.push(cleanup);
    fail = true; await click(button(host, "Обновить"));
    expect(host.textContent).toContain("последний подтверждённый ответ");
    expect(host.textContent).toContain(labels.ai_rules);
    expect(host.textContent).toContain("Сервис не передал сведения об исходных файлах");
  });
});
