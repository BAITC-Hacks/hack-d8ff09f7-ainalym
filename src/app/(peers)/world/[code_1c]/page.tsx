import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { activeOrg } from "@/world/feed";
import JudgeCompose from "./JudgeCompose";
import styles from "../../peerPages.module.css";

export const dynamic = "force-dynamic";

export default async function JudgePage({ params }: { params: Promise<{ code_1c: string }> }) {
  const { code_1c } = await params;
  activeOrg();
  const sku = db().prepare("SELECT code_1c,name,supplier_id,median_month_qty,p95_doc_qty FROM sku WHERE code_1c = ?").get(code_1c) as { code_1c: string; name: string; supplier_id: string; median_month_qty: string | null; p95_doc_qty: string | null } | undefined;
  if (!sku) notFound();
  const finite = (value: string | null) => { const n = Number(value ?? 0); return Number.isFinite(n) && n >= 0 ? n : 0; };
  const threshold = Math.max(3 * finite(sku.median_month_qty), 5 * finite(sku.p95_doc_qty), 20);
  return <main className={styles.main}>
    <div className={styles.topline}><div><p className={styles.eyebrow}>Пульт сценария · {sku.supplier_id}</p><h1 className={styles.title}>{sku.name}</h1><p className={styles.subtitle}>Код 1С {sku.code_1c}. Добавьте синтетическое событие и проверьте, как агент пересчитает потребность.</p></div><Link className={styles.link} href="/peers">Мир и экспорт</Link></div>
    <section className={styles.panel}><h2>Событие для агента</h2><JudgeCompose code={sku.code_1c} threshold={threshold} /></section>
  </main>;
}
