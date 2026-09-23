import type { Metadata } from "next";
import { SkuCard } from "./SkuCard";

export const metadata: Metadata = { title: "Карточка позиции" };
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <SkuCard code={decodeURIComponent(code)} />;
}
