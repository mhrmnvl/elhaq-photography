import type * as React from "react";
import {headers} from "next/headers";

import {SettingsForm, emptySiteSettings} from "@/components/admin/settings-form";
import {requireAdmin} from "@/lib/authz";
import {getAdminSettings} from "@/server/admin-settings";
import {listAdminAlbums} from "@/server/admin-albums";

export const runtime = "nodejs";

export default async function SettingsPage(): Promise<React.ReactElement> {
  const actor = await requireAdmin(await headers());
  const [settings, albums] = await Promise.all([getAdminSettings(actor), listAdminAlbums(actor)]);
  return <SettingsForm initialSettings={settings ?? emptySiteSettings} featuredAlbums={albums.map(({id, title, status}) => ({id, title, status}))} />;
}
