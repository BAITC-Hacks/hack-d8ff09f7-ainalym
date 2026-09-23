"use client";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { ApiError, useApiSync } from "@/components/shell";
import { Btn, Card, Loading, PageHead, Pill, Section, StaleBanner, Truth, Unavailable, fmtMoney, fmtNum, type Tone } from "@/components/v2/ui";
import { acceptDocument, getDocument, previewUrl, useLoaded } from "@/components/documents/client";
import { KIND_RU, LINE_RU, MODE_RU, STATE_RU, hasMatch, type IntakeDocument } from "@/components/documents/types";
import { FileIcon } from "../DocumentsInbox";
import styles from "@/components/documents/documents.module.css";

const fmtSize = (n: number | null | undefined) => n == null ? null : n >= 1_048_576 ? `${(n / 1_048_576).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`;
const ext = (name: string | null) => (name?.split(".").pop() ?? "").toUpperCase();
const MIME_RU: Record<string, string> = { "application/pdf": "PDF", "image/jpeg": "фото JPEG", "image/png": "изображение PNG", "image/webp": "изображение WebP", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "таблица Excel (xlsx)", "text/csv": "таблица CSV", "application/csv": "таблица CSV", "text/plain": "текст" };
type Local = { rejected?: boolean; note?: string; accepted?: boolean };
const key = (id: string) => `documents.local.${id}`;
const parseLocal = (raw: string): Local => { try { return JSON.parse(raw) as Local; } catch { return {}; } };
const subscribe = (cb: () => void) => { window.addEventListener("storage", cb); return () => window.removeEventListener("storage", cb); };

