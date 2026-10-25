import {expect, mock, test} from "bun:test";
import * as React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {NextIntlClientProvider} from "next-intl";

mock.module("@/i18n/navigation", () => ({
  Link: ({href, children, ...props}: any) =>
    React.createElement("a", {href, ...props}, children),
  usePathname: () => "/",
  useRouter: () => ({push: () => undefined}),
}));

const {SiteFooter} = await import("@/components/site-footer");
import messagesEn from "@/messages/en.json";
import messagesId from "@/messages/id.json";

function renderFooter(
  locale: "en" | "id" = "en",
  props: {instagramUrl?: string | null; whatsappNumber?: string | null} = {}
): string {
  const messages = locale === "en" ? messagesEn : messagesId;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <SiteFooter
        locale={locale}
        brandName="Elhaq Photography"
        instagramUrl={props.instagramUrl ?? "https://instagram.com/elhaq"}
        whatsappNumber={props.whatsappNumber ?? "6281234567890"}
      />
    </NextIntlClientProvider>
  );
}

test("renders brand name, tagline, and copyright notice", () => {
  const markup = renderFooter("en");
  expect(markup).toContain("Elhaq Photography");
  expect(markup).toContain("Capturing authentic emotions and timeless stories.");
  expect(markup).toContain("All rights reserved.");
  expect(markup).toContain(String(new Date().getFullYear()));
});

test("renders bilingual localized content in Indonesian", () => {
  const markup = renderFooter("id");
  expect(markup).toContain("Mendokumentasikan emosi autentik dan cerita abadi.");
  expect(markup).toContain("Hak cipta dilindungi undang-undang.");
  expect(markup).toContain("Kembali ke atas");
});

test("renders navigation and social links with valid hrefs", () => {
  const markup = renderFooter("en");
  expect(markup).toContain('href="https://instagram.com/elhaq"');
  expect(markup).toContain('href="https://wa.me/6281234567890"');
  expect(markup).toContain('href="/portfolio"');
  expect(markup).toContain('href="/contact"');
  expect(markup).toContain('href="/about"');
  expect(markup).toContain('href="/"');
});

test("renders back-to-top button with accessible label", () => {
  const markup = renderFooter("en");
  expect(markup).toContain('aria-label="Back to top"');
});
