import type * as React from "react";
import {headers} from "next/headers";
import Link from "next/link";

import {AlbumEditor} from "@/components/admin/album-editor";
import {EmptyState} from "@/components/data-state";
import {requireAdmin} from "@/lib/authz";
import {listAdminAlbums} from "@/server/admin-albums";

export const runtime = "nodejs";

export default async function AlbumsPage({searchParams}: {searchParams: Promise<{new?: string}>}): Promise<React.ReactElement> {
  const actor = await requireAdmin(await headers());
  const albums = await listAdminAlbums(actor);
  const isCreating = (await searchParams).new === "1";

  if (isCreating) {
    return (
      <section className="space-y-6">
        <Link className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]" href="/admin/albums">Back to albums</Link>
        <AlbumEditor initialAlbum={null} />
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm">Public portfolio</p>
          <h1 className="mt-2 font-serif text-5xl">Albums</h1>
        </div>
        <Link className="inline-flex min-h-11 items-center border border-[var(--charcoal)] px-4 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]" href="/admin/albums?new=1">Create album</Link>
      </header>
      {albums.length === 0 ? <EmptyState title="No albums yet" description="Create a draft album, add its photos, and publish it when both languages are ready." action={{href: "/admin/albums?new=1", label: "Create an album"}} /> : (
        <ul className="grid gap-4 md:grid-cols-2">
          {albums.map((album) => (
            <li key={album.id} className="border border-[var(--line)] p-5">
              <Link className="block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus)]" href={`/admin/albums/${album.id}`}>
                <span className="text-sm">{album.status === "published" ? "Published" : "Draft"}, {album.category}</span>
                <h2 className="mt-2 font-serif text-3xl">{album.title.en}</h2>
                <p className="mt-2 text-sm">{album.photos.length} photo{album.photos.length === 1 ? "" : "s"}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
