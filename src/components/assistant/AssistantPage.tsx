import { AssistantPanel } from "./AssistantPanel";
import styles from "./assistant.module.css";

export function AssistantPage() {
  return <div className={styles.page}><div className={styles.pageIntro}><p className={styles.eyebrow}>ПОПОЛНЕНИЕ СКЛАДА</p><h1>Сначала разобраться.<br />Потом заказать.</h1><p className={styles.lead}>Что изменилось в продажах и остатках, какие решения ждут вас и сколько заказать поставщику.</p><div className={styles.guide}><p><kbd>1</kbd> Очередь решений</p><p><kbd>2</kbd> Последние изменения</p><p><kbd>3</kbd> Расчёт по поставщику или категории</p><p><kbd>4</kbd> Обоснование по коду 1С</p></div><p className={styles.meta}>Кнопки работают без живого AI.<br />Для сообщения нажмите <kbd>i</kbd>.</p></div><AssistantPanel variant="page" /></div>;
}
