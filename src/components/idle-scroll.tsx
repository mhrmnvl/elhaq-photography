"use client";

import * as React from "react";

import {
  IDLE_DELAY_MS,
  IDLE_SPEED_PX_PER_SECOND,
  INTRO_GALLERY_MS,
  atBottom,
  introGalleryTop,
  nextScrollTop,
} from "@/lib/idle-scroll";
import {INTRO_DONE_EVENT} from "@/lib/site-intro";

/**
 * Pengendali gulir otomatis beranda.
 *
 * Setelah layar pembuka selesai, galeri bergerak cepat satu putaran penuh lalu
 * kembali tepat ke posisi awalnya, jadi perpindahannya mulus dan tidak menyisakan
 * lompatan. Sesudah itu, kalau halaman tidak mendapat aksi, halaman menggulir sendiri
 * dengan pelan dan galeri menutup putarannya tanpa terasa.
 *
 * Setiap aksi menghentikan gulir otomatis dan memulai ulang hitungan idle, jadi
 * perilaku ini berulang tanpa pernah melawan pengguna.
 */
export function IdleScroll({wallSelector = "[data-photo-wall]"}: {wallSelector?: string}): null {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const wall = document.querySelector<HTMLElement>(wallSelector);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      wall?.removeAttribute("data-opening");
      return;
    }

    let idleTimer = 0;
    let frame = 0;
    let introFrame = 0;
    let opening = false;
    let introStarted = 0;
    let introFrom = 0;
    let introDistance = 0;
    let lastFrame = 0;
    let finishTimer = 0;
    let ready = false;

    const stop = (): void => {
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      if (introFrame) {
        window.cancelAnimationFrame(introFrame);
        introFrame = 0;
      }
      opening = false;
    };

    const atDocumentBottom = (): boolean =>
      atBottom(window.scrollY, window.innerHeight, document.documentElement.scrollHeight);

    const maxTop = (): number => document.documentElement.scrollHeight - window.innerHeight;

    // Jarak satu putaran galeri, diukur dari dua salinan dinding yang berurutan.
    const galleryPeriod = (): number => {
      const cycles = document.querySelectorAll<HTMLElement>("[data-gallery-cycle]");
      if (cycles.length < 2) return 0;
      return cycles[1].getBoundingClientRect().top - cycles[0].getBoundingClientRect().top;
    };

    const tick = (now: number): void => {
      frame = 0;
      if (opening || atDocumentBottom()) return;

      const delta = lastFrame ? now - lastFrame : 0;
      lastFrame = now;
      const limit = maxTop();
      const next = nextScrollTop(window.scrollY, limit, IDLE_SPEED_PX_PER_SECOND, delta);

      window.scrollTo({top: next, behavior: "instant"});
      if (next >= limit) return;
      frame = window.requestAnimationFrame(tick);
    };

    // Animasi pembuka: satu putaran penuh galeri, melambat di kedua ujungnya.
    const openFrame = (now: number): void => {
      introFrame = 0;
      if (!opening) return;

      const elapsed = now - introStarted;
      window.scrollTo({top: introGalleryTop(introFrom, introDistance, elapsed, INTRO_GALLERY_MS), behavior: "instant"});
      if (elapsed >= INTRO_GALLERY_MS) {
        window.scrollTo({top: introFrom, behavior: "instant"});
        wall?.setAttribute("data-opening", "finishing");
        finishTimer = window.setTimeout(() => {
          opening = false;
          ready = true;
          wall?.removeAttribute("data-opening");
          schedule();
        }, 600);
        return;
      }
      introFrame = window.requestAnimationFrame(openFrame);
    };

    const schedule = (): void => {
      if (opening) {
        ready = true;
        window.clearTimeout(finishTimer);
        wall?.removeAttribute("data-opening");
      }
      stop();
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        if (!ready || atDocumentBottom()) return;
        wall?.setAttribute("data-idle-scrolling", "");
        lastFrame = 0;
        frame = window.requestAnimationFrame(tick);
      }, IDLE_DELAY_MS);
    };

    const startOpening = (): void => {
      const period = galleryPeriod();
      if (period <= 0) {
        ready = true;
        wall?.removeAttribute("data-opening");
        schedule();
        return;
      }
      opening = true;
      introFrom = 0;
      introDistance = period;
      introStarted = performance.now();
      introFrame = window.requestAnimationFrame(openFrame);
    };

    const events: Array<[keyof WindowEventMap, EventListener]> = [
      ["pointerdown", schedule],
      ["wheel", schedule],
      ["touchstart", schedule],
      ["keydown", schedule],
    ];

    const onPointerMove = (): void => {
      if (ready) {
        wall?.removeAttribute("data-idle-scrolling");
        schedule();
      }
    };
    window.addEventListener("pointermove", onPointerMove, {passive: true});

    for (const [name, listener] of events) {
      window.addEventListener(name, listener, {passive: true});
    }

    // Layar pembuka selalu tayang, jadi gulir otomatis menunggu sinyal selesainya
    // supaya tidak berebut dengan tirai yang sedang tersingkap.
    window.addEventListener(INTRO_DONE_EVENT, startOpening, {once: true});

    return () => {
      stop();
      window.clearTimeout(idleTimer);
      window.clearTimeout(finishTimer);
      wall?.removeAttribute("data-idle-scrolling");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener(INTRO_DONE_EVENT, startOpening);
      for (const [name, listener] of events) {
        window.removeEventListener(name, listener);
      }
    };
  }, [wallSelector]);

  return null;
}
