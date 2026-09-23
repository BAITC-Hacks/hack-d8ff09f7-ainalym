"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";
import { FileSpreadsheet, FileText, Image as ImageIcon, Upload } from "lucide-react";
import { ApiError, useApiSync } from "@/components/shell";
import { Btn, Empty, Loading, PageHead, Pill, Section, Truth, Unavailable, fmtMoney, fmtNum, useRowKeys } from "@/components/v2/ui";
import { ingestFixture, listDocuments, uploadDocument, useLoaded } from "@/components/documents/client";
import { KIND_RU, MODE_RU, STATE_RU, hasMatch, needsAttention, type IntakeDocument } from "@/components/documents/types";
import styles from "@/components/documents/documents.module.css";

const ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,.xlsx,.csv,image/jpeg,image/png,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";
const when = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };
const plural = (n: number, one: string, few: string, many: string) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many; };
export function FileIcon({ mime }: { mime: string | null }) {
  const Icon = mime?.startsWith("image/") ? ImageIcon : mime?.includes("spreadsheet") || mime?.includes("csv") ? FileSpreadsheet : FileText;
  return <span className={styles.fileIcon} aria-hidden="true"><Icon size={15} strokeWidth={1.75} /></span>;
}

export function DocumentsInbox() {
  const router = useRouter();
  const { refresh } = useApiSync();
  const list = useLoaded(listDocuments, []);
  const [busy, setBusy] = useState<"example" | "upload" | null>(null);
  const [note, setNote] = useState<{ tone: "good" | "bad" | "plain"; text: string } | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const table = useRef<HTMLDivElement>(null);
  useRowKeys(table);
  const docs = list.data ?? [];
  const attention = docs.filter(needsAttention).length;

  async function example() {
    if (busy) return; setBusy("example"); setNote(null);
    try {
      const r = await ingestFixture();
      setNote({ tone: r.source === "api" ? "good" : "plain", text: r.source === "api" ? `Пример принят: счёт № ${r.data.extracted.number ?? "без номера"}, ${fmtNum(r.data.extracted.lines.length)} строк. Открываю сверку.` : "Сервер документов не отвечает — показываю встроенный пример без записи." });
      refresh(); router.push(`/documents/${encodeURIComponent(r.data.id)}`);
    } catch (e) { setNote({ tone: "bad", text: e instanceof ApiError ? e.message : "Пример не загружен." }); }
    finally { setBusy(null); }
  }
  async function upload(files: FileList | File[] | null) {
    const file = files?.[0]; if (!file || busy) return; setBusy("upload"); setNote(null);
    try {
      const r = await uploadDocument(file);
      setNote({ tone: "good", text: `«${file.name}» принят: ${fmtNum(r.data.extracted.lines.length)} строк, ${MODE_RU[String(r.data.extraction_mode)] ?? "извлечено"}.` });
      refresh(); router.push(`/documents/${encodeURIComponent(r.data.id)}`);
    } catch (e) { setNote({ tone: "bad", text: e instanceof ApiError ? e.message : "Файл не принят." }); }
    finally { setBusy(null); if (input.current) input.current.value = ""; }
  }
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); void upload(e.dataTransfer.files); };

  return <>
    <PageHead crumbs={[{ href: "/today", label: "Сегодня" }, { label: "Документы" }]} title="Документы"
      badges={attention > 0 ? <Pill tone="warn">{fmtNum(attention)} {plural(attention, "требует", "требуют", "требуют")} внимания</Pill> : docs.length ? <Pill tone="good">все приняты</Pill> : null}
      sub={<>счета, накладные и фото от поставщиков · агент извлекает строки и сверяет с заказом{list.source === "fixture" ? " · пример без сервера" : ""}</>} />
    <div className={`${styles.drop} ${over ? styles.dropOver : ""}`} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop} aria-label="Область загрузки">
      <div className={styles.dropText}>
        <p className={styles.dropTitle}>Перетащите счёт, накладную или фото — агент извлечёт строки и сверит с заказом</p>
        <p className={styles.dropMeta}>jpg, png, webp, pdf, xlsx, csv · до 10 МБ · файл остаётся в приложении, никуда не отправляется</p>
      </div>
      <div className={styles.dropActions}>
        <input ref={input} className={styles.dropInput} type="file" accept={ACCEPT} onChange={e => void upload(e.target.files)} aria-label="Выбрать файл" />
        <Btn busy={busy === "upload"} onClick={() => input.current?.click()}><Upload size={15} aria-hidden="true" />Выбрать файл</Btn>
        <Btn variant="primary" busy={busy === "example"} onClick={example}>Загрузить пример</Btn>
      </div>
    </div>
    {note && <p className={`${styles.note} ${note.tone === "bad" ? styles.noteBad : note.tone === "good" ? styles.noteGood : ""}`} role="status">{note.text}</p>}
    <Section id="inbox" title="Входящие" count={docs.length} aside={<Truth>j / k — по строкам · Enter — открыть сверку</Truth>}>
      {list.loading && !list.data && <Loading label="Читаю документы…" />}
      {list.error && !list.data && <Unavailable title="Документы недоступны" detail={list.error.message} retry={list.reload} />}
      {list.data && docs.length === 0 && <Empty title="Входящих документов пока нет">Перетащите файл поставщика или нажмите «Загрузить пример» — агент извлечёт строки и сверит их с заказом.</Empty>}
      {docs.length > 0 && <div className={styles.table} ref={table} role="table" aria-label="Входящие документы">
        <div className={styles.thead} role="row">
          <span role="columnheader">Документ</span><span role="columnheader">Вид</span><span role="columnheader">Поставщик</span><span role="columnheader">Заказ</span>
          <span role="columnheader" className={styles.right}>Извлечено</span><span role="columnheader" className={styles.right}>Расхождения</span><span role="columnheader">Состояние</span><span role="columnheader" className={styles.right}>Дата</span>
        </div>
        {docs.map(d => <InboxRow key={d.id} doc={d} fixture={list.source === "fixture"} />)}
      </div>}
    </Section>
    <p className={styles.dropMeta} style={{ marginTop: -16 }}><Truth>Данные партнёра · обезличены</Truth> · <Truth>Документы читаются локально · связи с Кеден, ЭСФ и 1С нет</Truth></p>
  </>;
}

