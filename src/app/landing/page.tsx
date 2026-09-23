import type { Metadata } from "next";
import { ArrowRight, CalendarRange, FileSpreadsheet, Funnel, PackageX, ShieldCheck, Truck } from "lucide-react";
import { HeroMedia, POSTER_SRC } from "./HeroMedia";
import { ProductClips } from "./ProductClips";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: { absolute: "Ainalym — понятный расчёт закупок электротоваров" },
  description: "Ainalym считает, что и у кого заказать, готовит заказы поставщикам и объясняет каждую цифру. Решение остаётся за человеком.",
};

const DEMO_HREF = "/";
const METHODOLOGY_HREF = "https://github.com/BAITC-Hacks/hack-d8ff09f7-ainalym/blob/main/README.md#методика-расчёта";

const STEPS = [
  { step: "01", title: "Файлы 1С", text: "Продажи, остатки и товар в пути — исходные данные для закупки. 1С — файловый обмен." },
  { step: "02", title: "Расчёт", text: "Ainalym учитывает сезонность, срок поставки и разовые продажи. По каждому товару видно, сколько заказать и почему." },
  { step: "03", title: "Заказ поставщику", text: "Вы проверяете количество и утверждаете черновик. Файл заказа и письмо готовы к вашей отправке." },
  { step: "04", title: "Документы", text: "Счёт, накладная или фото: агент извлекает строки, сверяет с заказом и готовит пакет документов по маршруту поставки - РК, ЕАЭС, импорт. Черновики не отправляются." },
];

const HONEST = [
  { icon: Truck, title: "Товар в пути уже учтён", text: "То, что едет от поставщика, не заказывается второй раз." },
  { icon: CalendarRange, title: "Сезон не застаёт врасплох", text: "Сезонные колебания спроса учитываются заранее, а не после пустой полки." },
  { icon: PackageX, title: "Пустая полка — не слабый спрос", text: "Расчёт восстанавливает спрос за месяцы, когда товара не было в наличии." },
  { icon: Funnel, title: "Разовые заказы не искажают картину", text: "Крупная отгрузка под один объект не превращается в постоянный спрос." },
];


