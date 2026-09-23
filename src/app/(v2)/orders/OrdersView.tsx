"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ClipboardList, FileSpreadsheet, FileText, Mail, Truck } from "lucide-react";
import { ApiError, apiRequest, useApi, useApiSync } from "@/components/shell";
import { Btn, Card, Empty, Kpis, Loading, PageHead, Pill, Section, Truth, Unavailable, fmtDate, fmtMoney, fmtNum } from "@/components/v2/ui";
import { buildPipeline, daysLabel, ddmm, type FeedIn, type LedgerIn, type MoneyOutIn, type OrderIn, type PipelineRow, type TransitIn } from "./pipeline";
import { ExportButton } from "@/components/v2/ExportButton";
import styles from "./orders.module.css";

type OrdersResp = { orders: OrderIn[] };
type FeedResp = { rows: FeedIn[] };
type LedgerResp = { rows: LedgerIn[] };
type MoneyResp = { next_60d: { out: MoneyOutIn[] } };
type SourcesResp = { loaded_at: string | null; files: { kind: string; name: string; supplier_id: string | null; rows: number; data_since: string | null; data_until: string | null; file_date: string | null }[]; transit: TransitIn[] };

const plural = (n: number, one: string, few: string, many: string) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many; };
const clock = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };

function StageRail({ row }: { row: PipelineRow }) {
  return <ol className={styles.stages} aria-label="Этапы заказа">
    {row.steps.map(s => <li key={s.key} data-state={s.state} aria-current={s.state === "current" ? "step" : undefined}><i aria-hidden /><span>{s.label}</span>{s.note ? <em>{s.note}</em> : null}</li>)}
  </ol>;
}

/** Approve from the list: binds the visible order version, same contract as the order page. */
function OrderActions({ row, onChanged }: { row: PipelineRow; onChanged: () => void }) {
  const { refresh } = useApiSync();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "warn" | "bad"; text: string } | null>(null);
  const draft = row.kind === "system" && row.steps.some(s => s.key === "approved" && s.state === "pending");
  const approved = row.kind === "system" && !draft;
  async function approve() {
    if (busy) return; setBusy(true); setNote(null);
    try {
      const current = await apiRequest<{ order: { version: number } }>(`/api/orders/${encodeURIComponent(row.id)}`);
      const version = current.order?.version ?? row.version;
      if (version === undefined) throw new ApiError(409, "version_unknown", "Версия заказа неизвестна");
      await apiRequest(`/api/orders/${encodeURIComponent(row.id)}/approve`, { method: "POST", body: JSON.stringify({ version }) });
      setNote({ tone: "ok", text: `Заказ утверждён. Обязательство перед ${row.supplier_id} появилось в «Деньгах»; файл для 1С можно скачать.` });
      refresh(); onChanged();
    } catch (failure) {
      const e = failure instanceof ApiError ? failure : new ApiError(500, "unknown", "Действие не выполнено.");
      if (e.status === 409) { setNote({ tone: "warn", text: "Данные обновились — список обновлён, проверьте заказ ещё раз." }); onChanged(); }
      else setNote({ tone: "bad", text: e.message });
    } finally { setBusy(false); }
  }
  if (row.kind !== "system") return null;
  return <div className={styles.actions}>
    {draft && !note?.tone.startsWith("ok") ? <Btn variant="primary" busy={busy} onClick={approve}>Утвердить заказ</Btn> : null}
    <Link href={`/orders/${encodeURIComponent(row.id)}`} className={styles.link}>Открыть</Link>
    {(approved || note?.tone === "ok") ? <><Link href="/money" className={styles.link}>Деньги</Link><ExportButton poId={row.id} format="xlsx" lines={row.lines} className={styles.link} /></> : null}
    {note ? <p className={styles.receipt} data-tone={note.tone} role="status">{note.text}</p> : null}
  </div>;
}

function OrderRow({ row, selected, onSelect, onChanged }: { row: PipelineRow; selected: boolean; onSelect: () => void; onChanged: () => void }) {
  const days = daysLabel(row.arrival.days);
  const transit = row.steps.some(s => s.key === "transit" && s.state === "current");
  return <li>
    <button type="button" className={styles.row} aria-pressed={selected} onClick={onSelect} data-row>
      <div className={styles.top}>
        <span className={styles.icon} data-tone={row.kind === "system" ? "accent" : undefined} aria-hidden>{row.kind === "system" ? <ClipboardList size={18} /> : <Truck size={18} />}</span>
        <div style={{ minWidth: 0 }}>
          <h3 className={styles.title}>{row.title}</h3>
          <div className={styles.meta}>
            <Pill tone={transit ? "good" : row.stage_label === "Черновик" ? "warn" : "neutral"}>{row.stage_label}</Pill>
            <span>{row.supplier_id} · {fmtNum(row.lines)} {plural(row.lines, "позиция", "позиции", "позиций")} · {fmtNum(row.qty)} шт{row.kind === "partner" && !row.synthetic ? " · заказ из 1С" : row.synthetic ? " · демо-событие" : ""}</span>
          </div>
        </div>
        <div className={styles.sum}>
          {row.arrival.date ? <strong>{row.arrival.label}</strong> : row.kind === "system" && row.total_cost ? <strong>{fmtMoney(row.total_cost)}</strong> : <span>{row.kind === "system" ? "себестоимость не задана" : "в пути · дата не указана"}</span>}
          {days ? <span>{days}</span> : null}
          {row.customs ? <span className={styles.policy}>{row.customs}</span> : null}
        </div>
      </div>
      <StageRail row={row} />
    </button>
    <OrderActions row={row} onChanged={onChanged} />
  </li>;
}

