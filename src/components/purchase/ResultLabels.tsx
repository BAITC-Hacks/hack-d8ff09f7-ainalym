"use client";
import { TruthLabels } from "@/components/labels";
import { axesOf, type ResultAxes } from "./types";

export function ResultLabels({ result }: { result?: ResultAxes }) {
  // A current provider mode cannot establish how a saved result was produced.
  return <TruthLabels axes={axesOf(result)} />;
}
