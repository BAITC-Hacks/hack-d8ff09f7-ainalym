"use client";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { PenLine, Play } from "lucide-react";
import { TruthLabels, WorldLabel } from "@/components/labels";
import { ActionStatus, apiRequest, Button, useApiAction } from "@/components/shell";
import { EVENT_STATES, type WorldEvent } from "./WorldEventList";
import styles from "./world-console.module.css";

type Kind = "judge_message" | "in_transit_update" | "price_update";
export type ComposeValues = { kind: Kind; code: string; value: string; text: string };
export function composeBody({ kind, code, value, text }: ComposeValues) {
  const code_1c = code.trim();
  return { kind, code_1c, actor_id: "judge", text: text.trim(), payload: kind === "judge_message" ? { code_1c, qty: value, one_off: true } : kind === "in_transit_update" ? { code_1c, delta: value } : { code_1c, unit_cost: value, currency: "KZT" } };
}
export function WorldControls() {
  const id = useId();
  const play = useApiAction(); const compose = useApiAction();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("judge_message");
  const [code, setCode] = useState(""); const [value, setValue] = useState("5000"); const [text, setText] = useState("");
  const [result, setResult] = useState<{ event: WorldEvent; replayed?: boolean; run_id?: string }>();
  const input = useRef<HTMLInputElement>(null);
  function preset(next: Kind) {
    setKind(next); setValue(next === "judge_message" ? "5000" : next === "in_transit_update" ? "100" : ""); setText(""); input.current?.focus();
  }
  const description = kind === "judge_message" ? `Разовый заказ ${value} шт по коду ${code}` : kind === "in_transit_update" ? `Товар в пути +${value} по коду ${code}` : `Цена по коду ${code} = ${value} KZT`;
  return <section className={`v2-priority-card ${styles.controls}`} aria-label="Воспроизвести или сочинить событие"><div className={styles.controlsHead}><div><h2>Следующее событие</h2><p className={styles.meta}>Событие меняет данные и запускает обработку агентом.</p></div><WorldLabel /></div>
    <div className={styles.controlActions}><Button id="world-play" busy={play.busy} disabled={compose.busy} onClick={() => play.run(() => apiRequest<{ processed: number; emitted?: WorldEvent[] }>("/api/world/play", { method: "POST", body: JSON.stringify({ steps: 1 }) }), response => response.processed === 0 ? "Нет новых событий для обработки." : `✓ Обработано событий: ${response.processed}`)}><Play size={16} />Воспроизвести</Button><Button id="world-compose-toggle" aria-expanded={open} aria-controls={`${id}-form`} onClick={() => setOpen(previous => !previous)} disabled={compose.busy}><PenLine size={16} />Сочинить событие</Button></div><ActionStatus error={play.error} receipt={play.receipt} />
    {open && <form className={styles.compose} id={`${id}-form`} aria-busy={compose.busy} onSubmit={async event => {
      event.preventDefault(); if (play.busy || compose.busy) return;
      const response = await compose.run(() => apiRequest<{ event: WorldEvent; replayed?: boolean; run_id?: string }>("/api/world/compose", { method: "POST", body: JSON.stringify(composeBody({ kind, code, value, text: text || description })) }), data => data.replayed ? "Событие уже сохранено — повтор без эффекта." : `Событие сохранено · ${EVENT_STATES[data.event.state] ?? data.event.state}`);
      if (response) setResult(response);
    }}><div className={styles.presets} role="group" aria-label="Тип нового события"><Button type="button" aria-pressed={kind === "judge_message"} disabled={compose.busy} onClick={() => preset("judge_message")}>Разовый заказ</Button><Button type="button" aria-pressed={kind === "in_transit_update"} disabled={compose.busy} onClick={() => preset("in_transit_update")}>Товар в пути</Button><Button type="button" aria-pressed={kind === "price_update"} disabled={compose.busy} onClick={() => preset("price_update")}>Изменение цены</Button></div>
      <div className={styles.composeFields}><label>Код 1С<input ref={input} autoFocus required value={code} onChange={event => setCode(event.target.value)} disabled={compose.busy} /></label><label>{kind === "price_update" ? "Цена, ₸" : "Количество, шт."}<input type="number" inputMode="decimal" min={kind === "price_update" ? "0" : "1"} step={kind === "price_update" ? "0.01" : "1"} required value={value} onChange={event => setValue(event.target.value)} disabled={compose.busy} /></label></div>
      <label>Текст события<textarea rows={3} maxLength={4000} value={text} onChange={event => setText(event.target.value)} placeholder={description} disabled={compose.busy} /></label><p className={styles.meta}>Если текст не указан, используется описание по коду и количеству выше.</p><Button type="submit" variant="primary" busy={compose.busy} disabled={play.busy}>Добавить событие</Button><ActionStatus error={compose.error} receipt={compose.receipt} />
      {result && <div className={styles.composeResult}><p>Сохранено: {result.event.id}</p><TruthLabels axes={result.event.axes ?? { provenance: "synthetic", external: "local_simulator" }} />{result.run_id && <Link href={`/world/runs/${encodeURIComponent(result.run_id)}`}>Открыть запуск агента</Link>}</div>}
    </form>}
  </section>;
}
