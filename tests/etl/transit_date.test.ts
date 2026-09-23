import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { read as readXlsx, utils } from "xlsx";
import { transitDueDate } from "../../scripts/etl/transit-date.mjs";

describe("IEK transit header dates", () => {
  it("parses the dated columns from the partner workbook", () => {
    const dir = resolve("fixtures/partner/IEK");
    const name = readdirSync(dir).find(file => file.startsWith("Путь ИЭК"));
    expect(name).toBeDefined();
    const workbook = readXlsx(readFileSync(resolve(dir, name!)), { type: "buffer" });
    const header = utils.sheet_to_json<string[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" })[0];
    expect(header.slice(3).map(transitDueDate)).toEqual([
      "2026-10-10", "2026-10-15", "2026-10-01", "2026-09-30", "2026-09-30", "2026-09-30",
    ]);
  });
});
