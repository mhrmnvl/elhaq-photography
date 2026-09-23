import type * as React from "react";
import {headers} from "next/headers";
import {redirect} from "next/navigation";

import {AdminNav} from "@/components/admin/admin-nav";
import {Separator} from "@/components/ui/separator";
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
      <AdminNav name={actor.name} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-[var(--line)] px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="font-serif text-xl">Elhaq Photography</span>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6 md:py-10">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
