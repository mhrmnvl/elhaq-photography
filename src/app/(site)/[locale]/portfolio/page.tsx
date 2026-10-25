import type * as React from "react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {PortfolioFilter} from "@/components/portfolio-filter";
import {SiteFooter} from "@/components/site-footer";
import {SiteHeader} from "@/components/site-header";
import type {Locale} from "@/lib/domain";
import {listPublishedAlbums, getPublicSiteSettings} from "@/server/public-content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {params: Promise<{locale: Locale}>};

function text(value: {en: string; id: string} | null | undefined, locale: Locale): string {
  return value?.[locale] ?? "";
}

export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {locale} = await params;
  const [settings, nav] = await Promise.all([
    getPublicSiteSettings(),
    getTranslations({locale, namespace: "nav"}),
  ]);
  const brandName = settings?.brandName || "Elhaq Photography";
  const description = text(settings?.homeDescription, locale);

  return {
    title: `${nav("portfolio")} | ${brandName}`,
    ...(description ? {description} : {}),
  };
}

export default async function PortfolioPage({params}: PageProps): Promise<React.ReactElement> {
  const {locale} = await params;
  const [settings, albums, nav, category, portfolio, actions] = await Promise.all([
    getPublicSiteSettings(),
    listPublishedAlbums(),
    getTranslations({locale, namespace: "nav"}),
    getTranslations({locale, namespace: "category"}),
    getTranslations({locale, namespace: "portfolio"}),
    getTranslations({locale, namespace: "actions"}),
  ]);
  const brandName = settings?.brandName || "Elhaq Photography";
  const logo = settings?.logo ? {asset: settings.logo, alt: text(settings.logoAlt, locale)} : null;

  return (
    <main>
      <SiteHeader locale={locale} brandName={brandName} logo={logo} instagramUrl={settings?.instagramUrl ?? null} />
      <section className="px-6 py-16 sm:py-20 md:px-12 lg:py-28">
        <div className="mx-auto max-w-7xl space-y-12">
          <h1>{nav("portfolio")}</h1>
          <PortfolioFilter
            albums={albums}
            locale={locale}
            labels={{wedding: category("wedding"), events: category("events"), other: category("other")}}
            allLabel={portfolio("all")}
            filterLabel={portfolio("filter")}
            emptyTitle={portfolio("emptyTitle")}
            emptyDescription={portfolio("emptyDescription")}
            backHomeLabel={actions("backToHome")}
          />
        </div>
      </section>
      <SiteFooter locale={locale} brandName={brandName} instagramUrl={settings?.instagramUrl ?? null} whatsappNumber={settings?.whatsappNumber ?? null} />
    </main>
  );
}
