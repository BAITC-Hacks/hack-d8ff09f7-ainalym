import type { Metadata } from "next";
import { AssistantDock } from "@/components/assistant/AssistantDock";
import "./assistant-page.css";

export const metadata: Metadata = { title: "Помощник" };
/** Page mode of the same conversation: opened as a small popup window («Открыть отдельно»). Context travels in `?ctx=`; `base` is detected from the URL (/v2 today, / after the move). */
export default function Page() { return <AssistantDock mode="page" base="" />; }
