import type * as React from "react";
import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getTranslations} from "next-intl/server";

import {EmptyState} from "@/components/data-state";
import {LightboxGallery} from "@/components/lightbox";
import {SiteFooter} from "@/components/site-footer";
import {SiteHeader} from "@/components/site-header";
import {Link} from "@/i18n/navigation";
import type {Locale} from "@/lib/domain";
import {getPublishedAlbumBySlug, getPublicSiteSettings} from "@/server/public-content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {params: Promise<{locale: Locale; slug: string}>};

function text(value: {en: string; id: string} | null | undefined, locale: Locale): string {
  return value?.[locale] ?? "";
}

export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {locale, slug} = await params;
  const [settings, album, nav] = await Promise.all([
    getPublicSiteSettings(),
    getPublishedAlbumBySlug(slug),
    getTranslations({locale, namespace: "nav"}),
  ]);
  const brandName = settings?.brandName || "Elhaq Photography";
  const title = album ? text(album.title, locale) : nav("portfolio");
  const description = album ? text(album.story, locale) : "";

  return {
    title: `${title} | ${brandName}`,
    ...(description ? {description} : {}),
  };
}

export default async function AlbumPage({params}: PageProps): Promise<React.ReactElement> {
  const {locale, slug} = await params;
  const [settings, album, nav, state] = await Promise.all([
    getPublicSiteSettings(),
    getPublishedAlbumBySlug(slug),
    getTranslations({locale, namespace: "nav"}),
    getTranslations({locale, namespace: "state"}),
  ]);
  if (!album) notFound();

  const brandName = settings?.brandName || "Elhaq Photography";
  const logo = settings?.logo ? {asset: settings.logo, alt: text(settings.logoAlt, locale)} : null;
  const title = text(album.title, locale);
  const story = text(album.story, locale);

  return (
    <main>
      <SiteHeader locale={locale} brandName={brandName} logo={logo} />
      <article className="px-6 py-16 sm:py-20 md:px-12 lg:py-28">
        <div className="mx-auto max-w-7xl space-y-10">
          <div className="max-w-3xl space-y-5">
            <Link href="/portfolio" locale={locale} className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]">
              {nav("portfolio")}
            </Link>
            <h1>{title}</h1>
            {story ? <p className="max-w-2xl text-lg leading-8">{story}</p> : null}
          </div>
          {album.photos.length === 0 ? (
            <EmptyState title={state("emptyTitle")} description={state("emptyDescription")} action={{href: "/portfolio", label: nav("portfolio")}} />
          ) : (
            <LightboxGallery photos={album.photos} locale={locale} />
          )}
        </div>
      </article>
      <SiteFooter locale={locale} brandName={brandName} instagramUrl={settings?.instagramUrl ?? null} whatsappNumber={settings?.whatsappNumber ?? null} />
    </main>
  );
}
