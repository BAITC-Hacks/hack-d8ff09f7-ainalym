"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleAlert, CircleCheck } from "lucide-react";
import { Button, Pill, TruthStrip, fmtInt } from "@/components/v2/primitives";
import styles from "./review.module.css";

type Line = { code_1c: string; qty: number };
type Part = { eta: string; lines: Line[]; total_qty: number; total_cost: string | null; prepayment: string | null; balance: string | null };
export type SupplierReplyProposal = {
  id: string; kind: string; subject_id: string; version: number; state: string; rationale_ru: string;
  supplier_name: string; line_names: Record<string, string>;
  payload: { supplier_id: string; original_text: string; decision: { delay_days: number | null; affected_lines: string[] };
    parts: { now: Part; later: Part } | null; alternatives: { code_1c: string; available_supplier: string | null }[] };
};

const STATE_RU: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "neutral" }> = { needs_review: { label: "ждёт решения", tone: "warn" }, approved: { label: "утверждён", tone: "ok" }, rejected: { label: "отклонён", tone: "neutral" }, stale: { label: "устарел", tone: "danger" } };
function date(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(parsed) : "Срок уточняется";
}
function amount(value: string | null): string {
  return value === null ? "Сумма пока не определена" : `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Number(value))} ₸`;
}

export default function SupplierReplyReview({ proposal }: { proposal: SupplierReplyProposal }) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [state, setState] = useState(proposal.state);
  const [message, setMessage] = useState<{ tone: "ok" | "stale" | "error"; text: string } | null>(null);
  const [orders, setOrders] = useState<string[]>([]);
  const split = proposal.kind === "supplier_split";
  const affected = proposal.payload.decision.affected_lines.length;
  async function decide(choice: "approve" | "reject") {
    if (busy || state !== "needs_review") return;
    setBusy(choice);
    setMessage(null);
    try {
      const response = await fetch(`/api/proposals/${encodeURIComponent(proposal.id)}/${choice}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposal_version: proposal.version }),
      });
      if (!response.ok) {
        setMessage(response.status === 409 ? { tone: "stale", text: "Данные обновились — обновите страницу, чтобы увидеть актуальное предложение." } : { tone: "error", text: "Не удалось сохранить решение. Попробуйте ещё раз." });
        return;
      }
      const result = await response.json() as { split_po_ids?: string[] };
      setState(choice === "approve" ? "approved" : "rejected");
      setOrders(result.split_po_ids ?? []);
      setMessage({ tone: "ok", text: choice === "reject" ? "Предложение отклонено. Заказ оставлен без изменений." : split
        ? "Заказ разделён. Платежи по каждой части появились в разделе «Деньги». Ничего не отправлено поставщику."
        : "Срочность повышена, задача закупщику подготовлена. Ничего не отправлено поставщику." });
    } catch {
      setMessage({ tone: "error", text: "Связь прервалась. Проверьте состояние предложения в списке решений." });
    } finally { setBusy(null); }
  }
  const parts = proposal.payload.parts;
  const st = STATE_RU[state] ?? { label: state, tone: "neutral" as const };
  return <div className={styles.page} data-proposal-id={proposal.id} data-order-id={proposal.subject_id}>
    <Link className={styles.back} href="/today"><ArrowLeft size={14} aria-hidden="true" />Сегодня</Link>
    <div className={styles.head}>
      <div className={styles.headText}>
        <h1 className={styles.display}>{split ? "Разделить поставку" : "Ускорить поставку"}</h1>
        <div className={styles.headMeta}><Pill tone={st.tone}>{st.label}</Pill><span><strong>{proposal.supplier_name}</strong></span>{affected > 0 && <span>· {fmtInt(affected)} {affected === 1 ? "позиция" : affected < 5 ? "позиции" : "позиций"} затронуто</span>}</div>
      </div>
    </div>
    {proposal.rationale_ru && <p className={styles.lead}>{proposal.rationale_ru}</p>}

    <div className={styles.columns}>
      <div>
        <section className={styles.card} aria-labelledby="reply-h">
          <h2 id="reply-h">Ответ поставщика</h2>
          <p>{proposal.payload.original_text}</p>
        </section>
        {split && parts ? <section className={`${styles.card} ${styles.section}`} aria-labelledby="parts-h">
          <h2 id="parts-h">Предлагаемое разделение</h2>
          <div className={styles.parts}>
            {([parts.now, parts.later] as Part[]).map((part, index) => <div key={index} className={styles.part}>
              <h3>{index === 0 ? "Первая часть" : "Остаток"} · {date(part.eta)}</h3>
              <ul>{part.lines.map((line, lineIndex) => <li key={`${line.code_1c}-${lineIndex}`}>{proposal.line_names[line.code_1c] ?? "Позиция заказа"} — {fmtInt(line.qty)} шт</li>)}</ul>
              <p className={styles.note}>Всего {fmtInt(part.total_qty)} шт · {amount(part.total_cost)}</p>
              <p className={styles.note}>Предоплата 30 %: {amount(part.prepayment)} · остаток 70 %: {amount(part.balance)}</p>
            </div>)}
          </div>
        </section> : <section className={`${styles.card} ${styles.section}`} aria-labelledby="act-h">
          <h2 id="act-h">Предлагаемое действие</h2>
          <p>Задержка: {proposal.payload.decision.delay_days ?? "срок уточняется"} дн. После утверждения срочность повысится, а закупщик получит задачу проверить поставку.</p>
          <ul>{proposal.payload.decision.affected_lines.map(code => <li key={code}>{proposal.line_names[code] ?? "Позиция заказа"}</li>)}</ul>
        </section>}
      </div>
      <section className={`${styles.card} ${styles.decision}`} aria-labelledby="dec-h">
        <h2 id="dec-h">Ваше решение</h2>
        <p>Изменения вступят в силу только после вашего утверждения. Поставщику ничего не отправляется.</p>
        {message && <div className={`${styles.alert} ${message.tone === "ok" ? styles.alertOk : message.tone === "stale" ? styles.alertStale : styles.alertError}`} role={message.tone === "ok" ? "status" : "alert"}>{message.tone === "ok" ? <CircleCheck size={15} aria-hidden="true" /> : <CircleAlert size={15} aria-hidden="true" />}{message.text}{message.tone === "stale" && <button type="button" className={styles.linkBtn} onClick={() => location.reload()}>Обновить</button>}</div>}
        {state === "needs_review" ? <div className={styles.actions}>
          <Button variant="primary" busy={busy === "approve"} disabled={busy !== null} onClick={() => decide("approve")}>{split ? "Утвердить разделение" : "Поручить ускорение"}</Button>
          <Button busy={busy === "reject"} disabled={busy !== null} onClick={() => decide("reject")}>Отклонить</Button>
        </div> : <p className={styles.note}>{state === "approved" ? "Решение утверждено." : "Предложение отклонено."}</p>}
        {(orders.length > 0 || state === "approved") && <div className={styles.receiptLinks}>{orders.map((id, index) => <Link className={styles.receiptLink} key={id} href={`/orders/${encodeURIComponent(id)}`}>Открыть {index === 0 ? "первую часть" : "остаток"}</Link>)}<Link className={styles.receiptLink} href="/money">Деньги</Link><Link className={styles.receiptLink} href="/orders">Заказы</Link></div>}
      </section>
    </div>
    <footer className={styles.foot}><TruthStrip /></footer>
  </div>;
}
