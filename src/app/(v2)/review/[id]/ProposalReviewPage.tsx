"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, CircleAlert, CircleCheck, FileSpreadsheet, PencilLine, RefreshCw } from "lucide-react";
import { ApiError, apiRequest, useApi, useApiSync } from "@/components/shell/api";
import { Button, Pill, Skeleton, StateBlock, TruthStrip, UrgencyPill, errorKind, errorTitle, fmtInt, type Money, type Urgency } from "@/components/v2/primitives";
import styles from "./review.module.css";

type Line = { recommendation_id?: string; code_1c: string; name?: string; unit?: string; qty: number | null; unit_cost?: string | null; rationale_ru?: string };
type Proposal = { id: string; kind: string; subject_id?: string; version: number; state: string; rationale_ru: string; money_at_stake?: Money | null; affects?: unknown[]; sources?: unknown[];
  payload: { supplier_id?: string; lines?: Line[]; cost_known_lines?: number; doc_no?: string; code_1c?: string; ym?: string; state?: string; changes?: Record<string, unknown>; current?: Record<string, unknown>; before?: Record<string, unknown>; after?: Record<string, unknown> } };
type ProposalResponse = { proposal: Proposal; ai?: string; external?: string };
type RecRow = { code_1c: string; image_url?: string | null; urgency?: Urgency; unit?: string | null };
type SkuRow = { code_1c: string; article?: string | null; image_url?: string | null; unit?: string | null };
type Order = { order: { id: string; eta?: string | null; total_cost?: string | null; state: string } };

const KIND_RU: Record<string, string> = { supplier_order: "Заказ поставщику", supplier_split: "Разделить поставку", supplier_expedite: "Ускорить поставку", clarification: "Уточнение по задаче", outlier_review: "Разовый заказ", param_change: "Параметры расчёта" };
const STATE_RU: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "neutral" }> = { needs_review: { label: "ждёт решения", tone: "warn" }, approved: { label: "утверждён", tone: "ok" }, rejected: { label: "отклонён", tone: "neutral" }, stale: { label: "устарел", tone: "danger" }, draft: { label: "готовится", tone: "neutral" }, delivered: { label: "передан", tone: "ok" }, delivery_failed: { label: "ошибка передачи", tone: "danger" } };
const FIELD_RU: Record<string, string> = { lead_time_days: "Срок поставки, дни", review_days: "Период пересмотра, дни", service_level: "Уровень сервиса", growth_cap: "Предел роста", outlier: "Порог разовых заказов", k_month: "Множитель месячного спроса", k_doc: "Множитель документа", min_units: "Минимальное количество" };
const URGENCY_RANK: Record<string, number> = { critical: 0, soon: 1, normal: 2, none: 3 };
const PREPAY_PCT = 30;

const kzt = (n: number) => `${Math.round(n).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₸`;
const scale = (n: number | null): "m" | "k" | "u" | "none" => n == null ? "none" : n >= 1e6 ? "m" : n >= 1e4 ? "k" : "u";
const lineCost = (line: Line, qty: number | null) => line.unit_cost == null || qty == null ? null : Number(line.unit_cost) * qty;
const firstSentence = (text: string) => { const clean = text.replace(/^Код 1С\s+\S+:\s*/i, "").trim(); const m = clean.match(/^.*?[.!?](?=\s|$)/); return { short: (m ? m[0] : clean).trim(), full: clean }; };
const plural = (n: number, one: string, few: string, many: string) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many; };
const fmtDay = (iso: string | null | undefined) => { if (!iso) return null; const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso); return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }); };
const valueText = (value: unknown): string => value == null ? "не задано" : typeof value === "object" ? Object.entries(value as Record<string, unknown>).map(([k, v]) => `${FIELD_RU[k] ?? k}: ${valueText(v)}`).join(" · ") : typeof value === "number" ? value.toLocaleString("ru-RU") : String(value);

