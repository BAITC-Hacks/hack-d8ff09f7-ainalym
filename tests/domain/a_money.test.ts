import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Money } from "../../src/domain/money";

describe("KZT money", () => {
  it("preserves decimal cents through arithmetic and JSON", () => {
    expect(Money.of("0.10").add(Money.of("0.20")).toJSON()).toEqual({ amount: "0.30", currency: "KZT" });
    expect(Money.of("7.00").sub(Money.of("1.25")).mul("2").toJSON()).toEqual({ amount: "11.50", currency: "KZT" });
  });

  it("allocates every cent, assigning the remainder to earlier shares", () => {
    expect(Money.of("1.00").allocate(3).map((part) => part.toJSON().amount)).toEqual(["0.34", "0.33", "0.33"]);
    expect(Money.of("-1.00").allocate(3).map((part) => part.toJSON().amount)).toEqual(["-0.34", "-0.33", "-0.33"]);
  });

  it("rejects fractional cents and mixed currencies", () => {
    expect(() => Money.of("0.001")).toThrow();
    expect(() => Money.of("1.00").add(Money.of("1.00", "USD"))).toThrow();
  });
});

it("keeps floating point coercion out of domain source", () => {
  const root = join(process.cwd(), "src", "domain");
  for (const name of readdirSync(root).filter((file) => file.endsWith(".ts"))) {
    const source = readFileSync(join(root, name), "utf8");
    expect(source, name).not.toMatch(/parseFloat|Number\(|toFixed/);
  }
});
