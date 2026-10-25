import {z} from "zod";
import type {PoolClient} from "pg";

import {lockMediaForAttach} from "@/server/admin-media";
import {getDb, withTransaction, type SqlExecutor} from "@/lib/db";
import type {AdminSession} from "@/lib/authz";
import type {AlbumCategory, AdminAlbum, BilingualText} from "@/lib/domain";
import {HttpError, DomainError} from "@/lib/errors";
import {invalidatePublicPaths} from "@/lib/public-revalidation";

export type AlbumInput = {
  slug: string;
  category: AlbumCategory;
  title: BilingualText;
  story: BilingualText;
  location?: BilingualText;
  coverMediaId: string | null;
  sortOrder: number;
};

export type AlbumPhotoInput = {
  mediaId: string;
  position: number;
  alt: BilingualText;
};

export type AdminAlbumDependencies = {
  db?: SqlExecutor;
  transaction?: <T>(work: (client: PoolClient) => Promise<T>) => Promise<T>;
  invalidate?: (slug?: string) => void;
  expectedUpdatedAt?: string;
  idempotencyKey?: string;
};

type ConfiguredDependencies = {
  db: SqlExecutor;
  transaction: <T>(work: (client: PoolClient) => Promise<T>) => Promise<T>;
  invalidate: (slug?: string) => void;
  expectedUpdatedAt?: string;
  idempotencyKey?: string;
};

type QueryExecutor = {
  query<T extends Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{rows: T[]}>;
};

type AdminAlbumRow = {
  id: string;
  slug: string;
  category: AlbumCategory;
  title_en: string;
  title_id: string;
  story_en: string;
  story_id: string;
  location_en: string;
  location_id: string;
  status: "draft" | "published";
  cover_media_id: string | null;
  sort_order: number;
  creation_key: string | null;
  updated_at: Date | string;
};

type AdminPhotoRow = {
  position: number;
  media_id: string;
  cloud_name: string;
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  alt_en: string;
  alt_id: string;
};

const albumColumns = "id, slug, category, title_en, title_id, story_en, story_id, location_en, location_id, status, cover_media_id, sort_order, creation_key, updated_at::text AS updated_at";

function dependencies(overrides: AdminAlbumDependencies): ConfiguredDependencies {
  return {
    ...overrides,
    db: overrides.db ?? getDb(),
    transaction: overrides.transaction ?? ((work) => withTransaction(work)),
    invalidate: overrides.invalidate ?? invalidatePublicPaths,
  };
}

const bilingual = z.object({
  en: z.string().trim().min(1).max(5000),
  id: z.string().trim().min(1).max(5000),
}).strict();

const albumSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  category: z.enum(["wedding", "events", "other"]),
  title: z.object({
    en: z.string().trim().min(1).max(160),
    id: z.string().trim().min(1).max(160),
  }).strict(),
  story: bilingual,
  // Opsional supaya payload lama tetap sah; caption hanya menampilkannya kalau diisi.
  location: z.object({en: z.string().trim().max(160), id: z.string().trim().max(160)}).strict().optional(),
  coverMediaId: z.string().uuid().nullable(),
  sortOrder: z.number().int().min(0).max(10000),
}).strict();

const albumPhotosSchema = z.array(z.object({
  mediaId: z.string().uuid(),
  position: z.number().int().min(0).max(10000),
  alt: z.object({
    en: z.string().trim().min(1).max(200),
    id: z.string().trim().min(1).max(200),
  }).strict(),
}).strict()).max(500).superRefine((photos, context) => {
  const ids = new Set<string>();
  const positions = new Set<number>();
  for (const [index, photo] of photos.entries()) {
    if (ids.has(photo.mediaId)) context.addIssue({code: "custom", path: [index, "mediaId"], message: "Duplicate media ID"});
    if (positions.has(photo.position)) context.addIssue({code: "custom", path: [index, "position"], message: "Duplicate position"});
    ids.add(photo.mediaId);
    positions.add(photo.position);
  }
  for (let position = 0; position < photos.length; position += 1) {
    if (!positions.has(position)) context.addIssue({code: "custom", path: [], message: "Photo positions must be contiguous"});
  }
});