export default function ProposalReviewPage({ id }: { id: string }) {
  const p = useApi<ProposalResponse>(`/api/proposals/${encodeURIComponent(id)}`);
  const proposal = p.data?.proposal;
  if (p.loading && !p.data) return <div className={styles.page}><Link href="/today" className={styles.back}><ArrowLeft size={14} aria-hidden="true" />Сегодня</Link><div style={{ marginTop: 24 }}><Skeleton rows={6} height={18} /></div></div>;
  if (p.error && !p.data) return <div className={styles.page}><Link href="/today" className={styles.back}><ArrowLeft size={14} aria-hidden="true" />Сегодня</Link><div style={{ marginTop: 24 }}>
    {p.error.status === 404 ? <StateBlock kind="empty" title="Предложение не найдено" detail="Возможно, оно уже решено или заменено новой версией." action={<Link href="/today" className={styles.receiptLink}>К списку решений</Link>} />
      : <StateBlock kind={errorKind(p.error)} title={errorTitle(p.error)} detail="Не удалось загрузить предложение." action={<Button onClick={p.reload}><RefreshCw size={14} aria-hidden="true" />Повторить</Button>} />}
  </div></div>;
  if (!proposal) return null;
  return <ProposalView key={`${proposal.id}`} proposal={proposal} ai={p.data?.ai} external={p.data?.external} reload={p.reload} />;
}

