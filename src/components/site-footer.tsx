"use client";

import * as React from "react";
import {useTranslations} from "next-intl";
import {ArrowUp, ArrowUpRight} from "lucide-react";

import {Link} from "@/i18n/navigation";
import type {Locale} from "@/lib/domain";

export function SiteFooter({
  locale,
  brandName,
  instagramUrl,
  whatsappNumber,
}: {
  locale: Locale;
  brandName: string;
  instagramUrl: string | null;
  whatsappNumber: string | null;
}): React.ReactElement {
  const footer = useTranslations("footer");
  const nav = useTranslations("nav");
  const currentYear = new Date().getFullYear();

  const navLinks = [
    {href: "/", label: nav("home")},
    {href: "/portfolio", label: nav("portfolio")},
    {href: "/about", label: nav("about")},
    {href: "/contact", label: nav("contact")},
  ];

  const scrollToTop = (): void => {
    if (typeof window !== "undefined") {
      window.scrollTo({top: 0, behavior: "smooth"});
    }
  };

  return (
    <footer
      lang={locale}
      className="border-t border-[var(--line)]/25 bg-[var(--ivory)] text-[var(--charcoal)] transition-colors"
    >
      <div className="mx-auto max-w-7xl px-4 pt-2.5 sm:pt-3 pb-1 sm:pb-1.5 sm:px-6">
        {/* Top 3-Column Grid with tight, compact gaps */}
        <div className="grid grid-cols-1 gap-2.5 sm:gap-4 md:grid-cols-[1.4fr_1fr_1fr] lg:gap-6">
          {/* Brand & Description Column */}
          <div className="flex flex-col items-start gap-0.5">
            <Link
              href="/"
              locale={locale}
              className="inline-flex items-center text-sm sm:text-base font-semibold tracking-tight text-[var(--charcoal)] no-underline hover:opacity-80 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] leading-snug"
            >
              {brandName}
            </Link>
            <p className="text-xs text-[var(--charcoal)]/65 leading-snug max-w-xs m-0">
              {footer("tagline")}
            </p>
          </div>

          {/* Navigation Column */}
          <div className="flex flex-col gap-0.5">
            <h3 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--charcoal)]/40 m-0">
              {footer("navigation")}
            </h3>
            <nav className="flex flex-col" aria-label={nav("primary")}>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  locale={locale}
                  className="inline-flex py-[1px] text-xs sm:text-sm text-[var(--charcoal)]/75 hover:text-[var(--charcoal)] no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] leading-snug"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Connect Column */}
          <div className="flex flex-col gap-0.5">
            <h3 className="text-[11px] uppercase tracking-wider font-semibold text-[var(--charcoal)]/40 m-0">
              {footer("social")}
            </h3>
            <div className="flex flex-col">
              {instagramUrl ? (
                <a
                  className="group inline-flex items-center gap-1 py-[1px] text-xs sm:text-sm text-[var(--charcoal)]/75 hover:text-[var(--charcoal)] no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] leading-snug"
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>Instagram</span>
                  <ArrowUpRight className="size-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" aria-hidden="true" />
                </a>
              ) : null}
              {whatsappNumber ? (
                <a
                  className="group inline-flex items-center gap-1 py-[1px] text-xs sm:text-sm text-[var(--charcoal)]/75 hover:text-[var(--charcoal)] no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] leading-snug"
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>WhatsApp</span>
                  <ArrowUpRight className="size-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" aria-hidden="true" />
                </a>
              ) : null}
              <Link
                href="/contact"
                locale={locale}
                className="inline-flex py-[1px] text-xs sm:text-sm text-[var(--charcoal)]/75 hover:text-[var(--charcoal)] no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] leading-snug"
              >
                {nav("contact")}
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Back-to-top */}
        <div className="mt-2 sm:mt-2.5 pt-1.5 sm:pt-2 border-t border-[var(--line)]/15 flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between gap-1.5 text-xs">
          <p className="text-[11px] sm:text-xs text-[var(--charcoal)]/50 m-0 leading-normal">
            &copy; {currentYear} {brandName}. {footer("rights")}
          </p>
          <button
            type="button"
            onClick={scrollToTop}
            className="group inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-[var(--charcoal)]/60 hover:text-[var(--charcoal)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] leading-normal"
            aria-label={footer("backToTop")}
          >
            <span>{footer("backToTop")}</span>
            <ArrowUp className="size-3 group-hover:-translate-y-0.5 transition-transform" aria-hidden="true" />
          </button>
        </div>
      </div>
    </footer>
  );
}
