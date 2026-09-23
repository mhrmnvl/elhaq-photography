import type * as React from "react";
import {headers} from "next/headers";
import Link from "next/link";

import {requireAdmin} from "@/lib/authz";

export const runtime = "nodejs";

export default async function AdminDashboardPage(): Promise<React.ReactElement> {
  await requireAdmin(await headers());
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm">Elhaq Photography</p>
        <h1 className="mt-2 font-serif text-5xl">Dashboard</h1>
      </div>
      <p className="max-w-xl">Manage the albums that appear in the public portfolio.</p>
      <Link className="inline-flex min-h-11 items-center border border-[var(--charcoal)] px-4 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]" href="/admin/albums">Open albums</Link>
    </section>
  );
}