const publishSchema = z.object({published: z.boolean()}).strict();

export function parseAlbumInput(raw: unknown): AlbumInput {
  const result = albumSchema.safeParse(raw);
  if (!result.success) throw new HttpError(422, "VALIDATION_FAILED", "Album input is invalid");
  return result.data;
}

export function parseAlbumPhotosInput(raw: unknown): readonly AlbumPhotoInput[] {
  const result = albumPhotosSchema.safeParse(raw);
  if (!result.success) throw new HttpError(422, "VALIDATION_FAILED", "Album photo input is invalid");
  return result.data;
}

export function parsePublishInput(raw: unknown): {published: boolean} {
  const result = publishSchema.safeParse(raw);
  if (!result.success) throw new HttpError(422, "VALIDATION_FAILED", "Publish input is invalid");
  return result.data;
}

export function assertPublishable(album: AdminAlbum): void {
  const hasText = (value: string): boolean => value.trim().length > 0;
  const hasCompleteText = (value: BilingualText): boolean => hasText(value.en) && hasText(value.id);
  const validCategory = album.category === "wedding" || album.category === "events" || album.category === "other";
  const hasOwnedCover = album.coverMediaId !== null && album.photos.some((photo) => photo.media.id === album.coverMediaId);
  const completePhotos = album.photos.length > 0 && album.photos.every((photo) => hasCompleteText(photo.media.alt));

  if (!validCategory || !hasCompleteText(album.title) || !hasCompleteText(album.story) || !completePhotos || !hasOwnedCover) {
    throw new DomainError(409, "PUBLISHED_ALBUM_INVALID", "Album does not meet publication requirements");
  }
}

function assertCoverBelongsToPhotos(coverMediaId: string | null, photos: readonly AdminAlbum["photos"][number][]): void {
  if (coverMediaId !== null && !photos.some((photo) => photo.media.id === coverMediaId)) {
    throw new DomainError(409, "COVER_MEDIA_NOT_IN_ALBUM", "Cover media must be one of the album photos");
  }
}

function updatedAtValue(value: Date | string): string {
  return typeof value === "string" ? value : value.toISOString();
}

function assertAlbumVersion(row: AdminAlbumRow, expectedUpdatedAt: string | undefined): void {
  if (expectedUpdatedAt !== undefined && updatedAtValue(row.updated_at) !== expectedUpdatedAt) {
    throw new DomainError(409, "ALBUM_VERSION_CONFLICT", "Album changed since it was loaded");
  }
}

function createInputMatches(row: AdminAlbumRow, input: AlbumInput): boolean {
  return row.slug === input.slug
    && row.category === input.category
    && row.title_en === input.title.en
    && row.title_id === input.title.id
    && row.story_en === input.story.en
    && row.story_id === input.story.id
    && row.location_en === (input.location?.en ?? "")
    && row.location_id === (input.location?.id ?? "")
    && row.cover_media_id === input.coverMediaId
    && row.sort_order === input.sortOrder;
}

async function loadAlbumPhotoRows(tx: QueryExecutor, albumId: string): Promise<readonly AdminPhotoRow[]> {
  const result = await tx.query<AdminPhotoRow>("SELECT ap.position, ap.media_id, m.cloud_name, m.public_id, m.secure_url, m.width, m.height, ap.alt_en, ap.alt_id FROM album_photos ap JOIN media_assets m ON m.id = ap.media_id WHERE ap.album_id = $1 ORDER BY ap.position", [albumId]);
  return result.rows;
}

