import type * as React from "react";
import {headers} from "next/headers";
import {AdminAlbumList} from "@/components/admin/admin-album-list";
import {AlbumEditor} from "@/components/admin/album-editor";
import {requireAdmin} from "@/lib/authz";
import {listAdminAlbums} from "@/server/admin-albums";

export const runtime = "nodejs";

export default async function AlbumsPage({searchParams}: {searchParams: Promise<{new?: string}>}): Promise<React.ReactElement> {
  const actor = await requireAdmin(await headers());
  const albums = await listAdminAlbums(actor);
  const isCreating = (await searchParams).new === "1";

  if (isCreating) {
    return <AlbumEditor key="new" initialAlbum={null} />;
  }

  return <AdminAlbumList albums={albums} />;
}
