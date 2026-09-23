"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ApiError, apiRequest, useApi, useApiSync } from "@/components/shell";
import { Btn, Card, Empty, Kpis, PageHead, Pill, PO_STATE, Section, StaleBanner, Truth, fmtDate, fmtMoney, fmtNum, fmtQty, useRowKeys, type Tone } from "@/components/ui";
import styles from "./supplier.module.css";

export type ChannelState = "draft" | "sent" | "confirmed";
export type SupplierInitial = {
  order: { id: string; supplier_id: string; supplier_name: string; state: string; total_qty: number; eta: string | null; version: number };
  lines: { code_1c: string; article: string | null; name: string; qty: number; rationale_ru: string | null }[];
  channel: { state: ChannelState; label: string; as_of: string | null; reply_text: string | null; event_id: string | null };
  state_version: number;
};
type OrderLine = { id: number; code_1c: string; qty: number; unit_cost: string | null; rationale_ru: string | null; article?: string | null; name?: string; moq?: number; image_url?: string | null };
type OrderResponse = { ok: true; order: { id: string; supplier_id: string; state: string; total_qty: number; total_cost: string | null; cost_known_lines: number; eta: string | null; export_path: string | null; version: number; lines: OrderLine[] }; state_version: number };
type Reply = { ok: true; channel: SupplierInitial["channel"]; order: SupplierInitial["order"]; replayed?: boolean; event?: { id: string } };

const CHANNEL_TONE: Record<ChannelState, Tone> = { draft: "neutral", sent: "warn", confirmed: "good" };

