import { describe, expect, it } from "vitest";
import { TranscriptGate, VoiceTurnGate } from "../../src/voice/transport";

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

  it("does not reuse a late transcript from an earlier speech turn", () => {
    const transcript = new TranscriptGate();
    transcript.started("input-old");
    transcript.started("input-new");
    expect(transcript.completed("input-old", "тринадцать… нет, четырнадцать")).toBe(false);
    expect(transcript.peek()).toBe("");
    expect(transcript.completed("input-new", "расчёт по SE")).toBe(true);
    expect(transcript.take()).toBe("расчёт по SE");
    expect(transcript.take()).toBe("");
    expect(transcript.completed("input-new", "late duplicate")).toBe(false);
  });
});
