import {expect, mock, test} from "bun:test";
import * as React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {NextIntlClientProvider} from "next-intl";

import messagesEn from "@/messages/en.json";
import messagesId from "@/messages/id.json";

mock.module("@/i18n/navigation", () => ({
  Link: ({href, children, ...props}: {href?: string; children?: React.ReactNode} & Record<string, unknown>) =>
    React.createElement("a", {href, ...props} as React.ComponentProps<"a">, children),
  usePathname: () => "/about",
  useRouter: () => ({push: () => undefined}),
}));

mock.module("@/components/cloudinary-image", () => ({
  CloudinaryImage: ({asset, alt, className}: {asset: {cloudName: string; publicId: string}; alt?: string; className?: string}) =>
    React.createElement("img", {
      src: `https://res.cloudinary.com/${asset.cloudName}/${asset.publicId}`,
      alt,
      className,
    }),
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
    about: {
      id: "about-1",
      cloudName: "demo",
      publicId: "about_portrait",
      secureUrl: "https://res.cloudinary.com/demo/image/upload/about_portrait",
      width: 1200,
      height: 1500,
      alt: {en: "Portrait", id: "Potret"},
    },
    aboutAlt: {en: "Photographer portrait", id: "Potret fotografer"},
    hero: null,
    heroAlt: {en: "", id: ""},
    logoAlt: {en: "", id: ""},
    personalIntroduction: {en: "Based in Bandung, documenting love stories.", id: "Berbasis di Bandung, mendokumentasikan kisah cinta."},
    aboutStory: {en: "A decade of documenting quiet, honest moments.", id: "Satu dekade mendokumentasikan momen jujur dan tenang."},
    homeHeadline: {en: "Capturing Authentic Memories", id: "Mengabadikan Kenangan Autentik"},
    homeDescription: {en: "Fine art wedding and story photographer.", id: "Fotografer pernikahan dan cerita seni indah."},
    location: {en: "Bandung, Indonesia", id: "Bandung, Indonesia"},
    serviceArea: {en: "Available Worldwide", id: "Tersedia di Seluruh Dunia"},
    services: {
      wedding: {title: {en: "Weddings", id: "Pernikahan"}, description: {en: "", id: ""}},
      events: {title: {en: "Events", id: "Acara"}, description: {en: "", id: ""}},
      other: {title: {en: "Other", id: "Lainnya"}, description: {en: "", id: ""}},
    },
    instagramUrl: "https://instagram.com/elhaq",
    whatsappNumber: "6281234567890",
  },
};

mock.module("@/server/public-content", () => ({
  getPublicSiteSettings: async () => settingsFixture.value,
}));

const {default: AboutPage} = await import("@/app/(site)/[locale]/about/page");

async function renderAbout(locale: "en" | "id" = "en"): Promise<string> {
  const element = await AboutPage({params: Promise.resolve({locale})});
  const messages = locale === "en" ? messagesEn : messagesId;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      {element}
    </NextIntlClientProvider>
  );
}

test("renders the editorial about page from the site settings", async () => {
  const markup = await renderAbout("en");

  // Satu heading halaman, memakai headline brand sebagai pernyataan editorial.
  expect(markup.match(/<h1/g)?.length).toBe(1);
  expect(markup).toContain("Capturing Authentic Memories");

  expect(markup).toContain("Based in Bandung, documenting love stories.");
  expect(markup).toContain("A decade of documenting quiet, honest moments.");
  expect(markup).toContain("Bandung, Indonesia");
  expect(markup).toContain("Available Worldwide");

  // Potret dari settings, dengan alt terlokalisasi.
  expect(markup).toContain("about_portrait");
  expect(markup).toContain('alt="Photographer portrait"');

  // Ajakan menuju halaman kontak yang sudah ada.
  expect(markup).toMatch(/href="\/contact"/);
  expect(markup).toContain("Check Availability");
});

test("renders localized Indonesian about content", async () => {
  const markup = await renderAbout("id");

  expect(markup).toContain("Mengabadikan Kenangan Autentik");
  expect(markup).toContain("Berbasis di Bandung, mendokumentasikan kisah cinta.");
  expect(markup).toContain("Satu dekade mendokumentasikan momen jujur dan tenang.");
  expect(markup).toContain("Konsultasi Tanggal");
});

test("stays usable when settings are empty", async () => {
  const previous = settingsFixture.value;
  settingsFixture.value = null;
  try {
    const markup = await renderAbout("en");
    expect(markup).toContain("Nothing here yet");
    expect(markup).not.toContain("about_portrait");
    expect(markup).not.toContain("undefined");
  } finally {
    settingsFixture.value = previous;
  }
});
