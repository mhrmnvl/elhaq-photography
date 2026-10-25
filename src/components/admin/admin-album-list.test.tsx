import {expect, mock, test} from "bun:test";
import * as React from "react";
import {renderToStaticMarkup} from "react-dom/server";

mock.module("@/components/cloudinary-image", () => ({
  CloudinaryImage: ({asset, alt, className}: any) =>
    React.createElement("img", {
      src: `https://res.cloudinary.com/${asset.cloudName}/${asset.publicId}`,
      alt,
      className,
    }),
}));

const {AdminAlbumList} = await import("@/components/admin/admin-album-list");
import type {AdminAlbum} from "@/lib/domain";

const mockAlbums: AdminAlbum[] = [
  {
    id: "album-1",
    slug: "intimate-wedding",
    category: "wedding",
    title: {en: "Intimate Garden Wedding", id: "Pernikahan Kebun Intim"},
    location: {en: "", id: ""},
    story: {en: "A beautiful garden wedding story.", id: "Cerita pernikahan kebun yang indah."},
    status: "published",
    coverMediaId: "cover-1",
    sortOrder: 1,
    updatedAt: "2026-09-01T00:00:00Z",
    photos: [
      {
        position: 0,
        media: {
          id: "cover-1",
          cloudName: "demo",
          publicId: "weddings/cover-1",
          secureUrl: "https://res.cloudinary.com/demo/image/upload/weddings/cover-1",
          width: 1200,
          height: 800,
          alt: {en: "Bride and groom in garden", id: "Pengantin di kebun"},
        },
      },
      {
        position: 1,
        media: {
          id: "photo-2",
          cloudName: "demo",
          publicId: "weddings/photo-2",
          secureUrl: "https://res.cloudinary.com/demo/image/upload/weddings/photo-2",
          width: 1200,
          height: 800,
          alt: {en: "Wedding bouquet", id: "Buket bunga"},
        },
      },
    ],
  },
  {
    id: "album-2",
    slug: "music-festival",
    category: "events",
    title: {en: "Summer Music Festival", id: "Festival Musik Musim Panas"},
    location: {en: "", id: ""},
    story: {en: "Live stage documentation.", id: "Dokumentasi panggung live."},
    status: "draft",
    coverMediaId: null,
    sortOrder: 2,
    updatedAt: "2026-09-02T00:00:00Z",
    photos: [],
  },
];

test("renders empty state with call to action when no albums exist", () => {
  const markup = renderToStaticMarkup(<AdminAlbumList albums={[]} />);

  expect(markup).toContain("No stories created yet");
  expect(markup).toContain("Create an album");
  expect(markup).toContain('href="/admin/albums?new=1"');
});

test("renders album list with covers, badges, statistics, and accessible navigation", () => {
  const markup = renderToStaticMarkup(<AdminAlbumList albums={mockAlbums} />);

  // Header & Stats
  expect(markup).toContain("Albums");
  expect(markup).toContain("2 Total stories");
  expect(markup).toContain("1 Published");
  expect(markup).toContain("1 Drafts");
  expect(markup).toContain("Sort by:");
  expect(markup).toContain('aria-label="Sort albums"');
  expect(markup).toContain("Sort albums");
  expect(markup).toContain("Create album");

  // Album 1 (Published with cover)
  expect(markup).toContain("Intimate Garden Wedding");
  expect(markup).toContain("Pernikahan Kebun Intim");
  expect(markup).toContain("/portfolio/intimate-wedding");
  expect(markup).toContain("Published");
  expect(markup).toContain("Wedding");
  expect(markup).toContain("2 photos");
  expect(markup).toContain('href="/admin/albums/album-1"');
  expect(markup).toContain('aria-label="Manage album Intimate Garden Wedding"');

  // Album 2 (Draft without cover)
  expect(markup).toContain("Summer Music Festival");
  expect(markup).toContain("Draft");
  expect(markup).toContain("Events");
  expect(markup).toContain("0 photos");
  expect(markup).toContain("No photos uploaded");
  expect(markup).toContain('href="/admin/albums/album-2"');
});