function ProposalView({ proposal, ai, external, reload }: { proposal: Proposal; ai?: string; external?: string; reload: () => void }) {
  const { refresh } = useApiSync();
  const supplier = proposal.payload.supplier_id ?? proposal.subject_id ?? "";
  const lines = useMemo(() => proposal.payload.lines ?? [], [proposal.payload.lines]);
  const isOrder = proposal.kind === "supplier_order";
  const recs = useApi<{ groups: { supplier_id: string; rows: RecRow[] }[] }>(isOrder && supplier ? `/api/recommendations?supplier=${encodeURIComponent(supplier)}` : "/api/health");
  const skus = useApi<{ items: SkuRow[] }>(isOrder && supplier ? `/api/skus?supplier=${encodeURIComponent(supplier)}&limit=500` : "/api/health");
  const enrich = useMemo(() => {
    const map = new Map<string, { image_url: string | null; urgency: Urgency | null; article: string | null; unit: string | null }>();
    for (const row of skus.data?.items ?? []) map.set(row.code_1c, { image_url: row.image_url ?? null, urgency: null, article: row.article ?? null, unit: row.unit ?? null });
    for (const group of recs.data?.groups ?? []) for (const row of group.rows) { const cur = map.get(row.code_1c); map.set(row.code_1c, { image_url: row.image_url ?? cur?.image_url ?? null, urgency: row.urgency ?? null, article: cur?.article ?? null, unit: row.unit ?? cur?.unit ?? null }); }
    return map;
  }, [recs.data, skus.data]);

  const [boundVersion, setBoundVersion] = useState(proposal.version);
  const [editing, setEditing] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<"urgency" | "cost">("urgency");
  const [shown, setShown] = useState(60);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [validation, setValidation] = useState("");
  const [done, setDone] = useState<{ kind: "approve" | "reject"; po_id?: string | null } | null>(null);
  const order = useApi<Order>(done?.po_id ? `/api/orders/${encodeURIComponent(done.po_id)}` : "/api/health");
  const stale = proposal.version !== boundVersion && !done;
  const editable = proposal.state === "needs_review" && !done;

  const qtyOf = (line: Line) => quantities[line.code_1c] !== undefined ? (quantities[line.code_1c].trim() === "" ? null : Number(quantities[line.code_1c])) : line.qty;
  const rows = useMemo(() => lines.map(line => ({ line, e: enrich.get(line.code_1c), qty: line.qty, cost: lineCost(line, line.qty) })), [lines, enrich]);
  const sorted = useMemo(() => [...rows].sort((a, b) => sort === "cost"
    ? (b.cost ?? -1) - (a.cost ?? -1)
    : (URGENCY_RANK[a.e?.urgency ?? "none"] - URGENCY_RANK[b.e?.urgency ?? "none"]) || ((b.cost ?? -1) - (a.cost ?? -1))), [rows, sort]);
  const total = useMemo(() => rows.reduce((s, r) => s + (lineCost(r.line, qtyOf(r.line)) ?? 0), 0), [rows, quantities]); // eslint-disable-line react-hooks/exhaustive-deps
  const priced = rows.filter(r => r.line.unit_cost != null).length;
  const unpriced = rows.length - priced;
  const critical = rows.filter(r => r.e?.urgency === "critical").length;
  const edited = Object.entries(quantities).filter(([code, v]) => { const line = lines.find(l => l.code_1c === code); return line && v.trim() !== "" && Number(v) !== line.qty; }).length;
  const stakeAmount = proposal.money_at_stake ? Number(proposal.money_at_stake.amount) : (priced ? total : null);
  const headMoney = stakeAmount != null ? kzt(stakeAmount) : null;

  const decide = async (key: "approve" | "reject") => {
    setError(null); setValidation("");
    const adjustments: { code_1c: string; qty: number }[] = [];
    if (key === "approve" && isOrder) {
      for (const [code, value] of Object.entries(quantities)) {
        const line = lines.find(l => l.code_1c === code); if (!line) continue;
        if (value.trim() === "" || !Number.isSafeInteger(Number(value)) || Number(value) < 0) { setValidation(`Укажите целое количество не меньше нуля: ${line.name ?? "позиция"}.`); return; }
        if (Number(value) !== line.qty) adjustments.push({ code_1c: code, qty: Number(value) });
      }
      if (lines.some(l => l.qty == null && quantities[l.code_1c] === undefined)) { setValidation("У части позиций не задано количество — укажите его перед утверждением."); return; }
    }
    setBusy(key);
    try {
      const r = await apiRequest<{ po_id?: string | null; proposal_version: number }>(`/api/proposals/${encodeURIComponent(proposal.id)}/${key}`, { method: "POST", body: JSON.stringify({ proposal_version: boundVersion, ...(adjustments.length ? { adjustments } : {}) }) });
      setDone({ kind: key, po_id: r.po_id ?? null }); setEditing(false); refresh(); reload();
    } catch (e) { setError(e instanceof ApiError ? e : new ApiError(500, "unknown", "Действие не выполнено")); }
    finally { setBusy(null); }
  };
  const conflict = error?.status === 409 || (stale && editable);
  const state = STATE_RU[done ? (done.kind === "approve" ? "approved" : "rejected") : proposal.state] ?? { label: proposal.state, tone: "neutral" as const };
  const prepay = stakeAmount != null ? stakeAmount * PREPAY_PCT / 100 : null;
  const balanceDay = fmtDay(order.data?.order?.eta);

  return <div className={styles.page} data-proposal-id={proposal.id}>
    <Link href="/today" className={styles.back}><ArrowLeft size={14} aria-hidden="true" />Сегодня</Link>
    <div className={styles.head}>
      <div className={styles.headText}>
        <h1 className={styles.display}>{KIND_RU[proposal.kind] ?? "Предложение"}{isOrder && supplier ? ` ${supplier}` : ""}</h1>
        <div className={styles.headMeta}>
          <Pill tone={state.tone}>{state.label}</Pill>
          {isOrder && <span><strong>{fmtInt(lines.length)}</strong> {plural(lines.length, "позиция", "позиции", "позиций")}</span>}
          {headMoney && <span>· <strong>{headMoney}</strong></span>}
          {isOrder && <span>· поставщику ничего не отправляется без вас</span>}
        </div>
      </div>
      {editable && isOrder && lines.length > 0 && <div className={styles.headActions}>
        <Button variant={editing ? "dark" : "secondary"} onClick={() => setEditing(v => !v)} aria-pressed={editing}><PencilLine size={14} aria-hidden="true" />{editing ? "Готово" : "Изменить количество"}</Button>
      </div>}
    </div>
    {proposal.rationale_ru && <p className={styles.lead}>{proposal.rationale_ru}</p>}

    {done && <section className={styles.receipt} role="status" aria-label="Итог решения">
      <p className={styles.receiptTitle}><CircleCheck size={18} aria-hidden="true" />{done.kind === "approve" ? (isOrder ? "Утверждено · черновик заказа создан, поставщику ничего не отправлено" : "Утверждено") : "Отклонено · данные оставлены без изменений"}</p>
      {done.kind === "approve" && isOrder && prepay != null && stakeAmount != null && <p className={styles.receiptLine}>Предоплата {PREPAY_PCT} % <strong>{kzt(prepay)}</strong> сейчас · {100 - PREPAY_PCT} % <strong>{kzt(stakeAmount - prepay)}</strong> {balanceDay ? balanceDay : "при поставке"}{unpriced ? ` · без ${fmtInt(unpriced)} ${plural(unpriced, "позиции", "позиций", "позиций")} без цены` : ""}</p>}
      {done.kind === "approve" && isOrder && edited > 0 && <p className={styles.receiptLine}>Учтены ваши изменения количества: {fmtInt(edited)} {plural(edited, "позиция", "позиции", "позиций")}.</p>}
      <div className={styles.receiptLinks}>
        {done.po_id && <Link href={`/orders/${encodeURIComponent(done.po_id)}`} className={styles.receiptLink}>Заказы</Link>}
        <Link href="/money" className={styles.receiptLink}>Деньги</Link>
        {done.po_id && <a href={`/api/orders/${encodeURIComponent(done.po_id)}/export.xlsx`} className={styles.receiptLink}><FileSpreadsheet size={14} aria-hidden="true" />Выгрузка для 1С</a>}
        <Link href="/today" className={styles.receiptLink}>К следующему решению</Link>
      </div>
    </section>}

    {isOrder && <section className={styles.strip} aria-label="Сумма заказа">
      <div className={styles.tile}><p className={styles.tileLabel}>Сумма заказа</p><p className={styles.tileValue} data-scale={scale(stakeAmount)}>{headMoney ?? "—"}</p><p className={styles.tileMeta}>{priced ? `по ${fmtInt(priced)} ${plural(priced, "позиции", "позициям", "позициям")} с известной ценой` : "себестоимость не задана"}{edited ? ` · с вашими изменениями ${kzt(total)}` : ""}</p></div>
      <div className={styles.tile}><p className={styles.tileLabel}>Предоплата {PREPAY_PCT} %</p><p className={styles.tileValue} data-scale={scale(prepay)}>{prepay != null ? kzt(prepay) : "—"}</p><p className={styles.tileMeta}>сразу после утверждения заказа · остаток {100 - PREPAY_PCT} % при поставке</p></div>
      <div className={styles.tile}><p className={styles.tileLabel}>Срочных позиций</p><p className={styles.tileValue} style={critical ? { color: "var(--v2-danger)" } : undefined}>{recs.data ? fmtInt(critical) : "…"}</p><p className={styles.tileMeta}>{critical ? "покрытие меньше срока поставки" : "дефицита по этому заказу не ожидается"}</p></div>
    </section>}

    {isOrder ? <section className={styles.section} aria-labelledby="basis-h">
      <div className={styles.sectionHead}><h2 id="basis-h">Основание</h2><span className={styles.count}>{fmtInt(lines.length)}</span>
        {lines.length > 1 && <div className={styles.sort} role="group" aria-label="Сортировка">сортировать:
          <button type="button" className={styles.sortBtn} aria-pressed={sort === "urgency"} onClick={() => setSort("urgency")}>по срочности</button>
          <button type="button" className={styles.sortBtn} aria-pressed={sort === "cost"} onClick={() => setSort("cost")}>по стоимости</button>
        </div>}
      </div>
      {lines.length === 0 ? <StateBlock kind="empty" title="В предложении нет позиций" detail="Утверждать пока нечего. Запустите расчёт пополнения, чтобы получить новое предложение." /> : <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Товар</th><th scope="col" className={styles.num}>Заказать</th><th scope="col">Срочность</th><th scope="col" className={styles.num}>Цена</th><th scope="col" className={styles.num}>Стоимость</th><th scope="col">Почему</th></tr></thead>
          <tbody>
            {sorted.slice(0, shown).map(({ line, e }) => <LineRow key={line.code_1c} line={line} e={e} editing={editing && editable} value={quantities[line.code_1c]} onEdit={v => setQuantities(cur => ({ ...cur, [line.code_1c]: v }))} />)}
          </tbody>
        </table>
        {sorted.length > shown && <div className={styles.more}><Button variant="quiet" onClick={() => setShown(n => n + 100)}>Показать ещё {fmtInt(Math.min(100, sorted.length - shown))} из {fmtInt(sorted.length - shown)}</Button></div>}
      </div>}
    </section> : <section className={styles.section} aria-labelledby="basis-h"><div className={styles.sectionHead}><h2 id="basis-h">Основание</h2></div><div className={styles.card}><Facts proposal={proposal} /></div></section>}

    <div className={styles.columns}>
      <section className={styles.card} aria-labelledby="why-h">
        <h2 id="why-h">Что изменится</h2>
        {isOrder ? <>
          <p>После утверждения появится черновик заказа поставщику {supplier}: {fmtInt(lines.length)} {plural(lines.length, "позиция", "позиции", "позиций")}{headMoney ? ` на ${headMoney}` : ""}. Деньги: предоплата {PREPAY_PCT} % сразу, остаток при поставке — обе суммы появятся в разделе «Деньги».</p>
          <p>Поставщику ничего не отправляется автоматически: письмо и выгрузка для 1С готовятся отдельным шагом в разделе «Заказы».</p>
          {unpriced > 0 && <p className={styles.warn}>У {fmtInt(unpriced)} {plural(unpriced, "позиции", "позиций", "позиций")} не задана цена — сумма заказа посчитана без них, нули не подставлены.</p>}
        </> : <p>{proposal.kind === "outlier_review" ? "Решение определит, учитывать ли этот документ в регулярном спросе при следующем расчёте." : proposal.kind === "param_change" ? "Новые параметры применятся при следующем расчёте пополнения." : "Изменения вступят в силу только после вашего решения."}</p>}
        <p className={styles.note}>Данные партнёра · обезличены{ai === "rules" ? " · локальный режим расчёта" : ""}</p>
      </section>
      <section className={`${styles.card} ${styles.decision}`} aria-labelledby="dec-h">
        <h2 id="dec-h">Ваше решение</h2>
        {isOrder && <dl className={styles.decisionSum}><dt>К утверждению</dt><dd>{edited ? kzt(total) : headMoney ?? "—"}</dd><dt>{fmtInt(lines.length)} {plural(lines.length, "позиция", "позиции", "позиций")}{edited ? ` · изменено ${fmtInt(edited)}` : ""}</dt></dl>}
        {conflict && <div className={`${styles.alert} ${styles.alertStale}`} role="alert"><CircleAlert size={15} aria-hidden="true" />Данные обновились — обновите страницу, чтобы увидеть актуальную версию.<button type="button" className={styles.linkBtn} onClick={() => { setError(null); setBoundVersion(proposal.version); reload(); }}>Обновить</button></div>}
        {error && error.status !== 409 && <div className={`${styles.alert} ${styles.alertError}`} role="alert"><CircleAlert size={15} aria-hidden="true" />{error.status === 0 ? "Нет связи — решение не сохранено. Попробуйте ещё раз." : error.status === 422 ? "Решение не принято: проверьте состав заказа." : "Не удалось сохранить решение. Попробуйте ещё раз."}</div>}
        {validation && <div className={`${styles.alert} ${styles.alertError}`} role="alert"><CircleAlert size={15} aria-hidden="true" />{validation}</div>}
        {editable ? <div className={styles.actions}>
          <Button variant="primary" busy={busy === "approve"} disabled={busy !== null || conflict || (isOrder && lines.length === 0)} onClick={() => decide("approve")}>{isOrder ? "Утвердить заказ" : proposal.kind === "outlier_review" ? "Подтвердить" : proposal.kind === "param_change" ? "Применить" : "Утвердить"}</Button>
          <Button busy={busy === "reject"} disabled={busy !== null || conflict} onClick={() => decide("reject")}>Отклонить</Button>
        </div> : <p className={styles.note}>{done ? "Решение сохранено." : proposal.state === "approved" ? "Это предложение уже утверждено." : proposal.state === "rejected" ? "Это предложение отклонено." : proposal.state === "stale" ? "Появились новые данные — эта версия больше не утверждается." : "Решение по этому предложению сейчас недоступно."}</p>}
        {editable && <p className={styles.note}>Решение фиксирует именно эту версию. Поставщику ничего не уходит.</p>}
      </section>
    </div>
    <footer className={styles.foot}><TruthStrip ai={ai} external={external} /></footer>
  </div>;
}

