"use client";
import Link from "next/link";
import { useState } from "react";
import { Calculator } from "lucide-react";
import { apiRequest, Button, ActionStatus, useApiAction } from "@/components/shell";
import { TruthAxisLabels, resultAxes, type TruthAxes } from "@/components/labels";
import type { Labelled } from "./types";
import styles from "./pulse.module.css";
export function CalculationComposer() {
  const [supplier, setSupplier] = useState(""); const [category, setCategory] = useState(""); const [axes, setAxes] = useState<TruthAxes>({}); const [runId, setRunId] = useState<string>(); const action = useApiAction();
  return <section className={styles.composer} id="calculation" aria-labelledby="calculation-title"><div><h2 id="calculation-title">Рассчитать пополнение</h2><p className={styles.meta}>Продажи, остатки и товары в пути → заказ с обоснованием</p></div>
    <form className={styles.calcForm} onSubmit={async e => { e.preventDefault(); const result = await action.run(() => apiRequest<Labelled & { run_id: string; skus: number; recommended: number }>("/api/calc/run", { method: "POST", body: JSON.stringify({ scope: { ...(supplier ? { supplier } : {}), ...(category.trim() ? { category: category.trim() } : {}) } }) }), result => `Расчёт завершён · ${result.skus} товаров · ${result.recommended} рекомендаций`); if (result) { setRunId(result.run_id); setAxes(resultAxes(result)); } }} aria-busy={action.busy}>
      <label>Поставщик<select value={supplier} onChange={e => setSupplier(e.target.value)} disabled={action.busy}><option value="">Все поставщики</option><option value="IEK">IEK</option><option value="SE">SE</option></select></label>
      <label>Категория<input value={category} onChange={e => setCategory(e.target.value)} placeholder="Все категории" disabled={action.busy} /></label>
      <Button variant="primary" type="submit" busy={action.busy}><Calculator size={16} />Запустить расчёт</Button>
    </form><ActionStatus error={action.error} receipt={action.receipt} />{action.receipt && <TruthAxisLabels axes={axes} />}{runId && <Link className={styles.inlineLink} href={`/purchases?run_id=${encodeURIComponent(runId)}`}>Открыть рекомендации расчёта</Link>}
  </section>;
}
