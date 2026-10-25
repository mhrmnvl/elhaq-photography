import {expect, mock, test} from "bun:test";
import * as React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {NextIntlClientProvider} from "next-intl";

import messagesEn from "@/messages/en.json";
import messagesId from "@/messages/id.json";

type PhotoFixture = {
  albumId: string;
  albumSlug: string;
  category: "wedding" | "events" | "other";
  title: {en: string; id: string};
  location: {en: string; id: string};
  media: {
    id: string;
    cloudName: string;
    publicId: string;
    secureUrl: string;
    width: number;
    height: number;
    alt: {en: string; id: string};
  };
};

const asset = (id: string, publicId: string): PhotoFixture["media"] => ({
  id,
  cloudName: "demo",
  publicId,
  secureUrl: `https://res.cloudinary.com/demo/image/upload/${publicId}`,
  width: 1200,
  height: 1600,
  alt: {en: `${publicId} photograph`, id: `Foto ${publicId}`},
});

// Mutable so a single test can prove the empty-wall state.
const photoFixtures: {photos: PhotoFixture[]} = {
  photos: [
    {albumId: "album-1", albumSlug: "clara-and-damon", category: "wedding", title: {en: "Clara & Damon", id: "Clara & Damon"}, location: {en: "Bandung, Indonesia", id: "Bandung, Indonesia"}, media: asset("m1", "clara_first")},
    {albumId: "album-1", albumSlug: "clara-and-damon", category: "wedding", title: {en: "Clara & Damon", id: "Clara & Damon"}, location: {en: "Bandung, Indonesia", id: "Bandung, Indonesia"}, media: asset("m2", "clara_second")},
    {albumId: "album-2", albumSlug: "malik-and-rose", category: "events", title: {en: "Malik & Rose", id: "Malik & Rose"}, location: {en: "Yogyakarta, Indonesia", id: "Yogyakarta, Indonesia"}, media: asset("m3", "malik_first")},
  ],
};

mock.module("@/i18n/navigation", () => ({
  Link: ({href, children, ...props}: {href?: string; children?: React.ReactNode} & Record<string, unknown>) =>
    React.createElement("a", {href, ...props} as React.ComponentProps<"a">, children),
  usePathname: () => "/",
  useRouter: () => ({push: () => undefined}),
}));

