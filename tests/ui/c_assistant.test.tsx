// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { ResultCard } from "@/components/assistant/ResultCard";
import { VoiceStateStrip, VOICE_STATES } from "@/components/assistant/VoiceStateStrip";
import { resultAxes } from "@/components/assistant/types";
import { button, canonicalLabels, click, json, mount, type } from "./c_helpers";

const voice = vi.hoisted(() => ({ state: "unavailable", reason: "Provider unavailable", captions: [], start: vi.fn(), stop: vi.fn(), mute: vi.fn(), interrupt: vi.fn() }));
vi.mock("@/voice/useVoiceSession", () => ({ useVoiceSession: () => voice }));
const cleanups: (() => Promise<void>)[] = [];
async function render(node: Parameters<typeof mount>[0]) { const view = await mount(node); cleanups.push(view.cleanup); return view; }
afterEach(async () => { for (const clean of cleanups.splice(0)) await clean(); voice.state = "unavailable"; vi.unstubAllGlobals(); vi.clearAllMocks(); });
const health = { ok: true, providers: { voice: "missing" }, mode: "offline" };

describe("c_assistant — honest API-backed tools", () => {
  it("keeps all four tools and typed path available without an OpenAI key", async () => {
    const fetcher = vi.fn(async (path: string) => path === "/api/health" ? json(health) : json({ ok: true, items: [{ id: "PR-TEST", title: "Проверить заказ SE", href: "/review/PR-TEST" }], labels: canonicalLabels, state_version: 7 }));
    vi.stubGlobal("fetch", fetcher);
    const { host } = await render(<AssistantPanel variant="page" />);
    expect(host.textContent).toContain("Голос недоступен — печатайте");
    expect(host.textContent).toContain("Provider unavailable");
    expect(host.textContent).toContain("Realtime + async speech");
    for (const title of ["Что нужно от меня?", "Что изменилось?", "Что заказать по …", "Объясни код …"]) expect(button(host, title)?.disabled).toBe(false);
    expect(host.querySelector("textarea")?.disabled).toBe(false);
    await click(button(host, "Что нужно от меня?"));
    expect(fetcher.mock.calls.some(([path]) => path === "/api/voice/tools/what_needs_me")).toBe(true);
    expect(host.textContent).toContain("Проверить заказ SE");
    expect(host.textContent).toContain("Данные партнёра · обезличены");
    expect(host.textContent).toContain("Правила без LLM");
    expect(host.textContent).toContain("Экспорт для 1С (файл)");
  });
  it("announces pending immediately, ignores duplicate submit and preserves failed text and retry id", async () => {
    let settle!: (value: Response) => void;
    const bodies: { request_id: string; text: string }[] = [];
    vi.stubGlobal("fetch", vi.fn((path: string, init?: RequestInit) => {
      if (path === "/api/health") return Promise.resolve(json(health));
      bodies.push(JSON.parse(String(init?.body)));
      return new Promise<Response>(resolve => { settle = resolve; });
    }));
    const { host } = await render(<AssistantPanel />);
    const input = host.querySelector("textarea")!;
    await type(input, "Что изменилось?");
    await click(button(host, "Отправить сообщение"));
    expect(button(host, "Отправить сообщение")?.getAttribute("aria-busy")).toBe("true");
    await click(button(host, "Отправить сообщение"));
    expect(bodies).toHaveLength(1);
    await act(async () => settle(json({ ok: false, code: "provider_unavailable", message: "Провайдер недоступен" }, 503)));
    expect(input.value).toBe("Что изменилось?");
    expect(host.querySelectorAll("article")).toHaveLength(0);
    await click(button(host, "Повторить запрос"));
    expect(bodies[1].request_id).toBe(bodies[0].request_id);
    await act(async () => settle(json({ ok: true, reply_ru: "Нет новых изменений", labels: canonicalLabels, state_version: 2 })));
    expect(host.textContent).toContain("Нет новых изменений");
  });
  it("posts explicit scope and entered SKU instead of inventing an example", async () => {
    const calls: { path: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (path: string, init?: RequestInit) => { if (path === "/api/health") return json(health); calls.push({ path, body: JSON.parse(String(init?.body)) }); return json({ ok: true, code_1c: "TEST-CODE", rationale_ru: "Потребность из источников", labels: canonicalLabels }); }));
    const { host } = await render(<AssistantPanel scope={{ org_id: "partner", supplier_id: "SE" }} />);
    await click(button(host, "Объясни код …"));
    await type(host.querySelector("input")!, "TEST-CODE");
    await click(button(host, "Объяснить товар"));
    expect(calls[0]).toMatchObject({ path: "/api/voice/tools/explain_sku", body: { scope: { org_id: "partner", supplier_id: "SE" }, args: { code_1c: "TEST-CODE" } } });
  });
  it.each(Object.entries(VOICE_STATES))("renders voice state %s without claiming a saved task", async (state, title) => {
    const { host } = await render(<VoiceStateStrip state={state as keyof typeof VOICE_STATES} />);
    expect(host.textContent).toBe(title);
    expect(host.querySelector('[role="status"]')?.getAttribute("data-state")).toBe(state);
  });
  it("keeps drafts and attributes an in-flight result to its original scope after navigation", async () => {
    let settle!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn((path: string) => path === "/api/health" ? Promise.resolve(json(health)) : new Promise<Response>(resolve => { settle = resolve; })));
    const { host, root } = await render(<AssistantPanel scope={{ org_id: "partner", supplier_id: "SE" }} />);
    await type(host.querySelector("textarea")!, "Черновик вопроса SE");
    await click(button(host, "Что нужно от меня?"));
    await act(async () => { root.render(<AssistantPanel scope={{ supplier_id: "IEK", org_id: "partner" }} />); });
    expect(host.querySelector("textarea")?.value).toBe("");
    await act(async () => settle(json({ ok: true, items: [{ id: "PR-SE", title: "Результат SE" }], labels: canonicalLabels })));
    expect(host.textContent).toContain("Ответ по поставщику SE");
    expect(host.textContent).toContain("Результат SE");
    await act(async () => { root.render(<AssistantPanel scope={{ supplier_id: "SE", org_id: "partner" }} />); });
    expect(host.querySelector("textarea")?.value).toBe("Черновик вопроса SE");
  });
  it("does not substitute a mode for absent axes and prevents external result links", async () => {
    expect(resultAxes({ reply_ru: "Уточните" })).toEqual({ provenance: undefined, ai: undefined, external: undefined });
    const { host } = await render(<ResultCard title="Решения" response={{ items: [{ id: "1", title: "Данные", href: "//untrusted.example" }], labels: canonicalLabels }} />);
    expect(host.querySelector("a")).toBeNull();
    expect(host.querySelector('[aria-label="Источник, AI, внешнее действие"]')?.children).toHaveLength(3);
  });
  it("renders a confirmed spoken tool result once and ignores results outside an active conversation", async () => {
    voice.state = "checking";
    vi.stubGlobal("fetch", vi.fn(async () => json({ providers: { voice: "configured" } })));
    const { host, root } = await render(<AssistantPanel />);
    const detail = { request_id: "spoken-1", tool: "what_changed", result: { ok: true, summary_ru: "Изменились остатки", labels: canonicalLabels } };
    await act(async () => { window.dispatchEvent(new CustomEvent("ainalym:voice-tool-result", { detail })); window.dispatchEvent(new CustomEvent("ainalym:voice-tool-result", { detail })); });
    expect(host.querySelectorAll("article")).toHaveLength(1);
    expect(host.textContent).toContain("Изменились остатки");
    voice.state = "ended";
    await act(async () => { root.render(<AssistantPanel />); });
    await act(async () => { window.dispatchEvent(new CustomEvent("ainalym:voice-tool-result", { detail: { ...detail, request_id: "late-2" } })); });
    expect(host.querySelectorAll("article")).toHaveLength(1);
  });
});
