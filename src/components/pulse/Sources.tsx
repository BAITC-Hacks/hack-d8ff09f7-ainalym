import Link from "next/link";
import { Chip } from "@/components/labels";
import type { Source } from "./types";
import styles from "./pulse.module.css";
export function Sources({ sources }: { sources?: Source[] }) {
  return <div className={styles.sources}>{sources?.length ? sources.map((source,index) => {
    const label = typeof source === "string" ? source : source.label ?? source.title ?? source.ref ?? source.id ?? source.kind ?? "Источник";
    const href = typeof source === "object" ? source.href : undefined;
    return href?.startsWith("/") && !href.startsWith("//") ? <Link key={`${label}-${index}`} href={href}><Chip>{label}</Chip></Link> : <Chip key={`${label}-${index}`}>{label}{typeof source === "object" && source.version !== undefined ? ` · v${source.version}` : ""}</Chip>;
  }) : <span className={styles.meta}>Источники не указаны в ответе сервиса.</span>}</div>;
}
