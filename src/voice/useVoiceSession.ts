"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TranscriptGate, VoiceTurnGate } from "./transport";

export type VoiceState = "idle" | "connecting" | "listening" | "checking" | "preparing" | "waiting_review" | "ended" | "unavailable";
export interface Caption { who: "user" | "assistant" | "tool"; text: string }
export interface VoiceSession { state: VoiceState; reason?: string; start: () => Promise<void>; stop: () => void; mute: (on: boolean) => void; interrupt: () => void; captions: Caption[] }
export interface VoiceScope { org_id: string; supplier_id?: string; code_1c?: string }

type FunctionCall = { type: "function_call"; name: string; call_id: string; arguments: string };
type RealtimeEvent = { type: string; item_id?: string; transcript?: string; response?: { id?: string; status?: string; output?: FunctionCall[] } };
type SessionResponse = { client_secret?: string; expires_at?: number };

export function useVoiceSession(scope: VoiceScope): VoiceSession {
  const router = useRouter();
  const [state, setState] = useState<VoiceState>("idle");
  const [reason, setReason] = useState<string>();
  const [captions, setCaptions] = useState<Caption[]>([]);
  const peer = useRef<RTCPeerConnection | null>(null);
  const starting = useRef(false);
  const channel = useRef<RTCDataChannel | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const generation = useRef(0);
  const turn = useRef(new VoiceTurnGate());
  const transcript = useRef(new TranscriptGate());
  const latestStateVersion = useRef<number | undefined>(undefined);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const send = useCallback((event: Record<string, unknown>) => {
    if (channel.current?.readyState === "open") channel.current.send(JSON.stringify(event));
  }, []);

  const release = useCallback(() => {
    starting.current = false;
    turn.current.cancel();
    transcript.current.clear();
    const dataChannel = channel.current;
    channel.current = null;
    dataChannel?.close();
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    const connection = peer.current;
    peer.current = null;
    connection?.close();
    if (audio.current) { audio.current.pause(); audio.current.srcObject = null; audio.current.remove(); audio.current = null; }
  }, []);

  const stop = useCallback(() => {
    generation.current++;
    send({ type: "response.cancel" });
    release();
    setState("ended");
  }, [release, send]);

  const interrupt = useCallback(() => {
    turn.current.cancel();
    transcript.current.clear();
    send({ type: "response.cancel" });
    setState("listening");
  }, [send]);

  const mute = useCallback((on: boolean) => {
    stream.current?.getAudioTracks().forEach(track => { track.enabled = !on; });
  }, []);

  const handleEvent = useCallback(async (event: RealtimeEvent, sessionGeneration: number) => {
    if (sessionGeneration !== generation.current) return;
    if (event.type === "response.created" && event.response?.id) turn.current.created(event.response.id);
    if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript?.trim()) {
      transcript.current.completed(event.item_id, event.transcript);
      setCaptions(lines => [...lines, { who: "user", text: event.transcript!.trim() }]);
    }
    if (event.type === "response.output_audio_transcript.done" && event.transcript?.trim()) {
      setCaptions(lines => [...lines, { who: "assistant", text: event.transcript!.trim() }]);
    }
    if (event.type === "input_audio_buffer.speech_started") {
      turn.current.cancel();
      transcript.current.started(event.item_id);
      setState("listening");
    }
    if (event.type !== "response.done" || event.response?.status !== "completed") return;
    const callEpoch = turn.current.accept(event.response.id);
    if (callEpoch === null) return;
    const calls = event.response.output?.filter(item => item.type === "function_call") ?? [];
    if (!calls.length) return;
    for (const call of calls) {
      if (sessionGeneration !== generation.current || !turn.current.isCurrent(callEpoch) || !call.call_id) return;
      const controller = new AbortController();
      turn.current.track(controller);
      setState(call.name === "recommend_for" ? "preparing" : "checking");
      setCaptions(lines => [...lines, { who: "tool", text: "Проверяю…" }]);
      let output: Record<string, unknown>;
      try {
        const args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
        if (call.name === "recommend_for") {
          for (let attempt = 0; attempt < 30 && !transcript.current.peek() && !controller.signal.aborted; attempt++) await new Promise(resolve => setTimeout(resolve, 100));
          const utterance = transcript.current.take();
          if (!utterance) {
            output = { ok: false, code: "needs_clarification", message: "Не удалось надёжно распознать запрос. Повторите его или используйте текст." };
          } else {
            args.utterance = utterance;
            if (latestStateVersion.current !== undefined) args.expected_state_version = latestStateVersion.current;
            const response = await fetch(`/api/voice/tools/${encodeURIComponent(call.name)}`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ request_id: call.call_id, scope: scopeRef.current, args }), signal: controller.signal,
            });
            output = await response.json();
            if (!response.ok) output = { ...output, ok: false };
          }
        } else {
          const response = await fetch(`/api/voice/tools/${encodeURIComponent(call.name)}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ request_id: call.call_id, scope: scopeRef.current, args }), signal: controller.signal,
          });
          output = await response.json();
          if (!response.ok) output = { ...output, ok: false };
        }
      } catch {
        if (controller.signal.aborted) return;
        output = { ok: false, code: "tool_unavailable", message: "Не удалось проверить данные" };
      } finally {
        turn.current.done(controller);
      }
      if (controller.signal.aborted || sessionGeneration !== generation.current || !turn.current.isCurrent(callEpoch)) return;
      if (output.ok && typeof output.state_version === "number") {
        window.dispatchEvent(new CustomEvent("ainalym:voice-tool-result", { detail: { request_id: call.call_id, tool: call.name, result: output } }));
        void fetch("/api/state", { cache: "no-store" }).then(async response => {
          if (!response.ok) return;
          const snapshot = await response.json();
          if (typeof snapshot.state_version === "number") latestStateVersion.current = snapshot.state_version;
          window.dispatchEvent(new CustomEvent("ainalym:state-changed", { detail: snapshot }));
          router.refresh();
        }).catch(() => undefined);
      }
      if (call.name === "recommend_for" && output.ok) setState("waiting_review");
      else setState("listening");
      send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: call.call_id, output: JSON.stringify(output) } });
    }
    if (sessionGeneration === generation.current && turn.current.isCurrent(callEpoch)) send({ type: "response.create", response: { tool_choice: "none" } });
  }, [router, send]);

  const start = useCallback(async () => {
    if (starting.current || peer.current || !scopeRef.current.org_id) return;
    starting.current = true;
    const sessionGeneration = ++generation.current;
    setReason(undefined);
    setState("connecting");
    try {
      try {
        const stateResponse = await fetch("/api/state", { cache: "no-store" });
        if (stateResponse.ok) {
          const snapshot = await stateResponse.json();
          if (typeof snapshot.state_version === "number") latestStateVersion.current = snapshot.state_version;
        }
      } catch { /* voice can still answer if the state fingerprint is temporarily unavailable */ }
      const sessionResponse = await fetch("/api/voice/session", { method: "POST", cache: "no-store" });
      const session = await sessionResponse.json() as SessionResponse;
      if (!sessionResponse.ok || !session.client_secret || !session.expires_at || session.expires_at * 1000 <= Date.now()) throw new Error("Provider unavailable");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Provider unavailable");
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (sessionGeneration !== generation.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const connection = new RTCPeerConnection();
      peer.current = connection;
      const speaker = document.createElement("audio");
      speaker.autoplay = true;
      audio.current = speaker;
      connection.ontrack = e => {
        speaker.srcObject = e.streams[0];
        void speaker.play().catch(() => {
          if (sessionGeneration === generation.current) { release(); setReason("Provider unavailable"); setState("unavailable"); }
        });
      };
      connection.onconnectionstatechange = () => {
        if (sessionGeneration !== generation.current) return;
        if (connection.connectionState === "failed" || connection.connectionState === "disconnected") {
          release(); setReason("Provider unavailable"); setState("unavailable");
        }
      };
      media.getAudioTracks().forEach(track => connection.addTrack(track, media));
      const dataChannel = connection.createDataChannel("oai-events");
      channel.current = dataChannel;
      dataChannel.onopen = () => { if (sessionGeneration === generation.current) setState("listening"); };
      dataChannel.onclose = () => {
        if (sessionGeneration === generation.current && peer.current) { release(); setReason("Provider unavailable"); setState("unavailable"); }
      };
      dataChannel.onerror = () => {
        if (sessionGeneration === generation.current && peer.current) { release(); setReason("Provider unavailable"); setState("unavailable"); }
      };
      dataChannel.onmessage = e => { try { void handleEvent(JSON.parse(e.data) as RealtimeEvent, sessionGeneration); } catch { /* malformed transport event */ } };
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      const answerResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST", headers: { Authorization: `Bearer ${session.client_secret}`, "Content-Type": "application/sdp" }, body: offer.sdp,
      });
      if (!answerResponse.ok) throw new Error("Provider unavailable");
      const answer = await answerResponse.text();
      if (sessionGeneration !== generation.current) return;
      await connection.setRemoteDescription({ type: "answer", sdp: answer });
      starting.current = false;
    } catch {
      if (sessionGeneration !== generation.current) return;
      release();
      setReason("Provider unavailable");
      setState("unavailable");
    }
  }, [handleEvent, release]);

  useEffect(() => () => { generation.current++; release(); }, [release]);
  return { state, reason, start, stop, mute, interrupt, captions };
}