mock.module("@/components/cloudinary-image", () => ({
  CloudinaryImage: ({asset: media, alt, className}: {asset: {cloudName: string; publicId: string}; alt?: string; className?: string}) =>
    React.createElement("img", {
      src: `https://res.cloudinary.com/${media.cloudName}/${media.publicId}`,
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

mock.module("@/server/public-content", () => ({
  getPublicSiteSettings: async () => ({
    brandName: "Elhaq Photography",
    homeHeadline: {en: "Capturing Authentic Memories", id: "Mengabadikan Kenangan Autentik"},
    homeDescription: {en: "Fine art wedding and story photographer.", id: "Fotografer pernikahan dan cerita seni indah."},
    personalIntroduction: {en: "Based in Bandung, documenting love stories.", id: "Berbasis di Bandung, mendokumentasikan kisah cinta."},
    about: null,
    aboutAlt: {en: "Photographer portrait", id: "Potret fotografer"},
    aboutStory: {en: "A decade of documenting quiet, honest moments.", id: "Satu dekade mendokumentasikan momen jujur dan tenang."},
    location: {en: "Bandung, Indonesia", id: "Bandung, Indonesia"},
    serviceArea: {en: "Available Worldwide", id: "Tersedia di Seluruh Dunia"},
    hero: null,
    heroAlt: {en: "", id: ""},
    logoAlt: {en: "", id: ""},
    services: {
      wedding: {title: {en: "Weddings", id: "Pernikahan"}, description: {en: "", id: ""}},
      events: {title: {en: "Events", id: "Acara"}, description: {en: "", id: ""}},
      other: {title: {en: "Other", id: "Lainnya"}, description: {en: "", id: ""}},
    },
    instagramUrl: "https://instagram.com/elhaq",
    whatsappNumber: "6281234567890",
  }),
  listPublishedPhotos: async () => photoFixtures.photos,
}));

const {default: HomePage} = await import("@/app/(site)/[locale]/page");

async function renderHome(locale: "en" | "id" = "en"): Promise<string> {
  const element = await HomePage({params: Promise.resolve({locale})});
  const messages = locale === "en" ? messagesEn : messagesId;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      {element}
    </NextIntlClientProvider>
  );
}

test("renders only the photo wall, with one screen-reader heading and no footer", async () => {
  const markup = await renderHome("en");

  expect(markup).toMatch(/<h1[^>]*class="sr-only"[^>]*>Capturing Authentic Memories/);
  expect(markup.match(/<h1/g)?.length).toBe(1);

  expect(markup).not.toContain('id="about"');
  expect(markup).not.toContain('id="services"');
  expect(markup).not.toContain('id="contact"');
  expect(markup).not.toContain('data-testid="contact-form"');
  expect(markup).not.toContain("All rights reserved.");
});

test("renders every photo of every published album, in order, linked to its album", async () => {
  const markup = await renderHome("en");

  const order = ["clara_first", "clara_second", "malik_first"].map((id) => markup.indexOf(id));
  expect(order.every((index) => index > -1)).toBe(true);
  expect(order[0]).toBeLessThan(order[1]);
  expect(order[1]).toBeLessThan(order[2]);

  // Dua foto dari album yang sama menaut ke album yang sama.
  expect(markup.match(/href="\/portfolio\/clara-and-damon"/g)?.length).toBe(2);
  expect(markup.match(/href="\/portfolio\/malik-and-rose"/g)?.length).toBe(1);
  expect(markup.match(/data-slot="photo-tile"/g)?.length).toBe(3);
});

test("wires the wall for hover emphasis and scroll reveal, and keeps captions revealable", async () => {
  const markup = await renderHome("en");

  // Dinding memakai kelas yang mengatur peredupan tile lain (CSS ter-scope).
  expect(markup).toContain("photo-wall");

  const tiles = markup.match(/<a [^>]*data-slot="photo-tile"[^>]*>/g) ?? [];
  expect(tiles.length).toBe(photoFixtures.photos.length);

  // Tiap tile punya pembungkus reveal terpisah supaya animasi masuk tidak bentrok
  // dengan peredupan hover; tanpa pembungkus ini keduanya berebut properti opacity.
  expect(markup.match(/data-slot="photo-reveal"/g)?.length).toBe(photoFixtures.photos.length);

  const overlays = markup.match(/<span class="[^"]*pointer-events-none absolute inset-x-0 bottom-0[^"]*"/g) ?? [];
  expect(overlays.length).toBe(photoFixtures.photos.length);
  for (const overlay of overlays) {
    expect(overlay).toContain("bg-gradient-to-t");
    expect(overlay).toContain("text-shadow");
    expect(overlay).toContain("group-hover:opacity-100");
    expect(overlay).toContain("group-focus-visible:opacity-100");
    expect(overlay).toContain("sm:opacity-0");
  }

  // Pembesaran/pengecilan diatur CSS ter-scope, bukan kelas per-elemen.
  const images = markup.match(/<img [^>]*>/g) ?? [];
  expect(images.length).toBeGreaterThan(0);
  for (const image of images) {
    expect(image).not.toContain("scale");
  }
});

test("uses the transparent floating header on the wall", async () => {
  const markup = await renderHome("en");

  expect(markup).toContain("site-header--knockout");
  // Tanpa latar pekat dan tanpa garis, dan Instagram tidak lagi di header.
  expect(markup.match(/<header\b[\s\S]*?<\/header>/)?.[0]).not.toContain("instagram.com");
  expect(markup).not.toContain("backdrop-blur");
});

test("renders an empty wall state when there are no published photos", async () => {
  const previous = photoFixtures.photos;
  photoFixtures.photos = [];
  try {
    const markup = await renderHome("en");
    expect(markup).toContain("Nothing here yet");
    expect(markup).not.toContain("clara_first");
  } finally {
    photoFixtures.photos = previous;
  }
});

test("shows the event location under the album title, localized", async () => {
  const english = await renderHome("en");
  expect(english).toContain("Bandung, Indonesia");
  expect(english).toContain("Yogyakarta, Indonesia");
  // Kategori bukan lagi isi caption.
  expect(english).not.toContain(">Wedding<");

  const indonesian = await renderHome("id");
  expect(indonesian).toContain("Bandung, Indonesia");
});

test("renders the intro overlay with the brand letters and a percentage", async () => {
  const markup = await renderHome("en");

  expect(markup).toContain('data-slot="site-intro"');
  // Setiap huruf brand punya span sendiri supaya bisa keluar satu per satu.
  for (const letter of ["E", "l", "h", "a", "q", "P", "g", "y"]) {
    expect(markup).toContain(`data-letter="${letter}"`);
  }
  expect(markup).toMatch(/data-slot="intro-percent"[^>]*>0%/);
});

test("shows a complete percentage when there is nothing to load", async () => {
  const previous = photoFixtures.photos;
  photoFixtures.photos = [];
  try {
    const markup = await renderHome("en");
    expect(markup).toMatch(/data-slot="intro-percent"[^>]*>100%/);
  } finally {
    photoFixtures.photos = previous;
  }
});
