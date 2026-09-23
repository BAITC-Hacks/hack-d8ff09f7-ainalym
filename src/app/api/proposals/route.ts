import { db, stateVersion } from "../../../db/client";

function hydrate(row: Record<string, unknown>) {
  return { ...row, payload: JSON.parse(row.payload as string), affects: JSON.parse(row.affects as string),
    sources: JSON.parse(row.sources as string), money_at_stake: row.money_at_stake ? JSON.parse(row.money_at_stake as string) : null };
}

export async function GET(request: Request) {
  const database = db();
  const state = new URL(request.url).searchParams.get("state");
  const rows = state
    ? database.prepare("SELECT * FROM proposal WHERE state=? ORDER BY created_at DESC").all(state)
    : database.prepare("SELECT * FROM proposal ORDER BY created_at DESC").all();
  return Response.json({ ok: true, proposals: rows.map((row) => hydrate(row as Record<string, unknown>)), state_version: stateVersion(database) });
}
