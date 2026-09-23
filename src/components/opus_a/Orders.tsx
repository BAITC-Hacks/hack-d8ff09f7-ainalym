"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { apiRequest, ApiError, useApi, useApiSync } from "@/components/shell/api";
import { day, money, qty } from "./format";
import { ErrorState, Pill, State, type ApiErr } from "./ui";

type Order = { id: string; supplier_id: string; state: string; version: number; total_qty: number; total_cost: string | null; cost_known_lines: number; eta: string | null; lines: { code_1c: string; name: string; qty: number }[] };
function OrderCard({ order }: { order: Order }) {
  const { refresh } = useApiSync();
  const [acknowledged, setAcknowledged] = useState<Order | null>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLElement>(null);
  const [review, setReview] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<ApiErr>(null);
  const latest = acknowledged && acknowledged.version > order.version ? acknowledged : order;
  const current = review ?? latest;
  const approved = ["approved", "exported", "sent", "confirmed"].includes(latest.state);
  async function reviewLatest() {
    try { const result = await apiRequest<{ order: Order }>(`/api/orders/${encodeURIComponent(order.id)}`); setReview(result.order); setError(null); }
    catch (failure) { setError(failure instanceof ApiError ? failure : { status: 500, code: "unknown", message: "Не удалось обновить заказ. Повторите попытку." }); }
  }
  async function approve() {
    if (!review || lock.current || error?.status === 409) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const result = await apiRequest<{ order: Partial<Order> }>(`/api/orders/${encodeURIComponent(order.id)}/approve`, { method: "POST", body: JSON.stringify({ version: review.version }) });
      setAcknowledged({ ...review, ...result.order, total_cost: review.total_cost, lines: review.lines });
      setReview(null); refresh();
      requestAnimationFrame(() => card.current?.querySelector<HTMLAnchorElement>(".oa-export a")?.focus());
    } catch (failure) { setError(failure instanceof ApiError ? failure : { status: 500, code: "unknown", message: "Заказ не утверждён. Повторите попытку." }); }
    finally { lock.current = false; setBusy(false); }
  }
  async function download(event: React.MouseEvent<HTMLAnchorElement>, format: "csv" | "xlsx") {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/export.${format}`);
      if (!response.ok) throw new ApiError(response.status, "export", "Не удалось подготовить файл. Повторите скачивание.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${order.id}.${format}`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); refresh();
    } catch (failure) { setError(failure instanceof ApiError ? failure : { status: 0, code: "network", message: "Файл не скачан. Проверьте связь и повторите." }); }
    finally { lock.current = false; setBusy(false); }
  }
  const close = () => { if (lock.current) return; setReview(null); setError(null); requestAnimationFrame(() => opener.current?.focus()); };
  return <article ref={card} onKeyDown={event => { if (event.key === "Escape" && review) { event.stopPropagation(); close(); } }} className="oa-card oa-order" id={`order-${order.id}`}>
    <div className="oa-section-head"><h3>Заказ · {order.supplier_id}</h3><Pill tone={approved ? "ok" : "warn"}>{approved ? "Утверждён" : "Черновик"}</Pill></div>
    <div className="oa-order-total"><strong>{current.total_cost ? money({ amount: current.total_cost, currency: "KZT" }) : "Стоимость не задана"}</strong><span className="muted">{qty(current.lines.length)} позиций · {qty(current.total_qty)} шт · ожидается {day(current.eta)}</span></div>
    <p className="muted">Цена известна для {qty(current.cost_known_lines)} из {qty(current.lines.length)} позиций. {current.cost_known_lines < current.lines.length ? "Сумма неполная. " : ""}{["sent", "confirmed"].includes(latest.state) ? "Передан поставщику." : "Поставщику не отправлен."}</p>
    <details><summary>Состав заказа</summary><ul className="oa-order-lines">{current.lines.map(line => <li key={line.code_1c}><Link href={`/opus_a/skus/${encodeURIComponent(line.code_1c)}?from=${encodeURIComponent("/opus_a/today")}`}>{line.name}<span className="muted">Код 1С {line.code_1c}</span></Link><b className="num">{qty(line.qty)} шт</b></li>)}</ul></details>
    {approved ? <div className="oa-export"><span>Экспорт для 1С · поле «Код 1с»</span>{(["csv", "xlsx"] as const).map(format => <a key={format} className="oa-btn oa-btn-outline oa-btn-sm" href={`/api/orders/${encodeURIComponent(order.id)}/export.${format}`} download aria-disabled={busy} onClick={event => download(event, format)}><Download size={14} aria-hidden />{format.toUpperCase()}</a>)}</div> : review ? <div className="oa-order-confirm">
      <p>Утвердить этот состав? Появятся обязательства перед поставщиком: предоплата 30 %, остаток при поставке.</p>
      <div className="oa-head-actions"><button autoFocus className="oa-btn oa-btn-black" disabled={busy || error?.status === 409 || current.state !== "draft"} onClick={approve}>{busy ? "Утверждаю…" : "Утвердить заказ"}</button><button className="oa-btn oa-btn-ghost" disabled={busy} onClick={close}>Отмена</button></div>
    </div> : <button ref={opener} className="oa-btn oa-btn-outline" onClick={() => { setReview(latest); setError(null); }}>Проверить и утвердить</button>}
    {error ? <ErrorState error={error} onRetry={error.status === 409 ? reviewLatest : undefined} /> : null}
  </article>;
}
export function Orders() {
  const orders = useApi<{ orders: Order[] }>("/api/orders");
  if (!orders.data?.orders.length && !orders.error) return null;
  return <section className="oa-orders" aria-labelledby="oa-orders-title"><h2 className="oa-h2" id="oa-orders-title">Подготовленные заказы</h2>
    {orders.error ? <ErrorState error={orders.error} onRetry={orders.reload} /> : null}
    {orders.data?.orders.map(order => <OrderCard key={order.id} order={order} />)}
    {orders.data && !orders.data.orders.length ? <State kind="empty" title="Заказов пока нет" /> : null}
  </section>;
}