export function DocumentReview({ id }: { id: string }) {
  const { refresh } = useApiSync();
  const loaded = useLoaded(() => getDocument(id), [id]);
  // The accepted response replaces the loaded document until the next load of the same id.
  const [override, setOverride] = useState<IntakeDocument | undefined>(undefined);
  const doc = override && override.id === id ? override : loaded.data;
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState("");
  const [status, setStatus] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  // Decisions taken without the server (reject, fixture accept) live in this window's sessionStorage.
  const raw = useSyncExternalStore(subscribe, () => { try { return sessionStorage.getItem(key(id)) ?? "{}"; } catch { return "{}"; } }, () => "{}");
  const local = useMemo(() => parseLocal(raw), [raw]);
  const save = (next: Local) => { try { sessionStorage.setItem(key(id), JSON.stringify(next)); window.dispatchEvent(new Event("storage")); } catch { /* storage may be unavailable */ } };

  if (loaded.error && !doc) return <>
    <PageHead crumbs={[{ href: "/documents", label: "Документы" }, { label: "Сверка" }]} title={loaded.error.status === 404 ? "Документ не найден" : "Документ недоступен"} />
    <Unavailable title={loaded.error.status === 404 ? `Документа «${id}» нет во входящих` : "Не удалось прочитать документ"} detail={loaded.error.status === 404 ? "Он мог быть загружен в другой базе. Вернитесь во «Входящие» и откройте документ из списка." : loaded.error.message} retry={loaded.reload} />
  </>;
  if (!doc) return <><PageHead crumbs={[{ href: "/documents", label: "Документы" }, { label: "Сверка" }]} title="Сверка документа" /><Loading label="Читаю документ…" /></>;

  const fixture = loaded.source === "fixture";
  const m = hasMatch(doc) ? doc.match : null;
  const cur = doc.extracted.currency ?? "KZT";
  const effectiveState = local.rejected ? "rejected" : local.accepted && fixture ? "accepted" : doc.state;
  const state = effectiveState === "rejected" ? { label: "отклонён", tone: "bad" as Tone } : STATE_RU[effectiveState] ?? { label: effectiveState, tone: "neutral" as Tone };
  const mode = MODE_RU[String(doc.extraction_mode)] ?? "извлечено";
  const image = previewUrl(doc.id);
  const isSheet = !!doc.mime && (doc.mime.includes("spreadsheet") || doc.mime.includes("csv") || doc.mime === "text/plain");
  const done = effectiveState === "accepted" || effectiveState === "rejected";

  async function accept() {
    if (busy || !doc) return; setBusy(true); setStale(""); setStatus("");
    try {
      if (fixture) { save({ accepted: true }); setStatus("Пример принят локально — сервер документов не отвечает, запись не создана."); }
      else { const next = await acceptDocument(doc.id, doc.version); setOverride(next); setStatus(`Документ принят · версия ${next.version}. Он засчитан в пакете заказа.`); refresh(); }
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(500, "unknown", "Действие не выполнено.");
      if (err.status === 409) { setStale(err.code === "already_accepted" ? "Документ уже принят — показываю актуальную версию." : "Данные обновились — документ изменился. Показываю актуальную версию."); loaded.reload(); }
      else setStatus(err.message);
    } finally { setBusy(false); }
  }
  function reject() { save({ rejected: true, note: note.trim() }); setRejecting(false); setStatus("Документ отклонён. Решение сохранено в этом окне; поставщику ничего не отправлено."); }

  return <>
    {stale && <StaleBanner>{stale}</StaleBanner>}
    <PageHead crumbs={[{ href: "/documents", label: "Документы" }, { label: doc.extracted.number ? `№ ${doc.extracted.number}` : doc.file_name ?? "документ" }]}
      title={doc.extracted.number ? `${KIND_RU[doc.kind] ? KIND_RU[doc.kind][0].toUpperCase() + KIND_RU[doc.kind].slice(1) : "Документ"} № ${doc.extracted.number}` : doc.file_name ?? "Документ"}
      badges={<><Pill tone={state.tone}>{state.label}</Pill><Pill tone={doc.extraction_mode === "unavailable" ? "warn" : "neutral"}>{mode}</Pill>{fixture && <Pill tone="neutral">пример без сервера</Pill>}</>}
      sub={<>{doc.extracted.supplier ?? doc.supplier_id ?? "поставщик не определён"}{doc.po_id ? <> · заказ {fixture ? doc.po_id : <Link href={`/orders/${encodeURIComponent(doc.po_id)}`}>{doc.po_id}</Link>}</> : " · заказ не определён"} · версия {doc.version}</>}
      actions={done ? undefined : <><Btn onClick={() => setRejecting(v => !v)} disabled={busy}>Отклонить</Btn><Btn variant="black" busy={busy} onClick={accept}>Принять · версия {doc.version}</Btn></>} />
    {status && <p className={`${styles.note} ${styles.noteGood}`} role="status">{status}</p>}
    {rejecting && !done && <form className={styles.reject} onSubmit={e => { e.preventDefault(); reject(); }} style={{ marginBottom: 24 }}>
      <label className={styles.dropMeta} htmlFor="reject-note">Причина отклонения — останется в этом окне, поставщику не уходит</label>
      <textarea id="reject-note" value={note} onChange={e => setNote(e.target.value)} placeholder="Например: количество по строке 1 не подтверждено поставщиком" />
      <div className={styles.actions} style={{ marginTop: 0 }}><Btn variant="black" type="submit">Подтвердить отклонение</Btn><Btn variant="quiet" onClick={() => setRejecting(false)}>Отмена</Btn></div>
    </form>}
    {local.rejected && local.note && <p className={styles.note}>Причина отклонения: {local.note}</p>}
    {doc.extracted.note_ru && <p className={`${styles.note} ${doc.extraction_mode === "unavailable" ? styles.noteBad : ""}`}>{doc.extracted.note_ru}</p>}
    <div className={styles.panes}>
      <div className={styles.pane}>
        <Section id="file" title="Файл" aside={<Truth>хранится в приложении · никуда не отправляется</Truth>}>
          <Card className={styles.preview}>
            <div className={styles.previewHead}><FileIcon mime={doc.mime} /><span><b>{doc.file_name ?? "без имени"}</b><br />{[doc.mime ? MIME_RU[doc.mime] ?? doc.mime : null, fmtSize(doc.size), doc.sha256 ? `sha256 ${doc.sha256.slice(0, 12)}…` : null].filter(Boolean).join(" · ")}</span></div>
            {image ? <img className={styles.previewImg} src={image} alt={`Изображение документа ${doc.file_name ?? ""}`} />
              : isSheet && doc.extracted.lines.length ? <><div className={styles.sheetWrap}><table className={styles.sheet}>
                  <thead><tr><th>Код 1С</th><th>Артикул</th><th>Наименование</th><th className={styles.num}>Кол-во</th><th>Ед</th><th className={styles.num}>Цена</th><th className={styles.num}>Сумма</th></tr></thead>
                  <tbody>{doc.extracted.lines.map((l, i) => <tr key={i}><td>{l.code_1c ?? "—"}</td><td>{l.article ?? "—"}</td><td>{l.name}</td><td className={styles.num}>{fmtNum(l.qty)}</td><td>{l.unit ?? "—"}</td><td className={styles.num}>{l.price ? fmtMoney(l.price, cur) : "—"}</td><td className={styles.num}>{l.amount ? fmtMoney(l.amount, cur) : "—"}</td></tr>)}</tbody>
                </table></div><p className={styles.sheetCaption}>Таблица из файла: {fmtNum(doc.extracted.lines.length)} строк · заголовки распознаны по синонимам (код, артикул, наименование, кол-во, цена, сумма)</p></>
              : <div className={styles.previewCard}><b>{doc.mime === "application/pdf" ? "PDF" : doc.mime?.startsWith("image/") ? "Фото" : ext(doc.file_name) || "Файл"}</b><p>{doc.file_name ?? "без имени"}{fmtSize(doc.size) ? ` · ${fmtSize(doc.size)}` : ""}</p><p>{doc.mime?.startsWith("image/") ? "Изображение показывается только в окне, где оно было загружено; строки ниже извлечены из него." : doc.extraction_mode === "unavailable" ? "Строки не извлечены: без ключа модели распознавание файла недоступно." : "Содержимое файла не отображается; строки справа извлечены из него."}</p></div>}
          </Card>
        </Section>
      </div>
      <div className={styles.pane}>
        <Section id="extracted" title="Извлечено" aside={<Truth>{mode}</Truth>}>
          <dl className={styles.header}>
            <div><dt>Поставщик</dt><dd>{doc.extracted.supplier ?? "—"}</dd></div>
            <div><dt>№ документа</dt><dd>{doc.extracted.number ?? "—"}</dd></div>
            <div><dt>Дата</dt><dd>{doc.extracted.date ?? "—"}</dd></div>
            <div><dt>Валюта</dt><dd>{doc.extracted.currency ?? "—"}</dd></div>
            <div><dt>Итого</dt><dd className={styles.num}>{m ? fmtMoney(m.summary.total_doc, cur) : doc.extracted.lines.length ? fmtMoney(doc.extracted.lines.reduce((s, l) => s + Number(l.amount ?? 0), 0).toFixed(2), cur) : "—"}</dd></div>
          </dl>
          {m ? <>
            <p className={styles.strip}><span>строк совпало <b>{fmtNum(m.summary.matched)}</b> из {fmtNum(m.lines.length)}</span><span>расхождений <b className={m.summary.discrepancies ? styles.numBad : undefined}>{fmtNum(m.summary.discrepancies)}</b></span><span>по документу <b>{fmtMoney(m.summary.total_doc, cur)}</b></span><span>по заказу <b>{fmtMoney(m.summary.total_po, cur)}</b></span>{m.three_way && <span>приёмка учтена</span>}</p>
            <div className={styles.lines} role="table" aria-label="Строки документа и заказа">
              <div className={styles.lhead} role="row"><span role="columnheader">Позиция</span><span role="columnheader" className={styles.right}>В документе</span><span role="columnheader" className={styles.right}>В заказе</span><span role="columnheader" className={styles.right}>Принято на склад</span><span role="columnheader" className={styles.right}>Цена · док / заказ</span><span role="columnheader">Сверка</span></div>
              {m.lines.map((l, i) => { const s = LINE_RU[l.status] ?? { label: l.status, tone: "neutral" as Tone }; return <div key={`${l.code_1c ?? l.name}-${i}`} className={styles.ltr} role="row" data-status={l.status}>
                <span role="cell" className={styles.cell}><b>{l.name}</b><span>{l.article ?? "без артикула"}{l.code_1c ? <> · <Link href={`/skus/${encodeURIComponent(l.code_1c)}`}>{l.code_1c}</Link></> : null}</span></span>
                <span role="cell" className={`${styles.cell} ${styles.num}`}><b>{l.status === "missing_in_doc" ? "—" : fmtNum(l.qty_doc)}</b></span>
                <span role="cell" className={`${styles.cell} ${styles.num}`}><b className={l.status === "qty_diff" ? styles.numBad : undefined}>{l.qty_po == null ? "—" : fmtNum(l.qty_po)}</b></span>
                <span role="cell" className={`${styles.cell} ${styles.num}`}><b>{l.qty_received == null ? (m.three_way ? "0" : "—") : fmtNum(l.qty_received)}</b><span>{m.three_way ? "" : "приёмки нет"}</span></span>
                <span role="cell" className={`${styles.cell} ${styles.num}`}><b className={l.status === "price_diff" ? styles.numBad : undefined}>{l.price_doc ? fmtMoney(l.price_doc, cur) : "—"}</b><span>{l.unit_cost_po ? fmtMoney(l.unit_cost_po, cur) : "цена в заказе не задана"}</span></span>
                <span role="cell"><Pill tone={s.tone}>{s.label}</Pill></span>
              </div>; })}
            </div>
          </> : <>
            <p className={styles.strip}><span>строк <b>{fmtNum(doc.extracted.lines.length)}</b></span><span>{doc.po_id ? "сверка не выполнена" : "заказ не определён — сверять не с чем"}</span></p>
            {doc.extracted.lines.length > 0 && !isSheet && <div className={styles.sheetWrap}><table className={styles.sheet}>
              <thead><tr><th>Наименование</th><th className={styles.num}>Кол-во</th><th className={styles.num}>Цена</th><th className={styles.num}>Сумма</th></tr></thead>
              <tbody>{doc.extracted.lines.map((l, i) => <tr key={i}><td>{l.name}<br /><span className={styles.dropMeta}>{[l.article, l.code_1c].filter(Boolean).join(" · ")}</span></td><td className={styles.num}>{fmtNum(l.qty)}</td><td className={styles.num}>{l.price ? fmtMoney(l.price, cur) : "—"}</td><td className={styles.num}>{l.amount ? fmtMoney(l.amount, cur) : "—"}</td></tr>)}</tbody>
            </table></div>}
          </>}
          <p className={styles.dropMeta} style={{ marginTop: 14 }}><Truth>Строки сверены локально с заказом{m?.three_way ? " и актом приёмки" : ""} · данные партнёра · обезличены</Truth></p>
        </Section>
      </div>
    </div>
  </>;
}
