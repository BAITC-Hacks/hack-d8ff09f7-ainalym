import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bumpStateVersion, withTx } from "../db/client";
import { activeOrg } from "./feed";
import { play } from "./play";

/** Seeds the scripted demo inbox from fixtures/world_events.jsonl when the org has no events, then plays the first steps. */
export async function playDemo(input: { steps?: number; org_id?: string } = {}) {
  const orgId = activeOrg(input.org_id);
  const seeded = withTx((d) => {
    const existing = (d.prepare("SELECT COUNT(*) AS n FROM world_event WHERE org_id = ?").get(orgId) as { n: number }).n;
    if (existing > 0) return 0;
    const path = join(process.cwd(), "fixtures", "world_events.jsonl");
    if (!existsSync(path)) return 0;
    const lines = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
    const insert = d.prepare("INSERT OR IGNORE INTO world_event (id,org_id,seq,kind,actor_id,code_1c,po_id,at,source_id,text,payload,state) VALUES (?,?,?,?,?,?,?,?,?,?,?,'scripted')");
    let count = 0;
    lines.forEach((line, index) => {
      const event = JSON.parse(line) as Record<string, unknown>;
      const r = insert.run(String(event.id ?? `WE-SCRIPT-${index + 1}`), orgId, Number(event.seq ?? index + 1), String(event.kind), (event.actor_id as string | null) ?? null,
        (event.code_1c as string | null) ?? null, (event.po_id as string | null) ?? null, (event.at as string | null) ?? null, String(event.source_id ?? `SCRIPT-${index + 1}`),
        (event.text as string | null) ?? null, JSON.stringify(event.payload ?? {}));
      count += Number(r.changes);
    });
    if (count) bumpStateVersion(d);
    return count;
  });
  const played = await play({ steps: input.steps ?? 3, org_id: orgId });
  return { seeded, ...played };
}
