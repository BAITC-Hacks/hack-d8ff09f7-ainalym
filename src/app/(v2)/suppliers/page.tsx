import type { Metadata } from "next";
import { Suppliers } from "@/components/v2/Suppliers";
export const metadata: Metadata = { title: "Поставщики" };
export default function Page() { return <Suppliers />; }
