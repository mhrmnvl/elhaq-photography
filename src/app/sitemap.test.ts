import {expect, test} from "bun:test";

import {buildSitemapEntries} from "@/app/sitemap";
import type {PublicAlbumSummary} from "@/lib/domain";

const fixture = [
  {
    id: "draft-id",
    slug: "draft-fixture",
    status: "draft" as const,
    category: "wedding" as const,
    title: {en: "Draft", id: "Draf"},
    cover: null,
  },
  {
    id: "published-id",
    slug: "published-fixture",
    status: "published" as const,
    category: "events" as const,
    title: {en: "Published", id: "Terbit"},
    cover: null,
  },
] satisfies readonly (PublicAlbumSummary & {status: "draft" | "published"})[];

const missingStatus = {
  id: "missing-status-id",
  slug: "missing-status-fixture",
  category: "other" as const,
  title: {en: "Missing status", id: "Status hilang"},
  cover: null,
} as PublicAlbumSummary & {status: "draft" | "published"};

test("builds localized sitemap entries from the published reader without draft slugs", () => {
  const entries = buildSitemapEntries([...fixture, missingStatus], "https://example.test");
  const urls = entries.map((entry) => entry.url);

  expect(urls).not.toContain("https://example.test/en/portfolio/draft-fixture");
  expect(urls).not.toContain("https://example.test/id/portfolio/draft-fixture");
  expect(urls).not.toContain("https://example.test/en/portfolio/missing-status-fixture");
  expect(urls).not.toContain("https://example.test/id/portfolio/missing-status-fixture");
  expect(urls).toContain("https://example.test/en/portfolio/published-fixture");
  expect(urls).toContain("https://example.test/id/portfolio/published-fixture");
});
