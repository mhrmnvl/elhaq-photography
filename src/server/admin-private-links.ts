import {z} from "zod";

import type {AdminSession} from "@/lib/authz";
import {getDb, type SqlExecutor} from "@/lib/db";
import type {PrivateClientLink} from "@/lib/domain";
import {HttpError} from "@/lib/errors";

export type PrivateClientLinkInput = {albumName: string; driveUrl: string};

export type AdminPrivateLinkDependencies = {db?: SqlExecutor};

type PrivateClientLinkRow = {
  id: string;
  album_name: string;
  drive_url: string;
  created_at: Date | string;
  updated_at: Date | string;
};

const privateLinkSchema = z.object({
  albumName: z.string().trim().min(1).max(200),
  driveUrl: z.string().url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "drive.google.com" || url.hostname === "docs.google.com");
  }, "Drive URL host is not allowed"),
}).strict();

const linkColumns = "id, album_name, drive_url, created_at, updated_at";

function dbFor(overrides: AdminPrivateLinkDependencies): SqlExecutor {
  return overrides.db ?? getDb();
}

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function mapLink(row: PrivateClientLinkRow): PrivateClientLink {
  return {
    id: row.id,
    albumName: row.album_name,
    driveUrl: row.drive_url,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function parsePrivateClientLinkInput(raw: unknown): PrivateClientLinkInput {
  const result = privateLinkSchema.safeParse(raw);
  if (!result.success) throw new HttpError(422, "VALIDATION_FAILED", "Private link input is invalid");
  return result.data;
}

export async function listPrivateClientLinks(actor: AdminSession, overrides: AdminPrivateLinkDependencies = {}): Promise<readonly PrivateClientLink[]> {
  void actor;
  const result = await dbFor(overrides).query<PrivateClientLinkRow>(`SELECT ${linkColumns} FROM private_client_links ORDER BY updated_at DESC, id`);
  return result.rows.map(mapLink);
}

export async function getPrivateClientLink(actor: AdminSession, id: string, overrides: AdminPrivateLinkDependencies = {}): Promise<PrivateClientLink | null> {
  void actor;
  const result = await dbFor(overrides).query<PrivateClientLinkRow>(`SELECT ${linkColumns} FROM private_client_links WHERE id = $1`, [id]);
  return result.rows[0] ? mapLink(result.rows[0]) : null;
}

export async function createPrivateClientLink(actor: AdminSession, input: PrivateClientLinkInput, overrides: AdminPrivateLinkDependencies = {}): Promise<PrivateClientLink> {
  void actor;
  const result = await dbFor(overrides).query<PrivateClientLinkRow>(
    "INSERT INTO private_client_links(album_name, drive_url) VALUES ($1, $2) RETURNING id, album_name, drive_url, created_at, updated_at",
    [input.albumName, input.driveUrl],
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(500, "PRIVATE_LINK_CREATE_FAILED", "Private link could not be created");
  return mapLink(row);
}

export async function updatePrivateClientLink(actor: AdminSession, id: string, input: PrivateClientLinkInput, overrides: AdminPrivateLinkDependencies = {}): Promise<PrivateClientLink> {
  void actor;
  const result = await dbFor(overrides).query<PrivateClientLinkRow>(
    "UPDATE private_client_links SET album_name = $2, drive_url = $3, updated_at = now() WHERE id = $1 RETURNING id, album_name, drive_url, created_at, updated_at",
    [id, input.albumName, input.driveUrl],
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(404, "PRIVATE_LINK_NOT_FOUND", "Private link was not found");
  return mapLink(row);
}

export async function deletePrivateClientLink(actor: AdminSession, id: string, overrides: AdminPrivateLinkDependencies = {}): Promise<void> {
  void actor;
  const result = await dbFor(overrides).query<{id: string}>("DELETE FROM private_client_links WHERE id = $1 RETURNING id", [id]);
  if (!result.rows[0]) throw new HttpError(404, "PRIVATE_LINK_NOT_FOUND", "Private link was not found");
}
