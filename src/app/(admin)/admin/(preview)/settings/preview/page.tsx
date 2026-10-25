import type * as React from "react";
import {notFound} from "next/navigation";

import {AdminShell} from "@/components/admin/admin-shell";

export default function AdminHeaderPreviewPage(): React.ReactElement {
  if (process.env.NODE_ENV !== "development") notFound();

  return <AdminShell name={null} email={null}><p className="text-sm">Local preview. No admin data is loaded.</p></AdminShell>;
}

