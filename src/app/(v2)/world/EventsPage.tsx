"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest, useApi, useApiAction, ActionStatus } from "@/components/shell";
import { Btn, Loading, PageHead, Pill, Unavailable, type Tone } from "@/components/v2/ui";
import { describe, dayKey, dayLabel, clock, type FeedEvent, type Who } from "./sentence";
import styles from "./events.module.css";

type Feed = { rows?: FeedEvent[]; events?: FeedEvent[] };
type Sku = { code_1c: string; name: string; image_url?: string | null };
const WHO_TONE: Record<Who, Tone> = { "ИИ-Помощник": "accent", "менеджер": "neutral", "поставщик": "warn", "1С-файл": "good" };
const when = (e: FeedEvent) => e.at ?? e.emitted_at ?? e.processed_at ?? "";

export function EventsPage() {
  const feed = useApi<Feed>("/api/world/feed");
  const demo = useApiAction();
  const events = useMemo(() => (feed.data?.rows ?? feed.data?.events ?? []).slice().sort((a, b) => when(b).localeCompare(when(a)) || b.id.localeCompare(a.id)), [feed.data]);
  const [skus, setSkus] = useState<Record<string, Sku>>({});
  const codes = useMemo(() => Array.from(new Set(events.map(e => describe(e, () => null).code).filter((c): c is string => !!c))).slice(0, 24), [events]);
  useEffect(() => {
    const missing = codes.filter(c => !skus[c]); if (!missing.length) return;
    let alive = true;
    Promise.all(missing.map(c => apiRequest<{ items?: Sku[] }>(`/api/skus?q=${encodeURIComponent(c)}&limit=3`).then(r => r.items?.find(s => s.code_1c === c) ?? null).catch(() => null)))
      .then(found => { if (!alive) return; setSkus(prev => { const next = { ...prev }; found.forEach((s, i) => { if (s) next[missing[i]] = s; }); return next; }); });
    return () => { alive = false; };
  }, [codes, skus]);
  const name = (c: string) => skus[c]?.name?.replace(/\s+/g, " ") ?? null;
  const days = useMemo(() => { const m = new Map<string, FeedEvent[]>(); for (const e of events) { const k = dayKey(when(e)) || "Без даты"; (m.get(k) ?? m.set(k, []).get(k)!).push(e); } return Array.from(m.entries()); }, [events]);
  const sample = () => demo.run(() => apiRequest<{ processed: number; seeded: number }>("/api/world/demo", { method: "POST", body: JSON.stringify({ steps: 3 }) }),
    r => { feed.reload(); return r.processed === 0 && r.seeded === 0 ? "Пример дня уже показан — новых событий нет." : `Добавлено событий: ${r.processed}`; });

  return <div className={styles.page}>
    <PageHead crumbs={[{ label: "События" }]} title="События" sub="Что произошло со складом, заказами и деньгами — и что сделал ИИ-Помощник."
      actions={<div className={styles.sample}><Btn onClick={sample} busy={demo.busy}>Показать пример дня</Btn><span className={styles.hint}>Воспроизведёт один образцовый день: файлы из 1С, правки менеджера и ответ поставщика.</span></div>} />
    <ActionStatus error={demo.error} receipt={demo.receipt} />
    {feed.error && !feed.data && <Unavailable title="События сейчас недоступны" detail="Не удалось загрузить ленту событий." retry={feed.reload} />}
    {feed.loading && !feed.data ? <Loading label="Загружаю события…" /> : events.length === 0 && !feed.error ? <div className={styles.empty}>
      <p className={styles.emptyTitle}>Пока событий нет</p>
      <p className={styles.emptyBody}>Они появятся, когда придут файлы из 1С или изменится заказ. <Link href="/settings">Настроить обмен с 1С</Link></p>
    </div> : days.map(([key, list]) => <section key={key} className={styles.day} aria-label={dayLabel(key)}>
      <h2 className={styles.dayTitle}>{dayLabel(key)}<span className={styles.dayCount}>{list.length}</span></h2>
      <ol className={styles.list}>{list.map(e => { const s = describe(e, name); const img = s.code ? skus[s.code]?.image_url : null; return <li key={e.id} className={styles.event}>
        <time className={styles.time} dateTime={when(e) || undefined}>{clock(when(e))}</time>
        <div className={styles.media} aria-hidden="true">{img ? <img src={img} alt="" width={40} height={40} loading="lazy" decoding="async" /> : <span className={styles.mediaNone} />}</div>
        <div className={styles.body}>
          <p className={styles.text}>{s.text}</p>
          <div className={styles.meta}><Pill tone={WHO_TONE[s.who]}>{s.who}</Pill>{s.link && <Link href={s.link.href} className={styles.link}>{s.link.label} →</Link>}</div>
        </div>
      </li>; })}</ol>
    </section>)}
  </div>;
}
