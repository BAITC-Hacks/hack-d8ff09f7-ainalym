import type { Metadata } from "next";
import { Replenishment } from "@/components/opus_b/Replenishment";

export const metadata: Metadata = { title: "Пополнение" };
export default function Page() { return <Replenishment />; }
