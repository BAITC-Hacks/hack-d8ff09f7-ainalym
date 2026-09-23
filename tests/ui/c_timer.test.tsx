// @vitest-environment jsdom
import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { PlaybackTimer } from "@/components/world-console/PlaybackTimer";
import { click, json, mount } from "./c_helpers";
let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => { await cleanup?.(); cleanup = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); Object.defineProperty(document, "hidden", { configurable: true, value: false }); });
it("c_timer is off by default, waits 20 s, pauses hidden and stops at the end", async () => {
  vi.useFakeTimers();
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  const fetcher = vi.fn(async () => json({ ok: true, processed: 0 })); vi.stubGlobal("fetch", fetcher);
  const view = await mount(<PlaybackTimer />); cleanup = view.cleanup;
  await act(async () => { await vi.advanceTimersByTimeAsync(40_000); });
  expect(fetcher).not.toHaveBeenCalled();
  await click(view.host.querySelector("input"));
  await act(async () => { await vi.advanceTimersByTimeAsync(19_999); });
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); await vi.advanceTimersByTimeAsync(40_000); });
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); await vi.advanceTimersByTimeAsync(20_000); });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(view.host.querySelector("input")?.checked).toBe(false);
});
