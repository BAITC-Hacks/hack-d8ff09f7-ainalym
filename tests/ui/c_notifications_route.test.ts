import { afterEach, describe, expect, it } from "vitest";
import { db, resetInstance, stateVersion } from "@/db/client";
import { GET } from "@/app/api/notifications/route";
afterEach(() => { resetInstance(); });
describe("c_notifications read-only API", () => {
  it("returns only waiting decisions and failed events without advancing the state version", async () => {
    const d = db();
    d.prepare("INSERT INTO proposal(id,kind,state,created_at) VALUES(?,?,?,?)").run("PR-TEST", "supplier_order", "needs_review", "2026-09-23T08:00:00Z");
    d.prepare("INSERT INTO proposal(id,kind,state,created_at) VALUES(?,?,?,?)").run("PR-OLD", "supplier_order", "approved", "2026-09-23T07:00:00Z");
    d.prepare("INSERT INTO world_event(id,org_id,kind,source_id,state,at,run_id) VALUES(?,?,?,?,?,?,?)").run("WE-FAIL", "partner", "judge_message", "TEST-FAIL", "failed", "2026-09-23T09:00:00Z", "AR-TEST");
    const before = stateVersion(); const data = await (await GET()).json();
    expect(data.total).toBe(2);
    expect(data.items.map((item: { id: string }) => item.id)).toEqual(["WE-FAIL", "PR-TEST"]);
    expect(data.items[0].href).toBe("/world/runs/AR-TEST");
    expect(stateVersion()).toBe(before);
    expect(d.prepare("SELECT state FROM proposal WHERE id='PR-TEST'").get()?.state).toBe("needs_review");
  });
});
