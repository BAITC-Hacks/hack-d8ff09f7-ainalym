import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import XLSX from "xlsx";

const root = process.cwd();
const directory = join(root, "fixtures", "documents");
const book = XLSX.readFile(join(directory, "iek_invoice_demo.xlsx"));
const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, raw: false, defval: "" });
const lines = rows.slice(6, 16);
if (lines.length !== 10) throw new Error("Invoice fixture must have 10 lines");
const input = { title: String(rows[0][0]), rows: [String(rows[1][0]), String(rows[2][0]), String(rows[3][0]),
  "Код 1С       Наименование                              Кол-во   Цена       Сумма",
  ...lines.map(row => `${String(row[0]).padEnd(12)} ${String(row[2]).slice(0,39).padEnd(40)} ${String(row[3]).padStart(6)} ${String(row[5]).padStart(10)} ${String(row[6]).padStart(11)}`),
  `ИТОГО: ${rows[16][6]}` ] };
const extracted = { number: "IEK-DEMO-0923", date: "23.09.2026", supplier: "IEK", buyer: "ТОО «Электрокомплект»", currency: "KZT",
  lines: lines.map(row => ({ code_1c: String(row[0]), article: String(row[1]), name: String(row[2]), unit: String(row[4]),
    qty: String(row[3]), price: String(row[5]), amount: String(row[6]) })) };
const temporary = mkdtempSync(join(tmpdir(), "ainalym-invoice-photo-"));
try {
  const jsonPath = join(temporary, "input.json"), outputPath = join(temporary, "photo.png");
  writeFileSync(jsonPath, JSON.stringify(input));
  const render = spawnSync("swift", [join(root, "scripts", "fixtures", "render_invoice.swift"), jsonPath, outputPath], { cwd: root, encoding: "utf8", timeout: 120_000 });
  if (render.status !== 0) throw new Error(render.stderr || "Swift invoice render failed");
  const bytes = readFileSync(outputPath);
  const sha = createHash("sha256").update(bytes).digest("hex");
  const replayPath = join(directory, "replay.json"), replayTemp = `${replayPath}.tmp`;
  writeFileSync(replayTemp, `${JSON.stringify({ [sha]: extracted }, null, 2)}\n`);
  renameSync(replayTemp, replayPath);
  renameSync(outputPath, join(directory, "iek_invoice_demo_photo.png"));
  console.log(`photo_sha256=${sha} lines=${extracted.lines.length}`);
} finally { rmSync(temporary, { recursive: true, force: true }); }
