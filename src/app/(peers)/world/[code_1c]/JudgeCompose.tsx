"use client";

import { useState } from "react";
import { WorldLabel } from "@/components/labels";
import styles from "../../peerPages.module.css";

type Kind = "judge_message" | "in_transit_update" | "price_update";
const kinds: { kind: Kind; label: string }[] = [
  { kind: "judge_message", label: "Разовый заказ" },
  { kind: "in_transit_update", label: "Товар в пути" },
  { kind: "price_update", label: "Новая цена" },
];
function preset(kind: Kind, threshold: number) {
  if (kind === "judge_message") return String(Math.max(5000, Math.ceil(threshold * 1.1)));
  return kind === "in_transit_update" ? "100" : "1200";
}
function eventText(kind: Kind, code: string, number: string) {
  if (!number) return "";
  if (kind === "judge_message") return `Разовый заказ ${number} шт по коду ${code}`;
  if (kind === "in_transit_update") return `Товар в пути +${number} шт по коду ${code}`;
  return `Цена по коду ${code} = ${number} KZT`;
}

export default function JudgeCompose({ code, threshold }: { code: string; threshold: number }) {
  const [kind, setKind] = useState<Kind>("judge_message");
  const [number, setNumber] = useState(preset("judge_message", threshold));
  const text = eventText(kind, code, number);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ id: string; state: string; replayed: boolean } | null>(null);
  function choose(next: Kind) { setKind(next); setNumber(preset(next, threshold)); setResult(null); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setResult(null);
    const qty = Number(number);
    const now = new Date();
    const priorMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 22, 12)).toISOString();
    const payload = kind === "judge_message"
      ? { code_1c: code, qty, document_qty: qty, threshold, doc_type: "Расходная накладная", at: priorMonth }
      : kind === "in_transit_update"
        ? { code_1c: code, delta: qty }
        : { code_1c: code, unit_cost: number, currency: "KZT" };
    try {
      const response = await fetch("/api/world/compose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, actor_id: "judge", code_1c: code, text, payload }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Событие не добавлено");
      setResult({ id: body.event.id, state: body.event.state, replayed: body.replayed });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ошибка события"); }
    finally { setBusy(false); }
  }
  return <>
    <div className={styles.choiceRow} role="group" aria-label="Тип события">{kinds.map((item) => <button key={item.kind} type="button" className={styles.choice} aria-pressed={kind === item.kind} onClick={() => choose(item.kind)}>{item.label}</button>)}</div>
    <form className={styles.form} onSubmit={submit}>
      <div><label className={styles.label} htmlFor="judge-number">{kind === "price_update" ? "Цена, KZT" : "Количество, шт"}</label><input id="judge-number" className={styles.input} type="number" min={kind === "price_update" ? "0.01" : "1"} step={kind === "price_update" ? "0.01" : "1"} value={number} onChange={(event) => setNumber(event.target.value)} required /></div>
      {kind === "judge_message" && <p className={styles.truth}>Порог проверки разового заказа: {threshold} шт.</p>}
      <div><label className={styles.label} htmlFor="judge-text">Текст события (из полей выше)</label><textarea id="judge-text" className={styles.input} rows={3} value={text} readOnly /></div>
      <button className={styles.button} disabled={busy || !text.trim() || !number}>Добавить событие</button>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {result && <p role="status">{result.replayed ? "Событие уже было добавлено" : "Событие добавлено"}: {result.id} · {result.state}</p>}
    </form>
    <p className={styles.truth}><WorldLabel /> Событие останется в локальном симуляторе.</p>
  </>;
}
