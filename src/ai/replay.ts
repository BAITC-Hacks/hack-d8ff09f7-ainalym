import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { ChoiceQuestion, ChoiceResult } from "./provider";

const Recording = z.object({
  question_id: z.string(), subject_ref: z.string(), answer: z.string(),
  distribution: z.record(z.string(), z.number().min(0).max(1)), model_version: z.string(),
});
const Replay = z.object({ mode: z.literal("replay"), recordings: z.array(Recording) });

export function replayChoice(question: ChoiceQuestion, context: unknown): ChoiceResult {
  const subject = typeof context === "object" && context !== null && "_replay_subject_ref" in context
    ? String((context as { _replay_subject_ref: unknown })._replay_subject_ref) : "";
  const base = { answer: null, distribution: {}, provider: "offline", model_version: "replay-v1", result_state: "unsupported" as const, label: "Replay · recorded decision" };
  if (!subject) return base;
  const data = Replay.parse(JSON.parse(readFileSync(join(process.cwd(), "fixtures", "replay_decisions.json"), "utf8")));
  const recording = data.recordings.find(r => r.question_id === question.id && r.subject_ref === subject);
  if (!recording || !(recording.answer in question.criteria)) return base;
  const keys = Object.keys(question.criteria);
  if (!keys.every(k => typeof recording.distribution[k] === "number")) return base;
  return {
    answer: recording.answer, distribution: recording.distribution,
    provider: "offline", model_version: recording.model_version, result_state: "decided", label: "Replay · recorded decision",
  };
}
