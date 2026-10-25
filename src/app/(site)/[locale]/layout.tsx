import type * as React from "react";
import {NextIntlClientProvider} from "next-intl";
import {getLocale, getMessages} from "next-intl/server";
import {notFound} from "next/navigation";

import {dmSans, fraunces} from "@/app/fonts";
import {routing} from "@/i18n/routing";
import "@/app/globals.css";

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}): Promise<React.ReactElement> {
  const {locale} = await params;

  if (!routing.locales.includes(locale as "en" | "id")) notFound();

  const activeLocale = await getLocale();
  const messages = await getMessages();

  return (
      <html lang={activeLocale} className={`${dmSans.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale={activeLocale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
