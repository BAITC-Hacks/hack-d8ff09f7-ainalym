import type { Metadata } from "next";
import { MoneyPage } from "./MoneyPage";

export const metadata: Metadata = { title: "Деньги" };
export default function Page() { return <MoneyPage />; }
