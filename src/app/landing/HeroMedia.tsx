"use client";

import { useState, useSyncExternalStore } from "react";
import styles from "./landing.module.css";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
export const POSTER_SRC = "/landing/mountains-poster.jpg";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Full-bleed mountains loop. Server render and reduced motion: the still only. */
export function HeroMedia() {
  const allowsMotion = useSyncExternalStore(subscribe, () => !window.matchMedia(REDUCED_MOTION).matches, () => false);
  const [playing, setPlaying] = useState(false);

  return (
    <div className={styles.media} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static poster; keeps the hero outside the image optimiser */}
      <img className={styles.poster} src={POSTER_SRC} alt="" width={1920} height={1072} fetchPriority="high" decoding="async" />
      {allowsMotion && (
        <video
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
          <source src="/landing/mountains.mp4" type="video/mp4" />
        </video>
      )}
      <div className={styles.shade} />
    </div>
  );
}
