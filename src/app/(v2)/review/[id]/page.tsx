import { ProposalDesk } from "@/components/review/ProposalDesk";
import { db } from "@/db/client";
import SupplierReplyReview, { type SupplierReplyProposal } from "./SupplierReplyReview";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = db().prepare("SELECT id,kind,subject_id,version,state,rationale_ru,payload FROM proposal WHERE id=?").get(id) as
    Omit<SupplierReplyProposal, "payload" | "supplier_name" | "line_names"> & { payload: string } | undefined;
  if (row && (row.kind === "supplier_split" || row.kind === "supplier_expedite")) {
    const payload = JSON.parse(row.payload) as SupplierReplyProposal["payload"];
    const supplier = db().prepare("SELECT name FROM supplier WHERE id=?").get(payload.supplier_id) as { name: string } | undefined;
    const lineNames = Object.fromEntries((db().prepare("SELECT code_1c,name FROM sku WHERE code_1c IN (SELECT code_1c FROM purchase_order_line WHERE po_id=?)")
      .all(row.subject_id) as { code_1c: string; name: string }[]).map(line => [line.code_1c, line.name]));
    return <SupplierReplyReview key={id} proposal={{ ...row, payload, supplier_name: supplier?.name ?? "Поставщик", line_names: lineNames }} />;
  }
  return <ProposalDesk key={id} id={id} />;
}
