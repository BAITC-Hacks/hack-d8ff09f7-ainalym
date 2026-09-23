import { ProposalDesk } from "@/components/review/ProposalDesk";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProposalDesk key={id} id={id} />;
}
