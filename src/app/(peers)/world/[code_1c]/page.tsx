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
  const sku = db().prepare("SELECT code_1c,name,supplier_id FROM sku WHERE code_1c = ?").get(code_1c) as { code_1c: string; name: string; supplier_id: string } | undefined;
  if (!sku) notFound();
  return <main className={styles.main}>
    <div className={styles.topline}><div><p className={styles.eyebrow}>Пульт сценария · {sku.supplier_id}</p><h1 className={styles.title}>{sku.name}</h1><p className={styles.subtitle}>Код 1С {sku.code_1c}. Добавьте синтетическое событие и проверьте, как агент пересчитает потребность.</p></div><Link className={styles.link} href="/peers">Мир и экспорт</Link></div>
    <section className={styles.panel}><h2>Событие для агента</h2><JudgeCompose code={sku.code_1c} /></section>
  </main>;
}
