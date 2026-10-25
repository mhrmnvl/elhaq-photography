"use client";

import * as React from "react";

import {CloudinaryImage} from "@/components/cloudinary-image";
import {EmptyState} from "@/components/data-state";
import {Button} from "@/components/ui/button";
import {Link} from "@/i18n/navigation";
import type {AlbumCategory, Locale, PublicAlbumSummary} from "@/lib/domain";

const categoryOrder: readonly AlbumCategory[] = ["wedding", "events", "other"];

type Props = {
  albums: readonly PublicAlbumSummary[];
  locale: Locale;
  labels: Record<AlbumCategory, string>;
  allLabel: string;
  filterLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  backHomeLabel: string;
};

export function PortfolioFilter({albums, locale, labels, allLabel, filterLabel, emptyTitle, emptyDescription, backHomeLabel}: Props): React.ReactElement {
  const [selected, setSelected] = React.useState<AlbumCategory | "all">("all");
  const visibleAlbums = selected === "all" ? albums : albums.filter((album) => album.category === selected);

  return (
    <div className="space-y-10">
      <nav aria-label={filterLabel} className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          aria-pressed={selected === "all"}
          className="border-[var(--line)] px-4 py-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] aria-pressed:bg-[var(--charcoal)] aria-pressed:text-[var(--ivory)]"
          onClick={() => setSelected("all")}
        >
          {allLabel}
        </Button>
        {categoryOrder.map((category) => (
          <Button
            key={category}
            type="button"
            variant="outline"
            aria-pressed={selected === category}
            className="border-[var(--line)] px-4 py-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] aria-pressed:bg-[var(--charcoal)] aria-pressed:text-[var(--ivory)]"
            onClick={() => setSelected(category)}
          >
            {labels[category]}
          </Button>
        ))}
      </nav>

      {visibleAlbums.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={{href: "/", label: backHomeLabel}} />
      ) : (
        <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {visibleAlbums.map((album) => {
            const title = album.title[locale];
            const alt = album.cover?.alt[locale] || title;

            return (
              <article key={album.id} className="min-w-0">
                <Link
                  href={`/portfolio/${album.slug}`}
                  locale={locale}
                  className="group block min-w-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus)]"
                >
                  {album.cover ? (
                    <CloudinaryImage asset={album.cover} alt={alt} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
                  ) : (
                    <div className="flex min-h-64 items-center justify-center border border-[var(--line)] px-4 text-center">
                      {alt}
                    </div>
                  )}
                  <h2 className="mt-4 text-2xl group-hover:underline group-focus-visible:underline">{title}</h2>
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
