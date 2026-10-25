import {expect, mock, test} from "bun:test";
import {readFile} from "node:fs/promises";
import * as React from "react";
import {renderToStaticMarkup} from "react-dom/server";

const pathname = "/admin/albums/album-1";

mock.module("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({push: () => undefined}),
}));

const {AdminSidebar} = await import("@/components/admin/admin-sidebar");
const {AdminBreadcrumbs} = await import("@/components/admin/admin-breadcrumbs");
const {SidebarProvider} = await import("@/components/ui/sidebar");

function renderSidebar(): string {
  return renderToStaticMarkup(
    React.createElement(
      SidebarProvider,
      null,
      React.createElement(AdminSidebar, {collapsible: "icon"})
    )
  );
}

test("renders only real admin destinations and activates nested album route", () => {
  const markup = renderSidebar();
  const nav = markup.match(/<nav id="admin-navigation" aria-label="Admin navigation">([\s\S]*?)<\/nav>/)?.[1] ?? "";

  expect([...nav.matchAll(/href="([^"]+)"/g)].map(([, href]) => href)).toEqual([
    "/admin",
    "/admin/albums",
    "/admin/settings",
    "/admin/private-links",
    "/admin/messages",
  ]);
  expect(/<a[^>]*aria-current="page"[^>]*href="\/admin\/albums"/.test(nav)).toBe(true);
  expect(markup).not.toContain("Playground");
  expect(markup).not.toContain("Acme Inc");
});

test("renders linked breadcrumb ancestors and marks current admin page", () => {
  const markup = renderToStaticMarkup(React.createElement(AdminBreadcrumbs));
  const nav = markup.match(/<nav aria-label="Breadcrumb"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "";

  expect([...nav.matchAll(/href="([^"]+)"/g)].map(([, href]) => href)).toEqual([
    "/admin",
    "/admin/albums",
  ]);
  expect(nav).toContain('aria-current="page"');
  expect(nav).toContain("Album details");
  expect(nav).toContain("/");
  expect(nav).not.toContain("lucide-chevron-right");
});

test("uses high-contrast project colors for the active navigation item", () => {
  const markup = renderSidebar();
  const activeLink = markup.match(/<a(?=[^>]*aria-current="page")[^>]*>/)?.[0] ?? "";

  expect(activeLink).toContain("data-active:bg-sidebar-primary");
  expect(activeLink).toContain("data-active:text-sidebar-primary-foreground");
});

test("keeps the mobile sheet close control visible and easy to tap", async () => {
  const sidebarSource = await readFile(new URL("../ui/sidebar.tsx", import.meta.url), "utf8");

  expect(sidebarSource).not.toContain("[&>button]:hidden");
  expect(sidebarSource).toContain("[&>button]:min-h-11");
  expect(sidebarSource).toContain("[&>button]:min-w-11");
});

test("places desktop sidebar toggle in the footer and removes profile actions", () => {
  const markup = renderSidebar();
  const footer = markup.slice(markup.indexOf('data-sidebar="footer"'));
  const sidebarContainer = markup.match(/<div[^>]*data-slot="sidebar-container"[^>]*>/)?.[0] ?? "";

  expect(markup).toContain('data-variant="sidebar"');
  expect(sidebarContainer).toContain("group-data-[side=left]:border-r-0");
  expect(sidebarContainer).not.toContain("group-data-[side=left]:border-r ");
  expect(footer).toContain('aria-label="Collapse admin navigation"');
  expect(footer).not.toContain("Sign out");
  expect(footer).not.toContain("Admin name");
});

test("keeps profile identity and sign-out outside sidebar", () => {
  const markup = renderSidebar();

  expect(markup).not.toContain("Signed in as");
  expect(markup).not.toContain("m@example.com");
  expect(markup).not.toContain("Avatar");
  expect(markup).not.toContain("Sign out");
});
