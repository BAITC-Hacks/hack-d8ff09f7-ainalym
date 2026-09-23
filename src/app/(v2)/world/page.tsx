import type { Metadata } from "next";
import { WorldConsole } from "@/components/world-console/WorldConsole";
import styles from "@/styles/v2/legacy.module.css";
export default function Page() { return <div className={styles.surface}><WorldConsole /></div>; }

export const metadata: Metadata = { title: "Лента" };
