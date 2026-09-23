import type { Metadata } from "next";
import { readApi } from "@/components/shell/server";
import type { MoneyView } from "@/components/pulse/types";
import { MoneyPage } from "./MoneyPage";
export const metadata: Metadata = { title: "Деньги" };
export default async function Page() { const initial = await readApi<MoneyView>("/api/money"); return <MoneyPage initial={initial} />; }
