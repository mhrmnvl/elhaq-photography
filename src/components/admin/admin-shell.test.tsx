import {expect, mock, test} from "bun:test";
import * as React from "react";
import {renderToStaticMarkup} from "react-dom/server";

mock.module("next/navigation", () => ({
  usePathname: () => "/admin/messages/message-1",
  useRouter: () => ({push: () => undefined}),
}));

const {AdminShell} = await import("@/components/admin/admin-shell");

test("keeps searchable header above page breadcrumbs and real content", () => {
  const markup = renderToStaticMarkup(<AdminShell name="Admin name" email="admin@example.com"><h1>Message details</h1></AdminShell>);
  const headers = [...markup.matchAll(/<header[^>]*>([\s\S]*?)<\/header>/g)];
  const header = headers[0]?.[1] ?? "";
  const topHeader = headers[0]?.[0].match(/^<header[^>]*>/)?.[0] ?? "";
  const contentHeader = headers[1]?.[0].match(/^<header[^>]*>/)?.[0] ?? "";

  expect(topHeader).toContain("bg-sidebar");
  expect(topHeader).toContain("text-sidebar-foreground");
  expect(topHeader).not.toContain("border-b");
  expect(topHeader).not.toMatch(/rounded/);
  expect(header).toContain('aria-label="Toggle admin navigation"');
  expect(header).toContain('for="admin-global-search"');
  expect(header).toContain('aria-controls="admin-search-results"');
  expect(header).toContain('aria-label="Admin name profile"');
  expect(header).toContain("Admin name");
  expect(header).not.toContain("Collapse admin navigation");
  expect(headers).toHaveLength(2);
  expect(contentHeader).toContain("sticky top-0");
  expect(contentHeader).toContain('data-scrolled="false"');
  expect(contentHeader).toContain("bg-background");
  expect(contentHeader).toContain("rounded-t-xl");
  expect(headers[1]?.[1]).toContain("border-b border-transparent");
  expect(headers[1]?.[1]).not.toContain("border-b border-border");
  expect(headers[1]?.[1]).toContain("rounded-t-xl");
  expect(headers[1]?.[1]).toContain("px-4");
  expect(markup).toMatch(/<main[^>]*rounded-xl/);
  // The content column has no bottom padding, so a page footer ends exactly on the card floor.
  expect(markup).toContain("w-full px-4 pt-5");
  expect(markup).not.toContain("px-4 py-5");
  // Fixed thin base under the scroll area: three stacked parts, only the middle scrolls.
  expect(markup).toContain('class="h-1.5 sm:h-2 shrink-0 rounded-b-xl bg-background"');
  expect(headers[1]?.[1]).toContain('aria-label="Breadcrumb"');
  // Native scroll column (browser scrollbar) instead of an overlay with a stale thumb.
  expect(markup).toContain('class="admin-scroll min-h-0 w-full flex-1"');
  expect(markup).not.toContain('data-slot="scroll-area"');
  expect(markup).toContain("Message details");
});