function mapAdminAlbum(row: AdminAlbumRow, photos: readonly AdminPhotoRow[]): AdminAlbum {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    title: {en: row.title_en, id: row.title_id},
    story: {en: row.story_en, id: row.story_id},
    location: {en: row.location_en, id: row.location_id},
    status: row.status,
    coverMediaId: row.cover_media_id,
    sortOrder: row.sort_order,
    updatedAt: updatedAtValue(row.updated_at),
    photos: photos.map((photo) => ({
      position: photo.position,
      media: {
        id: photo.media_id,
        cloudName: photo.cloud_name,
        publicId: photo.public_id,
        secureUrl: photo.secure_url,
        width: photo.width,
        height: photo.height,
        alt: {en: photo.alt_en, id: photo.alt_id},
      },
    })),
  };
}

async function lockAdminAlbum(tx: PoolClient, id: string, expectedUpdatedAt?: string): Promise<AdminAlbum> {
  const result = await tx.query<AdminAlbumRow>(`SELECT ${albumColumns} FROM albums WHERE id = $1 FOR UPDATE`, [id]);
  const row = result.rows[0];
  if (!row) throw new HttpError(404, "ALBUM_NOT_FOUND", "Album not found");
  assertAlbumVersion(row, expectedUpdatedAt);
  return mapAdminAlbum(row, await loadAlbumPhotoRows(tx, id));
}

async function loadAdminAlbum(tx: QueryExecutor, id: string): Promise<AdminAlbum> {
  const result = await tx.query<AdminAlbumRow>(`SELECT ${albumColumns} FROM albums WHERE id = $1`, [id]);
  const row = result.rows[0];
  if (!row) throw new HttpError(404, "ALBUM_NOT_FOUND", "Album not found");
  return mapAdminAlbum(row, await loadAlbumPhotoRows(tx, id));
}

async function replaceAlbumPhotos(tx: PoolClient, albumId: string, photos: readonly AlbumPhotoInput[]): Promise<void> {
  await tx.query("DELETE FROM album_photos WHERE album_id = $1", [albumId]);
  for (const photo of photos) {
    await tx.query("INSERT INTO album_photos(album_id, media_id, position, alt_en, alt_id) VALUES ($1, $2, $3, $4, $5)", [albumId, photo.mediaId, photo.position, photo.alt.en, photo.alt.id]);
  }
}

function invalidateAfterCommit(configured: ConfiguredDependencies, album: AdminAlbum): void {
  try {
    configured.invalidate(album.slug);
  } catch (error) {
    console.error(JSON.stringify({code: "PUBLIC_PATH_INVALIDATION_FAILED", error: error instanceof Error ? error.message : String(error)}));
  }
}

export async function listAdminAlbums(actor: AdminSession, overrides: AdminAlbumDependencies = {}): Promise<readonly AdminAlbum[]> {
  void actor;
  const configured = dependencies(overrides);
  const result = await configured.db.query<AdminAlbumRow>(`SELECT ${albumColumns} FROM albums ORDER BY sort_order, created_at, id`);
  return Promise.all(result.rows.map(async (row) => mapAdminAlbum(row, await loadAlbumPhotoRows(configured.db, row.id))));
}

export async function getAdminAlbum(actor: AdminSession, id: string, overrides: AdminAlbumDependencies = {}): Promise<AdminAlbum | null> {
  void actor;
  const configured = dependencies(overrides);
  const result = await configured.db.query<AdminAlbumRow>(`SELECT ${albumColumns} FROM albums WHERE id = $1`, [id]);
  const row = result.rows[0];
  return row ? mapAdminAlbum(row, await loadAlbumPhotoRows(configured.db, id)) : null;
}

