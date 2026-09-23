"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Chip, TruthLabels, type TruthAxes } from "@/components/labels";
import { ActionStatus, Button, EmptyState, LoadError, Skeleton, apiRequest, useApi, useApiAction } from "@/components/shell";
import { humanize } from "@/components/labels";
import styles from "./world-console.module.css";

export const EVENT_STATES = { scripted: "По сценарию", pending: "Ждёт обработки", processed: "Обработано", replayed: "Повтор — без эффекта", failed: "Ошибка обработки" } as const;
export type EventState = keyof typeof EVENT_STATES;
export type WorldEvent = { id: string; seq?: number | null; kind: string; text?: string | null; at?: string | null; state: EventState; actor_id?: string | null; code_1c?: string | null; run_id?: string | null; axes?: TruthAxes; label?: string; external?: string };
type Feed = { rows?: WorldEvent[]; events?: WorldEvent[]; state_version?: number };
const KINDS: Record<string, string> = { sales_day: "Продажи за день", stock_snapshot: "Снимок остатков", in_transit_update: "Товары в пути", price_update: "Изменение цены", judge_message: "Разовый заказ", supplier_reply: "Ответ поставщика", order_drafted: "Черновик заказа", order_approved: "Заказ утверждён", recommendation_run: "Расчёт выполнен" };
const ACTORS: Record<string, string> = { judge: "жюри", system: "система", agent: "агент", supplier: "поставщик", purchasing_manager: "менеджер по закупкам", manager: "менеджер" };
function eventTime(value?: string | null) { if (!value) return "Дата не указана"; const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" }).format(date); }

export function WorldEventList() {
  const feed = useApi<Feed>("/api/world/feed");
  const [filter, setFilter] = useState<EventState | "all">("all");
  const [code, setCode] = useState("");
  const demo = useApiAction();
  const events = useMemo(() => feed.data?.rows ?? feed.data?.events ?? [], [feed.data]);
  const shown = events.filter(event => (filter === "all" || event.state === filter) && (!code.trim() || event.code_1c?.toLowerCase().includes(code.trim().toLowerCase())));
  return <section className={styles.list} aria-labelledby="events-heading">
    <div className={styles.listHead}><div><h2 id="events-heading">Все события</h2><p className={styles.meta}>История и очередь обработки · время Астаны</p></div><Button onClick={feed.reload}>Обновить</Button></div>
    <div className={styles.filters}><label>Состояние<select value={filter} onChange={event => setFilter(event.target.value as EventState | "all")}><option value="all">Все состояния</option>{Object.entries(EVENT_STATES).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></label><label>Код 1С<input type="search" value={code} onChange={event => setCode(event.target.value)} placeholder="Найти код в ленте" /></label><p className={styles.count} role="status">{feed.data ? `${shown.length} из ${events.length}` : ""}</p></div>
    {feed.error && <LoadError message={feed.data ? "Не удалось обновить события — показываю последнее." : feed.error.message} retry={feed.reload} />}
    {feed.loading ? <Skeleton lines={5} /> : shown.length > 0 ? <ol className={styles.events}>{shown.map(event => <li key={event.id} className={styles.event}>
      <div className={styles.sequence}>{event.seq ?? "—"}</div><div className={styles.eventBody}><div className={styles.eventHead}><h3>{KINDS[event.kind] ?? humanize(event.kind)}</h3><Chip tone={event.state === "failed" ? "danger" : "neutral"}>{EVENT_STATES[event.state] ?? event.state}</Chip></div>{event.text && <p className={styles.eventText}>{humanize(event.text)}</p>}<div className={styles.eventMeta}><time dateTime={event.at ?? undefined}>{eventTime(event.at)}</time>{event.actor_id && <span>{ACTORS[event.actor_id] ?? humanize(event.actor_id)}</span>}{event.code_1c && <Link href={`/skus/${encodeURIComponent(event.code_1c)}`}>Код {event.code_1c}</Link>}</div><TruthLabels axes={event.axes ?? { provenance: event.label ? "synthetic" : undefined, external: event.external === "local_simulator" ? "local_simulator" : undefined }} /></div>
      <div className={styles.eventAction}>{event.run_id ? <Link href={`/world/runs/${encodeURIComponent(event.run_id)}`}>Открыть запуск<ArrowUpRight size={14} aria-hidden="true" /></Link> : <span className={styles.meta}>{event.state === "scripted" ? "Ещё не запущено" : "Запуск не указан"}</span>}</div>
    </li>)}</ol> : !feed.error && <div className={styles.empty}><EmptyState>{events.length ? "Событий по этим условиям нет." : "Лента — это журнал того, что случилось с продажами, остатками и поставками, и как на это отреагировал агент. Пока событий нет."}</EmptyState>{events.length > 0 ? <Button onClick={() => { setFilter("all"); setCode(""); }}>Сбросить фильтры</Button> : <Button variant="primary" busy={demo.busy} onClick={() => demo.run(() => apiRequest<{ processed: number; seeded: number }>("/api/world/demo", { method: "POST", body: JSON.stringify({ steps: 3 }) }), r => { feed.reload(); return r.processed === 0 && r.seeded === 0 ? "Демо-события недоступны на этом сервере." : `Показано событий: ${r.processed}`; })}>Показать демо-события</Button>}<ActionStatus error={demo.error} receipt={demo.receipt} /></div>}
  </section>;
}
