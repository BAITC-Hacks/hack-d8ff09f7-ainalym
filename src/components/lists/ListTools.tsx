import { NotificationsBell } from "./NotificationsBell";
import { SearchPalette } from "./SearchPalette";
import styles from "./overlays.module.css";
export function ListTools() { return <div className={styles.tools}><SearchPalette /><NotificationsBell /></div>; }
