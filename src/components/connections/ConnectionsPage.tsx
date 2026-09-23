"use client";

import Link from "next/link";
import { Database, FileOutput, AudioLines, Cpu, ArrowUpRight, FileSpreadsheet, Send, Workflow } from "lucide-react";
import { Button, LoadError, Skeleton, useApi } from "@/components/shell";
import { modeLabel, sourceDate, type ConnectionsModes } from "./types";
import styles from "./connections.module.css";

type Health = { ai_provider?: string; providers?: { voice?: "configured" | "missing" }; mode?: string };
export function ConnectionsPage() {
  const modes = useApi<ConnectionsModes>("/api/modes");
  const health = useApi<Health>("/api/health");
  const label = (name: string) => modeLabel(modes.data, name);
  const ai = modes.data?.axes?.ai;
  const sources = modes.data?.sources ?? modes.data?.data_sources;
  const axes = [
    { title: "Данные", value: label("provenance"), detail: "Происхождение исходных данных", Icon: Database },
    { title: "Решения", value: ai ? label(`ai_${ai}`) : undefined, detail: "Режим принятия решений", Icon: Cpu },
    { title: "Внешние действия", value: label("external"), detail: "Куда попадает результат", Icon: FileOutput },
  ];
  return <div className={styles.page}>
    <header className={styles.pageHead}><div><p className={styles.eyebrow}>ИСТОЧНИКИ И РЕЖИМЫ</p><h1>Связи</h1><p className={styles.subtitle}>Откуда данные, кто готовит решения и что уходит за пределы системы.</p></div><Button onClick={() => { modes.reload(); health.reload(); }}>Обновить</Button></header>
    {modes.error && <LoadError message={modes.data ? "Не удалось обновить режимы — показан последний подтверждённый ответ." : modes.error.message} retry={modes.reload} />}
    <section className={styles.modes} aria-labelledby="modes-heading"><div className={styles.sectionHead}><h2 id="modes-heading">Три независимых статуса</h2><span className={styles.meta}>Three visible modes</span></div>
      {modes.loading ? <Skeleton lines={3} /> : modes.data ? <dl className={styles.axes}>{axes.map(({ title, value, detail, Icon }) => <div key={title}><dt><Icon size={18} aria-hidden="true" />{title}</dt><dd>{value ?? "Статус не передан сервисом"}</dd><dd className={styles.meta}>{detail}</dd></div>)}</dl> : <p className={styles.unavailable}>Статусы не подтверждены. Повторите загрузку режимов.</p>}
    </section>
    <section className={styles.section} aria-labelledby="sources-heading"><div className={styles.sectionHead}><h2 id="sources-heading">Данные партнёра</h2>{label("provenance") && <span className={styles.meta}>{label("provenance")}</span>}</div>
      {modes.loading ? <Skeleton lines={2} /> : sources?.length ? <ul className={styles.rows}>{sources.map((file, index) => <li className={styles.sourceRow} key={`${file.supplier_id ?? ""}-${file.name}-${index}`}><FileSpreadsheet size={18} aria-hidden="true" /><div><h3>{file.name}</h3><p className={styles.meta}>{file.supplier_id}{file.anonymised === true ? " · обезличены" : ""}{file.rows !== undefined ? ` · строк: ${file.rows.toLocaleString("ru-RU")}` : ""}</p></div><p className={styles.sourceTime}>{sourceDate(file.as_of ?? file.date)}</p></li>)}</ul> : <p className={styles.unavailable}>Сервис не передал сведения об исходных файлах и датах выгрузок.</p>}
    </section>
    <section className={styles.section} aria-labelledby="services-heading"><div className={styles.sectionHead}><h2 id="services-heading">Сервисы и каналы</h2></div>
      <div className={styles.serviceRow}><Cpu size={18} aria-hidden="true" /><div><h3>Провайдер решений{health.data?.ai_provider ? ` · ${health.data.ai_provider}` : ""}</h3><p className={styles.meta}>{ai ? label(`ai_${ai}`) ?? "Режим AI не передан" : "Режим AI не подтверждён"}</p></div><Link href="/assistant">Помощник<ArrowUpRight size={14} aria-hidden="true" /></Link></div>
      {health.error && <LoadError message="Не удалось проверить доступность провайдера." retry={health.reload} />}
      <div className={styles.serviceRow}><AudioLines size={18} aria-hidden="true" /><div><h3>Голос</h3><p className={styles.meta}>{health.data?.providers?.voice === "missing" ? label("voice_unavailable") ?? "Статус голоса не передан" : health.data?.providers?.voice === "configured" ? "Ключ настроен. Доступность проверяется при запуске разговора." : "Доступность голоса не подтверждена"}</p></div><Link href="/assistant">Открыть<ArrowUpRight size={14} aria-hidden="true" /></Link></div>
      <div className={styles.serviceRow} data-testid="onec-row"><FileOutput size={18} aria-hidden="true" /><div><h3>{modes.data?.onec?.label ?? label("external") ?? "Режим экспорта не передан"}</h3><p className={styles.meta}>Файл заказа с кодами 1С. Загрузка в учётную систему выполняется отдельно.</p><p className={styles.meta} title="Prior 1C sandbox access and live integration diagnostics completed; business connector unverified.">Ранее выполнен доступ к тестовой базе 1С и диагностика живой интеграции; бизнес-коннектор не подтверждён.</p></div><Link href="/peers">Файлы экспорта<ArrowUpRight size={14} aria-hidden="true" /></Link></div>
      <div className={styles.serviceRow}><Send size={18} aria-hidden="true" /><div><h3>Поставщик</h3><p className={styles.meta}>{label("supplier_draft") ?? "Статус канала не передан"}</p></div><Link href="/purchases">Заказы<ArrowUpRight size={14} aria-hidden="true" /></Link></div>
      <div className={styles.serviceRow}><Workflow size={18} aria-hidden="true" /><div><h3>Мир</h3><p className={styles.meta}>{label("world") ?? "Статус мира не передан"}</p></div><Link href="/world">Консоль событий<ArrowUpRight size={14} aria-hidden="true" /></Link></div>
    </section>
    <footer className={styles.footer}><p>{label("agents")}</p><p>Режим задаётся при запуске приложения. Офлайн — записанные решения для проверки; правила — детерминированный расчёт без LLM.</p></footer>
  </div>;
}
