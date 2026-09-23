import { describe, it } from "vitest";

describe("live voice gates", () => {
  it("Russian microphone round-trip through Realtime, what_changed, persisted ledger, and UI state", (ctx) => {
    ctx.skip("UNVERIFIED: requires a real microphone utterance and recorded provider/UI trace");
  });
  it("browser stop() after recommend_for keeps the review task visible in the UI", (ctx) => {
    ctx.skip("UNVERIFIED: requires a real microphone session and browser task observation");
  });
});
