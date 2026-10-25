import type * as React from "react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {ArrowRight} from "lucide-react";

import {CloudinaryImage} from "@/components/cloudinary-image";
import {EmptyState} from "@/components/data-state";
import {SiteFooter} from "@/components/site-footer";
import {SiteHeader} from "@/components/site-header";
import {Link} from "@/i18n/navigation";
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
  const [settings, nav, state, a11y, home] = await Promise.all([
    getPublicSiteSettings(),
    getTranslations({locale, namespace: "nav"}),
    getTranslations({locale, namespace: "state"}),
    getTranslations({locale, namespace: "a11y"}),
    getTranslations({locale, namespace: "home"}),
  ]);
  const brandName = settings?.brandName || "Elhaq Photography";
  const logo = settings?.logo ? {asset: settings.logo, alt: text(settings.logoAlt, locale)} : null;
  const headline = text(settings?.homeHeadline, locale) || nav("about");
  const introduction = text(settings?.personalIntroduction, locale);
  const story = text(settings?.aboutStory, locale);
  const location = text(settings?.location, locale);
  const serviceArea = text(settings?.serviceArea, locale);
  const portrait = settings?.about ?? null;
  const hasStory = Boolean(introduction || story || location || serviceArea);

  return (
    <main className="bg-[var(--ivory)] text-[var(--charcoal)]">
      <SiteHeader
        locale={locale}
        brandName={brandName}
        logo={logo}
        instagramUrl={settings?.instagramUrl ?? null}
      />

      <article className="px-6 pt-10 pb-20 sm:px-8 md:px-12 md:pt-14 lg:pb-28">
        <div className="mx-auto w-full max-w-[1500px]">
          {/* Pernyataan editorial besar, memakai heading serif global. */}
          <h1 className="m-0 max-w-4xl text-balance">{headline}</h1>

          {hasStory || portrait ? (
            <div className="mt-10 grid gap-10 md:mt-16 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:items-start md:gap-16 lg:gap-24">
              <div className="min-w-0">
                {portrait ? (
                  <CloudinaryImage
                    asset={portrait}
                    alt={text(settings?.aboutAlt, locale) || a11y("photo")}
                    sizes="(min-width: 768px) 45vw, 100vw"
                    priority
                    className="w-full"
                  />
                ) : null}
              </div>

              <div className="min-w-0 max-w-2xl space-y-6">
                {introduction ? (
                  <p className="m-0 text-xl leading-snug text-[var(--charcoal)] sm:text-2xl md:text-3xl">
                    {introduction}
                  </p>
                ) : null}
                {story ? (
                  <p className="m-0 text-base leading-relaxed text-[var(--charcoal)]/80">
                    {story}
                  </p>
                ) : null}
                {location || serviceArea ? (
                  <dl className="m-0 flex flex-col gap-1.5 pt-2 text-xs">
                    {location ? (
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="font-semibold uppercase tracking-[0.12em] text-[var(--charcoal)]/50">
                          {home("locationLabel")}
                        </dt>
                        <dd className="m-0 text-[var(--charcoal)]/75">{location}</dd>
                      </div>
                    ) : null}
                    {serviceArea ? (
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="font-semibold uppercase tracking-[0.12em] text-[var(--charcoal)]/50">
                          {home("coverageLabel")}
                        </dt>
                        <dd className="m-0 text-[var(--charcoal)]/75">{serviceArea}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}

                <Link
                  href="/contact"
                  locale={locale}
                  className="inline-flex min-h-11 items-center gap-2 border-b border-[var(--charcoal)]/30 text-xs font-medium uppercase tracking-[0.16em] text-[var(--charcoal)] no-underline transition-colors hover:border-[var(--charcoal)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus)]"
                >
                  {home("inquire")}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-12">
              <EmptyState
                title={state("emptyTitle")}
                description={state("emptyDescription")}
                action={{href: "/contact", label: nav("contact")}}
              />
            </div>
          )}
        </div>
      </article>

      <SiteFooter
        locale={locale}
        brandName={brandName}
        instagramUrl={settings?.instagramUrl ?? null}
        whatsappNumber={settings?.whatsappNumber ?? null}
      />
    </main>
  );
}
