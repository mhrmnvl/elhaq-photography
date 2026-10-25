import type * as React from "react";
import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {ArrowUpRight} from "lucide-react";

import {ContactForm} from "@/components/contact-form";
import {ContactMotion} from "@/components/contact-motion";
import {SiteHeader} from "@/components/site-header";
import type {Locale} from "@/lib/domain";
import {getPublicSiteSettings} from "@/server/public-content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {params: Promise<{locale: Locale}>};

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
  const [settings, contact] = await Promise.all([
    getPublicSiteSettings(),
    getTranslations({locale, namespace: "contact"}),
  ]);
  const brandName = settings?.brandName || "Elhaq Photography";
  const logo = settings?.logo ? {asset: settings.logo, alt: settings.logoAlt[locale]} : null;
  const whatsappNumber = settings?.whatsappNumber ?? null;
  const instagramUrl = settings?.instagramUrl ?? null;
  const handle = instagramHandle(instagramUrl);
  const title = contact("tagline");
  const words = title.split(" ");
  const titleLines = [words.slice(0, -2).join(" "), words.slice(-2).join(" ")];

  const channelClass =
    "group inline-flex min-h-11 items-center gap-1.5 border-b border-[var(--charcoal)]/25 text-sm text-[var(--charcoal)]/85 no-underline transition-colors hover:border-[var(--charcoal)] hover:text-[var(--charcoal)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus)]";

  return (
    <main className="contact-page bg-[var(--ivory)] text-[var(--charcoal)]">
      <SiteHeader
        locale={locale}
        brandName={brandName}
        logo={logo}
        instagramUrl={instagramUrl}
        floating
      />

      <ContactMotion>
      <section className="px-6 pt-10 pb-20 sm:px-8 md:px-12 md:pt-14 lg:pb-28">
        <div className="mx-auto grid w-full max-w-[1500px] gap-12 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] md:gap-16 lg:gap-24">
          <div className="min-w-0">
            <h1 className="contact-page__title m-0 max-w-md text-balance">
              <span className="sr-only">{title}</span>
              {titleLines.map((line, index) => (
                <span key={index} className="contact-heading-line" aria-hidden="true">
                  <span data-contact-reveal="">{line}</span>
                </span>
              ))}
            </h1>
            <p data-contact-reveal="" className="mt-5 mb-0 max-w-sm text-sm leading-relaxed text-[var(--charcoal)]/70">
              {contact("intro")}
            </p>

            {whatsappNumber || instagramUrl ? (
              <div data-contact-reveal="" className="mt-8 flex flex-col items-start gap-1">
                {whatsappNumber ? (
                  <a
                    href={`https://wa.me/${whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={channelClass}
                  >
                    <span>{contact("chatWhatsApp")}</span>
                    <ArrowUpRight className="size-3.5 opacity-60 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                  </a>
                ) : null}
                {instagramUrl ? (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={channelClass}
                  >
                    <span>{handle ?? "Instagram"}</span>
                    <ArrowUpRight className="size-3.5 opacity-60 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="min-w-0">
            <ContactForm locale={locale} />
            <p className="mt-5 mb-0 text-xs text-[var(--charcoal)]/55">{contact("responseNote")}</p>
          </div>
        </div>
      </section>
      </ContactMotion>

    </main>
  );
}
