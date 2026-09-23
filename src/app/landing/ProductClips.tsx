"use client";

import { Maximize2, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./landing.module.css";

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeMotion(change: () => void) {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}
const allowsMotion = () => !window.matchMedia(MOTION_QUERY).matches;
const serverMotion = () => false;

const CLIPS = [
  { id: "today", title: "Сегодня", value: "Склад, риск дефицита и срочные решения — одним взглядом.", detail: "Начните день с позиций, которым нужно внимание." },
  { id: "purchases", title: "Закупки", value: "Расчёт пополнения сразу превращается в корзину.", detail: "Количество, сумма и предоплата — перед вами." },
  { id: "order", title: "Заказ поставщику", value: "Проверьте состав заказа и утвердите его сами.", detail: "Позиции и суммы уже собраны — решение за вами." },
  { id: "money", title: "Деньги", value: "Выплаты поставщикам на 60 дней вперёд.", detail: "Видно, когда нужны деньги и каких данных не хватает." },
  { id: "assistant", title: "ИИ-Помощник", value: "Спросите, что срочно заказать, — получите список.", detail: "Ответ по данным склада помогает выбрать следующий шаг." },
] as const;

function ClipCard({ clip, index, motion }: { clip: typeof CLIPS[number]; index: number; motion: boolean }) {
  const card = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [failed, setFailed] = useState(false);
  const poster = `/landing/clips/${clip.id}.png`;

  useEffect(() => {
    const element = card.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting) setLoaded(true);
    }, { threshold: 0.15 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (motion && visible && !paused && !hovered) {
      element.muted = true;
      void element.play().catch(() => setPlaying(false));
    } else {
      element.pause();
    }
  }, [hovered, loaded, motion, paused, visible]);

  return (
    <figure ref={card} className={styles.clipCard} data-product-clip={clip.id} data-revealed={loaded || undefined} data-inview={visible || undefined}>
      <div
        className={styles.clipMedia}
        onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }}
        onPointerLeave={() => setHovered(false)}
        onPointerCancel={() => setHovered(false)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- exact-size local video poster, also the reduced-motion fallback */}
        <img src={poster} className={styles.clipPoster} width={1280} height={800} loading="lazy" decoding="async" alt={`${clip.title}: ${clip.value}`} />
        {motion && loaded && (
          <video
            ref={video}
            className={styles.clipVideo}
            data-playing={hasFrame || undefined}
            autoPlay={visible && !paused && !hovered}
            muted
            loop
            playsInline
            preload="metadata"
            poster={poster}
            width={1280}
            height={800}
            aria-label={`Демонстрация: ${clip.title}`}
            onPlaying={() => { setPlaying(true); setHasFrame(true); }}
            onPause={() => setPlaying(false)}
            onError={() => { setPlaying(false); setHasFrame(false); setFailed(true); }}
          >
            <source src={`/landing/clips/${clip.id}.mp4`} type="video/mp4" />
            <source src={`/landing/clips/${clip.id}.webm`} type="video/webm" onError={() => { setFailed(true); setPlaying(false); setHasFrame(false); }} />
          </video>
        )}
      </div>
      <figcaption className={styles.clipCaption}>
        <div className={styles.clipHeading}>
          <span className={styles.clipNumber}>{String(index + 1).padStart(2, "0")}</span>
          <h3 className={styles.clipTitle}>{clip.title}</h3>
          <div className={styles.clipControls}>
            {motion && loaded && !failed && <>

              <button type="button" className={styles.clipControl} aria-label={`${playing ? "Приостановить" : "Воспроизвести"} ролик «${clip.title}»`} onClick={() => {
                if (playing) {
                  setPaused(true);
                } else {
                  setPaused(false);
                  void video.current?.play().catch(() => setPlaying(false));
                }
              }}>
                {!playing ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
              </button>
              <button type="button" className={styles.clipControl} aria-label={`Развернуть ролик «${clip.title}»`} onClick={() => { void video.current?.requestFullscreen?.().catch(() => undefined); }}>
                <Maximize2 size={16} aria-hidden="true" />
              </button>
            </>}
          </div>
        </div>
        <p className={styles.clipValue}>{clip.value}<span>{clip.detail}</span></p>
        <p className={styles.clipStatus} aria-hidden="true">{!motion || !loaded ? "\u00a0" : failed ? "Запись недоступна — показан кадр из демо" : hovered && !paused ? "Пауза для чтения" : playing ? "Ролик без звука" : "На паузе · нажмите ▶ для просмотра"}</p>
      </figcaption>
    </figure>
  );
}

export function ProductClips() {
  const motion = useSyncExternalStore(subscribeMotion, allowsMotion, serverMotion);
  return (
    <section id="product" className={styles.section} aria-labelledby="product-title">
      <div className={styles.sectionHead}>
        <p className={styles.kicker}>Продукт в действии</p>
        <h2 id="product-title" className={styles.sectionTitle}>От срочных позиций до плана платежей</h2>
        <p className={styles.sectionLead}>Посмотрите, как расчёт становится заказом и планом платежей. Пять коротких записей из демо, без звука.</p>
      </div>
      <p className={styles.clipHint}>Наведите на ролик, чтобы рассмотреть детали. Уберите курсор — просмотр продолжится.</p>
      <div className={styles.clips}>
        {CLIPS.map((clip, index) => <ClipCard key={clip.id} clip={clip} index={index} motion={motion} />)}
      </div>
    </section>
  );
}
