import type { Metadata } from "next";
import { SkuCard } from "@/components/opus_a/SkuCard";
export const metadata: Metadata = { title: "Карточка артикула (вариант A)" };
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const decoded = decodeURIComponent(code);
  return <SkuCard key={decoded} code={decoded} />;
}