function InboxRow({ doc, fixture }: { doc: IntakeDocument; fixture: boolean }) {
  const state = STATE_RU[doc.state] ?? { label: doc.state, tone: "neutral" as const };
  const m = hasMatch(doc) ? doc.match : null;
  const disc = m?.summary.discrepancies ?? 0;
  return <Link href={`/documents/${encodeURIComponent(doc.id)}`} className={styles.tr} role="row" data-row prefetch={false}>
    <span role="cell" className={styles.lead}><FileIcon mime={doc.mime} /><span className={styles.cell}><b>{doc.extracted.number ? `№ ${doc.extracted.number}` : doc.file_name ?? "документ"}</b><span>{doc.file_name ?? "—"}{doc.extracted.date ? ` · ${doc.extracted.date}` : ""}</span></span></span>
    <span role="cell" className={styles.cell}><b>{KIND_RU[doc.kind] ?? doc.kind}</b><span>{doc.source === "fixture" ? "пример" : doc.source === "upload" ? "загружен" : "событие"}</span></span>
    <span role="cell" className={styles.cell}><b>{doc.extracted.supplier ?? doc.supplier_id ?? "—"}</b><span>{doc.extracted.buyer ?? ""}</span></span>
    <span role="cell" className={styles.cell}>{doc.po_id ? <><b>{fixture ? doc.po_id : doc.po_id.length > 14 ? `${doc.po_id.slice(0, 11)}…` : doc.po_id}</b><span>{m ? (m.three_way ? "сверка с заказом и приёмкой" : "сверка с заказом") : "заказ определён"}</span></> : <><b>не определён</b><span>заказ не найден по строкам</span></>}</span>
    <span role="cell" className={`${styles.cell} ${styles.num}`}><b>{fmtNum(doc.extracted.lines.length)} {plural(doc.extracted.lines.length, "строка", "строки", "строк")}</b><span>{m ? fmtMoney(m.summary.total_doc, doc.extracted.currency ?? "KZT") : MODE_RU[String(doc.extraction_mode)] ?? "—"}</span></span>
    <span role="cell" className={`${styles.cell} ${styles.num}`}><b className={disc ? styles.numBad : undefined}>{m ? fmtNum(disc) : "—"}</b><span>{m ? `из ${fmtNum(m.lines.length)}` : "без сверки"}</span></span>
    <span role="cell"><Pill tone={state.tone}>{state.label}</Pill></span>
    <span role="cell" className={`${styles.cell} ${styles.num}`}><b>{when(doc.created_at)}</b><span>{MODE_RU[String(doc.extraction_mode)]?.split(" ")[1] ?? ""}</span></span>
  </Link>;
}
