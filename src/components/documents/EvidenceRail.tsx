"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ApiError, useApiSync } from "@/components/shell";
import { Card, Loading, Pill, Section, Truth, Unavailable, fmtMoney, fmtNum } from "@/components/v2/ui";
import { getPackage, setRoute, useLoaded } from "@/components/documents/client";
import { fixturePackage } from "@/components/documents/fixture";
import { DRAFT_RU, FIELD_RU, ITEM_RU, MONEY_FIELDS, ROUTE_RU, SOURCE_RU, STAGE_RU, type OrderPackage, type SupplyRoute } from "@/components/documents/types";
import styles from "./documents.module.css";

const ROUTES: SupplyRoute[] = ["domestic", "eaeu", "import"];
const plural = (n: number, one: string, few: string, many: string) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many; };
const scalar = (v: unknown): string => v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "да" : "нет") : String(v);

/** «Пакет документов» on the order page: stage rail, checklist with document links, agent drafts (never sent), editable route chip. */
export function EvidenceRail({ poId, supplierId }: { poId: string; supplierId: string }) {
  const { refresh } = useApiSync();
  const loaded = useLoaded(() => getPackage(poId), [poId]);
  // A local route change (fixture mode) overrides the loaded package until the next load for the same order.
  const [override, setOverride] = useState<{ poId: string; pkg: OrderPackage } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const pkg = override && override.poId === poId ? override.pkg : loaded.data;
  const fixture = loaded.source === "fixture";

  async function changeRoute(route: SupplyRoute) {
    if (busy || !pkg || route === pkg.route) return; setBusy(true); setNote("");
    try {
      const source = await setRoute(supplierId, route);
      if (source === "fixture") { setOverride({ poId, pkg: fixturePackage(route, pkg.items.some(x => x.document_id)) }); setNote(`Маршрут «${ROUTE_RU[route]}» применён локально — сервер документов не отвечает.`); }
      else { setOverride(null); setNote(`Маршрут поставщика сохранён: ${ROUTE_RU[route]}. Пакет пересчитан.`); refresh(); loaded.reload(); }
    } catch (e) { setNote(e instanceof ApiError ? e.message : "Маршрут не сохранён."); }
    finally { setBusy(false); }
  }

  const title = <>Пакет документов · маршрут: {pkg ? ROUTE_RU[pkg.route] : "…"}</>;
  if (loaded.error && !pkg) return <Section id="package" title={title}><Unavailable title="Пакет документов недоступен" detail={loaded.error.message} retry={loaded.reload} /></Section>;
  if (!pkg) return <Section id="package" title={title}><Loading label="Собираю пакет документов…" lines={3} /></Section>;
  const drafts = Object.entries(pkg.drafts ?? {}).filter(([, v]) => v && typeof v === "object");
  const missing = pkg.items.filter(x => x.status === "missing" && x.required).length;

  return <Section id="package" title={title} aside={<div className={styles.routeRow}>
    <label className={styles.routeChip}><span>маршрут</span><select aria-label="Маршрут поставки" value={pkg.route} disabled={busy} onChange={e => void changeRoute(e.target.value as SupplyRoute)}>{ROUTES.map(r => <option key={r} value={r}>{ROUTE_RU[r]}</option>)}</select><ChevronDown size={13} aria-hidden="true" /></label>
    {pkg.route_note_ru && <Truth>маршрут задан по умолчанию, уточните</Truth>}
  </div>}>
    <div className={styles.rail}>
      {note && <p className={`${styles.note} ${styles.noteGood}`} role="status" style={{ margin: 0 }}>{note}</p>}
      {fixture && <p className={styles.note} style={{ margin: 0 }}>Сервер документов не отвечает — показываю пакет на примере счёта IEK.</p>}
      <ol className={styles.stages} aria-label="Этапы пакета">
        {pkg.stage_rail.map(s => <li key={s.stage} data-state={s.state}><b>{STAGE_RU[s.stage]}</b><span>{ITEM_RU[s.state]?.label ?? s.state}</span></li>)}
      </ol>
      <div className={styles.items} role="list" aria-label="Документы пакета">
        {pkg.items.map(it => { const s = ITEM_RU[it.status] ?? { label: it.status, tone: "neutral" as const }; return <div key={it.key} className={styles.item} role="listitem">
          <span className={styles.cell}><b>{it.title_ru}</b><span>{STAGE_RU[it.stage]} · {SOURCE_RU[it.source]}{it.required ? "" : " · необязательно"}</span></span>
          <Pill tone={s.tone}>{s.label}</Pill>
          {it.document_id ? <Link href={`/documents/${encodeURIComponent(it.document_id)}`} prefetch={false}>открыть сверку</Link> : <span className={styles.dropMeta}>{it.status === "draft" ? "ниже" : ""}</span>}
        </div>; })}
      </div>
      <p className={styles.dropMeta} style={{ margin: 0 }}>{missing ? `${fmtNum(missing)} ${plural(missing, "обязательный документ", "обязательных документа", "обязательных документов")} ещё нет` : "все обязательные документы есть"} · <Truth>связи с Кеден, ЭСФ и 1С нет — только файлы и черновики</Truth></p>
      {drafts.length > 0 && <Card className={styles.drafts}>
        <p className={styles.draftsTitle}>Черновики агента — не отправлены</p>
        <p className={styles.draftsMeta}>Заполнены по строкам заказа{pkg.items.some(x => x.document_id) ? " и счёта" : ""}; проверка и подача остаются за менеджером.</p>
        {drafts.map(([k, v]) => <DraftBlock key={k} name={k} draft={v as Record<string, unknown>} />)}
      </Card>}
    </div>
  </Section>;
}

function DraftBlock({ name, draft }: { name: string; draft: Record<string, unknown> }) {
  const lines = Array.isArray(draft.lines) ? draft.lines as Record<string, unknown>[] : [];
  const fields = Object.entries(draft).filter(([k, v]) => k !== "lines" && k !== "label" && (v === null || typeof v !== "object"));
  const cols = lines.length ? Object.keys(lines[0]).filter(k => k !== "currency") : [];
  const cur = typeof draft.currency === "string" ? draft.currency : "KZT";
  return <details className={styles.draft}>
    <summary><span className={styles.cell}><b>{DRAFT_RU[name] ?? name}</b><span>{typeof draft.label === "string" ? draft.label : "Черновик подготовлен агентом — не отправлен"}{lines.length ? ` · ${fmtNum(lines.length)} ${plural(lines.length, "строка", "строки", "строк")}` : ""}</span></span><span>Открыть</span></summary>
    <dl className={styles.fields}>{fields.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{FIELD_RU[k] ?? k}</dt><dd>{scalar(v)}</dd></div>)}</dl>
    {lines.length > 0 && <div className={styles.sheetWrap}><table className={styles.sheet}>
      <thead><tr>{cols.map(c => <th key={c} className={MONEY_FIELDS.has(c) || c === "qty" ? styles.num : undefined}>{FIELD_RU[c] ?? c}</th>)}</tr></thead>
      <tbody>{lines.map((l, i) => <tr key={i}>{cols.map(c => <td key={c} className={MONEY_FIELDS.has(c) || c === "qty" ? styles.num : undefined}>{MONEY_FIELDS.has(c) && typeof l[c] === "string" ? fmtMoney(l[c] as string, cur) : c === "qty" ? fmtNum(l[c] as string) : scalar(l[c])}</td>)}</tr>)}</tbody>
    </table></div>}
  </details>;
}