function Doc({ label, state, note }: { label: string; state: string; note?: string }) {
  return <li><span>{label}</span><Pill tone={state === "получен" ? "good" : state === "не получен" ? "warn" : "neutral"}>{state}</Pill>{note ? <small>{note}</small> : null}</li>;
}

export function OrdersView() {
  const orders = useApi<OrdersResp>("/api/orders");
  const feed = useApi<FeedResp>("/api/world/feed");
  const ledger = useApi<LedgerResp>("/api/agent/ledger?limit=200");
  const cash = useApi<MoneyResp>("/api/money");
  const sources = useApi<SourcesResp>("/api/sources");
  const [picked, setPicked] = useState<string | null>(null);
  const rows = useMemo(() => orders.data ? buildPipeline({
    orders: orders.data.orders, feed: feed.data?.rows ?? [], ledger: ledger.data?.rows ?? [], money: cash.data?.next_60d.out ?? [], transit: sources.data?.transit ?? [],
  }) : [], [orders.data, feed.data, ledger.data, cash.data, sources.data]);
  const selected = rows.find(r => r.id === picked) ?? rows[0] ?? null;
  const system = rows.filter(r => r.kind === "system");
  const inTransit = rows.filter(r => r.steps.some(s => s.key === "transit" && s.state === "current"));
  const waiting = system.filter(r => r.steps.some(s => s.key === "approved" && s.state !== "pending") && !r.reply.text);
  const nearest = inTransit.filter(r => r.arrival.date).sort((a, b) => a.arrival.date!.localeCompare(b.arrival.date!))[0];
  const crumbs = [{ label: "Закупки" }];
  if (orders.loading && !orders.data) return <><PageHead crumbs={crumbs} title="Заказы" /><Loading label="Загружаю заказы…" /></>;
  if (orders.error && !orders.data) return <><PageHead crumbs={crumbs} title="Заказы" /><Unavailable title="Заказы недоступны" detail="Не удалось получить список заказов. Ничего не придумываю — попробуйте ещё раз." retry={orders.reload} /></>;
  const files = sources.data?.files ?? [];
  return <>
    <PageHead crumbs={crumbs} title="Заказы"
      badges={<><Truth>Данные партнёра · обезличены</Truth><Pill tone={waiting.length ? "warn" : "good"}>{waiting.length ? `${fmtNum(waiting.length)} ${plural(waiting.length, "ждёт", "ждут", "ждут")} ответа поставщика` : "ответы поставщиков получены"}</Pill></>}
      sub={<>{fmtNum(system.length)} {plural(system.length, "заказ", "заказа", "заказов")} в работе · {fmtNum(inTransit.length)} {plural(inTransit.length, "поставка", "поставки", "поставок")} в пути по отчётам 1С · этапы показаны по фактическому состоянию — что не произошло, отмечено как не пройденное</>}
      actions={<Link href="/replenishment" className={styles.link}>К пополнению</Link>} />
    <Kpis items={[
      { label: "В работе", value: fmtNum(system.length), meta: "черновики и утверждённые заказы" },
      { label: "В пути", value: fmtNum(inTransit.length), meta: inTransit.length ? `${fmtNum(inTransit.reduce((s, r) => s + r.qty, 0))} шт по отчётам 1С` : "по отчётам 1С поставок нет" },
      { label: "Ждут ответа поставщика", value: fmtNum(waiting.length), meta: waiting.length ? "ответа пока нет" : "все ответы получены", tone: waiting.length ? "warn" : "neutral" },
      { label: "Ближайшее поступление", value: nearest ? ddmm(nearest.arrival.date!) : "—", meta: nearest ? `${daysLabel(nearest.arrival.days)} · ${nearest.title}` : "дат поступления в отчётах нет" },
    ]} />
    <div className={styles.grid}>
      <div className={styles.main}>
        <Section title="Заказы поставщикам" count={rows.length} aside={<span className={styles.muted}>Выберите заказ — справа документы и ответ поставщика</span>}>
          {rows.length === 0 ? <Empty title="Заказов пока нет">Заказ появится здесь после утверждения предложения на странице «Сегодня».</Empty>
            : <ul className={styles.list}>{rows.map(r => <OrderRow key={r.id} row={r} selected={selected?.id === r.id} onSelect={() => setPicked(r.id)} onChanged={() => { orders.reload(); cash.reload(); ledger.reload(); }} />)}</ul>}
        </Section>
      </div>
      <aside className={styles.rail} aria-label="Документы и источники">
        {selected ? <>
          <Section title="Заказ">
            <Card><blockquote className={styles.quote}>{selected.header}</blockquote>
              <ul className={styles.facts} style={{ marginTop: 12 }}>
                <li><Truck size={15} aria-hidden /><span>{selected.arrival.date ? `${selected.arrival.label} · ${daysLabel(selected.arrival.days)}` : selected.arrival.label}</span></li>
                {selected.customs ? <li><span aria-hidden style={{ width: 15, flex: "none" }} /><span className={styles.policy}>{selected.customs}</span></li> : null}
                {selected.plan_eta ? <li><ClipboardList size={15} aria-hidden /><span>Срок по плану закупки: {fmtDate(selected.plan_eta)} — расчёт, поставщиком не подтверждён</span></li> : null}
                {selected.kind === "system" ? <li><FileSpreadsheet size={15} aria-hidden /><span>{selected.total_cost ? `Сумма ${fmtMoney(selected.total_cost)} · цена известна для ${fmtNum(selected.cost_known_lines)} из ${fmtNum(selected.lines)}` : "Себестоимость не задана"}</span></li> : null}
                {selected.source_file ? <li><FileText size={15} aria-hidden /><span>Из файла «{selected.source_file}»{selected.file_date ? ` от ${fmtDate(selected.file_date)}` : ""}</span></li> : null}
              </ul>
              {selected.kind === "system" ? <p style={{ margin: "12px 0 0", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}><Link className={styles.link} href={`/orders/${encodeURIComponent(selected.id)}`}>Открыть письмо поставщику</Link>{selected.steps.some(st => st.key === "approved" && st.state !== "pending") ? <ExportButton poId={selected.id} format="xlsx" lines={selected.lines} className={styles.link} /> : null}</p> : null}
            </Card>
          </Section>
          <Section title="Ответ поставщика">
            <Card>
              {selected.reply.text ? <><blockquote className={styles.quote}>{selected.reply.text}</blockquote><p className={styles.muted} style={{ margin: "8px 0 0" }}>{selected.reply.at ? `получен ${clock(selected.reply.at)}` : "дата получения не указана"}</p></>
                : <p className={styles.muted} style={{ margin: 0, display: "flex", gap: 8, font: "var(--v2-body)" }}><Mail size={16} aria-hidden />{selected.kind === "partner" ? "переписка ведётся в 1С" : "ответа пока нет"}</p>}
              {selected.letter_at ? <p className={styles.muted} style={{ margin: "8px 0 0" }}>Письмо подготовлено {clock(selected.letter_at)} — не отправлено без вашего решения</p> : null}
            </Card>
          </Section>
          <Section title="Документы">
            <Card>
              <ul className={styles.docs}>{selected.docs.map(d => <Doc key={d.label} {...d} />)}</ul>
              {selected.payouts.length ? <div style={{ marginTop: 8 }}>{selected.payouts.map(p => <div className={styles.kv} key={`${p.kind}-${p.at}`}><b>{/prepayment$/.test(p.kind) ? "Предоплата 30 %" : /balance$/.test(p.kind) ? "Остаток 70 % при поставке" : "Выплата"}</b><span className={styles.num}>−{fmtMoney(p.amount, p.currency)}</span><span>{fmtDate(p.at)}</span></div>)}</div> : null}
            </Card>
          </Section>
        </> : null}
        <Section title="Файлы партнёра">
          <Card>
            {sources.error && !sources.data ? <Unavailable title="Список файлов недоступен" retry={sources.reload} /> : null}
            {!sources.data && sources.loading ? <Loading label="Загружаю список файлов…" lines={2} /> : null}
            {sources.data && files.length === 0 ? <Empty title="Файлы не загружены">Отчёты 1С ещё не загружались.</Empty> : null}
            {files.map(f => <div className={styles.kv} key={f.name}><b>{f.name}</b><span className={styles.num}>{f.supplier_id ?? ""}</span><span style={{ gridColumn: "1 / -1" }}>{f.kind === "sales" ? `продажи ${fmtDate(f.data_since)} — ${fmtDate(f.data_until)} · ${fmtNum(f.rows)} строк` : `товар в пути${f.file_date ? ` на ${fmtDate(f.file_date)}` : ""} · ${fmtNum(f.rows)} строк`}</span></div>)}
            {sources.data?.loaded_at ? <p className={styles.muted} style={{ margin: "10px 0 0" }}>Загружено {clock(sources.data.loaded_at)}</p> : null}
          </Card>
        </Section>
      </aside>
    </div>
  </>;
}
