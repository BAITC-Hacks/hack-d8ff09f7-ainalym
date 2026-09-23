"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest, useApi, useApiSync } from "@/components/shell/api";
import { Btn, Card, Loading, PageHead, Section, StaleBanner, Unavailable, fmtDate, fmtNum } from "@/components/v2/ui";
import styles from "./settings.module.css";

type Supplier = { id: string; lead_time_days: number; review_days: number; currency: string; version: number; prepay_pct: number; service_level: number };
type Params = { suppliers: Supplier[]; org: { opening_cash: { amount: string; currency: string; as_of: string | null } | null; currency: string; data_as_of: string | null }; cost: { skus_total: number; skus_without_cost: number }; ai?: string };
type Modes = { ai_routing?: string; ai?: string; sources?: { as_of: string }[] };

const NAME: Record<string, string> = { IEK: "IEK", SE: "Systeme Electric" };
const CURRENCIES = ["KZT", "USD", "EUR", "RUB", "CNY"];
const README_RUN = "https://github.com/BAITC-Hacks/hack-d8ff09f7-ainalym#7-установка-и-запуск";
const README_DATA = "https://github.com/BAITC-Hacks/hack-d8ff09f7-ainalym#9-данные-и-интеграции";
const AI_WORDS: Record<string, string> = { live: "отвечает живая модель", rules: "работает по правилам, без внешней модели", replay: "показывает записанные ответы", unavailable: "внешняя модель сейчас недоступна — работают правила" };

export function SettingsPage() {
  const { data, error, loading, reload } = useApi<Params>("/api/params");
  const modes = useApi<Modes>("/api/modes");
  const { refresh } = useApiSync();
  useEffect(() => { if (!data || typeof window === "undefined" || !window.location.hash) return; const el = document.getElementById(window.location.hash.slice(1)); el?.scrollIntoView({ block: "start" }); (el?.querySelector("input,select") as HTMLElement | null)?.focus(); }, [data]);
  if (loading && !data) return <><PageHead crumbs={[{ label: "Настройки" }]} title="Настройки" /><Loading label="Открываю настройки…" /></>;
  if (error && !data) return <><PageHead crumbs={[{ label: "Настройки" }]} title="Настройки" /><Unavailable title="Настройки пока недоступны" detail="Попробуйте ещё раз через минуту." retry={reload} /></>;
  if (!data) return null;
  return <div className={styles.page}>
    {error && <StaleBanner>Обновление не удалось — показываю последние сохранённые значения.</StaleBanner>}
    <PageHead crumbs={[{ label: "Настройки" }]} title="Настройки" sub="Всё, что нужно заполнить, чтобы разделы считали полностью. Под каждым полем — зачем оно." />
    <MoneyForm data={data} onSaved={() => { reload(); refresh(); }} />
    <SupplyForm data={data} onSaved={() => { reload(); refresh(); }} />
    <Section id="cost" title="Себестоимость">
      <Card>
        <p className={styles.count}>{fmtNum(data.cost.skus_without_cost)} <span className={styles.unit}>товаров без себестоимости из {fmtNum(data.cost.skus_total)}</span></p>
        <p className={styles.costText}>Себестоимость берётся из прайс-листа 1С. У Systeme Electric она в выгрузке есть, у IEK — нет, поэтому заказы и склад по IEK показываются в штуках, а не в деньгах. Здесь мы ничего не придумываем: цена появится, когда появится файл.</p>
        <div className={styles.options}>
          <p className={styles.option}><a href={README_RUN} target="_blank" rel="noreferrer">Как загрузить прайс-лист из 1С</a><span className={styles.why}>инструкция по запуску: положите файл к остальным выгрузкам и обновите данные</span></p>
          <p className={styles.option}><a href={README_DATA} target="_blank" rel="noreferrer">Какие файлы уже загружены</a><span className={styles.why}>список выгрузок и что из них берётся</span></p>
        </div>
      </Card>
    </Section>
    <Section id="sources" title="Откуда данные">
      <div className={styles.sources}>
        <p><b>1С</b> — отчёты загружаются файлами; последняя загрузка {data.org.data_as_of ? fmtDate(data.org.data_as_of) : "ещё не выполнялась"}.</p>
        <p><b>Поставщики</b> — заказ и письмо готовятся здесь, ничего не отправляется автоматически; отправляете вы.</p>
        <p><b>Помощник</b> — {AI_WORDS[modes.data?.ai ?? data.ai ?? "rules"] ?? AI_WORDS.rules}.</p>
      </div>
    </Section>
  </div>;
}

