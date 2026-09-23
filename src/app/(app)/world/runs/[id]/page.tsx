import { WorldRun } from "@/components/world-console/WorldRun";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorldRun key={id} id={id} />;
}