export async function createAlbum(actor: AdminSession, input: AlbumInput, overrides: AdminAlbumDependencies = {}): Promise<AdminAlbum> {
  void actor;
  const configured = dependencies(overrides);
  const created = await configured.transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [configured.idempotencyKey ?? `album-slug:${input.slug}`]);
    if (configured.idempotencyKey !== undefined) {
      const keyed = await tx.query<AdminAlbumRow>(`SELECT ${albumColumns} FROM albums WHERE creation_key = $1 FOR UPDATE`, [configured.idempotencyKey]);
      if (keyed.rows[0]) {
        if (!createInputMatches(keyed.rows[0], input)) {
          throw new DomainError(409, "IDEMPOTENCY_PAYLOAD_MISMATCH", "The idempotency key was used with a different album payload");
        }
        return mapAdminAlbum(keyed.rows[0], await loadAlbumPhotoRows(tx, keyed.rows[0].id));
      }
    }
    if (input.coverMediaId) await lockMediaForAttach(tx, [input.coverMediaId]);
    assertCoverBelongsToPhotos(input.coverMediaId, []);
    const existing = await tx.query<AdminAlbumRow>(`SELECT ${albumColumns} FROM albums WHERE slug = $1 FOR UPDATE`, [input.slug]);
    if (existing.rows[0]) throw new DomainError(409, "ALBUM_SLUG_EXISTS", "An album with this slug already exists");
    const result = await tx.query<AdminAlbumRow>(
      `INSERT INTO albums (creation_key, slug, category, title_en, title_id, story_en, story_id, location_en, location_id, cover_media_id, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT DO NOTHING RETURNING ${albumColumns}`,
      [configured.idempotencyKey ?? null, input.slug, input.category, input.title.en, input.title.id, input.story.en, input.story.id, input.location?.en ?? "", input.location?.id ?? "", input.coverMediaId, input.sortOrder],
    );
    const row = result.rows[0];
    if (!row) {
      if (configured.idempotencyKey !== undefined) {
        const duplicateKey = await tx.query<AdminAlbumRow>(`SELECT ${albumColumns} FROM albums WHERE creation_key = $1 FOR UPDATE`, [configured.idempotencyKey]);
        const duplicateKeyRow = duplicateKey.rows[0];
        if (duplicateKeyRow) {
          if (!createInputMatches(duplicateKeyRow, input)) {
            throw new DomainError(409, "IDEMPOTENCY_PAYLOAD_MISMATCH", "The idempotency key was used with a different album payload");
          }
          return mapAdminAlbum(duplicateKeyRow, await loadAlbumPhotoRows(tx, duplicateKeyRow.id));
        }
      }
      const duplicate = await tx.query<AdminAlbumRow>(`SELECT ${albumColumns} FROM albums WHERE slug = $1 FOR UPDATE`, [input.slug]);
      if (duplicate.rows[0]) throw new DomainError(409, "ALBUM_SLUG_EXISTS", "An album with this slug already exists");
      throw new HttpError(500, "ALBUM_CREATE_FAILED", "Album could not be created");
    }
    return mapAdminAlbum(row, []);
  });
  invalidateAfterCommit(configured, created);
  return created;
}

export async function updateAlbum(actor: AdminSession, id: string, input: AlbumInput, overrides: AdminAlbumDependencies = {}): Promise<AdminAlbum> {
  void actor;
  const configured = dependencies(overrides);
  const updated = await configured.transaction(async (tx) => {
    const album = await lockAdminAlbum(tx, id, configured.expectedUpdatedAt);
    await lockMediaForAttach(tx, [album.coverMediaId, input.coverMediaId].filter((mediaId): mediaId is string => mediaId !== null));
    assertCoverBelongsToPhotos(input.coverMediaId, album.photos);
    await tx.query(
      "UPDATE albums SET slug = $1, category = $2, title_en = $3, title_id = $4, story_en = $5, story_id = $6, location_en = $7, location_id = $8, cover_media_id = $9, sort_order = $10, updated_at = GREATEST(clock_timestamp(), updated_at + interval '1 microsecond') WHERE id = $11",
      [input.slug, input.category, input.title.en, input.title.id, input.story.en, input.story.id, input.location?.en ?? "", input.location?.id ?? "", input.coverMediaId, input.sortOrder, id],
    );
    const next = await loadAdminAlbum(tx, id);
    assertCoverBelongsToPhotos(next.coverMediaId, next.photos);
    if (album.status === "published") assertPublishable(next);
    return next;
  });
  invalidateAfterCommit(configured, updated);
  return updated;
}

