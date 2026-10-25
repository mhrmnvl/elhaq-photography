"use client";

import * as React from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {Images, LayoutDashboard, Link2, MessageSquareText, PanelLeftClose, PanelLeftOpen, Settings2} from "lucide-react";

import {isAdminNavActive} from "@/components/admin/admin-nav-state";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  {label: "Dashboard", href: "/admin", icon: LayoutDashboard},
  {label: "Albums", href: "/admin/albums", icon: Images},
  {label: "Settings", href: "/admin/settings", icon: Settings2},
  {label: "Private links", href: "/admin/private-links", icon: Link2},
  {label: "Messages", href: "/admin/messages", icon: MessageSquareText},
];

export function AdminSidebar(props: React.ComponentProps<typeof Sidebar>): React.ReactElement {
  const pathname = usePathname();
  const {isMobile, setOpenMobile, state, toggleSidebar} = useSidebar();

  return (
    <Sidebar
      variant="sidebar"
      className="top-[var(--admin-header-height)] h-[calc(100svh-var(--admin-header-height))] group-data-[side=left]:border-r-0 group-data-[side=right]:border-l-0"
      {...props}
    >
      <SidebarContent>
        <nav id="admin-navigation" aria-label="Admin navigation">
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarMenu>
              {items.map((item) => {
                const active = isAdminNavActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      className="data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground data-active:font-semibold"
                    >
                      <Link href={item.href} aria-current={active ? "page" : undefined} onClick={() => {if (isMobile) setOpenMobile(false);}}>
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </nav>
      </SidebarContent>
      <SidebarFooter>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={state === "expanded" ? "Collapse admin navigation" : "Expand admin navigation"}
          className="hidden h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-sidebar-accent md:flex"
        >
          {state === "expanded" ? <PanelLeftClose aria-hidden="true" className="size-4 shrink-0" /> : <PanelLeftOpen aria-hidden="true" className="size-4 shrink-0" />}
          <span className="group-data-[collapsible=icon]:hidden">Collapse sidebar</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
