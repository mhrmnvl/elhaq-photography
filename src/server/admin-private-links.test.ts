import {expect, test} from "bun:test";

import type {PrivateClientLink} from "@/lib/domain";
import {getPublicSiteSettings} from "@/server/public-content";
import {
  createPrivateClientLink,
  deletePrivateClientLink,
  getPrivateClientLink,
  listPrivateClientLinks,
  parsePrivateClientLinkInput,
  updatePrivateClientLink,
} from "@/server/admin-private-links";

const actor = {userId: "admin-1", email: "admin@example.com", name: null};
const linkId = "00000000-0000-4000-8000-000000000010";
const baseRow = {
  id: linkId,
  album_name: "Private gallery",
  drive_url: "https://drive.google.com/drive/folders/example",
  created_at: "2026-09-22T00:00:00.000Z",
  updated_at: "2026-09-22T00:00:00.000Z",
};

function dbFor(rows: typeof baseRow[] = [baseRow]): {db: {query: <T extends Record<string, unknown>>(text: string, values?: readonly unknown[]) => Promise<{rows: T[]}>}; queries: string[]} {
  const queries: string[] = [];
  return {
    queries,
    db: {
      async query<T extends Record<string, unknown>>(text: string): Promise<{rows: T[]}> {
        queries.push(text);
        if (text.includes("DELETE FROM")) return {rows: rows.length ? [{id: rows[0].id} as unknown as T] : []};
        return {rows: rows.map((row) => row as unknown as T)};
      },
    },
  };
}

test("parses and trims a strict Google Drive link input", () => {
  expect(parsePrivateClientLinkInput({albumName: "  Private gallery ", driveUrl: "https://docs.google.com/document/d/example"})).toEqual({
    albumName: "Private gallery",
    driveUrl: "https://docs.google.com/document/d/example",
  });
  expect(() => parsePrivateClientLinkInput({albumName: "Private gallery", driveUrl: "http://drive.google.com/example"})).toThrow("VALIDATION_FAILED");
  expect(() => parsePrivateClientLinkInput({albumName: "Private gallery", driveUrl: "https://example.com/example"})).toThrow("VALIDATION_FAILED");
  expect(() => parsePrivateClientLinkInput({albumName: "Private gallery", driveUrl: "https://drive.google.com/example", extra: true})).toThrow("VALIDATION_FAILED");
});

test("lists, creates, and updates private client links using the fixed row shape", async () => {
  const {db, queries} = dbFor();
  const input = {albumName: "Private gallery", driveUrl: "https://drive.google.com/drive/folders/example"};

  await expect(listPrivateClientLinks(actor, {db})).resolves.toEqual<readonly PrivateClientLink[]>([{
    id: linkId,
    albumName: baseRow.album_name,
    driveUrl: baseRow.drive_url,
    createdAt: baseRow.created_at,
    updatedAt: baseRow.updated_at,
  }]);
  await expect(getPrivateClientLink(actor, linkId, {db})).resolves.toMatchObject({id: linkId});
  await expect(createPrivateClientLink(actor, input, {db})).resolves.toMatchObject({id: linkId, albumName: baseRow.album_name});
  await expect(updatePrivateClientLink(actor, linkId, input, {db})).resolves.toMatchObject({id: linkId, driveUrl: baseRow.drive_url});
  expect(queries.some((query) => query.startsWith("INSERT INTO private_client_links"))).toBe(true);
  expect(queries.some((query) => query.startsWith("UPDATE private_client_links"))).toBe(true);
});

test("returns not found for missing updates and deletes", async () => {
  const {db} = dbFor([]);
  const input = {albumName: "Private gallery", driveUrl: "https://drive.google.com/drive/folders/example"};

  await expect(updatePrivateClientLink(actor, linkId, input, {db})).rejects.toMatchObject({status: 404, code: "PRIVATE_LINK_NOT_FOUND"});
  await expect(deletePrivateClientLink(actor, linkId, {db})).rejects.toMatchObject({status: 404, code: "PRIVATE_LINK_NOT_FOUND"});
});

test("deletes a private client link after it is found", async () => {
  const {db} = dbFor();
  await expect(deletePrivateClientLink(actor, linkId, {db})).resolves.toBeUndefined();
});

test("public settings reads never query private client links", async () => {
  const queries: string[] = [];
  await getPublicSiteSettings({query: async <T extends Record<string, unknown>>(text: string) => {
    queries.push(text);
    return {rows: [] as T[]};
  }});

  expect(queries).toHaveLength(1);
  expect(queries[0]).not.toContain("private_client_links");
});
