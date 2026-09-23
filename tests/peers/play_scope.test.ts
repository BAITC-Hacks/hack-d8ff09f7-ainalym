import { afterEach, beforeEach, expect, it } from "vitest";
import { db, resetInstance } from "../../src/db/client";
import { play } from "../../src/world/play";

beforeEach(() => {
  process.env.DATABASE_PATH = ":memory:";
  resetInstance();
  const d = db();
  d.prepare("INSERT INTO organization (id,name) VALUES (?,?)").run("ORG-A", "A");
  d.prepare("INSERT INTO organization (id,name) VALUES (?,?)").run("ORG-B", "B");
  d.prepare("INSERT INTO world_event (id,org_id,seq,kind,source_id,state) VALUES (?,?,?,?,?,?)")
    .run("WE-A", "ORG-A", 2, "supplier_reply", "A", "scripted");
  d.prepare("INSERT INTO world_event (id,org_id,seq,kind,source_id,state) VALUES (?,?,?,?,?,?)")
    .run("WE-B", "ORG-B", 1, "supplier_reply", "B", "pending");
});
afterEach(() => resetInstance());

it("processes and returns only the caller organization's events", async () => {
  const result = await play({ org_id: "ORG-A", steps: 1 });
  expect(result.emitted.map((event) => event.id)).toEqual(["WE-A"]);
  expect(result.processed).toBe(1);
  expect(result.runs).toHaveLength(1);
  expect(db().prepare("SELECT state FROM world_event WHERE id='WE-A'").get()).toMatchObject({ state: "processed" });
  expect(db().prepare("SELECT state,run_id FROM world_event WHERE id='WE-B'").get()).toMatchObject({ state: "pending", run_id: null });
  expect(db().prepare("SELECT COUNT(*) AS n FROM world_event WHERE org_id='ORG-B' AND state='processed'").get()).toMatchObject({ n: 0 });
});
