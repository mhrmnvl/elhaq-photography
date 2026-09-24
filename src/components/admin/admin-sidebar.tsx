"use client";

import * as React from "react";
import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {Images, LayoutDashboard, Link2, LogOut, MessageSquareText, Settings2} from "lucide-react";

import {isAdminNavActive} from "@/components/admin/admin-nav-state";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {authClient} from "@/lib/auth-client";

const items = [
  {label: "Dashboard", href: "/admin", icon: LayoutDashboard},
  {label: "Albums", href: "/admin/albums", icon: Images},
  {label: "Settings", href: "/admin/settings", icon: Settings2},
  {label: "Private links", href: "/admin/private-links", icon: Link2},
  {label: "Messages", href: "/admin/messages", icon: MessageSquareText},
];

export function AdminSidebar({name, ...props}: React.ComponentProps<typeof Sidebar> & {name: string | null}): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const {isMobile, setOpen, setOpenMobile} = useSidebar();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const showSignOutError = (): void => {
    setError("Could not sign out. Try again.");
    if (isMobile) setOpenMobile(true);
    else setOpen(true);
  };

  const signOut = async (): Promise<void> => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        showSignOutError();
        return;
      }
      if (isMobile) setOpenMobile(false);
      else setOpen(false);
      router.push("/admin/login");
    } catch {
      showSignOutError();
    } finally {
      setPending(false);
    }
  };

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader className="group-data-[collapsible=icon]:hidden">
        <Link className="flex min-h-11 items-center px-2 font-serif text-base" href="/admin" onClick={() => setOpenMobile(false)}>Elhaq Photography</Link>
      </SidebarHeader>
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
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
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
      <SidebarFooter className="border-t border-sidebar-border">
        {name ? <p className="px-2 text-sm group-data-[collapsible=icon]:hidden">Signed in as {name}</p> : null}
        {error ? <p className="px-2 text-sm" role="alert">{error}</p> : null}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton type="button" disabled={pending} tooltip="Sign out" onClick={() => void signOut()}>
              <LogOut aria-hidden="true" />
              <span>{pending ? "Signing out" : "Sign out"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
