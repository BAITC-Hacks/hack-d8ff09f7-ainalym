import type { Metadata } from "next";
import { SkuCard } from "@/components/opus_a/SkuCard";
export const metadata: Metadata = { title: "Карточка SKU (вариант A)" };
export default async function Page({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ from?: string }> }) {
  const { code } = await params;
  const { from } = await searchParams;
  const decoded = decodeURIComponent(code);
  return <SkuCard key={decoded} code={decoded} from={from} />;
}
