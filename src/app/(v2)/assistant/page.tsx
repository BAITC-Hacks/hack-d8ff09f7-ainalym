import type { Metadata } from "next";
import { AssistantSurface } from "@/components/assistant/AssistantSurface";
import "./assistant-page.css";

export const metadata: Metadata = { title: "Помощник" };
/** Full-width conversation surface (the side dock stays on every other page). Context travels in `?ctx=` when opened from the dock; the shell is served at /, so `base` is "". */
export default function Page() { return <AssistantSurface base="" />; }
