// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useVoiceSession } from "../../src/voice/useVoiceSession";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

describe("voice audio unlock", () => {
  it("starts playback in the click stack and offers a retry after rejection", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValueOnce(new Error("blocked"))
      .mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    const { result, unmount } = renderHook(() => useVoiceSession({ org_id: "ORG-1" }));
    act(() => { void result.current.start(); expect(play).toHaveBeenCalledTimes(1); });
    await waitFor(() => expect(result.current.audioBlocked).toBe(true));
    act(() => result.current.enableAudio());
    await waitFor(() => expect(result.current.audioBlocked).toBe(false));
    expect(play).toHaveBeenCalledTimes(2);
    unmount();
    play.mockRestore();
    pause.mockRestore();
  });
});
