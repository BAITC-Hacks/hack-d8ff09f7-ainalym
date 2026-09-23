"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Chip, ProposalStateChip } from "@/components/labels";
import { Button, LoadError, Skeleton, apiRequest, useApi, useApiAction } from "@/components/shell";
import { ResultLabels } from "@/components/purchase/ResultLabels";
import { money, number, sourceText } from "@/components/purchase/types";
import { approvalVerbs, changedLines, decisionBody, hydrateProposal, kindLabels, type OrderLine, type Proposal, type ProposalsResponse } from "./types";
import styles from "@/components/purchase/workspace.module.css";
import review from "./review.module.css";

const fieldLabels: Record<string, string> = { lead_time_days: "Срок поставки, дни", review_days: "Период пересмотра, дни", service_level: "Уровень сервиса", growth_cap: "Предел роста", outlier: "Порог разовых заказов", k_month: "Множитель месячного спроса", k_doc: "Множитель документа", min_units: "Минимальное количество" };
function valueText(value: unknown): string { if (value === null || value === undefined) return "Не определено"; if (typeof value === "object") return Object.entries(value).map(([key, v]) => `${fieldLabels[key] ?? key}: ${valueText(v)}`).join(" · "); return typeof value === "number" ? number(value) : String(value); }
export function ProposalStateNotice({ proposal, successor }: { proposal: Proposal; successor?: Proposal }) {
  if (proposal.state === "needs_review") return null;
  const messages: Record<string, string> = { draft: "Предложение готовится. Утверждение появится после завершения подготовки.", stale: "Появились новые данные. Эта версия сохранена для сравнения и больше не утверждается.", approved: "Решение сохранено. Состав и версия зафиксированы.", rejected: "Предложение отклонено. Источники и состав сохранены для просмотра.", delivered: "Передача подтверждена сервисом. Состояние получено из сохранённой записи.", delivery_failed: "Ошибка передачи. Подготовленное предложение сохранено; результат передачи не подтверждён." };
  return <div className={review.state}><ProposalStateChip state={proposal.state} /><p>{messages[proposal.state]}</p>{successor && <Link className={styles.linkButton} href={`/review/${encodeURIComponent(successor.id)}`}>Открыть новую версию <ArrowRight size={16} /></Link>}</div>;
}
function LineDiff({ line, before, changed, editable, quantity, onEdit }: { line: OrderLine; before?: OrderLine; changed: boolean; editable: boolean; quantity?: string; onEdit: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  return <div className={`${review.diff} ${changed ? review.changed : ""}`}>
    <div className={review.diffHead}><div><Link className={styles.itemTitle} href={`/skus/${encodeURIComponent(line.code_1c)}`}>{line.name ?? line.code_1c}</Link><p className={styles.rowNote}>Код 1с {line.code_1c}</p></div><div className={review.diffValue}>{before && before.qty !== line.qty && <><del className={review.oldValue}>{number(before.qty)}</del><span aria-label="стало">→</span></>}{editing && editable || line.qty == null && editable ? <label className={styles.field}><span className={styles.eyebrow}>Количество</span><input className={review.qty} type="number" min="0" step="1" value={quantity ?? (line.qty == null ? "" : String(line.qty))} onChange={e => onEdit(e.target.value)} aria-label={`Количество ${line.code_1c}`} /></label> : <strong>{number(quantity ?? line.qty)} шт.</strong>}</div></div>
    <div className={styles.actions}><span className={styles.rowNote}>{money(line.unit_cost)}{line.unit_cost != null ? " / шт." : ""}</span>{editable && <button className={styles.editButton} onClick={() => setEditing(v => !v)}>{editing ? "Готово" : "Изменить qty"}</button>}{quantity !== undefined && <Chip>Изменено вами</Chip>}</div>
    <details className={styles.disclosure}><summary>Почему · источник</summary><p>{line.rationale_ru || "Обоснование не указано."}</p><Link className={styles.linkButton} href={`/skus/${encodeURIComponent(line.code_1c)}`}>История и расчёт артикула</Link></details>
  </div>;
}
export function ProposalReview({ proposal, previous, successor }: { proposal: Proposal; previous?: Proposal; successor?: Proposal }) {
  const [boundVersion, setBoundVersion] = useState(proposal.version);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [resolution, setResolution] = useState<"" | "approve" | "reject">("");
  const [validation, setValidation] = useState("");
  const [createdOrder, setCreatedOrder] = useState<string | null>(null);
  const [acknowledgedVersion, setAcknowledgedVersion] = useState<number | null>(null);
  const action = useApiAction();
  const editable = proposal.state === "needs_review";
  const stale = proposal.version !== boundVersion || action.error?.status === 409 && acknowledgedVersion !== proposal.version;
  const lines = proposal.payload.lines ?? [];
  const diffs = changedLines(lines, previous?.payload.lines);
  const changed = diffs.filter(row => row.changed), unchanged = diffs.filter(row => !row.changed);
  const decisionsRequired = proposal.kind !== "supplier_order";
  async function decide(decision: "approve" | "reject") {
    setValidation("");
    if (decision === "approve" && decisionsRequired && !resolution) { setValidation("Выберите, применять ли подготовленное решение."); return; }
    let body;
    try { body = decisionBody(boundVersion, quantities, lines); }
    catch (error) { setValidation(error instanceof Error ? error.message : "Проверьте количество."); return; }
    if (decision === "approve" && lines.some(line => line.qty == null && quantities[line.code_1c] === undefined)) { setValidation("Количество не определено. Укажите его явно для каждой позиции."); return; }
    const result = await action.run(() => apiRequest<{ po_id?: string | null }>(`/api/proposals/${encodeURIComponent(proposal.id)}/${decision}`, { method: "POST", body: JSON.stringify(body) }), decision === "approve" ? `Решение сохранено · версия ${boundVersion}.` : "Предложение отклонено.");
    if (result?.po_id) setCreatedOrder(result.po_id);
  }
  const renderLine = ({ line, before, changed }: ReturnType<typeof changedLines>[number]) => <LineDiff key={line.code_1c} line={line} before={before} changed={changed} editable={editable} quantity={quantities[line.code_1c]} onEdit={value => setQuantities(current => ({ ...current, [line.code_1c]: value }))} />;
  return <>
    <ProposalStateNotice proposal={proposal} successor={successor} />
    <div className={review.desk}>
      <section className={`${styles.panel} ${review.proposal}`} aria-label="Подготовленное предложение"><div className={styles.panelHead}><h2>{kindLabels[proposal.kind]}</h2><ProposalStateChip state={proposal.state} /></div>
        {proposal.kind === "supplier_order" ? <>{changed.map(renderLine)}{!!unchanged.length && <details className={`${styles.disclosure} ${styles.panelBody}`}><summary>Без изменений: {number(unchanged.length, 0)} позиций</summary>{unchanged.map(renderLine)}</details>}{!lines.length && <p className={styles.empty}>В предложении нет позиций. Утверждать пока нечего.</p>}</> : <div className={styles.panelBody}>
          {proposal.kind === "outlier_review" ? <div className={review.evidenceBlock}><h3>Документ {proposal.payload.doc_no ?? "не указан"}</h3><p>Код 1с {proposal.payload.code_1c ?? "не указан"} · {proposal.payload.ym}</p><p><strong>{proposal.payload.state === "excluded" ? "Исключить из регулярного спроса" : proposal.payload.state === "kept" ? "Учесть в регулярном спросе" : "Результат не определён"}</strong></p></div> : <dl className={styles.facts}>{Object.entries(proposal.payload.changes ?? proposal.payload.after ?? {}).map(([key, value]) => <div key={key} className={review.changed}><dt>{fieldLabels[key] ?? key}</dt><dd>{(proposal.payload.current ?? proposal.payload.before)?.[key] !== undefined && <><del className={review.oldValue}>{valueText((proposal.payload.current ?? proposal.payload.before)?.[key])}</del> → </>}<strong>{valueText(value)}</strong></dd></div>)}</dl>}
          {editable && <fieldset className={review.choice}><legend>Ваше решение</legend><label><input type="radio" name="resolution" value="approve" checked={resolution === "approve"} onChange={() => setResolution("approve")} /><span>Применить подготовленное решение и пересчитать потребность</span></label><label><input type="radio" name="resolution" value="reject" checked={resolution === "reject"} onChange={() => setResolution("reject")} /><span>Отклонить предложение, оставить текущие данные</span></label></fieldset>}
        </div>}
      </section>
      <aside className={`${styles.stack} ${review.evidence}`} aria-label="Основания решения"><section className={styles.panel}><div className={styles.panelBody}><h2>Основание</h2><div className={review.evidenceBlock} id="proposal-evidence"><p>{proposal.rationale_ru || "Обоснование не указано."}</p>{proposal.sources.length ? <ul className={review.list}>{proposal.sources.map((source, i) => <li key={i}>{sourceText(source)}</li>)}</ul> : <p className={styles.rowNote}>Источники не указаны.</p>}</div><h3>Затронет…</h3>{proposal.affects.length ? <ul className={review.list}>{proposal.affects.map((item, i) => <li key={i}>{sourceText(item)}</li>)}</ul> : <p className={styles.rowNote}>Последствия не указаны в предложении.</p>}{proposal.money_at_stake && <p><strong>{money(proposal.money_at_stake)}</strong> · сумма по известным ценам</p>}{proposal.kind === "supplier_order" && lines.some(line => line.unit_cost == null) && <p className={`${styles.notice} ${styles.warning}`}>Есть позиции без себестоимости. Полная сумма заказа неизвестна; цены не заменены нулями.</p>}</div></section>
        <details className={`${styles.panel} ${styles.panelBody} ${styles.disclosure}`}><summary>Предыдущая версия</summary>{previous ? <><p>Версия {previous.version} · {previous.rationale_ru}</p><Link className={styles.linkButton} href={`/review/${encodeURIComponent(previous.id)}`}>Открыть предыдущую версию</Link></> : <p className={styles.subtitle}>Это первое предложение: предыдущая версия не указана.</p>}</details>
      </aside>
    </div>
    <footer className={review.footer}>
      {stale && editable && <div className={`${styles.notice} ${styles.warning}`} role="alert">Версия устарела. Ваш выбор и количества сохранены. Проверьте обновлённое предложение.{proposal.version !== boundVersion && <Button onClick={() => { setBoundVersion(proposal.version); setAcknowledgedVersion(proposal.version); }}>Проверено · использовать версию {proposal.version}</Button>}</div>}
      <p className={`${styles.status} ${action.error || validation ? styles.error : ""}`} role="status">{validation || (action.error?.status !== 409 ? action.error?.message : "") || action.receipt}</p>
      <div className={review.footerRow}><div><ResultLabels result={proposal} /><p className={review.footerMeta}>Решение по версии {boundVersion} · отправки поставщику нет</p></div><div className={styles.actions}>
        {createdOrder ? <Link className={styles.linkButton} href={`/orders/${encodeURIComponent(createdOrder)}`}><Check size={16} />Открыть заказ</Link> : editable ? <><Button disabled={action.busy || stale} busy={action.busy} onClick={() => decide("reject")}>Отклонить</Button><Button variant="primary" disabled={action.busy || stale || proposal.kind === "supplier_order" && !lines.length} busy={action.busy} onClick={() => decide(resolution === "reject" ? "reject" : "approve")}>{resolution === "reject" ? "Оставить текущие данные" : approvalVerbs[proposal.kind]}</Button></> : <Link className={styles.linkButton} href="/review">К очереди</Link>}
      </div></div>
    </footer>
  </>;
}
export function ProposalDesk({ id }: { id: string }) {
  const api = useApi<ProposalsResponse>("/api/proposals");
  const proposals = api.data?.proposals.map(hydrateProposal) ?? [];
  const proposal = proposals.find(item => item.id === id);
  return <div className={styles.page}><Link className={styles.linkButton} href="/review" style={{ justifySelf: "start" }}><ArrowLeft size={16} />К очереди</Link><header className={styles.heading}><p className={`${styles.eyebrow} ${styles.code}`}>{id}</p><h1>{proposal ? kindLabels[proposal.kind] : "Проверка предложения"}</h1>{proposal && <p className={styles.subtitle}>{proposal.payload.supplier_id ?? proposal.subject_id} · версия {proposal.version}</p>}</header>{api.loading && !api.data && <Skeleton lines={8} />}{api.error && <LoadError message={api.error.message} retry={api.reload} />}{api.data && !proposal && <div className={`${styles.panel} ${styles.empty}`}><h2>Предложение не найдено</h2><p>Проверьте актуальную очередь решений.</p><Link className={styles.linkButton} href="/review">Открыть очередь</Link></div>}{proposal && <ProposalReview key={id} proposal={proposal} previous={proposals.find(item => item.id === proposal.supersedes_id)} successor={proposals.find(item => item.supersedes_id === id && item.state === "needs_review")} />}</div>;
}
