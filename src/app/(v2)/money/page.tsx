import type { Metadata } from "next";
import { MoneyPage } from "./MoneyPage";
import { PageContext } from "@/components/assistant/PageContext";

export const metadata: Metadata = { title: "Деньги" };
export default function Page() { return <><PageContext value={{ route: "money" }} /><MoneyPage /></>; }