function Field({ id, label, why, children }: { id: string; label: string; why: string; children: ReactNode }) {
  return <div className={styles.field} id={id}><label className={styles.label} htmlFor={`${id}-input`}>{label}</label><div className={styles.control}>{children}</div><p className={styles.why}>{why}</p></div>;
}

function MoneyForm({ data, onSaved }: { data: Params; onSaved: () => void }) {
  const [amount, setAmount] = useState(data.org.opening_cash?.amount ?? "");
  const [asOf, setAsOf] = useState(data.org.opening_cash?.as_of ?? new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState(data.org.opening_cash?.currency ?? data.org.currency ?? "KZT");
  const [prepay, setPrepay] = useState<Record<string, string>>(Object.fromEntries(data.suppliers.map(s => [s.id, String(s.prepay_pct)])));
  const [state, setState] = useState<{ kind: "idle" | "busy" | "done" | "fail"; text?: string }>({ kind: "idle" });
  const save = async () => {
    setState({ kind: "busy" });
    const clean = amount.replace(/\s/g, "").replace(",", ".");
    if (clean && !/^\d+(\.\d{1,2})?$/.test(clean)) { setState({ kind: "fail", text: "Остаток — число в тенге, например 12 500 000." }); return; }
    try {
      await apiRequest("/api/params", { method: "PATCH", body: JSON.stringify({ opening_cash: clean ? { amount: Number(clean).toFixed(2), currency, as_of: asOf } : null, currency, suppliers: data.suppliers.map(s => ({ id: s.id, prepay_pct: Math.min(100, Math.max(0, Number(prepay[s.id] || 0))) })) }) });
      setState({ kind: "done" }); onSaved();
    } catch (e) { setState({ kind: "fail", text: e instanceof Error && e.message ? e.message : "Не удалось сохранить. Попробуйте ещё раз." }); }
  };
  return <Section id="money" title="Деньги">
    <div className={styles.fields}>
      <Field id="opening_cash" label="Остаток денег на счетах" why="От него считаем, хватит ли денег на предоплаты и остатки по заказам.">
        <input id="opening_cash-input" className={styles.input} inputMode="decimal" placeholder="например 12 500 000" value={amount} onChange={e => setAmount(e.target.value)} /><span className={styles.unit}>{currency === "KZT" ? "₸" : currency}</span>
      </Field>
      <Field id="opening_cash_as_of" label="На какую дату" why="Остаток берём на эту дату; платежи после неё учитываются сами.">
        <input id="opening_cash_as_of-input" className={styles.input} type="date" value={asOf} onChange={e => setAsOf(e.target.value)} />
      </Field>
      <Field id="currency" label="Валюта" why="В этой валюте показываем деньги во всех разделах.">
        <select id="currency-input" className={styles.select} value={currency} onChange={e => setCurrency(e.target.value)}>{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
      </Field>
    </div>
    {data.suppliers.map(s => <div key={s.id} className={styles.supplier}>
      <p className={styles.supplierName}>Условия оплаты · {NAME[s.id] ?? s.id}</p>
      <div className={styles.fields}>
        <Field id={`prepay_${s.id}`} label="Предоплата при утверждении заказа" why="Эта доля встаёт в график выплат в день утверждения.">
          <input id={`prepay_${s.id}-input`} className={styles.input} inputMode="numeric" value={prepay[s.id] ?? ""} onChange={e => setPrepay({ ...prepay, [s.id]: e.target.value })} /><span className={styles.unit}>%</span>
        </Field>
        <Field id={`balance_${s.id}`} label="Остаток при получении товара" why="Остальное платится к дате поставки; считается само.">
          <input id={`balance_${s.id}-input`} className={styles.input} value={String(100 - Math.min(100, Math.max(0, Number(prepay[s.id] || 0))))} readOnly /><span className={styles.unit}>%</span>
        </Field>
      </div>
    </div>)}
    <div className={styles.actions}>
      <Btn variant="primary" onClick={save} busy={state.kind === "busy"}>Сохранить</Btn>
      {state.kind === "done" && <p className={styles.done} role="status">Сохранено. Раздел <Link href="/money">Деньги</Link> уже считает с этими данными.</p>}
      {state.kind === "fail" && <p className={styles.fail} role="alert">{state.text}</p>}
    </div>
  </Section>;
}

function SupplyForm({ data, onSaved }: { data: Params; onSaved: () => void }) {
  const initial = useMemo(() => Object.fromEntries(data.suppliers.map(s => [s.id, { lead: String(s.lead_time_days), review: String(s.review_days), level: String(Math.round(s.service_level * 100)) }])), [data]);
  const [form, setForm] = useState(initial);
  const [state, setState] = useState<{ kind: "idle" | "busy" | "done" | "fail"; text?: string }>({ kind: "idle" });
  const set = (id: string, key: "lead" | "review" | "level", value: string) => setForm(f => ({ ...f, [id]: { ...f[id], [key]: value } }));
  const save = async () => {
    setState({ kind: "busy" });
    const changed = data.suppliers.filter(s => form[s.id].lead !== initial[s.id].lead || form[s.id].review !== initial[s.id].review || form[s.id].level !== initial[s.id].level);
    if (!changed.length) { setState({ kind: "fail", text: "Ничего не изменилось." }); return; }
    try {
      for (const s of changed) {
        const f = form[s.id];
        const body: Record<string, unknown> = { supplier_id: s.id };
        if (f.lead !== initial[s.id].lead) body.lead_time_days = Number(f.lead);
        if (f.review !== initial[s.id].review) body.review_days = Number(f.review);
        if (f.level !== initial[s.id].level) body.service_level = Math.min(99.9, Math.max(50, Number(f.level))) / 100;
        await apiRequest("/api/params", { method: "PUT", body: JSON.stringify(body) });
      }
      setState({ kind: "done" }); onSaved();
    } catch (e) { setState({ kind: "fail", text: e instanceof Error && e.message ? e.message : "Не удалось сохранить. Попробуйте ещё раз." }); }
  };
  return <Section id="supply" title="Поставки">
    {data.suppliers.map(s => <div key={s.id} className={styles.supplier}>
      <p className={styles.supplierName}>{NAME[s.id] ?? s.id}</p>
      <div className={styles.fields}>
        <Field id={`lead_${s.id}`} label="Срок поставки" why="Сколько дней идёт заказ от утверждения до склада: на этот срок считаем запас.">
          <input id={`lead_${s.id}-input`} className={styles.input} inputMode="numeric" value={form[s.id]?.lead ?? ""} onChange={e => set(s.id, "lead", e.target.value)} /><span className={styles.unit}>дней</span>
        </Field>
        <Field id={`review_${s.id}`} label="Как часто проверяем запасы" why="Раз в столько дней пересматриваем, что заказать.">
          <input id={`review_${s.id}-input`} className={styles.input} inputMode="numeric" value={form[s.id]?.review ?? ""} onChange={e => set(s.id, "review", e.target.value)} /><span className={styles.unit}>дней</span>
        </Field>
        <Field id={`level_${s.id}`} label="Какую долю колебаний спроса покрывать" why="Чем выше, тем больше страхового запаса и реже пустые полки; 90 % — обычная практика.">
          <input id={`level_${s.id}-input`} className={styles.input} inputMode="numeric" value={form[s.id]?.level ?? ""} onChange={e => set(s.id, "level", e.target.value)} /><span className={styles.unit}>%</span>
        </Field>
      </div>
    </div>)}
    <div className={styles.actions}>
      <Btn variant="primary" onClick={save} busy={state.kind === "busy"}>Сохранить</Btn>
      {state.kind === "done" && <p className={styles.done} role="status">Отправлено на подтверждение: изменения расчёта вступят после вашего «да» в разделе <Link href="/today">Сегодня</Link>.</p>}
      {state.kind === "fail" && <p className={styles.fail} role="alert">{state.text}</p>}
    </div>
  </Section>;
}
