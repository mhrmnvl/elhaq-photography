import type * as React from "react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {CloudinaryImage} from "@/components/cloudinary-image";
import {EmptyState} from "@/components/data-state";
import {IdleScroll} from "@/components/idle-scroll";
import {LoopingGallery} from "@/components/looping-gallery";
import {SiteHeader} from "@/components/site-header";
import {SiteIntro} from "@/components/site-intro";
import {Link} from "@/i18n/navigation";
import type {Locale} from "@/lib/domain";
import {getPublicSiteSettings, listPublishedPhotos} from "@/server/public-content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {params: Promise<{locale: Locale}>};
type BilingualValue = {en: string; id: string} | null | undefined;

function text(value: BilingualValue, locale: Locale): string {
  return value?.[locale] ?? "";
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

/**
 * Beranda hanya berisi dinding foto: semua foto dari semua album published.
 * Cerita, layanan, dan kontak ada di halamannya masing-masing.
 */
export default async function HomePage({params}: PageProps): Promise<React.ReactElement> {
  const {locale} = await params;
  const [settings, photos, nav, state] = await Promise.all([
    getPublicSiteSettings(),
    listPublishedPhotos(),
    getTranslations({locale, namespace: "nav"}),
    getTranslations({locale, namespace: "state"}),
  ]);

  const brandName = settings?.brandName || "Elhaq Photography";
  const logo = settings?.logo ? {asset: settings.logo, alt: text(settings.logoAlt, locale)} : null;

  return (
    <>
      <SiteIntro brand={brandName} photoCount={photos.length} />
      <IdleScroll />

      <div
        id="site-content"
        className="hide-scrollbar flex min-h-screen flex-col bg-[var(--ivory)] text-[var(--charcoal)]"
      >
        <SiteHeader
          locale={locale}
          brandName={brandName}
          logo={logo}
          instagramUrl={settings?.instagramUrl ?? null}
          floating
        />

        <main className="flex-1">
          <section id="portfolio" aria-labelledby="home-gallery-title">
            <h1 id="home-gallery-title" className="sr-only">
              {text(settings?.homeHeadline, locale) || brandName}
            </h1>

            {photos.length === 0 ? (
              <div className="px-6 py-20 sm:py-28">
                <EmptyState
                  title={state("emptyTitle")}
                  description={state("emptyDescription")}
                  action={{href: "/contact", label: nav("contact")}}
                />
              </div>
            ) : (
              <LoopingGallery>
                {photos.map((photo) => {
                  const albumTitle = text(photo.title, locale);
                  const locationLabel = text(photo.location, locale);
                  return (
                    <Link
                      key={`${photo.albumId}-${photo.media.id}`}
                      href={`/portfolio/${photo.albumSlug}`}
                      locale={locale}
                      data-slot="photo-tile"
                      aria-label={locationLabel ? `${albumTitle}, ${locationLabel}` : albumTitle}
                      className="group relative block aspect-[3/4] min-w-0 overflow-hidden no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
                    >
                      {/* Pembungkus terpisah supaya animasi masuk tidak bentrok dengan peredupan hover. */}
                      <span data-slot="photo-reveal" className="block h-full w-full">
                        <CloudinaryImage
                          asset={photo.media}
                          alt={photo.media.alt[locale] || albumTitle}
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="h-full w-full object-cover"
                        />
                      </span>
                      {/* Caption di bawah, di belakang gradien yang makin hilang ke atas
                          supaya bagian atas foto tetap bersih. Tidak menutup seluruh tile.
                          Scrim tipis (55%) agar foto tidak gelap; keterbacaan judul
                          ditopang text-shadow yang diwariskan ke span di dalamnya. */}
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 bg-gradient-to-t from-[var(--charcoal)]/55 from-[35%] to-transparent px-4 pb-5 pt-20 text-center opacity-100 transition-opacity duration-300 [text-shadow:0_1px_3px_rgb(0_0_0_/_0.85),0_1px_12px_rgb(0_0_0_/_0.7)] motion-reduce:transition-none sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
                        <span className="font-serif text-2xl leading-tight text-[var(--ivory)]">
                          {albumTitle}
                        </span>
                        {locationLabel ? (
                          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--ivory)]">
                            {locationLabel}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  );
                })}
              </LoopingGallery>
            )}
          </section>
        </main>
      </div>
    </>
  );
}