function Brand({ size = "md" }: { size?: "md" | "sm" }) {
  return (
    <span className={styles.brand} data-size={size}>
      <span className={styles.mark} aria-hidden="true" />
      <span className={styles.wordmark}>Ainalym</span>
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <a className={styles.navBrand} href="/landing" aria-label="Ainalym — на главную">
          <Brand />
        </a>
        <nav className={styles.navLinks} aria-label="Разделы">
          <a className={styles.navLink} href="#how">Как это работает</a>
          <a className={styles.navLink} href="#product">Возможности</a>
          <a className={styles.navLink} href="#proof">Данные демо</a>
        </nav>
      </header>

      <main>
        <section id="start" className={styles.hero} aria-labelledby="hero-title">
          <HeroMedia />
          <div className={styles.heroInner}>
            <div className={styles.reveal}>
              <p className={styles.eyebrow}>Операционная система импорта и закупок</p>
              <h1 id="hero-title" className={styles.heroTitle}>
                Агенты ведут закупки и импорт.
                <span className={styles.heroTitleSoft}>Вы принимаете решения.</span>
              </h1>
              <p className={styles.heroLead}>
                Ainalym считает потребность по продажам, остаткам и товару в пути. Вы видите причины каждой рекомендации и решаете, что закупать.
              </p>
              <p className={styles.heroNote}>Белый импорт должен быть таким же простым, как заказать доставку.</p>
              <div className={styles.actions}>
                <a className={styles.primary} href={DEMO_HREF}>
                  Открыть демо <ArrowRight aria-hidden="true" size={18} />
                </a>
                <a className={styles.secondary} href={METHODOLOGY_HREF}>Как считаем</a>
              </div>
            </div>
          </div>
        </section>

        <ProductClips />

        <section id="how" className={styles.section} aria-labelledby="how-title">
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>Как это работает</p>
            <h2 id="how-title" className={styles.sectionTitle}>От файлов до готового заказа</h2>
            <p className={styles.sectionLead}>Привычные данные из учёта. Понятный расчёт. Решение остаётся у вас.</p>
          </div>
          <ol className={styles.steps}>
            {STEPS.map((item) => (
              <li key={item.step} className={styles.step}>
                <span className={styles.stepNo}>{item.step}</span>
                <h3 className={styles.stepTitle}>{item.title}</h3>
                <p className={styles.stepText}>{item.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="proof" className={styles.section} aria-labelledby="proof-title">
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>На чём можно проверить</p>
            <h2 id="proof-title" className={styles.sectionTitle}>Знакомый ассортимент. Конкретные условия расчёта.</h2>
            <p className={styles.sectionLead}>В демо — обезличенные данные дистрибьютора электротоваров. Откройте товар и проследите путь от продаж до рекомендации.</p>
          </div>
          <dl className={styles.proof}>
            <div className={styles.proofItem}>
              <dt>Товаров в демо</dt>
              <dd>3 909</dd>
              <dd className={styles.proofDetail}>Ассортимент из файлов партнёра</dd>
            </div>
            <div className={styles.proofItem}>
              <dt>Поставщики</dt>
              <dd className={styles.proofNames}>IEK <span>Systeme Electric</span></dd>
              <dd className={styles.proofDetail}>Расчёт по каждому поставщику</dd>
            </div>
            <div className={styles.proofItem}>
              <dt>Срок поставки</dt>
              <dd>40–50 <span className={styles.proofUnit}>дней</span></dd>
              <dd className={styles.proofDetail}>IEK — 40, Systeme Electric — 50</dd>
            </div>
            <div className={styles.proofItem}>
              <dt>Оплата в демо</dt>
              <dd>30 / 70 <span className={styles.proofUnit}>%</span></dd>
              <dd className={styles.proofDetail}>30 % — предоплата, 70 % — к поставке</dd>
            </div>
            <div className={styles.proofItem}>
              <dt>Данные демо</dt>
              <dd>249 тыс. <span className={styles.proofUnit}>строк продаж</span></dd>
              <dd className={styles.proofDetail}>12 файлов партнёра</dd>
            </div>
          </dl>
          <p className={styles.proofNote}>Сроки поставки и схема оплаты — настройки демо, а не подтверждённые условия поставщиков. Суммы считаются там, где известна себестоимость; по IEK она не задана.</p>
          <div className={styles.split}>
            <div className={styles.sectionHead}>
              <p className={styles.kicker}>Честный расчёт</p>
              <h2 id="honest-title" className={styles.sectionTitle}>У каждой рекомендации есть причина</h2>
              <p className={styles.sectionLead}>Остаток, товар в пути, сезонность и история продаж видны в объяснении. Вы можете проверить расчёт до утверждения заказа.</p>
            </div>
            <ul className={styles.facts}>
              {HONEST.map(({ icon: Icon, title, text }) => (
                <li key={title} className={styles.fact}>
                  <Icon className={styles.factIcon} aria-hidden="true" size={20} />
                  <h3 className={styles.factTitle}>{title}</h3>
                  <p className={styles.factText}>{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.closing} aria-labelledby="closing-title">
          {/* eslint-disable-next-line @next/next/no-img-element -- same cached poster as the hero */}
          <img className={styles.closingImage} src={POSTER_SRC} alt="" width={1600} height={900} loading="lazy" decoding="async" />
          <div className={styles.closingInner}>
            <h2 id="closing-title" className={styles.closingTitle}>Расчёт готовит Ainalym. Решение принимаете вы.</h2>
            <p className={styles.closingLead}>Проверьте рекомендации, поправьте количество и утвердите заказ. Отправка поставщику — в ваших руках.</p>
            <div className={styles.vision}>
              <p className={styles.kicker}>Куда это ведёт</p>
              <p className={styles.visionText}>AI-помощник превращает разрозненные документы и переписку в понятный маршрут официального импорта - от заказа поставщику до принятого на склад товара. Документы собраны, расхождения найдены, расходы рассчитаны, следующий шаг известен.</p>
              <p className={styles.visionText}>10 февраля 2026 года на расширенном заседании правительства президент поставил задачу оптимизировать таможенные процедуры с помощью цифровых подходов и искусственного интеллекта без потери контроля. Ainalym не заменяет государственные системы - он готовит для них согласованные данные и делает официальный импорт понятным процессом для предпринимателя: от заказа поставщику до принятого на склад товара и итоговой себестоимости в учёте.</p>
            </div>
            <p className={styles.promise}>
              <ShieldCheck aria-hidden="true" size={20} />
              <span>В демо заказ и письмо остаются черновиками для самостоятельной отправки.</span>
            </p>
            <a className={styles.backToStart} href="#start">К началу страницы <ArrowRight aria-hidden="true" size={16} /></a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <Brand size="sm" />
        <p className={styles.footerMeta}>Демо для HackAlem 2026</p>
        <p className={styles.footerMeta}>
          <FileSpreadsheet aria-hidden="true" size={16} /> 1С — файловый обмен
        </p>
      </footer>
    </div>
  );
}
