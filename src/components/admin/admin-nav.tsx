"use client";

import * as React from "react";
import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {Camera, Images, LayoutDashboard, Link2, LogOut, MessageSquare, Settings} from "lucide-react";

import {authClient} from "@/lib/auth-client";
import {Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator} from "@/components/ui/sidebar";

const navigation = [
  {label: "Dashboard", href: "/admin", icon: LayoutDashboard},
  {label: "Albums", href: "/admin/albums", icon: Images},
  {label: "Messages", href: "/admin/messages", icon: MessageSquare},
  {label: "Private links", href: "/admin/private-links", icon: Link2},
  {label: "Settings", href: "/admin/settings", icon: Settings},
] as const;

export function AdminNav({name}: {name: string | null}): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const signOut = async (): Promise<void> => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("Could not sign out. Try again.");
        return;
      }
      router.push("/admin/login");
    } catch {
      setError("Could not sign out. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="Elhaq Photography">
              <Link href="/admin">
                <Camera aria-hidden="true" />
                <span className="font-serif text-base">Elhaq Photography</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map(({label, href, icon: Icon}) => {
                const isActive = pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
                      <Link href={href} aria-current={isActive ? "page" : undefined}>
                        <Icon aria-hidden="true" />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {name ? <p className="truncate px-2 text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">Signed in as {name}</p> : null}
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton type="button" tooltip={pending ? "Signing out" : "Sign out"} onClick={() => void signOut()} disabled={pending}>
              <LogOut aria-hidden="true" />
              <span>{pending ? "Signing out" : "Sign out"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {error ? <p className="px-2 text-xs text-sidebar-foreground group-data-[collapsible=icon]:hidden" role="alert">{error}</p> : null}
      </SidebarFooter>
    </Sidebar>
  );
}
