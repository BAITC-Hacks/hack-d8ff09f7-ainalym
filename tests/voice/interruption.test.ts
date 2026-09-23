import { describe, expect, it } from "vitest";
import { VoiceTurnGate } from "../../src/voice/transport";

describe("Realtime interruption event stream", () => {
  it("drops a completed tool call from the interrupted response", () => {
    const turn = new VoiceTurnGate();
    turn.created("response-old");
    const pending = new AbortController();
    turn.track(pending);
    turn.cancel();
    expect(pending.signal.aborted).toBe(true);
    expect(turn.accept("response-old")).toBeNull();
    turn.created("response-new");
    expect(turn.isCurrent(turn.accept("response-new")!)).toBe(true);
  });
});
