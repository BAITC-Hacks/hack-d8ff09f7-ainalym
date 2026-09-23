import type { Metadata } from "next";
import { ConnectionsPage } from "@/components/connections/ConnectionsPage";
import styles from "@/styles/v2/legacy.module.css";
export default function Page() { return <div className={styles.surface}><ConnectionsPage /></div>; }

export const metadata: Metadata = { title: "Связи" };
