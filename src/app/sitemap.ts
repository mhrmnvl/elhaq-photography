import type {MetadataRoute} from "next";

import type {PublicAlbumSummary} from "@/lib/domain";
import {getServerEnv} from "@/lib/env";
import {listPublishedAlbums} from "@/server/public-content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const locales = ["en", "id"] as const;
const staticPaths = ["", "/portfolio", "/about", "/contact"] as const;

export type SitemapAlbum = PublicAlbumSummary & {status: "draft" | "published"};

function isPublished(album: SitemapAlbum): boolean {
  return album.status === "published";
}

export function buildSitemapEntries(albums: readonly SitemapAlbum[], baseUrl: string): MetadataRoute.Sitemap {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const paths = locales.flatMap((locale) => [
    ...staticPaths.map((path) => `/${locale}${path}`),
    ...albums.filter(isPublished).map((album) => `/${locale}/portfolio/${encodeURIComponent(album.slug)}`),
  ]);

  return paths.map((path) => ({url: `${normalizedBaseUrl}${path}`}));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getServerEnv().APP_URL;
  const albums = await listPublishedAlbums();
  return buildSitemapEntries(albums.map((album) => ({...album, status: "published" as const})), baseUrl);
}
