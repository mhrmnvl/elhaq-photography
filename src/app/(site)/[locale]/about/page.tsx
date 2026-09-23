import type * as React from "react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {CloudinaryImage} from "@/components/cloudinary-image";
import {EmptyState} from "@/components/data-state";
import {SiteFooter} from "@/components/site-footer";
import {SiteHeader} from "@/components/site-header";
import type {Locale} from "@/lib/domain";
import {getPublicSiteSettings} from "@/server/public-content";

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
  const description = text(settings?.aboutStory, locale);

  return {
    title: `${nav("about")} | ${brandName}`,
    ...(description ? {description} : {}),
  };
}

export default async function AboutPage({params}: PageProps): Promise<React.ReactElement> {
  const {locale} = await params;
  const [settings, nav, state, a11y] = await Promise.all([
    getPublicSiteSettings(),
    getTranslations({locale, namespace: "nav"}),
    getTranslations({locale, namespace: "state"}),
    getTranslations({locale, namespace: "a11y"}),
  ]);
  const brandName = settings?.brandName || "Elhaq Photography";
  const logo = settings?.logo ? {asset: settings.logo, alt: text(settings.logoAlt, locale)} : null;
  const introduction = text(settings?.personalIntroduction, locale);
  const story = text(settings?.aboutStory, locale);
  const location = text(settings?.location, locale);
  const serviceArea = text(settings?.serviceArea, locale);

  return (
    <main>
      <SiteHeader locale={locale} brandName={brandName} logo={logo} />
      <article className="px-6 py-16 sm:py-20 md:px-12 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-start md:gap-20">
          <div>
            {settings?.about ? (
              <CloudinaryImage asset={settings.about} alt={text(settings.aboutAlt, locale) || a11y("photo")} sizes="(min-width: 768px) 40vw, 100vw" priority />
            ) : (
              <div aria-label={a11y("photoPlaceholder")} className="flex min-h-80 items-center justify-center border border-[var(--line)] px-6 text-center text-sm">
                {a11y("photoPlaceholder")}
              </div>
            )}
          </div>
          <div className="min-w-0 max-w-2xl space-y-8">
            <h1>{nav("about")}</h1>
            {introduction || story || location || serviceArea ? (
              <div className="space-y-6 text-lg leading-8">
                {introduction ? <p>{introduction}</p> : null}
                {story ? <p>{story}</p> : null}
                {location ? <p>{location}</p> : null}
                {serviceArea ? <p>{serviceArea}</p> : null}
              </div>
            ) : (
              <EmptyState title={state("emptyTitle")} description={state("emptyDescription")} action={{href: "/contact", label: nav("contact")}} />
            )}
          </div>
        </div>
      </article>
      <SiteFooter locale={locale} brandName={brandName} instagramUrl={settings?.instagramUrl ?? null} whatsappNumber={settings?.whatsappNumber ?? null} />
    </main>
  );
}
