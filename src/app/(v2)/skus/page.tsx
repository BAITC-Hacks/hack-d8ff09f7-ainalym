import type { Metadata } from "next";
import { SkuIndex } from "@/components/v2/SkuIndex";
export const metadata: Metadata = { title: "Товары" };
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <SkuIndex key={q ?? ""} initialQuery={q ?? ""} />;
}
