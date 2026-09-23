import type * as React from "react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {ContactForm} from "@/components/contact-form";
import {CloudinaryImage} from "@/components/cloudinary-image";
import {EmptyState} from "@/components/data-state";
import {SiteFooter} from "@/components/site-footer";
import {SiteHeader} from "@/components/site-header";
import {Link} from "@/i18n/navigation";
import type {Locale} from "@/lib/domain";
import {getFeaturedPublishedAlbums, getPublicSiteSettings} from "@/server/public-content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {params: Promise<{locale: Locale}>};
type BilingualValue = {en: string; id: string} | null | undefined;

function text(value: BilingualValue, locale: Locale): string {
  return value?.[locale] ?? "";
}

function emptyService(en: string, id: string): {title: {en: string; id: string}; description: {en: string; id: string}} {
  return {title: {en, id}, description: {en: "", id: ""}};
}

export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {locale} = await params;
  const settings = await getPublicSiteSettings();
  const brandName = settings?.brandName || "Elhaq Photography";
  const headline = text(settings?.homeHeadline, locale);
  const description = text(settings?.homeDescription, locale);

  return {
    title: headline ? `${headline} | ${brandName}` : brandName,
    ...(description ? {description} : {}),
  };
}

export default async function HomePage({params}: PageProps): Promise<React.ReactElement> {
  const {locale} = await params;
  const [settings, albums, nav, state, a11y] = await Promise.all([
    getPublicSiteSettings(),
    getFeaturedPublishedAlbums(),
    getTranslations({locale, namespace: "nav"}),
    getTranslations({locale, namespace: "state"}),
    getTranslations({locale, namespace: "a11y"}),
  ]);
  const services = settings?.services ?? {
    wedding: emptyService("Wedding", "Pernikahan"),
    events: emptyService("Events", "Acara"),
    other: emptyService("Other photography", "Fotografi lainnya"),
  };
  const brandName = settings?.brandName || "Elhaq Photography";
  const logo = settings?.logo ? {asset: settings.logo, alt: text(settings.logoAlt, locale)} : null;
  const introduction = text(settings?.personalIntroduction, locale);
  const location = text(settings?.location, locale);
  const serviceArea = text(settings?.serviceArea, locale);

  return (
    <main>
      <SiteHeader locale={locale} brandName={brandName} logo={logo} />

      <section className="bg-[var(--ivory)] px-6 py-16 sm:py-20 md:px-12 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-16">
          <div className="min-w-0">
            <h1>{text(settings?.homeHeadline, locale) || state("setupTitle")}</h1>
            <p className="mt-6 max-w-xl text-lg leading-8">{text(settings?.homeDescription, locale) || state("setupDescription")}</p>
          </div>
          {settings?.hero ? (
            <CloudinaryImage asset={settings.hero} alt={text(settings.heroAlt, locale) || a11y("photo")} sizes="(min-width: 768px) 55vw, 100vw" priority />
          ) : (
            <div aria-label={a11y("photoPlaceholder")} className="flex min-h-72 items-center justify-center border border-[var(--line)] px-6 text-center text-sm">
              {a11y("photoPlaceholder")}
            </div>
          )}
        </div>
      </section>

      <section className="px-6 py-16 sm:py-20 md:px-12 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:gap-16">
          <h2 className="text-3xl sm:text-4xl">{nav("about")}</h2>
          {introduction || location || serviceArea ? (
            <div className="max-w-2xl space-y-5 text-lg leading-8">
              {introduction ? <p>{introduction}</p> : null}
              {location ? <p>{location}</p> : null}
              {serviceArea ? <p>{serviceArea}</p> : null}
            </div>
          ) : (
            <EmptyState title={state("emptyTitle")} description={state("emptyDescription")} action={{href: "/about", label: nav("about")}} />
          )}
        </div>
      </section>

      <section className="px-6 py-16 sm:py-20 md:px-12 lg:py-28">
        <div className="mx-auto max-w-7xl space-y-10">
          <h2 className="text-3xl sm:text-4xl">{nav("selectedStories")}</h2>
          {albums.length === 0 ? (
            <EmptyState title={state("emptyTitle")} description={state("emptyDescription")} action={{href: "/portfolio", label: nav("portfolio")}} />
          ) : (
            <div className="grid gap-x-8 gap-y-12 md:grid-cols-2">
              {albums.map((album) => (
                <Link
                  key={album.id}
                  href={`/portfolio/${album.slug}`}
                  locale={locale}
                  className="group block min-w-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus)]"
                >
                  {album.cover ? (
                    <CloudinaryImage asset={album.cover} alt={album.cover.alt[locale] || text(album.title, locale)} sizes="(min-width: 768px) 50vw, 100vw" />
                  ) : (
                    <div className="flex min-h-64 items-center justify-center border border-[var(--line)] px-6 text-center">
                      {text(album.title, locale)}
                    </div>
                  )}
                  <h3 className="mt-4 text-2xl group-hover:underline group-focus-visible:underline">{text(album.title, locale)}</h3>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="px-6 py-16 sm:py-20 md:px-12 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-3 md:gap-8">
          <article className="min-w-0">
            <h2 className="text-2xl">{text(services.wedding.title, locale)}</h2>
            <p className="mt-4 leading-7">{text(services.wedding.description, locale)}</p>
          </article>
          <article className="min-w-0">
            <h2 className="text-2xl">{text(services.events.title, locale)}</h2>
            <p className="mt-4 leading-7">{text(services.events.description, locale)}</p>
          </article>
          <article className="min-w-0">
            <h2 className="text-2xl">{text(services.other.title, locale)}</h2>
            <p className="mt-4 leading-7">{text(services.other.description, locale)}</p>
          </article>
        </div>
      </section>

      <section className="px-6 py-16 sm:py-20 md:px-12 lg:py-28">
        <div className="mx-auto max-w-3xl space-y-8">
          <h2 className="text-3xl sm:text-4xl">{nav("contact")}</h2>
          <ContactForm locale={locale} />
        </div>
      </section>

      <SiteFooter locale={locale} brandName={brandName} instagramUrl={settings?.instagramUrl ?? null} whatsappNumber={settings?.whatsappNumber ?? null} />
    </main>
  );
}
