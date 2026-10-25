"use client";

import * as React from "react";
import {flexRender, getCoreRowModel, useReactTable, type ColumnDef} from "@tanstack/react-table";

import {Checkbox} from "@/components/ui/checkbox";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import type {AdminAlbum} from "@/lib/domain";
import {cn} from "@/lib/utils";

export type FeaturedAlbumOption = Pick<AdminAlbum, "id" | "title" | "status">;

const BATCH_SIZE = 20;

// Featured albums table: no pagination, the list grows as you reach the end.
export function FeaturedAlbumsTable({
  albums,
  selectedIds,
  onToggle,
}: {
  albums: readonly FeaturedAlbumOption[];
  selectedIds: readonly string[];
  onToggle: (id: string, checked: boolean) => void;
}): React.ReactElement {
  const [visibleCount, setVisibleCount] = React.useState(BATCH_SIZE);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => Math.min(count + BATCH_SIZE, albums.length));
        }
      },
      {rootMargin: "160px"}
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [albums.length]);

  const rows = React.useMemo(() => albums.slice(0, visibleCount), [albums, visibleCount]);
  const hasMore = visibleCount < albums.length;

  const columns = React.useMemo<Array<ColumnDef<FeaturedAlbumOption>>>(
    () => [
      {
        id: "featured",
        header: () => <span className="sr-only">Featured</span>,
        cell: ({row}) => {
          const isPublished = row.original.status === "published";
          return (
            <Checkbox
              checked={selectedIds.includes(row.original.id)}
              disabled={!isPublished}
              aria-label={`Feature ${row.original.title.en}`}
              onCheckedChange={(checked) => onToggle(row.original.id, checked === true)}
            />
          );
        },
      },
      {
        id: "album",
        header: "Album",
        cell: ({row}) => (
          <div className="min-w-0">
            <span className="block max-w-[42ch] truncate font-medium text-foreground">{row.original.title.en}</span>
            {row.original.title.id ? (
              <span className="block max-w-[42ch] truncate text-xs text-muted-foreground">{row.original.title.id}</span>
            ) : null}
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({row}) => {
          const isPublished = row.original.status === "published";
          return (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                isPublished
                  ? "border-emerald-600/20 bg-emerald-500/10 text-emerald-800"
                  : "border-amber-600/20 bg-amber-500/10 text-amber-800"
              )}
            >
              {isPublished ? "Published" : "Draft"}
            </span>
          );
        },
      },
    ],
    [onToggle, selectedIds]
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className={header.column.id === "featured" ? "w-10" : undefined}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className={row.original.status === "published" ? undefined : "opacity-50"}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {hasMore ? (
        <>
          {/* Infinite scroll sentinel: growing the slice keeps the scrollbar continuous. */}
          <div ref={sentinelRef} aria-hidden="true" className="h-px" />
          <p role="status" className="text-center text-xs text-muted-foreground">
            Showing {rows.length} of {albums.length} albums…
          </p>
        </>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          {albums.length} album{albums.length === 1 ? "" : "s"} available.
        </p>
      )}
    </div>
  );
}
