import styles from "./peerPages.module.css";

export default function PeerLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.canvas}>{children}</div>;
}
