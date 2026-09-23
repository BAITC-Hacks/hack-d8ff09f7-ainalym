import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";

export async function mount(node: ReactNode) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  if (!window.matchMedia) Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
  const host = document.createElement("div"); document.body.append(host);
  const root: Root = createRoot(host);
  await act(async () => { root.render(node); });
  return { host, root, async cleanup() { await act(async () => root.unmount()); host.remove(); } };
}
export async function click(button: Element | null) { if (!button) throw new Error("Button not found"); await act(async () => { (button as HTMLElement).click(); }); }
export function button(host: HTMLElement, name: string) { return Array.from(host.querySelectorAll("button")).find(node => node.textContent?.includes(name) || node.getAttribute("aria-label") === name) ?? null; }
export async function type(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => { const base = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(base, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
export const axes = { provenance: "partner_anonymised", ai: "rules", external: "export_only" } as const;
export const canonicalLabels = { provenance: "Partner data · anonymised", ai: "Rules, no LLM", external: "Export for 1C (file)" };
export const labels = {
  provenance: "Данные партнёра · обезличены", ai_live: "Живой AI", ai_rules: "Правила без LLM", ai_replay: "Воспроизведение · записанное решение", ai_unavailable: "Провайдер недоступен", external: "Экспорт для 1С (файл)", agents: "Агенты · данные партнёра", supplier_draft: "Черновик заказа — не отправлен", world: "Симулятор мира — синтетическое событие", voice_live: "Голос: живой", voice_unavailable: "Голос недоступен",
};
