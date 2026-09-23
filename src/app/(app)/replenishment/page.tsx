import { Replenishment } from "@/components/purchase/Replenishment";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ run_id?: string }>;
}) {
  const { run_id } = await searchParams;
  return <Replenishment key={run_id ?? "latest"} runId={run_id} />;
}
