"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/shell";
import styles from "@/components/purchase/workspace.module.css";

type Line = { code_1c: string; qty: number };
type Part = { eta: string; lines: Line[]; total_qty: number; total_cost: string | null; prepayment: string | null; balance: string | null };
export type SupplierReplyProposal = {
  id: string; kind: string; subject_id: string; version: number; state: string; rationale_ru: string;
  supplier_name: string; line_names: Record<string, string>;
  payload: { supplier_id: string; original_text: string; decision: { delay_days: number | null; affected_lines: string[] };
    parts: { now: Part; later: Part } | null; alternatives: { code_1c: string; available_supplier: string | null }[] };
};

function date(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(parsed) : "Срок уточняется";
}
function amount(value: string | null): string {
  return value === null ? "Сумма пока не определена" : `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))} ₸`;
}

export default function SupplierReplyReview({ proposal }: { proposal: SupplierReplyProposal }) {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(proposal.state);
  const [message, setMessage] = useState("");
  const [orders, setOrders] = useState<string[]>([]);
  const split = proposal.kind === "supplier_split";
  async function decide(choice: "approve" | "reject") {
    if (busy || state !== "needs_review") return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/proposals/${encodeURIComponent(proposal.id)}/${choice}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposal_version: proposal.version }),
      });
      if (!response.ok) {
        setMessage(response.status === 409 ? "Заказ изменился. Вернитесь к очереди и откройте актуальное предложение." : "Не удалось сохранить решение. Попробуйте ещё раз.");
        return;
      }
      const result = await response.json() as { split_po_ids?: string[] };
      setState(choice === "approve" ? "approved" : "rejected");
      setOrders(result.split_po_ids ?? []);
      setMessage(choice === "reject" ? "Предложение отклонено. Заказ оставлен без изменений." : split
        ? "Заказ разделён. Платежи по каждой части появились в разделе «Деньги». Ничего не отправлено поставщику."
        : "Срочность повышена, задача закупщику подготовлена. Ничего не отправлено поставщику.");
    } catch {
      setMessage("Связь прервалась. Проверьте состояние предложения в очереди.");
    } finally { setBusy(false); }
  }
  const parts = proposal.payload.parts;
  return <main className={styles.page}>
    <Link className={styles.linkButton} href="/review">К очереди решений</Link>
    <header className={styles.heading}>
      <h1>{split ? "Разделить поставку" : "Ускорить поставку"}</h1>
      <p className={styles.subtitle}>{proposal.supplier_name} · заказ {proposal.subject_id}</p>
    </header>
    <section className={styles.panel} aria-label="Ответ поставщика">
      <div className={styles.panelBody}><h2>Ответ поставщика</h2><p>{proposal.payload.original_text}</p><p>{proposal.rationale_ru}</p></div>
    </section>
    {split && parts ? <section className={styles.panel} aria-label="Части заказа">
      <div className={styles.panelBody}><h2>Предлагаемое разделение</h2>
        {([parts.now, parts.later] as Part[]).map((part, index) => <section key={index}>
          <h3>{index === 0 ? "Первая часть" : "Остаток"} · {date(part.eta)}</h3>
          <ul>{part.lines.map((line, lineIndex) => <li key={`${line.code_1c}-${lineIndex}`}>{proposal.line_names[line.code_1c] ?? "Позиция заказа"} — {line.qty} шт.</li>)}</ul>
          <p>Всего {part.total_qty} шт. · {amount(part.total_cost)}</p>
          <p>Предоплата 30 %: {amount(part.prepayment)}. Остаток 70 %: {amount(part.balance)}.</p>
        </section>)}
      </div>
    </section> : <section className={styles.panel} aria-label="Ускорение поставки">
      <div className={styles.panelBody}><h2>Предлагаемое действие</h2>
        <p>Задержка: {proposal.payload.decision.delay_days ?? "срок уточняется"} дн. После утверждения срочность повысится, а закупщик получит задачу проверить поставку.</p>
        <ul>{proposal.payload.decision.affected_lines.map(code => <li key={code}>{proposal.line_names[code] ?? "Позиция заказа"}</li>)}</ul>
      </div>
    </section>}
    <section className={styles.panel} aria-label="Решение менеджера"><div className={styles.panelBody}>
      <h2>Ваше решение</h2>
      <p>Изменения вступят в силу только после вашего утверждения. Поставщику ничего не отправляется.</p>
      {state === "needs_review" ? <div className={styles.actions}>
        <Button variant="primary" busy={busy} disabled={busy} onClick={() => decide("approve")}>{split ? "Утвердить разделение" : "Поручить ускорение"}</Button>
        <Button busy={busy} disabled={busy} onClick={() => decide("reject")}>Отклонить</Button>
      </div> : <p>{state === "approved" ? "Решение утверждено." : "Предложение отклонено."}</p>}
      <p role="status">{message}</p>
      {orders.length > 0 && <div className={styles.actions}>{orders.map((id, index) => <Link className={styles.linkButton} key={id} href={`/orders/${encodeURIComponent(id)}`}>Открыть {index === 0 ? "первую часть" : "остаток"}</Link>)}<Link className={styles.linkButton} href="/money">Показать платежи</Link></div>}
    </div></section>
  </main>;
}
