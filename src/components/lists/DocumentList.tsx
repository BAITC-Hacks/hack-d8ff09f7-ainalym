"use client";
import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { TruthLabels, type TruthAxes } from "@/components/labels";
import { Button, EmptyState, LoadError, Skeleton, useApi } from "@/components/shell";
import { dateLabel } from "./format";
import { ListTools } from "./ListTools";
import styles from "./lists.module.css";
type ExportRecord = { id: string; external_identity: string; state: string; version: number; as_of: string; label?: string; axes?: TruthAxes; external?: TruthAxes["external"] };
type Artifact = { id: string; kind: string; title?: string; created_at?: string; po_id?: string; run_id?: string; axes?: TruthAxes };
export function DocumentList() {
  const exports = useApi<{ rows: ExportRecord[]; axes?: TruthAxes }>("/api/peers/onec-export/records");
  const drafts = useApi<{ artifacts?: Artifact[]; items?: Artifact[]; axes?: TruthAxes }>("/api/artifacts");
  const artifacts = drafts.data?.artifacts ?? drafts.data?.items ?? [];
  return <div className={styles.page}><ListTools /><header className={styles.header}><div><p className={styles.eyebrow}>ФАЙЛЫ И ЧЕРНОВИКИ</p><h1>Документы</h1><p className={styles.subtitle}>Экспорт заказов и подготовленные материалы по расчётам.</p></div><Button onClick={() => { exports.reload(); drafts.reload(); }}>Обновить</Button></header>
    <section aria-labelledby="export-list-heading"><h2 id="export-list-heading">Файлы для 1С</h2>{exports.error && <LoadError message={exports.error.message} retry={exports.reload} />}{exports.loading ? <Skeleton lines={3} /> : exports.data?.rows.length ? <ul className={styles.rows}>{exports.data.rows.map(row => <li key={row.id} className={styles.document}><FileText size={20} /><div className={styles.rowMain}><h3>{row.external_identity}</h3><p className={styles.meta}>{row.label} · {dateLabel(row.as_of)} · версия {row.version}</p><TruthLabels axes={row.axes ?? { ...exports.data?.axes, external: row.external }} /></div><div className={styles.downloads}>{["xlsx", "csv"].map(format => <a key={format} href={`/api/peers/onec-export/${encodeURIComponent(row.external_identity)}?format=${format}`}><Download size={14} aria-hidden="true" />{format.toUpperCase()}</a>)}</div></li>)}</ul> : !exports.error && <EmptyState>Экспортированных файлов пока нет. Файл создаётся после утверждения заказа.</EmptyState>}</section>
    <section aria-labelledby="draft-list-heading"><h2 id="draft-list-heading">Подготовленные материалы</h2>{drafts.error && <LoadError message={drafts.error.status === 404 ? "Список материалов пока недоступен. Сохранённый документ можно открыть из результата помощника." : drafts.error.message} retry={drafts.reload} />}{drafts.loading ? <Skeleton lines={3} /> : artifacts.length ? <ul className={styles.rows}>{artifacts.map(row => <li key={row.id} className={styles.document}><FileText size={20} /><div className={styles.rowMain}><h3>{row.title ?? (row.kind === "supplier_email" ? "Черновик письма поставщику" : "Итоги расчёта")}</h3><p className={styles.meta}>{dateLabel(row.created_at)} · {row.po_id ?? row.run_id ?? row.id}</p>{row.kind === "supplier_email" && <p className={styles.meta}>Черновик заказа — не отправлен</p>}<TruthLabels axes={row.axes ?? drafts.data?.axes} /></div><Link className={styles.actionLink} href={`/api/artifacts/${encodeURIComponent(row.id)}/download`}><Download size={14} />Скачать</Link></li>)}</ul> : !drafts.error && <EmptyState>Материалы ещё не подготовлены.</EmptyState>}</section>
  </div>;
}
