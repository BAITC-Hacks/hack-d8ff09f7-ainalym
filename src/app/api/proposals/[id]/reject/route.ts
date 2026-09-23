import { handleDecision } from "../../_decision";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleDecision(request, (await params).id, "reject");
}