export function SupplierDraft({ poId, initial }: { poId: string; initial: SupplierInitial }) {
  const router = useRouter();
  const { revision, refresh } = useApiSync();
  const live = useApi<OrderResponse>(`/api/orders/${encodeURIComponent(poId)}`);
  const [channel, setChannel] = useState(initial.channel);
  const [order, setOrder] = useState(initial.order);
  const [stale, setStale] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState(`Подтверждаем получение заказа ${poId}. Отгрузка в срок.`);
  const [showAll, setShowAll] = useState(false);
  const table = useRef<HTMLDivElement>(null);
  useRowKeys(table);
  const firstRevision = useRef(revision);
  useEffect(() => { if (revision !== firstRevision.current) router.refresh(); }, [revision, router]);
  useEffect(() => { setChannel(initial.channel); setOrder(initial.order); }, [initial]);
  const lines = live.data?.order.lines ?? [];
  const merged = initial.lines.map(l => { const x = lines.find(y => y.code_1c === l.code_1c); return { ...l, unit_cost: x?.unit_cost ?? null, image_url: x?.image_url ?? null }; });
  const known = merged.filter(l => l.unit_cost !== null);
  const sum = known.reduce((a, l) => a + Number(l.unit_cost) * l.qty, 0).toFixed(2);
  const orderState = live.data?.order.state ?? order.state;
  const version = live.data?.order.version ?? order.version;
  const approved = orderState === "approved" || orderState === "exported";
  const poState = PO_STATE[orderState] ?? { label: orderState, tone: "neutral" as Tone };
  const visible = showAll ? merged : merged.slice(0, 40);
  async function act(action: "send_demo" | "confirm" | "approve") {
    if (busy) return; setBusy(true); setStale(""); setStatus("");
    try {
      if (action === "approve") {
        const r = await apiRequest<{ order: SupplierInitial["order"] }>(`/api/orders/${encodeURIComponent(poId)}/approve`, { method: "POST", body: JSON.stringify({ version }) });
        setOrder(o => ({ ...o, ...r.order })); setStatus(`Заказ утверждён · версия ${r.order.version}. Обязательство перед ${order.supplier_name} появилось в «Деньгах».`);
      } else {
        const r = await apiRequest<Reply>(`/api/supplier/${encodeURIComponent(poId)}/reply`, { method: "POST", body: JSON.stringify(action === "confirm" ? { action, text } : { action }) });
        setChannel(r.channel); if (r.order) setOrder(o => ({ ...o, ...r.order }));
        setStatus(action === "send_demo" ? "Размещено в контролируемом демо-канале. Письмо не покидало приложение." : r.replayed ? "Ответ уже был записан — повтор не создаёт нового события." : `Ответ поставщика записан как синтетическое событие${r.event ? ` ${r.event.id.slice(0, 11)}…` : ""}.`);
      }
      refresh();
    } catch (failure) {
      const e = failure instanceof ApiError ? failure : new ApiError(500, "unknown", "Действие не выполнено.");
      if (e.status === 409) { setStale("Данные обновились — состояние заказа или канала изменилось. Показываю актуальную версию."); refresh(); router.refresh(); }
      else if (e.status === 403) setStatus("Канал закрыт: заказ ещё не утверждён менеджером.");
      else setStatus(`${e.message} (${e.code})`);
    } finally { setBusy(false); }
  }
  return <>
    {stale && <StaleBanner>{stale}</StaleBanner>}
    {live.error && !live.data && <StaleBanner>Живые данные заказа недоступны ({live.error.code}) — показываю снимок сервера, версия состояния {initial.state_version}.</StaleBanner>}
    <PageHead crumbs={[{ href: "/money", label: "Деньги" }, { label: "Поставщики" }, { label: order.supplier_name }]}
      title="Черновик заказа"
      badges={<><Pill tone={CHANNEL_TONE[channel.state]}>{channel.label}</Pill><Pill tone={poState.tone}>заказ: {poState.label}</Pill></>}
      sub={<>{order.id} · {order.supplier_name} · ETA {fmtDate(order.eta)} · версия {version}</>}
      actions={<>
        <a className={styles.linkBtn} href={`/api/orders/${encodeURIComponent(poId)}/export.xlsx`}>Экспорт для 1С (файл) · xlsx</a>
        <a className={styles.linkBtn} href={`/api/orders/${encodeURIComponent(poId)}/export.csv`}>csv</a>
      </>} />
    <Kpis items={[
      { label: "Позиций", value: fmtNum(merged.length), meta: `кратность соблюдена по каждой строке` },
      { label: "Количество", value: fmtQty(order.total_qty), meta: "сумма по строкам" },
      { label: "Сумма по известным ценам", value: known.length ? fmtMoney(sum) : "нет цен", meta: known.length === merged.length ? "все строки с ценой" : `${fmtNum(known.length)} из ${fmtNum(merged.length)} строк с ценой${known.length ? " · остальное не оценено" : ""}`, tone: known.length === merged.length ? undefined : "warn" },
      { label: "Ожидаемая поставка", value: order.eta ? fmtDate(order.eta) : "—", meta: order.supplier_id === "IEK" ? "срок 40 дн по политике" : "срок 50 дн по политике" },
    ]} />
    <div className={styles.grid}>
      <div className={styles.main}>
        <Section id="letter" title="Что увидит поставщик" aside={<Truth>подготовленное письмо · не отправляется автоматически</Truth>}>
          <Card className={styles.letter}>
            <div className={styles.letterHead}>
              <div><span>Кому</span><b>{order.supplier_name}</b></div>
              <div><span>Тема</span><b>Заказ на пополнение {order.id.slice(0, 11)}… · {fmtNum(merged.length)} позиций</b></div>
              <div><span>Дата</span><b>{fmtDate(new Date().toISOString())}</b></div>
            </div>
            <p className={styles.letterBody}>Здравствуйте! Направляем заказ на пополнение склада: {fmtNum(merged.length)} позиций, {fmtQty(order.total_qty)}. Просим подтвердить наличие и срок поставки до {fmtDate(order.eta)}. Перечень позиций ниже; количества округлены до вашей кратности отгрузки.</p>
            <p className={styles.letterSig}>ТОО «Электрокомплект» · отдел закупок</p>
          </Card>
        </Section>
        <Section id="lines" title="Позиции" count={merged.length} aside={<Truth>j / k — по строкам · Enter — обоснование</Truth>}>
          <div className={styles.table} ref={table} role="table" aria-label="Строки заказа">
            <div className={styles.thead} role="row"><span role="columnheader">Позиция</span><span role="columnheader" className={styles.right}>Кол-во</span><span role="columnheader" className={styles.right}>Цена</span><span role="columnheader" className={styles.right}>Сумма</span></div>
            {visible.map(l => <details key={l.code_1c} className={styles.tr} data-row tabIndex={0} onKeyDown={e => { if (e.key === "Enter" && e.currentTarget === document.activeElement) { e.preventDefault(); e.currentTarget.open = !e.currentTarget.open; } }}>
              <summary className={styles.summary} role="row">
                <span role="cell" className={styles.cellMain}>{l.image_url && <img className={styles.thumb} src={l.image_url} alt="" width={24} height={24} loading="lazy" />}<span className={styles.name}>{l.name}</span><span className={styles.meta}>{l.article ?? "без артикула"} · <Link href={`/skus/${l.code_1c}`} onClick={e => e.stopPropagation()}>{l.code_1c}</Link></span></span>
                <span role="cell" className={styles.num}>{fmtNum(l.qty)}</span>
                <span role="cell" className={styles.num}>{l.unit_cost === null ? <span className={styles.na}>не задана</span> : fmtMoney(l.unit_cost)}</span>
                <span role="cell" className={`${styles.num} ${styles.money}`}>{l.unit_cost === null ? <span className={styles.na}>—</span> : fmtMoney((Number(l.unit_cost) * l.qty).toFixed(2))}</span>
              </summary>
              <p className={styles.why}>{l.rationale_ru ?? "Обоснование не сохранено."}</p>
            </details>)}
            {merged.length > visible.length && <div className={styles.more}><Btn onClick={() => setShowAll(true)}>Показать все {fmtNum(merged.length)} строк</Btn></div>}
            {merged.length === 0 && <Empty title="В заказе нет строк" />}
          </div>
        </Section>
      </div>
      <aside className={styles.rail} aria-label="Канал ответа">
        <Card className={styles.channel}>
          <p className={styles.railTitle}>Канал ответа — симулятор</p>
          <ol className={styles.steps}>
            {(["draft", "sent", "confirmed"] as ChannelState[]).map((s, i) => { const idx = ["draft", "sent", "confirmed"].indexOf(channel.state); return <li key={s} className={i <= idx ? styles.stepDone : ""} aria-current={s === channel.state ? "step" : undefined}><span className={styles.stepDot} aria-hidden="true">{i < idx ? "✓" : i + 1}</span><span>{s === "draft" ? "Черновик заказа — не отправлен" : s === "sent" ? "Отправлено (контролируемый демо-канал)" : "Подтверждено (симулятор)"}</span></li>; })}
          </ol>
          {channel.as_of && <p className={styles.meta}>Состояние на {new Date(channel.as_of).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>}
          {status && <p className={styles.status} role="status">{status}</p>}
          {!approved && <div className={styles.actions}><p className={styles.meta}>Заказ ожидает решения менеджера. Канал откроется после утверждения.</p><Btn variant="black" busy={busy} onClick={() => act("approve")}>Утвердить заказ · версия {version}</Btn></div>}
          {approved && channel.state === "draft" && <div className={styles.actions}><Btn variant="primary" busy={busy} onClick={() => act("send_demo")}>Разместить в демо-канале</Btn><p className={styles.meta}>Письмо не покидает приложение: канал локальный.</p></div>}
          {channel.state === "sent" && <form className={styles.actions} onSubmit={e => { e.preventDefault(); void act("confirm"); }}>
            <label className={styles.label}>Ответ поставщика (симулятор)<textarea rows={3} value={text} onChange={e => setText(e.target.value)} required /></label>
            <Btn variant="black" type="submit" busy={busy} disabled={!text.trim()}>Подтвердить получение</Btn>
            <Truth>Симулятор мира — синтетическое событие</Truth>
          </form>}
          {channel.state === "confirmed" && <blockquote className={styles.reply}><p>{channel.reply_text}</p><footer><Truth>Симулятор мира — синтетическое событие{channel.event_id ? ` · ${channel.event_id.slice(0, 11)}…` : ""}</Truth></footer></blockquote>}
        </Card>
        <Section id="truth" title="Откуда данные">
          <div className={styles.sources}>
            <p><b>Строки</b> — <code>purchase_order_line</code> заказа {order.id.slice(0, 11)}…, количества после кратности.</p>
            <p><b>Цены</b> — «СС реал» из файла SE; у IEK не передаются.</p>
            <p><b>Канал</b> — <code>ledger_peer_record</code>, локальный симулятор; передача наружу не выполняется.</p>
            <p><Truth>Данные партнёра · обезличены</Truth> · <Truth>Экспорт для 1С (файл)</Truth></p>
          </div>
        </Section>
      </aside>
    </div>
  </>;
}
