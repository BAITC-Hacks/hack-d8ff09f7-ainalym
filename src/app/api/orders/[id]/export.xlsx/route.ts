import { exportResponse } from "../_export";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return exportResponse(id, "xlsx");
}
