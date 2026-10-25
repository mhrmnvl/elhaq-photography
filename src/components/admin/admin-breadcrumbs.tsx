"use client";

import * as React from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import * as nav from "next/navigation";

import {getAdminBreadcrumbs, type AdminBreadcrumb} from "@/components/admin/admin-nav-state";

function BreadcrumbsList({breadcrumbs}: {breadcrumbs: AdminBreadcrumb[]}): React.ReactElement {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 overflow-hidden text-sm">
        {breadcrumbs.map((breadcrumb, index) => (
          <li key={breadcrumb.href ?? breadcrumb.label} className="flex min-w-0 shrink items-center gap-1.5">
            {index > 0 ? (
              <span aria-hidden="true" className="shrink-0 select-none text-muted-foreground/70">
                /
              </span>
            ) : null}
            {breadcrumb.href ? (
              <Link href={breadcrumb.href} className="min-w-0 truncate text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                {breadcrumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="min-w-0 truncate font-medium text-foreground">
                {breadcrumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function useSafeSearchParams(): URLSearchParams | {get(name: string): string | null} | null {
  const fn = (nav as Record<string, unknown>).useSearchParams;
  if (typeof fn === "function") {
    try {
      const result = (fn as () => {get(name: string): string | null} | null)();
      if (result) return result;
    } catch {
      // Ignore if called outside Suspense
    }
  }
  if (typeof window !== "undefined" && window.location?.search) {
    return new URLSearchParams(window.location.search);
  }
  return null;
}

function BreadcrumbsWithParams({pathname}: {pathname: string}): React.ReactElement {
  const searchParams = useSafeSearchParams();
  const breadcrumbs = getAdminBreadcrumbs(pathname, searchParams);
  return <BreadcrumbsList breadcrumbs={breadcrumbs} />;
}

export function AdminBreadcrumbs(): React.ReactElement {
  const pathname = usePathname();
  const fallbackBreadcrumbs = getAdminBreadcrumbs(pathname);

  return (
    <React.Suspense fallback={<BreadcrumbsList breadcrumbs={fallbackBreadcrumbs} />}>
      <BreadcrumbsWithParams pathname={pathname} />
    </React.Suspense>
  );
}
