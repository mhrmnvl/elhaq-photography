import type * as React from "react";

import type {Locale} from "@/lib/domain";

export function SiteFooter({locale, brandName, instagramUrl, whatsappNumber}: {locale: Locale; brandName: string; instagramUrl: string | null; whatsappNumber: string | null}): React.ReactElement {
  return (
    <footer lang={locale} className="border-t border-[var(--line)] px-6 py-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <span>{brandName}</span>
        <div className="flex flex-wrap gap-4">
          {instagramUrl ? <a className="inline-flex min-h-11 items-center" href={instagramUrl} rel="noreferrer">Instagram</a> : null}
          {whatsappNumber ? <a className="inline-flex min-h-11 items-center" href={`https://wa.me/${whatsappNumber}`}>WhatsApp</a> : null}
        </div>
      </div>
    </footer>
  );
}