function LineRow({ line, e, editing, value, onEdit }: { line: Line; e?: { image_url: string | null; urgency: Urgency | null; article: string | null; unit: string | null }; editing: boolean; value?: string; onEdit: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const unit = line.unit ?? e?.unit ?? "шт";
  const qty = value !== undefined ? (value.trim() === "" ? null : Number(value)) : line.qty;
  const changed = value !== undefined && value.trim() !== "" && Number(value) !== line.qty;
  const cost = lineCost(line, qty);
  const why = firstSentence(line.rationale_ru ?? "");
  const expandable = why.full.length > why.short.length;
  return <tr className={styles.row} data-code={line.code_1c} data-recommendation-id={line.recommendation_id} data-edited={changed || undefined}>
    <td><div className={styles.tdName}>
      {/* eslint-disable-next-line @next/next/no-img-element -- partner thumbnails come from an external host without a loader */}
      {e?.image_url ? <img className={styles.thumb} src={e.image_url} alt="" loading="lazy" /> : <span className={styles.thumb} aria-hidden="true" />}
      <Link href={`/skus/${encodeURIComponent(line.code_1c)}`} prefetch={false} className={styles.name} title={line.name}>{line.name ?? "Позиция"}</Link>
      <span className={styles.meta}>{e?.article ? `арт. ${e.article}` : `код ${line.code_1c}`}</span>
    </div></td>
    <td className={styles.num}>{editing ? <input className={styles.qtyInput} type="number" min="0" step="1" inputMode="numeric" value={value ?? (line.qty == null ? "" : String(line.qty))} onChange={ev => onEdit(ev.target.value)} aria-label={`Количество: ${line.name ?? line.code_1c}`} />
      : <span className={styles.qty}>{qty == null ? "—" : fmtInt(qty)}<small>{unit}</small>{changed && <span className={styles.was}>было {fmtInt(line.qty)}</span>}</span>}</td>
    <td>{e?.urgency ? <UrgencyPill value={e.urgency} /> : <span className={styles.meta}>—</span>}</td>
    <td className={styles.num}>{line.unit_cost != null ? <span className={styles.cost} data-scale="u">{kzt(Number(line.unit_cost))}<span className={styles.costMeta}>за {unit}</span></span> : <span className={styles.cost} data-scale="none">цена не задана</span>}</td>
    <td className={styles.num}>{cost != null ? <span className={styles.cost} data-scale={scale(cost)}>{kzt(cost)}</span> : <span className={styles.cost} data-scale="none">—</span>}</td>
    <td className={styles.why}>{why.full ? <><div className={styles.whyText} data-open={open || undefined}>{open ? why.full : why.short}</div>{expandable && <button type="button" className={styles.whyBtn} onClick={() => setOpen(v => !v)} aria-expanded={open}>{open ? "Свернуть" : "Подробнее"}</button>}</> : <span className={styles.meta}>обоснование не указано</span>}</td>
  </tr>;
}

function Facts({ proposal }: { proposal: Proposal }) {
  const pl = proposal.payload;
  if (proposal.kind === "outlier_review") return <dl className={styles.facts}>
    <dt>Документ</dt><dd>{pl.doc_no ?? "не указан"}</dd>
    <dt>Период</dt><dd>{pl.ym ?? "—"}</dd>
    <dt>Предлагается</dt><dd><strong>{pl.state === "excluded" ? "Исключить из регулярного спроса" : pl.state === "kept" ? "Учесть в регулярном спросе" : "Результат не определён"}</strong></dd>
  </dl>;
  const changes = pl.changes ?? pl.after ?? {};
  const before = pl.current ?? pl.before ?? {};
  const entries = Object.entries(changes);
  if (!entries.length) return <p>{proposal.rationale_ru || "Подробности не указаны."}</p>;
  return <dl className={styles.facts}>{entries.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{FIELD_RU[k] ?? k}</dt><dd>{before[k] !== undefined && <><span className={styles.was}>было {valueText(before[k])}</span></>}<strong>{valueText(v)}</strong></dd></div>)}</dl>;
}
