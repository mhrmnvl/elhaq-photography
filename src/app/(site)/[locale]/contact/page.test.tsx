import {expect, mock, test} from "bun:test";
import * as React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {NextIntlClientProvider} from "next-intl";

import messagesEn from "@/messages/en.json";
import messagesId from "@/messages/id.json";

mock.module("@/i18n/navigation", () => ({
  Link: ({href, children, ...props}: {href?: string; children?: React.ReactNode} & Record<string, unknown>) =>
    React.createElement("a", {href, ...props} as React.ComponentProps<"a">, children),
  usePathname: () => "/contact",
  useRouter: () => ({push: () => undefined}),
}));

// Radix select/popover tidak dirender di lingkungan test ini; perilaku form
// sendiri diuji di contact-form.test.ts dan diverifikasi di browser.
mock.module("@/components/contact-form", () => ({
  ContactForm: () => React.createElement("form", {"data-testid": "contact-form"}, "Contact Form Mock"),
}));

mock.module("next-intl/server", () => ({
  getTranslations: async ({locale, namespace}: {locale: string; namespace: string}) => {
    const messages = locale === "en" ? messagesEn : messagesId;
    const nsObj = (messages as Record<string, Record<string, string>>)[namespace] ?? {};
    return (key: string) => nsObj[key] ?? `${namespace}.${key}`;
  },
}));

const settingsFixture: {value: Record<string, unknown> | null} = {
  value: {
    brandName: "Elhaq Photography",
    logo: null,
    logoAlt: {en: "", id: ""},
    instagramUrl: "https://instagram.com/elhaq",
    whatsappNumber: "6281234567890",
  },
};

mock.module("@/server/public-content", () => ({
  getPublicSiteSettings: async () => settingsFixture.value,
}));

const {default: ContactPage} = await import("@/app/(site)/[locale]/contact/page");

async function renderContact(locale: "en" | "id" = "en"): Promise<string> {
  const element = await ContactPage({params: Promise.resolve({locale})});
  const messages = locale === "en" ? messagesEn : messagesId;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      {element}
    </NextIntlClientProvider>
  );
}

test("renders the contact heading, configured channels, and the form", async () => {
  const markup = await renderContact("en");

  expect(markup.match(/<h1/g)?.length).toBe(1);
  expect(markup).toContain("Let&#x27;s capture your story");
  expect(markup).toContain('data-testid="contact-form"');

  // Hanya kanal yang benar-benar dikonfigurasi.
  expect(markup).toContain('href="https://wa.me/6281234567890"');
  expect(markup).toContain('href="https://instagram.com/elhaq"');
  expect(markup).toContain("@elhaq");
});

test("renders localized Indonesian contact content", async () => {
  const markup = await renderContact("id");

  expect(markup).toContain("Mari abadikan cerita Anda");
  expect(markup).toContain("Kami biasanya membalas dalam waktu 24 hingga 48 jam.");
});

test("uses the home-style header and leaves the contact page without a footer", async () => {
  const markup = await renderContact("en");
  expect(markup).not.toContain("site-header--knockout");
  expect(markup.split("</header>")[0]).toContain("sticky");
  expect(markup).not.toContain("<footer");
  expect(markup).toContain('aria-controls="site-menu"');
});

test("never invents a contact channel that is not configured", async () => {
  const previous = settingsFixture.value;
  settingsFixture.value = {brandName: "Elhaq Photography", logo: null, logoAlt: {en: "", id: ""}, instagramUrl: null, whatsappNumber: null};
  try {
    const markup = await renderContact("en");
    expect(markup).not.toContain("wa.me");
    expect(markup).not.toContain("instagram.com");
    expect(markup).not.toContain("mailto:");
    // Halaman tetap berguna: judul, catatan respons, dan form tetap ada.
    expect(markup).toContain('data-testid="contact-form"');
    expect(markup).toContain("We typically respond within 24 to 48 hours.");
  } finally {
    settingsFixture.value = previous;
  }
});
