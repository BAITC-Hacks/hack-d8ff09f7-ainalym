import type { Metadata } from "next";
import { SkuCard } from "./SkuCard";
import { PageContext } from "@/components/assistant/PageContext";

export const metadata: Metadata = { title: "Карточка позиции" };
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <><PageContext value={{ route: "sku", code_1c: decodeURIComponent(code) }} /><SkuCard code={decodeURIComponent(code)} /></>;
}
