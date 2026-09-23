import { db, stateVersion } from "../../../../db/client";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const database = db();
  const row = database.prepare("SELECT * FROM proposal WHERE id=?").get(id) as Record<string, unknown> | undefined;
  if (!row) return Response.json({ ok: false, code: "not_found", message: "Proposal not found" }, { status: 404 });
  return Response.json({ ok: true, proposal: { ...row, payload: JSON.parse(row.payload as string), affects: JSON.parse(row.affects as string),
    sources: JSON.parse(row.sources as string), money_at_stake: row.money_at_stake ? JSON.parse(row.money_at_stake as string) : null }, state_version: stateVersion(database) });
}
