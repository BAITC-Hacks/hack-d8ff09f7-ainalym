import type { ChoiceQuestion, ChoiceResult } from "./provider";

// Populated with the case replay catalog at the next checkpoint.
export function replayChoice(_question: ChoiceQuestion, _context: unknown): ChoiceResult {
  return { answer: null, distribution: {}, provider: "offline", model_version: "replay-v1", result_state: "unsupported", label: "Replay · recorded decision" };
}
