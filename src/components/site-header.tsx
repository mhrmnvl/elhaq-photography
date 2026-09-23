"use client";

import * as React from "react";
import {useTranslations} from "next-intl";

import {CloudinaryImage, type CloudinaryAsset} from "@/components/cloudinary-image";
import {Link, usePathname} from "@/i18n/navigation";
import type {Locale} from "@/lib/domain";

export function SiteHeader({locale, brandName, logo}: {locale: Locale; brandName: string; logo: {asset: CloudinaryAsset; alt: string} | null}): React.ReactElement {
  const nav = useTranslations("nav");
  const actions = useTranslations("actions");
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const otherLocale = locale === "en" ? "id" : "en";
  const links = [
    {href: "/", label: nav("home")},
    {href: "/portfolio", label: nav("portfolio")},
    {href: "/about", label: nav("about")},
    {href: "/contact", label: nav("contact")},
  ];

  return (
    <header className="border-b border-[var(--line)] px-6 py-4">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <Link href="/" locale={locale} className="flex min-h-11 items-center gap-3">
          {logo ? <CloudinaryImage asset={logo.asset} alt={logo.alt} sizes="44px" className="h-11 w-11 object-cover" /> : null}
          <span>{brandName}</span>
        </Link>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="inline-flex min-h-11 items-center md:hidden"
            aria-expanded={open}
            aria-controls="public-navigation"
            aria-label={open ? actions("closeMenu") : actions("openMenu")}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? actions("closeMenu") : actions("openMenu")}
          </button>
          <Link href={pathname} locale={otherLocale} className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]" aria-label={`${nav("language")}: ${otherLocale.toUpperCase()}`}>
            {otherLocale.toUpperCase()}
          </Link>
        </div>
        <nav id="public-navigation" aria-label={nav("primary")} className={open ? "flex basis-full flex-col gap-3 md:w-auto md:basis-auto md:flex-row" : "hidden gap-6 md:flex"}>
          {links.map((link) => <Link key={link.href} href={link.href} locale={locale} onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center">{link.label}</Link>)}
        </nav>
      </div>
    </header>
  );
}
