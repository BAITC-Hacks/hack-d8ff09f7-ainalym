"use client";
import Link from "next/link";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import { Chip, TruthAxisLabels, type TruthAxes } from "@/components/labels";
import { apiRequest, ApiError, Button, ActionStatus, EmptyState, LoadError, Skeleton, useApiAction } from "@/components/shell";
import type { QueueItem, QueueResponse, Money } from "./types";
import { formatMoney, safeHref } from "./format";
import { Sources } from "./Sources";
import styles from "./pulse.module.css";
function MoneyAtStake({ value }: { value?: Money | Money[] | null }) { return value ? <div className={styles.moneyAtStake}>{(Array.isArray(value) ? value : [value]).map(money => <span key={money.currency}>{formatMoney(money)}</span>)}</div> : null; }
async function resolveVersion(item: QueueItem): Promise<number> {
  if (Number.isInteger(item.proposal_version)) return item.proposal_version!;
  if (Number.isInteger(item.version)) return item.version!;
  const response = await apiRequest<{ proposals?: { id: string; version: number }[]; items?: { id: string; version: number }[] }>("/api/proposals?state=needs_review");
  const proposal = (response.proposals ?? response.items ?? []).find(row => row.id === item.id);
  if (!proposal || !Number.isInteger(proposal.version)) throw new ApiError(409, "stale", "Предложение изменилось. Откройте проверку новой версии.");
  return proposal.version;
}
export function QueueRow({ item, axes }: { item: QueueItem; axes?: TruthAxes }) {
  const action = useApiAction();
  return <li className={styles.queueRow}><div className={styles.rowHead}><Link href={safeHref(item.href, `/review/${encodeURIComponent(item.id)}`)}>{item.title}</Link><MoneyAtStake value={item.money_at_stake} /></div>
    <details className={styles.why}><summary>Почему?</summary><p>{item.why}</p><Sources sources={item.sources} /><TruthAxisLabels axes={item.axes ?? item.labels ?? axes} /></details>
    <div className={styles.rowOptions}>{item.options?.map(option => option.key === "approve" || option.key === "reject" ? <Button key={option.key} busy={action.busy} title={option.effect} onClick={() => action.run(async () => { const version = await resolveVersion(item); return apiRequest(`/api/proposals/${encodeURIComponent(item.id)}/${option.key}`, { method: "POST", body: JSON.stringify({ proposal_version: version }) }); }, option.key === "approve" ? "✓ Решение утверждено. Заказ не отправлен." : "✓ Предложение отклонено.")}>{option.label}</Button> : <Link className={styles.secondaryLink} title={option.effect} key={option.key} href={safeHref(item.href, `/review/${encodeURIComponent(item.id)}`)}>{option.label}</Link>)}</div><ActionStatus error={action.error} receipt={action.receipt} />
  </li>;
}
export function DecisionQueue({ data, error, loading, reload, axes }: { data?: QueueResponse; error: ApiError | null; loading: boolean; reload: () => void; axes?: TruthAxes }) {
  const first = data?.items[0];
  return <section className={styles.decisionSection} id="decision-primary" aria-labelledby="decision-title"><div className={styles.sectionHead}><h2 id="decision-title">Нужно ваше решение</h2>{data && <Chip>{data.items.length}</Chip>}</div>
    {error && <LoadError message={data ? "Не удалось обновить решения — показываю последнее известное." : error.message} retry={reload} />}
    {loading ? <div className={styles.decisionCard}><Skeleton lines={6} /></div> : first ? <article className={styles.decisionCard}>
      <div className={styles.eyebrow}><ClipboardCheck size={16} /><span>{first.supplier_id ? `Поставщик ${first.supplier_id}` : "Предложение к проверке"}</span><Chip tone="warning">ждёт вас</Chip></div>
      <h3 className={styles.decisionTitle}>{first.title}</h3><p className={styles.finding}>{first.why || "Обоснование не передано. Откройте предложение перед решением."}</p><MoneyAtStake value={first.money_at_stake} />
      {first.consequence && <p className={styles.consequence}>{first.consequence}</p>}
      <div className={styles.prepared}><span className={styles.label}>Что подготовлено</span>{first.prepared?.length ? <ul>{first.prepared.map(text => <li key={text}>{text}</li>)}</ul> : <p>Предложение для вашей проверки. Заказ поставщику не отправлен.</p>}</div>
      <TruthAxisLabels axes={first.axes ?? first.labels ?? axes} />
      <div className={styles.decisionActions}><Link className={styles.primaryLink} href={safeHref(first.href, `/review/${encodeURIComponent(first.id)}`)}>Проверить изменения <ArrowRight size={16} /></Link><details className={styles.why}><summary>Почему?</summary><p>{first.why}</p><Sources sources={first.sources} /></details></div>
    </article> : !error && <div className={styles.emptyDecision}><EmptyState>{data?.empty_reason === "domain pending" ? "Расчётный сервис готовится. Решения появятся после его запуска." : "Решений пока нет. Запустите расчёт — агенты подготовят рекомендации по поставщикам."}</EmptyState><a href="#calculation" className={styles.inlineLink}>К расчёту пополнения <ArrowRight size={14} /></a></div>}
    {data && data.items.length > 1 && <details className={styles.moreDecisions} open><summary>Ещё решения ({data.items.length - 1})</summary><ul>{data.items.slice(1, 60).map(item => <QueueRow key={item.id} item={item} axes={axes} />)}</ul>{data.items.length > 60 && <Link className={styles.inlineLink} href="/review">Все решения</Link>}</details>}
  </section>;
}