export async function setAlbumPhotos(actor: AdminSession, id: string, photos: readonly AlbumPhotoInput[], overrides: AdminAlbumDependencies = {}): Promise<AdminAlbum> {
  void actor;
  const configured = dependencies(overrides);
  const updated = await configured.transaction(async (tx) => {
    const album = await lockAdminAlbum(tx, id, configured.expectedUpdatedAt);
    const ids = photos.map((photo) => photo.mediaId);
    if (new Set(ids).size !== ids.length) throw new DomainError(409, "DUPLICATE_MEDIA_ID", "A media item appears more than once");
    await lockMediaForAttach(tx, [...ids, album.coverMediaId].filter((mediaId): mediaId is string => mediaId !== null));
    await replaceAlbumPhotos(tx, id, photos);
    const nextCover = album.coverMediaId && ids.includes(album.coverMediaId) ? album.coverMediaId : null;
    await tx.query("UPDATE albums SET cover_media_id = $2, updated_at = GREATEST(clock_timestamp(), updated_at + interval '1 microsecond') WHERE id = $1", [id, nextCover]);
    const next = await loadAdminAlbum(tx, id);
    assertCoverBelongsToPhotos(next.coverMediaId, next.photos);
    if (album.status === "published") assertPublishable(next);
    return next;
  });
  invalidateAfterCommit(configured, updated);
  return updated;
}

export async function publishAlbum(actor: AdminSession, id: string, overrides: AdminAlbumDependencies = {}): Promise<AdminAlbum> {
  void actor;
  const configured = dependencies(overrides);
  const updated = await configured.transaction(async (tx) => {
    const album = await lockAdminAlbum(tx, id, configured.expectedUpdatedAt);
    assertPublishable(album);
    if (album.status !== "published") await tx.query("UPDATE albums SET status = 'published', updated_at = GREATEST(clock_timestamp(), updated_at + interval '1 microsecond') WHERE id = $1", [id]);
    return loadAdminAlbum(tx, id);
  });
  invalidateAfterCommit(configured, updated);
  return updated;
}

export async function unpublishAlbum(actor: AdminSession, id: string, overrides: AdminAlbumDependencies = {}): Promise<AdminAlbum> {
  void actor;
  const configured = dependencies(overrides);
  const updated = await configured.transaction(async (tx) => {
    await lockAdminAlbum(tx, id, configured.expectedUpdatedAt);
    await tx.query("UPDATE albums SET status = 'draft', updated_at = GREATEST(clock_timestamp(), updated_at + interval '1 microsecond') WHERE id = $1", [id]);
    return loadAdminAlbum(tx, id);
  });
  invalidateAfterCommit(configured, updated);
  return updated;
}

export async function deleteAlbum(actor: AdminSession, id: string, overrides: AdminAlbumDependencies = {}): Promise<void> {
  void actor;
  const configured = dependencies(overrides);
  const deleted = await configured.transaction(async (tx) => {
    const album = await lockAdminAlbum(tx, id, configured.expectedUpdatedAt);
    if (album.status === "published") throw new DomainError(409, "ALBUM_MUST_BE_UNPUBLISHED", "Album must be unpublished before deletion");
    await lockMediaForAttach(tx, [...album.photos.map((photo) => photo.media.id), album.coverMediaId].filter((mediaId): mediaId is string => mediaId !== null));
    await tx.query("DELETE FROM albums WHERE id = $1", [id]);
    return album;
  });
  invalidateAfterCommit(configured, deleted);
}
