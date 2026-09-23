import type * as React from "react";
import {headers} from "next/headers";

import {PrivateLinkForm} from "@/components/admin/private-link-form";
import {requireAdmin} from "@/lib/authz";
import {listPrivateClientLinks} from "@/server/admin-private-links";

export const runtime = "nodejs";

export default async function PrivateLinksPage(): Promise<React.ReactElement> {
  const actor = await requireAdmin(await headers());
  const links = await listPrivateClientLinks(actor);
  return <PrivateLinkForm initialLinks={links} />;
}
