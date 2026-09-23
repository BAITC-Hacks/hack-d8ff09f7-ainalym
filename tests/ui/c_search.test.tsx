// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchResults } from "@/components/lists/SearchPalette";
import { json, mount } from "./c_helpers";
let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => { await cleanup?.(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("c_search live results", () => {
  it("never displays an older query response under a newly typed query", async () => {
    vi.useFakeTimers();
    const settles = new Map<string, (value: Response) => void>();
    vi.stubGlobal("fetch", vi.fn((path: string) => new Promise<Response>(resolve => settles.set(path, resolve))));
    const view = await mount(<SearchResults query="SE" />); cleanup = view.cleanup;
    expect(view.host.querySelector('[aria-busy="true"]')).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    await act(async () => { view.root.render(<SearchResults query="IEK" />); });
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    await act(async () => { settles.get("/api/search?q=IEK")!(json({ query: "IEK", items: [{ id: "IEK-TEST", kind: "sku", title: "Товар IEK", href: "/skus/IEK-TEST" }] })); });
    await act(async () => { settles.get("/api/search?q=SE")!(json({ query: "SE", items: [{ id: "SE-TEST", kind: "sku", title: "Старый товар SE", href: "/skus/SE-TEST" }] })); });
    expect(view.host.textContent).toContain("Товар IEK");
    expect(view.host.textContent).not.toContain("Старый товар SE");
  });
});
