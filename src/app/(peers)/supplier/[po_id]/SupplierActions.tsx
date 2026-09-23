"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../../peerPages.module.css";

export default function SupplierActions({ poId, orderState, channel }: { poId: string; orderState: string; channel: { state: "draft" | "sent" | "confirmed"; reply_text: string | null } }) {
  const router = useRouter();
  const [text, setText] = useState(`Подтверждаем получение заказа ${poId}.`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(action: "send_demo" | "confirm") {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/supplier/${encodeURIComponent(poId)}/reply`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, text }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Не удалось обновить канал");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ошибка канала"); }
    finally { setBusy(false); }
  }
  if (channel.state === "confirmed") return <><p className={styles.body}>{channel.reply_text}</p><p className={styles.truth}>Локальный симулятор · оригинальный ответ сохранён.</p></>;
  if (channel.state === "draft") return <div className={styles.form}>
    <p className={styles.subtitle}>{orderState === "approved" || orderState === "exported" ? "Заказ утверждён. Разместите его в локальном демо-канале перед ответом поставщика." : "Заказ ожидает утверждения. Канал откроется после решения менеджера."}</p>
    {(orderState === "approved" || orderState === "exported") && <button className={styles.button} disabled={busy} onClick={() => submit("send_demo")}>Разместить в демо-канале</button>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </div>;
  return <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void submit("confirm"); }}>
    <p className={styles.subtitle}>Sent (controlled demo channel). Письмо не покидало приложение.</p>
    <div><label className={styles.label} htmlFor="supplier-reply">Текст подтверждения</label><textarea id="supplier-reply" className={styles.input} rows={4} value={text} onChange={(event) => setText(event.target.value)} required /></div>
    <button className={styles.button} disabled={busy || !text.trim()}>Подтвердить получение</button>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </form>;
}
