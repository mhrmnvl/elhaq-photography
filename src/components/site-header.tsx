"use client";

import * as React from "react";
import {useTranslations} from "next-intl";
import {MenuIcon, XIcon} from "lucide-react";
import {cn} from "cn";

import {CloudinaryImage, type CloudinaryAsset} from "@/components/cloudinary-image";
import {Link, usePathname} from "@/i18n/navigation";
import type {Locale} from "@/lib/domain";

/** "@handle" dari URL Instagram, kalau URL-nya bisa dibaca. */
function instagramHandle(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const handle = new URL(url).pathname.split("/").filter(Boolean)[0];
    return handle ? `@${handle}` : null;
  } catch {
    return null;
  }
}

export function SiteHeader({
  locale,
  brandName,
  logo,
  instagramUrl = null,
  floating = true,
}: {
  locale: Locale;
  brandName: string;
  logo: {asset: CloudinaryAsset; alt: string} | null;
  instagramUrl?: string | null;
  /** Mode beranda: menempel di atas galeri, tanpa latar dan tanpa garis. */
  floating?: boolean;
}): React.ReactElement {
  const nav = useTranslations("nav");
  const actions = useTranslations("actions");
  const [open, setOpen] = React.useState(false);
  const panelContentRef = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const transparent = floating && pathname === "/";
  const handle = instagramHandle(instagramUrl);

  React.useEffect(() => {
    if (!floating) return;
    document.documentElement.dataset.siteMenu = open ? "open" : "closed";
    const content = panelContentRef.current;
    const measure = (): void => {
      document.documentElement.style.setProperty("--site-menu-height", `${content?.getBoundingClientRect().height ?? 0}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (content) observer.observe(content);
    return () => {
      observer.disconnect();
      delete document.documentElement.dataset.siteMenu;
      document.documentElement.style.removeProperty("--site-menu-height");
    };
  }, [open, floating]);

  // Tiap tujuan punya halamannya sendiri, jadi menu cuma navigasi biasa.
  const links = [
    {href: "/", label: nav("home")},
    {href: "/portfolio", label: nav("portfolio")},
    {href: "/about", label: nav("about")},
    {href: "/contact", label: nav("contact")},
  ];

  const isLinkActive = (href: string): boolean =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  // Handle ESC key to close the menu panel
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const brandMark = (
    <Link
      href="/"
      locale={locale}
      aria-label={`${brandName} - ${nav("home")}`}
      className={cn(
        "group absolute top-1/2 flex min-h-11 -translate-y-1/2 items-center gap-2 no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus)]",
        floating ? "left-24 sm:left-1/2 sm:-translate-x-1/2" : "left-1/2 -translate-x-1/2"
      )}
    >
      {!floating && logo ? (
        <CloudinaryImage
          asset={logo.asset}
          alt={logo.alt}
          sizes="32px"
          className="h-7 w-7 shrink-0 rounded-full border border-[var(--line)]/30 object-cover"
        />
      ) : null}
      <span
        className={cn(
          floating
             ? cn("whitespace-nowrap font-serif text-[clamp(0.75rem,3.5vw,1rem)] font-normal uppercase tracking-[0.06em] transition-opacity group-hover:opacity-70 sm:text-xl", open || !transparent ? "text-[var(--charcoal)]" : "text-white")
            : "text-sm font-medium uppercase tracking-[0.14em] text-[var(--charcoal)] transition-opacity group-hover:opacity-70 sm:text-base"
        )}
      >
        {brandName}
      </span>
    </Link>
  );

  const menuTrigger = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls="site-menu"
      aria-label={open ? actions("closeMenu") : actions("openMenu")}
      onClick={() => setOpen((prev) => !prev)}
      className={cn(
         "relative z-10 inline-flex min-h-11 min-w-11 items-center gap-2 text-[11px] uppercase tracking-[0.16em] transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]",
          floating ? cn("font-serif font-normal", open || !transparent ? "text-[var(--charcoal)]" : "text-white") : "font-medium text-[var(--charcoal)]"
      )}
    >
      {open ? (
        <XIcon className="size-4" aria-hidden="true" />
      ) : (
        <svg className="size-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M1 4h18M1 10h18M1 16h18" />
        </svg>
      )}
      <span className={floating ? "hidden sm:inline" : undefined}>{actions("menu")}</span>
    </button>
  );

  const rightActions = (
    <div className="relative z-10 flex shrink-0 items-center gap-1 sm:gap-2">
      {/* Navigasi inline hanya di header biasa; mode mengambang memakai MENU. */}
      <nav
        id="public-navigation"
        aria-label={nav("primary")}
        className={cn("items-center gap-6 lg:gap-8", floating ? "hidden" : "hidden md:flex")}
      >
        {links.map((link) => {
          const isActive = isLinkActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              locale={locale}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center text-xs uppercase tracking-[0.16em] no-underline transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus)]",
                isActive
                  ? "font-semibold text-[var(--charcoal)]"
                  : "font-medium text-[var(--charcoal)]/70 hover:text-[var(--charcoal)]"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Pemilih bahasa desktop + tautan Instagram hanya di header biasa. */}
      {!floating ? (
        <div className="hidden md:inline-flex items-center text-sm font-medium" aria-label={nav("language")}>
          <span className={cn("inline-flex min-h-11 items-center px-1.5", locale === "en" ? "font-semibold text-[var(--charcoal)]" : "text-[var(--charcoal)]/60")}>
            {locale === "en" ? (
              "EN"
            ) : (
              <Link href={pathname} locale="en" className="inline-flex min-h-11 items-center no-underline transition-colors hover:text-[var(--charcoal)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]" aria-label={`${nav("language")}: English`}>
                EN
              </Link>
            )}
          </span>
          <span className="select-none px-0.5 text-[var(--line)]/40" aria-hidden="true">/</span>
          <span className={cn("inline-flex min-h-11 items-center px-1.5", locale === "id" ? "font-semibold text-[var(--charcoal)]" : "text-[var(--charcoal)]/60")}>
            {locale === "id" ? (
              "ID"
            ) : (
              <Link href={pathname} locale="id" className="inline-flex min-h-11 items-center no-underline transition-colors hover:text-[var(--charcoal)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]" aria-label={`${nav("language")}: Bahasa Indonesia`}>
                ID
              </Link>
            )}
          </span>
        </div>
      ) : null}

      {!floating && instagramUrl ? (
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-[11px] font-medium tracking-[0.08em] text-[var(--charcoal)]/75 no-underline transition-colors hover:text-[var(--charcoal)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
        >
          {handle ?? "Instagram"}
        </a>
      ) : null}
    </div>
  );

  const panelContent = (
    <div ref={floating ? panelContentRef : undefined} className={floating ? "flex flex-col items-center gap-2 px-6 pt-3 pb-4 sm:gap-3 sm:pt-4 sm:pb-5" : undefined}>
      <nav aria-label={nav("primary")} className={floating ? "flex max-w-full items-center justify-center gap-2 sm:gap-8" : "flex flex-col px-4 sm:px-6"}>
        {links.map((link) => {
          const isActive = isLinkActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              locale={locale}
              onClick={() => setOpen(false)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                  "flex min-h-11 items-center justify-between py-1 no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]",
                  floating ? "min-w-11 justify-center whitespace-nowrap font-serif text-base leading-tight font-normal tracking-normal sm:text-lg" : "border-b border-[var(--line)]/10 py-2 text-xs font-medium uppercase tracking-[0.16em]",
                 isActive
                   ? cn("text-[var(--charcoal)]", !floating && "font-semibold")
                  : "text-[var(--charcoal)]/70 hover:text-[var(--charcoal)]"
              )}
            >
               <span className={floating && isActive ? "underline underline-offset-8 decoration-1" : undefined}>{link.label}</span>
               {isActive && !floating ? (
                <span className="size-1.5 rounded-full bg-[var(--charcoal)]" aria-hidden="true" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {floating ? (
        <div className="flex flex-wrap items-center justify-center gap-x-6">
        <nav aria-label={nav("language")} className="flex shrink-0 items-center gap-2 font-serif text-sm text-[var(--charcoal)]">
          {(["id", "en"] as const).map((language, index) => (
            <React.Fragment key={language}>
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              <Link
                href={pathname}
                locale={language}
                onClick={() => setOpen(false)}
                aria-current={locale === language ? "true" : undefined}
                aria-label={`${nav("language")}: ${language === "id" ? "Bahasa Indonesia" : "English"}`}
                className={cn("inline-flex min-h-11 min-w-11 items-center justify-center no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]", locale === language ? "underline underline-offset-8 decoration-1" : "hover:underline hover:underline-offset-8")}
              >
                {language.toUpperCase()}
              </Link>
            </React.Fragment>
          ))}
        </nav>
        {instagramUrl ? (
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-3 font-serif text-sm text-[var(--charcoal)] no-underline hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
          >
            <span>Instagram</span>
            {handle ? <span>{handle}</span> : null}
          </a>
        ) : null}
        </div>
      ) : (
      <div className="mt-3 flex items-center justify-between px-4 sm:px-6">
        <span className="text-xs font-medium text-[var(--charcoal)]/60">{nav("language")}</span>
        <div className="flex items-center gap-1.5">
          <Link
            href={pathname}
            locale="en"
            onClick={() => setOpen(false)}
            className={cn(
              "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3.5 text-sm no-underline transition-colors",
              locale === "en"
                ? "bg-[var(--charcoal)] font-semibold text-[var(--ivory)]"
                : "text-[var(--charcoal)]/70 hover:text-[var(--charcoal)]"
            )}
            aria-label={`${nav("language")}: English`}
          >
            EN
          </Link>
          <Link
            href={pathname}
            locale="id"
            onClick={() => setOpen(false)}
            className={cn(
              "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3.5 text-sm no-underline transition-colors",
              locale === "id"
                ? "bg-[var(--charcoal)] font-semibold text-[var(--ivory)]"
                : "text-[var(--charcoal)]/70 hover:text-[var(--charcoal)]"
            )}
            aria-label={`${nav("language")}: Bahasa Indonesia`}
          >
            ID
          </Link>
        </div>
      </div>
      )}
    </div>
  );

  if (floating) {
    // Panel dipisah dari header: header memakai mix-blend-mode, dan panel butuh latar pekat.
    return (
      <>
        <header className={cn("inset-x-0 top-0 z-40 w-full", transparent ? "fixed" : "sticky", open || !transparent ? "bg-[var(--ivory)]" : "site-header--knockout")}>
          <div className="relative mx-auto flex h-14 w-full items-center justify-between px-4 sm:px-6">
            {menuTrigger}
            {brandMark}
            <div className="relative z-10 flex items-center" aria-hidden="true" />
          </div>
        </header>
        <div
          id="site-menu"
          aria-hidden={open ? undefined : true}
          className={cn(
              "fixed inset-x-0 top-14 z-30 grid bg-[var(--ivory)] font-serif transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none",
              open ? "grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0 pointer-events-none"
          )}
        >
          <div className="min-h-0 overflow-hidden">{panelContent}</div>
        </div>
      </>
    );
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--line)]/25 bg-[var(--ivory)]/90 backdrop-blur-md">
      <div className="relative mx-auto flex h-14 w-full items-center justify-between px-4 sm:px-6">
        <div className="relative z-10 flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? actions("closeMenu") : actions("openMenu")}
            onClick={() => setOpen((prev) => !prev)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-[var(--charcoal)] transition-colors hover:bg-[var(--charcoal)]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] md:hidden"
          >
            {open ? <XIcon className="size-5" aria-hidden="true" /> : <MenuIcon className="size-5" aria-hidden="true" />}
            <span className="sr-only">{actions("menu")}</span>
          </button>
        </div>
        {brandMark}
        {rightActions}
      </div>

      <div
        id="site-menu"
        aria-hidden={open ? undefined : true}
        className={cn(
          "absolute left-0 right-0 top-full z-40 overflow-hidden border-t border-[var(--line)]/20 bg-[var(--ivory)] shadow-sm transition-all duration-200 ease-in-out motion-reduce:transition-none md:hidden",
          open ? "max-h-96 py-3 opacity-100" : "invisible max-h-0 py-0 opacity-0 pointer-events-none"
        )}
      >
        {panelContent}
      </div>
    </header>
  );
}
