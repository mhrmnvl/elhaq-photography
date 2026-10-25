"use client";

import Link from "next/link";
import {ArrowUpDown, ArrowUpRight, Camera, Images, Plus} from "lucide-react";
import * as React from "react";

import {CloudinaryImage} from "@/components/cloudinary-image";
import {Button} from "@/components/ui/button";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import type {AdminAlbum, AlbumCategory} from "@/lib/domain";
import {cn} from "@/lib/utils";

function categoryLabel(category: AlbumCategory): string {
  switch (category) {
    case "wedding":
      return "Wedding";
    case "events":
      return "Events";
    case "other":
      return "Other";
  }
}

type SortOption = "updated" | "name" | "order" | "photos";

export function AdminAlbumList({albums}: {albums: readonly AdminAlbum[]}): React.ReactElement {
  const [sortBy, setSortBy] = React.useState<SortOption>("updated");
  const publishedCount = albums.filter((a) => a.status === "published").length;
  const draftCount = albums.length - publishedCount;

  const sortedAlbums = React.useMemo(() => {
    const list = [...albums];
    switch (sortBy) {
      case "name":
        return list.sort((a, b) => (a.title.en || "").localeCompare(b.title.en || ""));
      case "photos":
        return list.sort((a, b) => b.photos.length - a.photos.length);
      case "order":
        return list.sort((a, b) => a.sortOrder - b.sortOrder);
      case "updated":
      default:
        return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
  }, [albums, sortBy]);

  return (
    <section className="space-y-6 sm:space-y-8">
      <header className="space-y-3 border-b border-[var(--line)]/15 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--charcoal)] sm:text-3xl m-0">
            Albums
          </h1>
          {albums.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1 text-xs font-medium text-[var(--charcoal)]/60 sm:inline-flex">
                <ArrowUpDown className="size-3.5" aria-hidden="true" />
                <span>Sort by:</span>
              </span>
              <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
                <SelectTrigger
                  aria-label="Sort albums"
                  className="h-9 min-w-[145px] border-[var(--line)]/25 bg-[var(--card)] text-xs focus-visible:ring-1 focus-visible:ring-[var(--focus)]"
                >
                  <SelectValue placeholder="Sort albums" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="updated">Updated date</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="order">Display order</SelectItem>
                  <SelectItem value="photos">Photo count</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {albums.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)]/25 bg-[var(--card)] px-2.5 py-1 font-medium text-[var(--charcoal)]">
              <span className="size-1.5 rounded-full bg-[var(--charcoal)]" />
              {albums.length} Total {albums.length === 1 ? "story" : "stories"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)]/25 bg-[var(--card)] px-2.5 py-1 text-[var(--charcoal)]/70">
              <span className="size-1.5 rounded-full bg-emerald-600" />
              {publishedCount} Published
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)]/25 bg-[var(--card)] px-2.5 py-1 text-[var(--charcoal)]/70">
              <span className="size-1.5 rounded-full bg-amber-600" />
              {draftCount} Drafts
            </span>
          </div>
        ) : null}
      </header>

      {albums.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line)]/30 bg-[var(--card)]/50 px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted/60 text-[var(--charcoal)]/60">
            <Camera className="size-6 stroke-[1.5]" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-[var(--charcoal)] sm:text-lg">No stories created yet</h2>
          <Button asChild className="mt-6">
            <Link href="/admin/albums?new=1">
              <Plus className="size-4" aria-hidden="true" />
              <span>Create an album</span>
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
            {sortedAlbums.map((album) => {
              const coverPhoto = album.photos.find((p) => p.media.id === album.coverMediaId)?.media ?? album.photos[0]?.media;

              return (
                <li
                  key={album.id}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-[var(--line)]/25 bg-[var(--card)] transition-all duration-300 hover:border-[var(--charcoal)]/40 hover:shadow-md"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted/30 border-b border-[var(--line)]/15">
                    {coverPhoto ? (
                      <>
                        <CloudinaryImage
                          asset={coverPhoto}
                          alt={coverPhoto.alt.en || album.title.en}
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--charcoal)]/30 via-transparent to-transparent opacity-60" />
                      </>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--charcoal)]/40 bg-muted/20">
                        <Camera className="size-8 stroke-[1.5]" aria-hidden="true" />
                        <span className="text-xs font-medium tracking-wide">No photos uploaded</span>
                      </div>
                    )}

                    <div className="absolute left-3 top-3 z-10">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide backdrop-blur-md shadow-2xs border",
                          album.status === "published"
                            ? "bg-[var(--ivory)]/90 text-emerald-800 border-emerald-600/30"
                            : "bg-[var(--ivory)]/90 text-amber-800 border-amber-600/30"
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            album.status === "published" ? "bg-emerald-600" : "bg-amber-600"
                          )}
                        />
                        <span>{album.status === "published" ? "Published" : "Draft"}</span>
                      </span>
                    </div>

                    <div className="absolute right-3 top-3 z-10">
                      <span className="inline-flex items-center rounded-full bg-[var(--charcoal)]/80 backdrop-blur-md px-2.5 py-0.5 text-[11px] font-medium tracking-wider text-[var(--ivory)] uppercase">
                        {categoryLabel(album.category)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
                    <div>
                      <h2 className="text-base font-semibold tracking-tight text-[var(--charcoal)] line-clamp-1 sm:text-lg">
                        {album.title.en || "Untitled Album"}
                      </h2>
                      {album.title.id && album.title.id !== album.title.en ? (
                        <p className="mt-0.5 text-xs text-[var(--charcoal)]/60 line-clamp-1 italic">
                          {album.title.id}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] font-mono text-[var(--charcoal)]/45 truncate">
                        /portfolio/{album.slug}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-[var(--line)]/15 pt-3 text-xs text-[var(--charcoal)]/70">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Images className="size-3.5" aria-hidden="true" />
                        <span>{album.photos.length} photo{album.photos.length === 1 ? "" : "s"}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 font-medium text-[var(--charcoal)] transition-transform group-hover:translate-x-0.5">
                        <span>Manage</span>
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/admin/albums/${album.id}`}
                    className="absolute inset-0 z-20 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
                    aria-label={`Manage album ${album.title.en}`}
                  />
                </li>
              );
            })}
          </ul>

          <footer className="mt-8 -mx-4 sm:-mx-5 border-t border-border px-4 py-2.5 sm:px-5 bg-background rounded-b-xl flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[var(--charcoal)]/60">
              {albums.length} Total {albums.length === 1 ? "story" : "stories"}
            </span>
            <Button size="sm" asChild>
              <Link href="/admin/albums?new=1">
                <Plus className="size-3.5" aria-hidden="true" />
                <span>Create album</span>
              </Link>
            </Button>
          </footer>
        </>
      )}
    </section>
  );
}
