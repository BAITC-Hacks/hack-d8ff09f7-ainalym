"use client";

import { useState, useSyncExternalStore } from "react";
import styles from "./landing.module.css";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const PHONE = "(max-width: 650px)";
export const POSTER_SRC = "/landing/hero/hero-brand-poster.webp";
const MP4_SRC = "/landing/hero/hero-brand.mp4";
const MP4_PHONE_SRC = "/landing/hero/hero-brand-720.mp4";
const WEBM_SRC = "/landing/hero/hero-brand.webm";

function subscribeTo(media: string) {
  return (onChange: () => void): (() => void) => {
    const query = window.matchMedia(media);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  };
}
const subscribeMotion = subscribeTo(REDUCED_MOTION);
const subscribePhone = subscribeTo(PHONE);

/** Full-bleed brand loop from the owner reference prototype. Server render and reduced motion: the still only. */
export function HeroMedia() {
  const allowsMotion = useSyncExternalStore(subscribeMotion, () => !window.matchMedia(REDUCED_MOTION).matches, () => false);
  const phone = useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);
  const [playing, setPlaying] = useState(false);

  return (
    <div className={styles.media} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static poster; keeps the hero outside the image optimiser */}
      <img className={styles.poster} src={POSTER_SRC} alt="" width={1600} height={900} fetchPriority="high" decoding="async" />
      {allowsMotion && (
        <video
          key={phone ? "phone" : "desktop"}
          className={styles.video}
          data-playing={playing ? "true" : undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={POSTER_SRC}
          onPlaying={() => setPlaying(true)}
          ref={(video) => {
            if (!video) return;
            video.muted = true;
            void video.play().catch(() => undefined);
          }}
        >
          <source src={phone ? MP4_PHONE_SRC : MP4_SRC} type="video/mp4" />
          <source src={WEBM_SRC} type="video/webm" />
        </video>
      )}
      <div className={styles.shade} />
    </div>
  );
}
