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
const {SidebarProvider} = await import("@/components/ui/sidebar");

function renderSidebar(name: string | null): string {
  return renderToStaticMarkup(
    React.createElement(
      SidebarProvider,
      null,
      React.createElement(AdminSidebar, {name, collapsible: "icon"})
    )
  );
}

test("renders only real admin destinations and activates nested album route", () => {
  const markup = renderSidebar("Admin name");
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

test("uses high-contrast project colors for the active navigation item", () => {
  const markup = renderSidebar("Admin name");
  const activeLink = markup.match(/<a(?=[^>]*aria-current="page")[^>]*>/)?.[0] ?? "";

  expect(activeLink).toContain("data-[active=true]:bg-sidebar-primary");
  expect(activeLink).toContain("data-[active=true]:text-sidebar-primary-foreground");
});

test("keeps the mobile sheet close control visible and easy to tap", async () => {
  const sidebarSource = await readFile(new URL("../ui/sidebar.tsx", import.meta.url), "utf8");

  expect(sidebarSource).not.toContain("[&>button]:hidden");
  expect(sidebarSource).toContain("[&>button]:min-h-11");
  expect(sidebarSource).toContain("[&>button]:min-w-11");
});

test("does not invent identity when admin name is absent", () => {
  const markup = renderSidebar(null);

  expect(markup).not.toContain("Signed in as");
  expect(markup).not.toContain("m@example.com");
  expect(markup).not.toContain("Avatar");
});
