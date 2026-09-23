import type * as React from "react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

import {ContactForm} from "@/components/contact-form";
import {SiteFooter} from "@/components/site-footer";
import {SiteHeader} from "@/components/site-header";
import type {Locale} from "@/lib/domain";
import {getPublicSiteSettings} from "@/server/public-content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {params: Promise<{locale: Locale}>};

export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {locale} = await params;
  const [settings, nav] = await Promise.all([
    getPublicSiteSettings(),
    getTranslations({locale, namespace: "nav"}),
  ]);
  const brandName = settings?.brandName || "Elhaq Photography";

  return {title: `${nav("contact")} | ${brandName}`};
}

export default async function ContactPage({params}: PageProps): Promise<React.ReactElement> {
  const {locale} = await params;
  const [settings, nav] = await Promise.all([
    getPublicSiteSettings(),
    getTranslations({locale, namespace: "nav"}),
  ]);
  const brandName = settings?.brandName || "Elhaq Photography";
  const logo = settings?.logo ? {asset: settings.logo, alt: settings.logoAlt[locale]} : null;

  return (
    <main>
      <SiteHeader locale={locale} brandName={brandName} logo={logo} />
      <section className="px-6 py-16 sm:py-20 md:px-12 lg:py-28">
        <div className="mx-auto max-w-3xl space-y-8">
          <h1>{nav("contact")}</h1>
          <ContactForm locale={locale} />
        </div>
      </section>
      <SiteFooter locale={locale} brandName={brandName} instagramUrl={settings?.instagramUrl ?? null} whatsappNumber={settings?.whatsappNumber ?? null} />
    </main>
  );
}
