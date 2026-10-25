import type * as React from "react";
import {headers} from "next/headers";
import {redirect} from "next/navigation";

import {AdminShell} from "@/components/admin/admin-shell";
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
  return <AdminShell name={actor.name} email={actor.email}>{children}</AdminShell>;
}
