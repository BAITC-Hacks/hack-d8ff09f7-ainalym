import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "../../src/db/client";
import { createTask, transitionTask } from "../../src/domain/tasks";
import { runScheduledChecks } from "../../src/domain/schedule";

const fixture = () => { const database = new DatabaseSync(":memory:"); migrate(database); return database; };

describe("task state and scheduled checks", () => {
  it("allows a valid versioned transition and reports affected rows", async () => {
    const database = fixture();
    const task = await createTask({ title: "Проверить", proposal_id: "PR-X" }, { database });
    const changed = await transitionTask(task.id, "needs_review", 1, { database });
    expect(changed).toEqual(expect.objectContaining({ state: "needs_review", version: 2, affected: { tasks: [task.id], proposals: ["PR-X"] } }));
  });

  it("rejects a stale task version and an invalid transition", async () => {
    const database = fixture();
    const task = await createTask({ title: "Проверить" }, { database });
    await expect(transitionTask(task.id, "needs_review", 2, { database })).rejects.toMatchObject({ status: 409 });
    await expect(transitionTask(task.id, "handed_over", 1, { database })).rejects.toThrow(/invalid task transition/);
  });

  it("creates one follow-up proposal for an overdue supplier task version", async () => {
    const database = fixture();
    const task = await createTask({ title: "Ответ IEK", state: "awaiting_supplier", next_event_at: "2025-01-01T00:00:00Z" }, { database });
    const first = await runScheduledChecks("2025-01-02T00:00:00Z", { database });
    const again = await runScheduledChecks("2025-01-02T00:00:00Z", { database });
    expect(first.proposals).toHaveLength(1);
    expect(again.processed).toBe(0);
    const proposal = database.prepare("SELECT kind,payload,state FROM proposal WHERE id=?").get(first.proposals[0]) as { kind: string; payload: string; state: string };
    expect(proposal.kind).toBe("clarification");
    expect(proposal.state).toBe("needs_review");
    expect(JSON.parse(proposal.payload)).toEqual(expect.objectContaining({ task_id: task.id, task_version: 1 }));
  });

  it("does not write on a quiet tick", async () => {
    const database = fixture();
    const version = database.prepare("SELECT n FROM state_version").get();
    const result = await runScheduledChecks("2025-01-02T00:00:00Z", { database });
    expect(result).toEqual({ runs: [], processed: 0, proposals: [], affected: [] });
    expect(database.prepare("SELECT n FROM state_version").get()).toEqual(version);
  });
});
