import Link from "next/link";
import { ArrowUpRight, Check, CircleAlert } from "lucide-react";
import { TruthLabels, UrgencyChip } from "@/components/labels";
import { localHref, resultAxes, type AssistantResult } from "./types";
import styles from "./assistant.module.css";

/** Rewrites older-shell links onto the current shell prefix (e.g. "/v2"). Links already under the prefix are kept. */
function rebase(href: string, base?: string): string {
  if (!base || href.startsWith(`${base}/`)) return href;
  if (href.startsWith("/skus/")) return `${base}${href}`;
  if (href.startsWith("/purchases") || href.startsWith("/review") || href.startsWith("/proposals")) return `${base}/replenishment`;
  return href;
}

/** `plain` hides the internal truth chips so business users see only the answer; `base` maps links onto the current shell. */
export function ResultCard({ title, response, plain = false, base }: { title: string; response: AssistantResult; plain?: boolean; base?: string }) {
  const data = response.result ?? response;
  const failed = response.ok === false;
  const Icon = failed ? CircleAlert : Check;
  const to = (href?: string) => { const safe = localHref(href); return safe ? rebase(safe, base) : undefined; };
  return <article className={styles.result} aria-label={title}>
    <header className={styles.resultHead}><Icon size={16} aria-hidden="true" /><h3>{title}</h3></header>
    {response.reply_ru && <p className={styles.prose}>{response.reply_ru}</p>}
    {data.summary_ru && data.summary_ru !== response.reply_ru && <p className={styles.prose}>{data.summary_ru}</p>}
    {data.items && (data.items.length ? <ul className={styles.resultList}>{data.items.map(item => <li key={item.id}>{to(item.href) ? <Link href={to(item.href)!}>{item.title}<ArrowUpRight size={14} aria-hidden="true" /></Link> : <span>{item.title}</span>}{item.meta && <span className={styles.meta}>{item.meta}</span>}</li>)}</ul> : !failed && !response.reply_ru && <p>Сейчас нет решений, требующих вашего участия.</p>)}
    {data.run_id && <><p>Расчёт подготовлен{typeof data.recommended === "number" ? ` · рекомендаций: ${data.recommended}` : ""}.</p><p className={styles.meta}>Черновик заказа — не отправлен</p><Link className={styles.resultLink} href={rebase(`/purchases?run_id=${encodeURIComponent(data.run_id)}`, base)}>Открыть расчёт <ArrowUpRight size={14} aria-hidden="true" /></Link></>}
    {data.top && data.top.length > 0 && <ul className={styles.resultList}>{data.top.map(row => <li key={row.code_1c}><Link href={rebase(`/skus/${encodeURIComponent(row.code_1c)}`, base)}>{row.code_1c}</Link><span>{row.qty} шт.</span><UrgencyChip urgency={row.urgency} /></li>)}</ul>}
    {data.rationale_ru && <p className={styles.prose}>{data.rationale_ru}</p>}
    {data.code_1c && <>{!data.rationale_ru && <p>Обоснование для этого кода ещё не подготовлено.</p>}<Link className={styles.resultLink} href={rebase(`/skus/${encodeURIComponent(data.code_1c)}`, base)}>Открыть товар {data.code_1c}<ArrowUpRight size={14} aria-hidden="true" /></Link></>}
    {data.outliers_excluded && data.outliers_excluded.length > 0 && <p className={styles.meta}>Исключено разовых документов: {data.outliers_excluded.length}</p>}
    {data.stockout_months && data.stockout_months.length > 0 && <p className={styles.meta}>Месяцев с компенсацией дефицита: {data.stockout_months.length}</p>}
    {data.replayed && <p className={styles.meta}>Повторный запрос · показан сохранённый ответ.</p>}
    {!plain && <TruthLabels axes={resultAxes(response)} />}
  </article>;
}
