import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { ChoiceQuestion } from "./provider";

const Question = z.object({
  id: z.string().min(1), type: z.literal("choice"), instructions: z.string().min(1),
  criteria: z.record(z.string(), z.string().min(1)).refine(value => Object.keys(value).length >= 2),
  required_input_context: z.array(z.string()).default([]),
  permitted_consumers: z.array(z.string()).min(1), authority: z.literal("proposal_only"),
});
const Catalog = z.object({ rubric_version: z.string().min(1), questions: z.array(Question).min(1) });
export type CatalogQuestion = z.infer<typeof Question> & ChoiceQuestion;
let cached: z.infer<typeof Catalog> | null = null;

export function loadCatalog(): z.infer<typeof Catalog> {
  if (cached) return cached;
  const parsed = Catalog.parse(JSON.parse(readFileSync(join(process.cwd(), "fixtures", "decision_catalog.json"), "utf8")));
  if (new Set(parsed.questions.map(q => q.id)).size !== parsed.questions.length) throw new Error("Duplicate decision question");
  cached = parsed;
  return parsed;
}

export function catalogQuestion(id: string): ChoiceQuestion | null {
  const catalog = loadCatalog();
  const question = catalog.questions.find(q => q.id === id);
  return question ? { ...question, rubric_version: catalog.rubric_version } : null;
}
