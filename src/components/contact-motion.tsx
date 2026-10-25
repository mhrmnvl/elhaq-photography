"use client";

import * as React from "react";

export function ContactMotion({children}: {children: React.ReactNode}): React.ReactElement {
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let nextFieldAt = performance.now() + 1600;
    const observer = new IntersectionObserver((entries) => {
      entries.filter((entry) => entry.isIntersecting).forEach((entry, index) => {
        const target = (entry.target.matches(".contact-heading-line") ? entry.target.firstElementChild : entry.target) as HTMLElement;
        let delay = index * 180;
        if (target.classList.contains("contact-form__row")) {
          const now = performance.now();
          const revealAt = Math.max(nextFieldAt, now);
          delay = revealAt - now;
          nextFieldAt = revealAt + 400;
        }
        target.style.setProperty("--contact-reveal-delay", `${delay}ms`);
        target.setAttribute("data-contact-visible", "");
        observer.unobserve(entry.target);
      });
    }, {threshold: 0.1});
    for (const target of root.querySelectorAll("[data-contact-reveal]")) observer.observe(target.closest(".contact-heading-line") ?? target);
    const revealFocused = (event: FocusEvent): void => {
      const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-contact-reveal]") : null;
      if (!target) return;
      target.setAttribute("data-contact-visible", "");
      target.setAttribute("data-contact-interacted", "");
      observer.unobserve(target);
    };
    root.addEventListener("focusin", revealFocused);
    root.setAttribute("data-contact-motion", "");
    return () => {
      observer.disconnect();
      root.removeEventListener("focusin", revealFocused);
      root.removeAttribute("data-contact-motion");
    };
  }, []);

  return <div ref={rootRef} className="contact-motion">{children}</div>;
}
