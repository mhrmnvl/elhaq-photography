"use client";

import * as React from "react";
import {flushSync} from "react-dom";

function shuffledOrder(count: number): number[] {
  const order = Array.from({length: count}, (_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function LoopingGallery({children}: {children: React.ReactNode}): React.ReactElement {
  const wallRef = React.useRef<HTMLDivElement>(null);
  const [copies, setCopies] = React.useState(1);
  const [orders, setOrders] = React.useState<number[][] | null>(null);
  const previousOrder = React.useRef<number[] | null>(null);
  const wrapped = React.useRef(false);
  const photos = React.Children.toArray(children);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      const firstOrder = shuffledOrder(React.Children.count(children));
      setOrders(Array.from({length: copies}, () => firstOrder));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [children, copies]);

  React.useEffect(() => {
    const wall = wallRef.current;
    const first = wall?.firstElementChild as HTMLElement | null;
    if (!wall || !first) return;
    let period = 0;
    let resizeFrame = 0;

    const measure = (): void => {
      period = first.getBoundingClientRect().height + 20;
      setCopies(Math.max(3, Math.ceil(window.innerHeight / period) + 2));
      for (const tail of wall.querySelectorAll<HTMLElement>('[data-gallery-tail-inner]')) {
        const columns = window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1;
        const tiles = Array.from(first.children).filter((child) => child.matches('[data-slot="photo-tile"]')).slice(-columns);
        tail.replaceChildren(...tiles.map((tile) => {
          const clone = tile.cloneNode(true) as HTMLElement;
          clone.removeAttribute("data-slot");
          return clone;
        }));
      }
    };
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(measure);
    });
    observer.observe(first);
    window.addEventListener("resize", measure);
    const openingObserver = new MutationObserver(() => {
      if (wall.hasAttribute("data-opening")) return;
      openingObserver.disconnect();
      setOrders((current) => current?.map((order, index) => index === 0 ? order : shuffledOrder(photos.length)) ?? current);
    });
    if (wall.hasAttribute("data-opening")) {
      openingObserver.observe(wall, {attributes: true, attributeFilter: ["data-opening"]});
    }

    const wrap = (): void => {
      if (wall.children.length < 2) return;
      period = (wall.children[1] as HTMLElement).getBoundingClientRect().top - first.getBoundingClientRect().top;
      if (!period) return;
      const start = wall.getBoundingClientRect().top + window.scrollY;
      const relative = window.scrollY - start;
      let target = window.scrollY;
      if (relative >= period) {
        target = start + (relative % period);
        wrapped.current = true;
      } else if (wrapped.current && relative < 0) {
        target = window.scrollY + period;
      }
      if (target === window.scrollY) return;

      // Commit the already-visible next cycle before moving the viewport back.
      // Only the offscreen future cycle receives a fresh order.
      if (!wall.hasAttribute("data-opening") && orders) {
        let nextOrders: number[][];
        if (relative >= period) {
          const steps = Math.max(1, Math.floor(relative / period));
          previousOrder.current = orders[Math.min(steps - 1, orders.length - 1)];
          nextOrders = [...orders.slice(steps), ...Array.from({length: Math.min(steps, orders.length)}, () => shuffledOrder(photos.length))];
        } else {
          const previous = previousOrder.current ?? shuffledOrder(photos.length);
          previousOrder.current = null;
          nextOrders = [previous, ...orders.slice(0, -1)];
        }
        flushSync(() => setOrders(nextOrders));
      }

      const active = document.activeElement;
      if (active instanceof HTMLElement && wall.contains(active)) {
        const cycle = active.closest("[data-gallery-cycle]");
        const links = cycle?.querySelectorAll<HTMLElement>('a');
        const index = links ? Array.from(links).indexOf(active) : -1;
        if (index >= 0) first.querySelectorAll<HTMLElement>('a')[index]?.focus({preventScroll: true});
      }
      window.scrollTo({top: target, behavior: "instant"});
    };
    window.addEventListener("scroll", wrap, {passive: true});
    return () => {
      observer.disconnect();
      openingObserver.disconnect();
      cancelAnimationFrame(resizeFrame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", wrap);
    };
  }, [copies, orders, photos.length]);

  return (
    <div ref={wallRef} data-photo-wall="" data-opening="" className="photo-wall relative flex w-full flex-col gap-5 px-6">
      {/* Jarak atas ikut di dalam tiap putaran, bukan di luar dinding, supaya jarak
          satu putaran bisa dicapai persis dan sambungannya tidak terlihat. */}
      {Array.from({length: copies}, (_, index) => (
        <div key={index} data-gallery-cycle="" className="relative grid grid-cols-1 gap-5 pt-14 sm:grid-cols-2 lg:grid-cols-3">
          {orders?.[index] ? orders[index].map((photoIndex) => photos[photoIndex]) : children}
          <div data-gallery-tail="" inert aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-9">
            <div data-gallery-tail-inner="" className="absolute inset-x-0 bottom-0 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
