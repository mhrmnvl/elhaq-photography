import {expect, mock, test} from "bun:test";
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

test("does not invent identity when admin name is absent", () => {
  const markup = renderSidebar(null);

  expect(markup).not.toContain("Signed in as");
  expect(markup).not.toContain("m@example.com");
  expect(markup).not.toContain("Avatar");
});
