"use client";

import * as React from "react";

import {
  INTRO_CURTAIN_MS,
  INTRO_CYCLES,
  INTRO_DONE_EVENT,
  INTRO_LETTER_DELAY_MS,
  INTRO_LETTER_MS,
  introPercent,
  introTimeline,
  splitBrandWords,
} from "@/lib/site-intro";

type Phase = "loading" | "waving" | "curtain" | "done";

/**
 * Layar pembuka beranda: brand besar satu baris di atas, progres animasi di bawah.
 *
 * Teksnya sudah sebesar dan selebar keadaan akhir sejak awal, jadi yang bergerak hanya
 * hurufnya: tiap huruf naik keluar ke atas dan langsung digantikan huruf yang sama masuk
 * dari bawah. Setelah satu lintasan, teks yang utuh naik bersama panel tirai.
 *
 * Dirender dalam keadaan tampil oleh server supaya galeri tidak berkedip lebih dulu.
 * Konten di bawahnya dibuat inert selama overlay aktif.
 */
export function SiteIntro({
  brand,
  photoCount,
}: {
  brand: string;
  photoCount: number;
}): React.ReactElement | null {
  const [phase, setPhase] = React.useState<Phase>("loading");
  const [staged, setStaged] = React.useState(false);
  const [resolved, setResolved] = React.useState(0);

  const words = React.useMemo(() => splitBrandWords(brand), [brand]);
  const wordOffsets = React.useMemo(
    () => words.map((_, index) => words.slice(0, index).reduce((total, word) => total + word.length, 0)),
    [words]
  );
  const letterCount = words.reduce((total, word) => total + word.length, 0);
  const percent = introPercent(resolved, photoCount);

  // Percentage tracks the opening choreography, not downloaded bytes.
  React.useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startedAt = performance.now();
    let frame = 0;
    const duration = Math.max(1, introTimeline(letterCount).leave * 0.8);
    const timer = window.setTimeout(() => {
      if (reducedMotion) {
        setResolved(photoCount);
        setPhase("done");
        return;
      }
      setStaged(true);
      setPhase("waving");
      const tick = (now: number): void => {
        const progress = Math.min(1, (now - startedAt) / duration);
        setResolved(progress * photoCount);
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [letterCount, photoCount]);

  // Sekali tahap pertama mulai, sisa tahapnya berjalan sendiri mengikuti timeline.
  // Sengaja tidak bergantung pada `phase` supaya timer tidak dibatalkan saat tahap berganti.
  // Reduced motion tidak pernah menyalakan `staged`, jadi urutan ini dilewati sama sekali.
  React.useEffect(() => {
    if (!staged) return;
    const timeline = introTimeline(letterCount);
    const timers = [
      window.setTimeout(() => setPhase("curtain"), timeline.curtain),
      window.setTimeout(() => setPhase("done"), timeline.done),
    ];
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [staged, letterCount]);

  // Selama overlay aktif: konten di bawah tidak bisa dijangkau dan tidak bisa digulir.
  React.useEffect(() => {
    const content = document.getElementById("site-content");
    const active = phase !== "done";
    if (content) {
      if (active) {
        content.setAttribute("inert", "");
        content.setAttribute("aria-hidden", "true");
      } else {
        content.removeAttribute("inert");
        content.removeAttribute("aria-hidden");
      }
    }
    document.documentElement.style.overflow = active ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [phase]);

  // Setelah selesai: beri tahu animasi gulir pembuka bahwa gilirannya mulai.
  React.useEffect(() => {
    if (phase !== "done") return;
    window.dispatchEvent(new Event(INTRO_DONE_EVENT));
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      data-slot="site-intro"
      data-phase={phase}
      aria-hidden="true"
      style={
        {
          "--intro-letter-step": `${INTRO_LETTER_MS}ms`,
          "--intro-cycles": INTRO_CYCLES,
          "--intro-letter-ms": `${INTRO_LETTER_MS}ms`,
          "--intro-curtain-ms": `${INTRO_CURTAIN_MS}ms`,
        } as React.CSSProperties
      }
      className="site-intro fixed inset-0 z-[60] overflow-hidden bg-[var(--charcoal)] text-[var(--ivory)]"
    >
      <div className="site-intro__group">
        <p data-slot="intro-text" className="site-intro__text font-serif font-normal">
          {words.map((word, wordIndex) => (
            <span key={`${word.join("")}-${wordIndex}`} className="site-intro__word">
              {word.map((letter, letterIndex) => (
                <span
                  key={`${letter}-${letterIndex}`}
                  style={{"--intro-letter-delay": `${(wordOffsets[wordIndex] + letterIndex) * INTRO_LETTER_DELAY_MS}ms`} as React.CSSProperties}
                  className="site-intro__slot"
                >
                  {/* Dua salinan huruf yang sama: satu naik keluar, satu masuk dari bawah. */}
                  <span data-letter={letter} className="site-intro__letter site-intro__letter--out">
                    {letter}
                  </span>
                  <span aria-hidden="true" className="site-intro__letter site-intro__letter--in">
                    {letter}
                  </span>
                </span>
              ))}
            </span>
          ))}
        </p>
        <p data-slot="intro-percent" className="absolute inset-x-0 top-[calc(100dvh-9rem)] m-0 text-center text-3xl tabular-nums tracking-[0.08em] text-[var(--ivory)] sm:text-5xl">
          {percent}%
        </p>
      </div>
    </div>
  );
}
