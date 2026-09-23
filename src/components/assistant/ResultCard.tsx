import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { TruthLabels, UrgencyChip } from "@/components/labels";
import { localHref, resultAxes, type AssistantResult } from "./types";
import styles from "./assistant.module.css";

export function ResultCard({ title, response }: { title: string; response: AssistantResult }) {
  const data = response.result ?? response;
  return <article className={styles.result} aria-label={title}>
    <header className={styles.resultHead}><Check size={16} aria-hidden="true" /><h3>{title}</h3></header>
    {response.reply_ru && <p className={styles.prose}>{response.reply_ru}</p>}
    {data.summary_ru && data.summary_ru !== response.reply_ru && <p className={styles.prose}>{data.summary_ru}</p>}
    {data.items && (data.items.length ? <ul className={styles.resultList}>{data.items.map(item => <li key={item.id}>{localHref(item.href) ? <Link href={localHref(item.href)!}>{item.title}<ArrowUpRight size={14} aria-hidden="true" /></Link> : <span>{item.title}</span>}</li>)}</ul> : <p>Сейчас нет решений, требующих вашего участия.</p>)}
    {data.run_id && <><p>Расчёт подготовлен{typeof data.recommended === "number" ? ` · рекомендаций: ${data.recommended}` : ""}.</p><p className={styles.meta}>Черновик заказа — не отправлен</p><Link className={styles.resultLink} href={`/purchases?run_id=${encodeURIComponent(data.run_id)}`}>Открыть расчёт <ArrowUpRight size={14} aria-hidden="true" /></Link></>}
    {data.top && data.top.length > 0 && <ul className={styles.resultList}>{data.top.map(row => <li key={row.code_1c}><Link href={`/skus/${encodeURIComponent(row.code_1c)}`}>{row.code_1c}</Link><span>{row.qty} шт.</span><UrgencyChip urgency={row.urgency} /></li>)}</ul>}
    {data.rationale_ru && <p className={styles.prose}>{data.rationale_ru}</p>}
    {data.code_1c && <>{!data.rationale_ru && <p>Обоснование для этого кода ещё не подготовлено.</p>}<Link className={styles.resultLink} href={`/skus/${encodeURIComponent(data.code_1c)}`}>Открыть товар {data.code_1c}<ArrowUpRight size={14} aria-hidden="true" /></Link></>}
    {data.outliers_excluded && data.outliers_excluded.length > 0 && <p className={styles.meta}>Исключено разовых документов: {data.outliers_excluded.length}</p>}
    {data.stockout_months && data.stockout_months.length > 0 && <p className={styles.meta}>Месяцев с компенсацией дефицита: {data.stockout_months.length}</p>}
    {data.replayed && <p className={styles.meta}>Повторный запрос · возвращён сохранённый результат.</p>}
    <TruthLabels axes={resultAxes(response)} />
    {typeof data.state_version === "number" && <p className={styles.meta}>Версия данных {data.state_version}</p>}
  </article>;
}
