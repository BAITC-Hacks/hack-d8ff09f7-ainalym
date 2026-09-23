import { DatabaseSync } from "node:sqlite";
import { mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import Decimal from "decimal.js";
import XLSX from "xlsx";
import { databasePath } from "../../src/db/path.mjs";

const d = new DatabaseSync(databasePath());
const po = "PO-DEMO-IEK-DOCUMENTS";
const lines = d.prepare(`SELECT l.code_1c,l.qty,l.unit_cost,s.article,s.name,s.unit FROM purchase_order_line l
  JOIN sku s ON s.code_1c=l.code_1c WHERE l.po_id=? ORDER BY l.id`).all(po);
if (lines.length !== 10) throw new Error("Run npm run demo:reset before generating the invoice fixture");
const rows = [
  ["Счёт на оплату № IEK-DEMO-0923 от 23.09.2026"],
  ["Поставщик: IEK"], ["Покупатель: ТОО «Электрокомплект»"], ["Валюта: KZT"], [],
  ["Код 1с", "Артикул", "Наименование", "Кол-во", "Ед", "Цена", "Сумма"],
];
let total = new Decimal(0);
lines.forEach((line, index) => {
  const qty = index === 0 ? 60 : line.qty;
  const price = new Decimal(line.unit_cost).times(index === 1 ? "1.10" : "1");
  const amount = price.times(qty);
  total = total.plus(amount);
  rows.push([line.code_1c, line.article, line.name, qty, line.unit || "шт", price.toFixed(2), amount.toFixed(2)]);
});
rows.push(["", "", "Итого", "", "", "", total.toFixed(2)]);
const sheet = XLSX.utils.aoa_to_sheet(rows);
sheet["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 65 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 18 }];
const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, sheet, "Счёт");
const directory = join(process.cwd(), "fixtures", "documents");
mkdirSync(directory, { recursive: true });
const output = join(directory, "iek_invoice_demo.xlsx");
const temp = `${output}.tmp`;
XLSX.writeFile(book, temp, { bookType: "xlsx", compression: true });
renameSync(temp, output);
const verify = XLSX.readFile(output);
const actual = XLSX.utils.sheet_to_json(verify.Sheets[verify.SheetNames[0]], { header: 1, raw: false });
if (actual.length !== rows.length || actual[5][0] !== "Код 1с" || actual[6][0] !== lines[0].code_1c) throw new Error("Invoice fixture verification failed");
console.log(`fixture=${output} lines=${lines.length} total=${total.toFixed(2)}`);
d.close();
