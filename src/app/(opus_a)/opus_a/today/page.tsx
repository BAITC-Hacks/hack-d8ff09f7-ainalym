import type { Metadata } from "next";
import { TodayView } from "@/components/opus_a/Today";
export const metadata: Metadata = { title: "Сегодня (вариант A)" };
export default function Page() { return <TodayView />; }
