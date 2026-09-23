import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { migrate } from "../../src/db/client";
import { proposeParamChange, paramsForSupplier } from "../../src/domain/params";
import { decideProposal } from "../../src/domain/apply";

function fixture() {
  const database = new DatabaseSync(":memory:");
  migrate(database);
  database.prepare("INSERT INTO supplier (id,name,lead_time_days,review_days,terms) VALUES ('SE','SE',50,30,'{\"prepayment_pct\":30}')").run();
  return database;
}

describe("policy proposals", () => {
  it("keeps a parameter edit in review until the exact proposal is approved", async () => {
    const database = fixture();
    const proposed = await proposeParamChange("SE", { lead_time_days: 60, growth_cap: 0.3 }, { database });
    expect(paramsForSupplier("SE", database).lead_time_days).toBe(50);
    const result = await decideProposal(proposed.id, 1, "approve", [], { database });
    expect(result.recompute_run_id).toMatch(/^RUN-/);
    expect(paramsForSupplier("SE", database)).toEqual(expect.objectContaining({ lead_time_days: 60, growth_cap: 0.3 }));
    expect(database.prepare("SELECT state FROM proposal WHERE id=?").get(proposed.id)).toEqual({ state: "approved" });
  });

  it("rejects a policy proposal if the supplier changed since it was prepared", async () => {
    const database = fixture();
    const proposal = await proposeParamChange("SE", { review_days: 20 }, { database });
    database.prepare("UPDATE supplier SET version=version+1 WHERE id='SE'").run();
    await expect(decideProposal(proposal.id, 1, "approve", [], { database })).rejects.toMatchObject({ status: 409 });
    expect(paramsForSupplier("SE", database).review_days).toBe(30);
  });
});
