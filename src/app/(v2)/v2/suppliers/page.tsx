import type { Metadata } from "next";
import { SuppliersView } from "./SuppliersView";
export const metadata: Metadata = { title: "Поставщики" };
export default function Page() { return <SuppliersView />; }
