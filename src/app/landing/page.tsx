import type { Metadata } from "next";
import { ArrowRight, CalendarRange, Eye, FileSpreadsheet, Funnel, PackageX, ShieldCheck, Sparkles, Truck, UserCheck } from "lucide-react";
import { HeroMedia, POSTER_SRC } from "./HeroMedia";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: { absolute: "Ainalym — агенты ведут цикл закупок" },
  description: "Ainalym считает, что и у кого заказать, готовит заказы поставщикам и объясняет каждую цифру. Решение остаётся за человеком.",
};

const DEMO_HREF = "/today";

const DAY = [
  { step: "01", title: "Сегодня", text: "С утра — только то, что требует решения: позиции на грани дефицита, задержки поставщиков, заказы на подтверждение." },
  { step: "02", title: "Закупки", text: "Сколько заказать, у кого и почему — по каждой позиции. Любую цифру можно раскрыть до причины." },
  { step: "03", title: "Заказы", text: "Черновики заказов поставщикам собираются сами. Вы правите и утверждаете — и только тогда заказ уходит." },
  { step: "04", title: "Поставщики", text: "IEK и Systeme Electric: сроки, надёжность, частичные поставки и опоздания — в одной карточке." },
];

const HONEST = [
  { icon: Truck, title: "Товар в пути уже учтён", text: "То, что едет от поставщика, не заказывается второй раз." },
  { icon: CalendarRange, title: "Сезон не застаёт врасплох", text: "В стройсезон кабель и автоматы уходят быстрее — расчёт видит это заранее." },
  { icon: PackageX, title: "Пустая полка — не слабый спрос", text: "Если товара не было в наличии, продажи этих дней не занижают потребность." },
  { icon: Funnel, title: "Разовые заказы не искажают картину", text: "Крупная отгрузка под один объект не превращается в постоянный спрос." },
];

const LOOP = [
  { icon: Eye, title: "Замечает", text: "Помощник следит за остатками, продажами и ответами поставщиков и видит риск раньше, чем он станет пустой полкой." },
  { icon: Sparkles, title: "Предлагает", text: "Готовит решение с объяснением: что заказать, у кого, к какому сроку и что будет, если ничего не делать." },
  { icon: UserCheck, title: "Вы решаете", text: "Утвердить, поправить или отклонить. Каждое решение сохраняется вместе с причиной." },
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
          <a className={styles.navLink} href="#loop">Помощник</a>
          <a className={styles.navCta} href={DEMO_HREF}>Открыть демо</a>
        </nav>
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="hero-title">
          <HeroMedia />
          <div className={styles.heroInner}>
            <div className={styles.reveal}>
              <p className={styles.eyebrow}>Закупки для оптовой торговли электротоварами</p>
              <h1 id="hero-title" className={styles.heroTitle}>
                Агенты ведут цикл закупок. <span className={styles.heroTitleSoft}>Решение — за вами.</span>
              </h1>
              <p className={styles.heroLead}>
                Ainalym каждый день считает, что и у кого заказать, готовит заказы поставщикам и объясняет каждую цифру. Отправляете их вы.
              </p>
              <div className={styles.actions}>
                <a className={styles.primary} href={DEMO_HREF}>
                  Открыть демо <ArrowRight aria-hidden="true" size={18} />
                </a>
                <a className={styles.secondary} href="#how">Как это работает</a>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className={styles.section} aria-labelledby="how-title">
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>Как это работает</p>
            <h2 id="how-title" className={styles.sectionTitle}>Рабочий день закупщика — в четырёх экранах</h2>
            <p className={styles.sectionLead}>От утреннего списка дел до отправленного заказа. Без выгрузок в таблицы и без ручного пересчёта.</p>
          </div>
          <ol className={styles.steps}>
            {DAY.map((item) => (
              <li key={item.step} className={styles.step}>
                <span className={styles.stepNo}>{item.step}</span>
                <h3 className={styles.stepTitle}>{item.title}</h3>
                <p className={styles.stepText}>{item.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section} aria-labelledby="honest-title">
          <div className={styles.split}>
            <div className={styles.sectionHead}>
              <p className={styles.kicker}>Честный расчёт</p>
              <h2 id="honest-title" className={styles.sectionTitle}>Цифрам можно верить, потому что их можно проверить</h2>
              <p className={styles.sectionLead}>Расчёт смотрит на то же, на что смотрит опытный закупщик, и показывает, откуда взялось каждое число.</p>
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

        <section id="loop" className={styles.section} aria-labelledby="loop-title">
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>Помощник и человек</p>
            <h2 id="loop-title" className={styles.sectionTitle}>Помощник предлагает. Решает человек.</h2>
          </div>
          <ol className={styles.loop}>
            {LOOP.map(({ icon: Icon, title, text }) => (
              <li key={title} className={styles.loopItem}>
                <span className={styles.loopIcon}><Icon aria-hidden="true" size={20} /></span>
                <h3 className={styles.loopTitle}>{title}</h3>
                <p className={styles.loopText}>{text}</p>
              </li>
            ))}
          </ol>
          <p className={styles.promise}>
            <ShieldCheck aria-hidden="true" size={20} />
            <span>Ничего не уходит поставщику автоматически. Заказ отправляется только после вашего подтверждения.</span>
          </p>
        </section>

        <section className={styles.closing} aria-labelledby="closing-title">
          {/* eslint-disable-next-line @next/next/no-img-element -- same cached poster as the hero */}
          <img className={styles.closingImage} src={POSTER_SRC} alt="" width={1920} height={1072} loading="lazy" decoding="async" />
          <div className={styles.closingInner}>
            <h2 id="closing-title" className={styles.closingTitle}>Посмотрите на рабочий день закупщика</h2>
            <a className={styles.primary} href={DEMO_HREF}>
              Открыть демо <ArrowRight aria-hidden="true" size={18} />
            </a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <Brand size="sm" />
        <p className={styles.footerMeta}>Демо для HackAlem 2026</p>
        <p className={styles.footerMeta}>
          <FileSpreadsheet aria-hidden="true" size={16} /> Обмен с 1С — файлами
        </p>
      </footer>
    </div>
  );
}
