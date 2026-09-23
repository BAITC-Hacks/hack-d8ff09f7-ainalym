import { SkuWorkspace } from "@/components/purchase/SkuWorkspace";
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <SkuWorkspace key={code} code={code} />;
}
