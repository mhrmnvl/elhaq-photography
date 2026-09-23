import {expect, mock, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";

import {SidebarProvider} from "@/components/ui/sidebar";

mock.module("next/navigation", () => ({usePathname: () => "/admin", useRouter: () => ({push: () => undefined})}));

const {AdminNav} = await import("@/components/admin/admin-nav");

test("renders the admin navigation as an inset icon-collapsible sidebar", () => {
  const markup = renderToStaticMarkup(
    <SidebarProvider defaultOpen={false}>
      <AdminNav name="Local development" />
    </SidebarProvider>,
  );

  expect(markup).toContain('data-slot="sidebar"');
  expect(markup).toContain('data-variant="inset"');
  expect(markup).toContain('data-collapsible="icon"');
  expect(markup).toContain("Dashboard");
  expect(markup).toContain("Albums");
  expect(markup).toContain("Sign out");
});
