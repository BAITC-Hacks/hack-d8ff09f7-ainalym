// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useVoiceSession } from "../../src/voice/useVoiceSession";
import { SPOKEN_SUMMARY_INSTRUCTIONS } from "../../src/voice/summary";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());

describe("Realtime tool-result state machine", () => {
  it("requests one audible summary per call_id with only three model-visible items", async () => {
    const sent: Record<string, any>[] = [];
    const channel = {
      readyState: "open", send: (json: string) => sent.push(JSON.parse(json)), close: vi.fn(),
      onopen: null as (() => void) | null, onmessage: null as ((event: { data: string }) => void) | null,
      onclose: null, onerror: null,
    };
    const remote = { getTracks: () => [] } as unknown as MediaStream;
    const local = { getTracks: () => [{ stop: vi.fn() }], getAudioTracks: () => [{ enabled: true }] } as unknown as MediaStream;
    const connection = {
      createDataChannel: () => channel, addTrack: vi.fn(), createOffer: async () => ({ sdp: "offer" }),
      setLocalDescription: async () => undefined, setRemoteDescription: async () => undefined, close: vi.fn(),
      ontrack: null as ((event: { streams: MediaStream[] }) => void) | null,
      onconnectionstatechange: null, connectionState: "connected",
    };
    vi.stubGlobal("RTCPeerConnection", function MockRTCPeerConnection() { return connection; });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => local } });
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const clientResults: unknown[] = [];
    window.addEventListener("ainalym:voice-tool-result", (event) => clientResults.push((event as CustomEvent).detail));
    const items = Array.from({ length: 20 }, (_, i) => ({ id: `P-${i}`, kind: "proposal", title: `Позиция ${i}`, href: `/review/P-${i}` }));
    const fetcher = vi.fn(async (input: string) => {
      if (input === "/api/state") return Response.json({ state_version: 1 });
      if (input === "/api/voice/session") return Response.json({ client_secret: "test-only", expires_at: Math.floor(Date.now() / 1000) + 40 });
      if (input === "https://api.openai.com/v1/realtime/calls") return new Response("answer");
      if (input === "/api/voice/turn") return Response.json({ ok: true });
      if (input === "/api/voice/tools/what_needs_me") return Response.json({ ok: true, state_version: 1, labels: {}, items, render: { kind: "queue", purpose: "approvals", title: "Требуют решения", items } });
      throw new Error(`Unexpected fetch: ${input}`);
    });
    vi.stubGlobal("fetch", fetcher);
    const { result, unmount } = renderHook(() => useVoiceSession({ org_id: "ORG-1" }));
    await act(async () => { await result.current.start(); });
    act(() => { connection.ontrack?.({ streams: [remote] }); });
    const event = (value: Record<string, unknown>) => act(() => { channel.onmessage?.({ data: JSON.stringify(value) }); });
    event({ type: "input_audio_buffer.speech_started", item_id: "input-1" });
    event({ type: "input_audio_buffer.committed" });
    event({ type: "conversation.item.input_audio_transcription.completed", item_id: "input-1", transcript: "Покажи очередь" });
    await waitFor(() => expect(sent.some(message => message.type === "response.create")).toBe(true));
    expect(sent.find(message => message.type === "response.create")?.response).toMatchObject({ tool_choice: "required", output_modalities: ["text"] });
    event({ type: "response.created", response: { id: "tool-response" } });
    const done = { type: "response.done", response: { id: "tool-response", status: "completed", output: [{ type: "function_call", name: "what_needs_me", call_id: "call-1", arguments: "{}" }] } };
    event(done);
    await waitFor(() => expect(sent.filter(message => message.type === "conversation.item.create")).toHaveLength(1));
    const toolOutput = JSON.parse(sent.find(message => message.type === "conversation.item.create")!.item.output);
    expect(toolOutput).toMatchObject({ total: { count: 20, unit: "решений" }, next_step: "Откройте очередь решений" });
    expect(toolOutput.top_items).toHaveLength(3);
    expect(JSON.stringify(toolOutput)).not.toContain("Позиция 19");
    expect(clientResults).toMatchObject([{ render: { kind: "queue", items }, result: { render: { kind: "queue", items } } }]);
    const responses = sent.filter(message => message.type === "response.create");
    expect(responses).toHaveLength(2);
    expect(responses[1].response).toMatchObject({ output_modalities: ["audio"], tool_choice: "none", instructions: SPOKEN_SUMMARY_INSTRUCTIONS });
    event(done);
    expect(sent.filter(message => message.type === "response.create")).toHaveLength(2);
    const beforeSummary = play.mock.calls.length;
    event({ type: "response.created", response: { id: "spoken-summary" } });
    await waitFor(() => expect(play.mock.calls.length).toBeGreaterThan(beforeSummary));
    const beforeNextReply = play.mock.calls.length;
    event({ type: "response.created", response: { id: "another-spoken-summary" } });
    await waitFor(() => expect(play.mock.calls.length).toBeGreaterThan(beforeNextReply));
    unmount();
    play.mockRestore();
    pause.mockRestore();
  });
});
