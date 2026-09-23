import { afterEach, describe, expect, it } from "vitest";
import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { db, resetInstance } from "../../src/db/client";
import { packageForRoute, extractDeterministic, matchDocumentToOrder, draftsForPackage } from "../../src/domain/documents";
import { POST as accept } from "../../src/app/api/documents/[id]/accept/route";
import { POST as ingest } from "../../src/app/api/documents/route";
import { GET as getPackage } from "../../src/app/api/orders/[id]/package/route";
import { GET as getDocument } from "../../src/app/api/documents/[id]/route";

const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const fixture = () => extractDeterministic(readFileSync(join(process.cwd(), "fixtures/documents/iek_invoice_demo.xlsx")), mime);
afterEach(() => resetInstance());

describe("document intake", () => {
  it("enumerates required package items for all three supply routes", () => {
    expect(packageForRoute("domestic").map(x => x.key)).toEqual(["payment_invoice", "contract", "esf", "delivery_note", "warehouse_receipt"]);
    expect(packageForRoute("eaeu").map(x => x.key)).toContain("form_328_00");
    expect(packageForRoute("eaeu").map(x => x.key)).not.toContain("dt_draft");
    expect(packageForRoute("import").map(x => x.key)).toContain("dt_draft");
    for (const route of ["domestic", "eaeu", "import"] as const)
      expect(packageForRoute(route).every(x => x.required && x.title_ru && x.stage && x.source)).toBe(true);
  });

  it("reads the committed invoice and flags exactly the two seeded discrepancies", () => {
    const invoice = fixture();
    expect(invoice.number).toBe("IEK-DEMO-0923");
    expect(invoice.lines).toHaveLength(10);
    expect(invoice.lines[0].code_1c).toMatch(/^\d{9}_$/);
    expect(invoice.lines.reduce((sum, line) => sum + Number(line.amount), 0).toFixed(2)).toBe("354750.00");
    const poLines = invoice.lines.map((line, index) => ({ code_1c: line.code_1c!, article: line.article, name: line.name,
      qty: index === 0 ? 100 : 20, unit_cost: String(1000 + index * 125) }));
    const match = matchDocumentToOrder(invoice, poLines);
    expect(match.summary).toEqual({ matched: 10, discrepancies: 2, total_doc: "354750.00", total_po: "392500.00" });
    expect(match.lines.filter(x => x.status !== "ok").map(x => x.status)).toEqual(["qty_diff", "price_diff"]);
    expect(match.three_way).toBe(false);
    expect(matchDocumentToOrder(invoice, poLines, poLines.map(x => ({ code_1c: x.code_1c, qty: x.qty }))).three_way).toBe(true);
  });

  it("computes 12 percent VAT in the unsubmitted EAEU draft", () => {
    const invoice = fixture();
    const form = draftsForPackage("eaeu", { id: "PO-1", supplier_name: "IEK", buyer_name: "ТОО «Электрокомплект»", lines: [] }, invoice).form_328_00 as
      { label: string; lines: { value: string; vat_12_percent: string }[] };
    expect(form.label).toBe("Черновик подготовлен агентом — не отправлен");
    expect(form.lines[0].value).toBe("60000.00");
    expect(form.lines[0].vat_12_percent).toBe("7200.00");
  });

  it("marks import heading suggestions as incomplete and requiring declarant review", () => {
    const draft = draftsForPackage("import", { id: "PO-2", supplier_name: "IEK", lines: [] }, fixture()).dt_draft as
      { lines: { tn_ved_eaeu_suggestion: string | null; suggestion_level: string; needs_review: boolean }[] };
    expect(draft.lines[0].tn_ved_eaeu_suggestion).toBe("8536");
    expect(draft.lines[0].suggestion_level).toContain("4 знака");
    expect(draft.lines.every(x => x.needs_review)).toBe(true);
  });

  it("parses a semicolon CSV with Russian column names", () => {
    const csv = "Счёт на оплату № CSV-1\nКод 1с;Артикул;Наименование;Кол-во;Ед;Цена;Сумма\n123_;A-1;Автомат;2;шт;125,50;251,00";
    const parsed = extractDeterministic(Buffer.from(csv), "text/csv");
    expect(parsed.lines).toEqual([{ code_1c: "123_", article: "A-1", name: "Автомат", unit: "шт", qty: "2", price: "125.50", amount: "251.00" }]);
  });

  it("prefers exact catalog code over a duplicate product name", () => {
    const doc = { number: null, date: null, supplier: null, buyer: null, currency: null,
      lines: [{ code_1c: "B", article: null, name: "Одинаковый товар", unit: "шт", qty: "2", price: "10.00", amount: "20.00" }] };
    const result = matchDocumentToOrder(doc, [{ code_1c: "A_", name: "Одинаковый товар", qty: 1, unit_cost: "10.00" },
      { code_1c: "B_", name: "Одинаковый товар", qty: 2, unit_cost: "10.00" }]);
    expect(result.lines[0].code_1c).toBe("B_");
    expect(result.lines[0].status).toBe("ok");
  });

  it("ingests the fixture, infers its order, and reports the discrepancy in the route package", async () => {
    resetInstance(); process.env.DATABASE_PATH = ":memory:";
    const d = db(), invoice = fixture();
    d.prepare("INSERT INTO organization(id,name) VALUES ('partner','ТОО «Электрокомплект»')").run();
    d.prepare("INSERT INTO supplier(id,name,lead_time_days) VALUES ('IEK','IEK',40)").run();
    d.prepare("INSERT INTO purchase_order(id,supplier_id,state) VALUES ('PO-DOC','IEK','approved')").run();
    invoice.lines.forEach((line, index) => {
      d.prepare("INSERT INTO sku(code_1c,supplier_id,article,name,unit) VALUES (?,?,?,?,?)").run(line.code_1c!,"IEK",line.article,line.name,line.unit);
      d.prepare("INSERT INTO purchase_order_line(po_id,code_1c,qty,unit_cost) VALUES ('PO-DOC',?,?,?)")
        .run(line.code_1c!,index === 0 ? 100 : 20,String(1000 + index * 125));
    });
    const response = await ingest(new Request("http://localhost/api/documents", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ fixture: "iek_invoice_demo.xlsx" }) }));
    expect(response.status).toBe(201);
    const body = await response.json();
    let receiptPath: string | null = null, contractPath: string | null = null, photoPath: string | null = null;
    try {
      expect(body.document.po_id).toBe("PO-DOC");
      expect(body.document.match.summary.discrepancies).toBe(2);
      expect(body.document.state).toBe("discrepancy");
      const pkg = await getPackage(new Request("http://localhost/api/orders/PO-DOC/package"), { params: Promise.resolve({ id: "PO-DOC" }) });
      expect(pkg.status).toBe(200);
      const packageBody = await pkg.json();
      expect(packageBody.route).toBe("eaeu");
      expect(packageBody.items.find((x: { key: string }) => x.key === "invoice").status).toBe("discrepancy");
      expect(packageBody.items.find((x: { key: string }) => x.key === "form_328_00").status).toBe("draft");
      const replayed = await ingest(new Request("http://localhost/api/documents", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ fixture: "iek_invoice_demo_photo.png" }) }));
      expect(replayed.status).toBe(201);
      const photo = (await replayed.json()).document;
      photoPath = photo.stored_path;
      expect(photo.extraction_mode).toBe("replay");
      expect(photo.match.summary.discrepancies).toBe(2);
      const csv = ["Код 1с;Наименование;Кол-во", ...invoice.lines.map((line, index) =>
        `${line.code_1c};${line.name};${index === 2 ? 19 : line.qty}`)].join("\n");
      const form = new FormData();
      form.set("file", new File([csv], "receipt.csv", { type: "text/csv" }));
      form.set("po_id", "PO-DOC"); form.set("kind", "receipt");
      const received = await ingest(new Request("http://localhost/api/documents", { method: "POST", body: form }));
      expect(received.status).toBe(201);
      receiptPath = (await received.json()).document.stored_path;
      const updated = await getDocument(new Request(`http://localhost/api/documents/${body.document.id}`), { params: Promise.resolve({ id: body.document.id }) });
      const rematched = (await updated.json()).document.match;
      expect(rematched.three_way).toBe(true);
      expect(rematched.summary.discrepancies).toBe(3);
      expect(rematched.lines[2].qty_received).toBe("19");
      const contract = new FormData();
      contract.set("file", new File(["Демонстрационный договор"], "contract.txt", { type: "text/plain" }));
      contract.set("po_id", "PO-DOC"); contract.set("kind", "other"); contract.set("package_key", "contract");
      const uploaded = await ingest(new Request("http://localhost/api/documents", { method: "POST", body: contract }));
      expect(uploaded.status).toBe(201);
      contractPath = (await uploaded.json()).document.stored_path;
      const updatedPackage = await getPackage(new Request("http://localhost/api/orders/PO-DOC/package"), { params: Promise.resolve({ id: "PO-DOC" }) });
      expect((await updatedPackage.json()).items.find((x: { key: string }) => x.key === "contract").status).toBe("present");
    } finally {
      unlinkSync(join(process.cwd(), body.document.stored_path));
      if (receiptPath) unlinkSync(join(process.cwd(), receiptPath));
      if (contractPath) unlinkSync(join(process.cwd(), contractPath));
      if (photoPath) unlinkSync(join(process.cwd(), photoPath));
    }
  });

  it("rejects acceptance with a stale document version", async () => {
    resetInstance();
    process.env.DATABASE_PATH = ":memory:";
    db().prepare("INSERT INTO document(id,kind,source,created_at,version) VALUES ('DOC-TEST','invoice','fixture','2026-09-23T00:00:00Z',2)").run();
    const response = await accept(new Request("http://localhost/api/documents/DOC-TEST/accept", { method: "POST", body: JSON.stringify({ version: 1 }) }),
      { params: Promise.resolve({ id: "DOC-TEST" }) });
    expect(response.status).toBe(409);
    expect((await response.json()).current_version).toBe(2);
  });
});
