"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../peerPages.module.css";

export default function PeerActions(props: { kind: "play"; enabled: boolean } | { kind: "export"; poId: string; exported: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function act() {
    setBusy(true); setError("");
    try {
      const url = props.kind === "play" ? "/api/world/play" : `/api/peers/onec-export/${encodeURIComponent(props.poId)}`;
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: props.kind === "play" ? JSON.stringify({ steps: 1 }) : "{}" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Операция не выполнена");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ошибка операции"); }
    finally { setBusy(false); }
  }
  if (props.kind === "play") return <div className={styles.form}><button className={styles.button} disabled={!props.enabled || busy} onClick={act}>Следующее событие</button>{error && <p className={styles.error} role="alert">{error}</p>}</div>;
  return <div className={styles.form}>{props.exported ? <a className={styles.link} href={`/api/peers/onec-export/${encodeURIComponent(props.poId)}?format=xlsx`}>Скачать XLSX</a> : <button className={`${styles.button} ${styles.secondary}`} disabled={busy} onClick={act}>Подготовить файл</button>}{error && <p className={styles.error} role="alert">{error}</p>}</div>;
}
