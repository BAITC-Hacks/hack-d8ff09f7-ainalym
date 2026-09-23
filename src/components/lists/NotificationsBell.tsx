"use client";
import Link from "next/link";
import { useId, useRef } from "react";
import { Bell, X } from "lucide-react";
import { Button, EmptyState, LoadError, Skeleton, useApi } from "@/components/shell";
import { localHref } from "@/components/assistant/types";
import styles from "./overlays.module.css";
type Notifications = { total: number; items: { id: string; kind: string; title: string; detail: string; href: string }[] };
export function NotificationsBell() {
  const id = useId();
  const api = useApi<Notifications>("/api/notifications");
  const dialog = useRef<HTMLDialogElement>(null); const trigger = useRef<HTMLSpanElement>(null);
  const close = () => { dialog.current?.close(); trigger.current?.querySelector<HTMLButtonElement>("button")?.focus(); };
  return <><span ref={trigger}><Button aria-label={api.data ? `Уведомления · требуют внимания: ${api.data.total}` : "Уведомления"} onClick={() => dialog.current?.showModal()}><Bell size={18} /><span>{api.data?.total ?? "—"}</span></Button></span><dialog ref={dialog} className={styles.dialog} aria-labelledby={id} onCancel={event => { event.preventDefault(); close(); }}><header className={styles.head}><div><h2 id={id}>Требуют внимания</h2><p>Решения и ошибки обработки</p></div><Button aria-label="Закрыть уведомления" onClick={close}><X size={18} /></Button></header><div className={styles.body}>{api.error && <LoadError message={api.error.message} retry={api.reload} />}{api.loading ? <Skeleton lines={3} /> : api.data?.items.length ? <ul className={styles.items}>{api.data.items.map(item => <li key={item.id}><Link href={localHref(item.href) ?? "/today"} onClick={close}><strong>{item.title}</strong><span>{item.detail}</span></Link></li>)}</ul> : !api.error && <EmptyState>Сейчас нет решений и ошибок, требующих внимания.</EmptyState>}</div></dialog></>;
}
