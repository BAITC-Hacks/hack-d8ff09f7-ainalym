import type { Metadata } from "next";
import { AssistantSurface } from "@/components/assistant/AssistantSurface";
import "./assistant-page.css";

export const metadata: Metadata = { title: "ИИ-ассистент" };
/** Full-width conversation surface (the side dock stays on every other page). Context travels in `?ctx=` when opened from the dock; `base` is detected from the URL (/v2 today, / after the move). */
export default function Page() { return <AssistantSurface />; }
