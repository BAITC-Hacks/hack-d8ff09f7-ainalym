import type { Metadata } from "next";
import { ReviewQueue } from "@/components/review/ReviewQueue";
export default function Page() { return <ReviewQueue />; }

export const metadata: Metadata = { title: "Проверка" };
