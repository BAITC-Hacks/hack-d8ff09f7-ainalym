import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, resetInstance } from "../../src/db/client";
import { composeEvent } from "../../src/world/compose";
import { feed } from "../../src/world/feed";
import { play } from "../../src/world/play";

beforeEach(() => {
  process.env.DATABASE_PATH = ":memory:";
  resetInstance();
  db().prepare("INSERT INTO organization (id, name) VALUES (?, ?)").run("ORG-TEST", "Test partner");
});
afterEach(() => resetInstance());

describe("world feed", () => {
  it("plays scripted rows in sequence through the worker seam", async () => {
    const d = db();
    for (const [id, seq] of [["WE-2", 2], ["WE-1", 1]] as const) {
      d.prepare("INSERT INTO world_event (id,org_id,seq,kind,source_id,text,state) VALUES (?,?,?,?,?,?,?)")
        .run(id, "ORG-TEST", seq, "sales_day", id, id, "scripted");
    }
    const result = await play({ steps: 1 });
    expect(result.emitted.map((row) => row.id)).toEqual(["WE-1"]);
    expect(result.emitted[0].emitted_at).toBeTruthy();
    expect(result.emitted[0].state).toBe("pending");
    expect(result.processed).toBe(0); // L3's current worker stub returns noop.
    expect(feed({}).rows.map((row) => row.state)).toEqual(["pending", "scripted"]);
  });

  it("composes verbatim, deduplicates, and labels a synthetic event", async () => {
    const input = { kind: "judge_message" as const, actor_id: "judge", code_1c: "030200874_", text: "Разовый заказ 500 шт" };
    const first = await composeEvent(input);
    const second = await composeEvent(input);
    expect(first.event.text).toBe(input.text);
    expect(first.event.label).toBe("Симулятор мира — синтетическое событие");
    expect(second.replayed).toBe(true);
    expect(second.event.id).toBe(first.event.id);
    expect(db().prepare("SELECT COUNT(*) AS n FROM world_event").get()).toMatchObject({ n: 1 });
  });

  it("does not disclose a foreign organization's rows", () => {
    db().prepare("INSERT INTO organization (id,name) VALUES (?,?)").run("ORG-OTHER", "Other");
    db().prepare("INSERT INTO world_event (id,org_id,kind,source_id,state) VALUES (?,?,?,?,?)")
      .run("WE-OTHER", "ORG-OTHER", "judge_message", "other", "pending");
    expect(feed({}).rows).toEqual([]);
    expect(() => feed({ org_id: "ORG-OTHER" })).toThrow("unknown_org");
  });
});
