import { SkuCard } from "@/components/opus_b/SkuCard";

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <SkuCard key={code} code={decodeURIComponent(code)} />;
}
