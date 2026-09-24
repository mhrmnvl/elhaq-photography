import type * as React from "react";
import {headers} from "next/headers";
import {redirect} from "next/navigation";

import {AdminSidebar} from "@/components/admin/admin-sidebar";
import {SidebarInset, SidebarProvider, SidebarTrigger} from "@/components/ui/sidebar";
import {requireAdmin} from "@/lib/authz";
import {HttpError} from "@/lib/errors";

export const runtime = "nodejs";

export default async function ProtectedAdminLayout({children}: {children: React.ReactNode}): Promise<React.ReactElement> {
  let actor;
  try {
    actor = await requireAdmin(await headers());
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect("/admin/login");
    throw error;
  }
  return (
    <SidebarProvider>
      <AdminSidebar name={actor.name} collapsible="icon" />
      <SidebarInset className="md:rounded-[var(--radius)]">
        <header className="flex min-h-16 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger className="min-h-11 min-w-11" aria-label="Toggle admin navigation" aria-controls="admin-navigation" />
          <span className="text-sm md:hidden">Menu</span>
        </header>
        <div className="mx-auto w-full max-w-6xl px-6 py-10">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
