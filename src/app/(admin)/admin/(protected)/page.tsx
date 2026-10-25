import type * as React from "react";
import {headers} from "next/headers";
import Link from "next/link";

import {buttonVariants} from "@/components/ui/button";
import {requireAdmin} from "@/lib/authz";

export const runtime = "nodejs";

export default async function AdminDashboardPage(): Promise<React.ReactElement> {
  await requireAdmin(await headers());
  return (
    <section className="flex flex-col min-h-[240px] justify-between">
      <header>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--charcoal)] m-0">Dashboard</h1>
      </header>
      <footer className="mt-8 -mx-4 sm:-mx-5 border-t border-border px-4 py-2.5 sm:px-5 bg-background rounded-b-xl flex items-center justify-end">
        <Link className={buttonVariants({variant: "default", size: "sm"})} href="/admin/albums">Open albums</Link>
      </footer>
    </section>
  );
}
