import type { Metadata } from "next";
import { ReplenishmentView } from "@/components/opus_a/Replenishment";
export const metadata: Metadata = { title: "Пополнение (вариант A)" };
export default async function Page({ searchParams }: { searchParams: Promise<{ supplier?: string; code?: string }> }) {
  const { supplier, code } = await searchParams;
  const id = supplier === "IEK" || supplier === "SE" ? supplier : undefined;
  return <ReplenishmentView key={`${id ?? "all"}:${code ?? ""}`} supplier={id} initialCode={code} />;
}
