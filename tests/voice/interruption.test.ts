import { describe, expect, it } from "vitest";
import { AutomaticResponseGate, TranscriptGate, VoiceTurnGate } from "../../src/voice/transport";

describe("Realtime interruption event stream", () => {
  it("creates at most one automatic response per tool result and two per user turn", () => {
    const gate = new AutomaticResponseGate();
    const emitted: string[] = [];
    for (const id of ["call-1", "call-1", "call-2", "call-3"]) {
      if (gate.claim(id)) {
        emitted.push(`output:${id}`);
        if (gate.followUp()) emitted.push(`response:${id}`);
      }
    }
    expect(emitted).toEqual(["output:call-1", "response:call-1", "output:call-2", "response:call-2", "output:call-3"]);
    gate.resetTurn();
    expect(gate.claim("call-1")).toBe(false);
    expect(gate.claim("call-4")).toBe(true);
    expect(gate.followUp()).toBe(true);
  });
  it("drops a completed tool call from the interrupted response", () => {
    const turn = new VoiceTurnGate();
    turn.created("response-old");
    const pending = new AbortController();
    turn.track(pending);
    turn.cancel();
    expect(pending.signal.aborted).toBe(true);
    expect(turn.accept("response-old")).toBeNull();
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
  it("rejects the owner's hallucinated Korean line and tiny VAD noise", () => {
    const transcript = new TranscriptGate();
    transcript.started("input-noise");
    expect(transcript.completed("input-noise", "운동이나 체킨더 운동이나")).toBe(false);
    expect(transcript.completed("input-noise", "а!")).toBe(false);
    expect(transcript.peek()).toBe("");
    expect(transcript.completed("input-noise", "Покажи очередь")).toBe(true);
    expect(transcript.take()).toBe("Покажи очередь");
  });
});
