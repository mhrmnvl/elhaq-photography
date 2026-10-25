import type * as React from "react";
import {headers} from "next/headers";
import {notFound} from "next/navigation";

import {AlbumEditor} from "@/components/admin/album-editor";
import {requireAdmin} from "@/lib/authz";
import {getAdminAlbum} from "@/server/admin-albums";

export const runtime = "nodejs";

export default async function AlbumPage({params}: {params: Promise<{id: string}>}): Promise<React.ReactElement> {
  const actor = await requireAdmin(await headers());
  const album = await getAdminAlbum(actor, (await params).id);
  if (!album) notFound();
  return <AlbumEditor key={album.id} initialAlbum={album} />;
}
