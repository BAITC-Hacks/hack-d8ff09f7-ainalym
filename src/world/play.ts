import { tick } from "../ai/worker";
import { bumpStateVersion, db, stateVersion, withTx } from "../db/client";
import { activeOrg, getWorldEvent, WorldError, type WorldRow } from "./feed";

export async function play(input: { steps?: number; until?: number; org_id?: string } = {}) {
  const orgId = activeOrg(input.org_id);
  const steps = input.steps ?? 1;
  if (!Number.isSafeInteger(steps) || steps < 1 || steps > 100 ||
      (input.until !== undefined && (!Number.isSafeInteger(input.until) || input.until < 0))) {
    throw new WorldError("invalid_play_range", 400);
  }
  const ids = withTx((d) => {
    const rows = (input.until === undefined
      ? d.prepare("SELECT id FROM world_event WHERE org_id = ? AND state = 'scripted' ORDER BY seq, id LIMIT ?").all(orgId, steps)
      : d.prepare("SELECT id FROM world_event WHERE org_id = ? AND state = 'scripted' AND seq <= ? ORDER BY seq, id").all(orgId, input.until)) as { id: string }[];
    const now = new Date().toISOString();
    for (const row of rows) d.prepare("UPDATE world_event SET state = 'pending', emitted_at = ? WHERE id = ? AND org_id = ? AND state = 'scripted'").run(now, row.id, orgId);
    if (rows.length) bumpStateVersion(d);
    return rows.map((r) => r.id);
  });
  const result = ids.length ? await tick() : { runs: [], processed: 0 };
  const emitted = ids.map((id) => getWorldEvent(id, orgId)).filter((row): row is WorldRow => row !== null);
  return { emitted, runs: result.runs, processed: result.processed, state_version: stateVersion() };
}
