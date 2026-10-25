import {expect, mock, test} from "bun:test";
import * as React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {NextIntlClientProvider} from "next-intl";

let mockPathname = "/portfolio";

mock.module("@/i18n/navigation", () => ({
  Link: ({href, children, ...props}: {href?: string; children?: React.ReactNode} & Record<string, unknown>) =>
    React.createElement("a", {href, ...props} as React.ComponentProps<"a">, children),
  usePathname: () => mockPathname,
  useRouter: () => ({push: () => undefined}),
}));

const {SiteHeader} = await import("@/components/site-header");
import messages from "@/messages/en.json";

function renderHeader(
  locale: "en" | "id" = "en",
  pathname: string = "/portfolio",
  instagramUrl: string | null = null,
  floating: boolean | undefined = undefined
): string {
  mockPathname = pathname;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <SiteHeader
        locale={locale}
        brandName="Elhaq Photography"
        logo={null}
        instagramUrl={instagramUrl}
        floating={floating}
      />
    </NextIntlClientProvider>
  );
}

test("floats the home header: transparent, no logo, no Instagram, only brand and MENU", () => {
  const markup = renderHeader("en", "/", "https://instagram.com/elhaq", true);
  const headerClass = markup.match(/<header class="([^"]*)"/)?.[1] ?? "";

  expect(headerClass).toContain("site-header--knockout");
  // Tanpa latar pekat dan tanpa garis pada header itu sendiri.
  expect(headerClass).not.toContain("border-b");
  expect(headerClass).not.toContain("backdrop-blur");
  expect(headerClass).not.toContain("bg-[var(--ivory)]");

  expect(markup).toContain('aria-controls="site-menu"');
  expect(markup).toContain("Elhaq Photography");
  // Instagram tidak lagi di header beranda.
  expect(markup.split("</header>")[0]).not.toContain("instagram.com");
});

test("centers the brand between the MENU trigger and the Instagram link", () => {
  const markup = renderHeader("en", "/", "https://instagram.com/elhaq");

  expect(markup).toContain("Elhaq Photography");
  expect(markup).toContain('aria-controls="site-menu"');
  expect(markup).toContain('aria-label="Open menu"');
  // Brand is absolutely centered in the bar.
  expect(markup).toMatch(/<a[^>]*href="\/"[^>]*class="[^"]*left-1\/2[^"]*"/);
  // Instagram sits on the right.
  expect(markup).toContain('href="https://instagram.com/elhaq"');
  expect(markup).toContain("@elhaq");
  expect(markup).toContain('rel="noopener noreferrer"');
});

test("hides the Instagram link when no account is configured", () => {
  const markup = renderHeader("en", "/", null);
  expect(markup).not.toMatch(/instagram\.com/);
});

test("keeps the closed menu out of the tab order", () => {
  const markup = renderHeader("en", "/");
  expect(markup).toContain('aria-expanded="false"');
  expect(markup).toMatch(/<div id="site-menu"[^>]*class="[^"]*invisible[^"]*"/);
  expect(markup).toContain('aria-hidden="true"');
});

test("links to each page and marks the current one", () => {
  const markup = renderHeader("en", "/about");

  for (const href of ["/", "/portfolio", "/about", "/contact"]) {
    expect(markup).toContain(`href="${href}"`);
  }
  expect(markup).toMatch(/<a[^>]*href="\/about"[^>]*aria-current="page"/);
  expect(markup).not.toMatch(/<a[^>]*href="\/contact"[^>]*aria-current="page"/);
});

test("keeps Portfolio marked while viewing an album", () => {
  const markup = renderHeader("en", "/portfolio/clara-and-damon");
  expect(markup).toMatch(/<a[^>]*href="\/portfolio"[^>]*aria-current="page"/);
});

test("renders navigation links meeting touch target requirements", () => {
  const markup = renderHeader("en", "/about");
  const navLinks = [...markup.matchAll(/<a[^>]*href="\/about"[^>]*>/g)];
  expect(navLinks.length).toBeGreaterThanOrEqual(1);
  for (const [link] of navLinks) {
    expect(link).toContain("min-h-11");
  }
});

test("renders the accessible language switcher inside the menu", () => {
  const markup = renderHeader("en", "/contact");
  expect(markup).toContain('aria-label="Language: Bahasa Indonesia"');
  expect(markup).toContain("min-h-11");
});

test("shows the configured Instagram account in the home menu, not the header", () => {
  const markup = renderHeader("en", "/", "https://instagram.com/elhaq", true);
  const menu = markup.split('id="site-menu"')[1];
  expect(menu).toContain('href="https://instagram.com/elhaq"');
  expect(menu).toContain("Instagram");
  expect(menu).toContain("@elhaq");
  expect(menu).toContain('rel="noopener noreferrer"');
  expect(renderHeader("en", "/", null, true)).not.toContain("Instagram");
});

test("keeps non-home headers solid and sticky with the compact serif menu", () => {
  for (const pathname of ["/contact", "/about", "/portfolio", "/portfolio/clara-and-damon"]) {
    const markup = renderHeader("en", pathname);
    const header = markup.split("</header>")[0];
    expect(header).toContain("sticky");
    expect(header).toContain("bg-[var(--ivory)]");
    expect(header).not.toContain("site-header--knockout");
    expect(header).not.toContain("text-white");
    expect(header).toContain("font-serif");
    expect(markup).toContain("justify-center whitespace-nowrap font-serif text-base");
  }
});
