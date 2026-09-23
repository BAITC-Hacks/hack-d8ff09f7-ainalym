"use client";
import { TruthLabels } from "@/components/labels";
import { useApi, type ModesResponse } from "@/components/shell";
import { axesOf, type ResultAxes } from "./types";

export function ResultLabels({ result }: { result?: ResultAxes }) {
  const { data: modes } = useApi<ModesResponse>("/api/modes");
  const own = axesOf(result);
  const global = axesOf(modes);
  return <TruthLabels axes={{ provenance: own.provenance ?? global.provenance, ai: own.ai ?? global.ai, external: own.external ?? global.external }} />;
}
