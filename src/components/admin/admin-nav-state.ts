export type AdminBreadcrumb = {label: string; href?: string};

const adminSections: Record<string, {label: string; detailLabel?: string}> = {
  albums: {label: "Albums", detailLabel: "Album details"},
  messages: {label: "Messages", detailLabel: "Message details"},
  settings: {label: "Settings"},
  "private-links": {label: "Private links"},
};

export function isAdminNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getAdminBreadcrumbs(
  rawPathname: string,
  searchParams?: {get(name: string): string | null} | URLSearchParams | string | null
): AdminBreadcrumb[] {
  let pathname = rawPathname;
  let isCreating = false;

  if (pathname.includes("?")) {
    const [pathPart, queryPart] = pathname.split("?");
    pathname = pathPart;
    const params = new URLSearchParams(queryPart);
    if (params.get("new") === "1" || params.get("new") === "true") {
      isCreating = true;
    }
  }

  if (searchParams) {
    if (typeof searchParams === "string") {
      const params = new URLSearchParams(searchParams);
      if (params.get("new") === "1" || params.get("new") === "true") {
        isCreating = true;
      }
    } else if ("get" in searchParams && typeof searchParams.get === "function") {
      if (searchParams.get("new") === "1" || searchParams.get("new") === "true") {
        isCreating = true;
      }
    }
  }

  const [root, sectionName, recordId] = pathname.split("/").filter(Boolean);
  if (root !== "admin") return [];
  if (!sectionName) return [{label: "Dashboard"}];

  const section = adminSections[sectionName];
  if (!section) return [{label: "Dashboard"}];

  const breadcrumbs: AdminBreadcrumb[] = [{label: "Dashboard", href: "/admin"}];

  if (sectionName === "albums" && (isCreating || recordId === "new")) {
    breadcrumbs.push({label: section.label, href: `/admin/${sectionName}`});
    breadcrumbs.push({label: "Create album"});
  } else if (section.detailLabel && recordId) {
    breadcrumbs.push({label: section.label, href: `/admin/${sectionName}`});
    breadcrumbs.push({label: section.detailLabel});
  } else {
    breadcrumbs.push({label: section.label});
  }

  return breadcrumbs;
}
