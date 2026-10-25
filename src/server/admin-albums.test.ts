import {expect, test} from "bun:test";
import {randomUUID} from "node:crypto";
import type {PoolClient} from "pg";
import {Pool} from "pg";

import type {AdminAlbum} from "@/lib/domain";
import {HttpError} from "@/lib/errors";
import {lockMediaForAttach} from "@/server/admin-media";
import {
  assertPublishable,
  createAlbum,
  deleteAlbum,
  parseAlbumInput,
  parseAlbumPhotosInput,
  parsePublishInput,
  setAlbumPhotos,
  updateAlbum,
} from "@/server/admin-albums";

const baseMedia = {
  id: "m1",
  cloudName: "test",
  publicId: "test/m1",
  secureUrl: "https://res.cloudinary.com/test/image/upload/test/m1",
  width: 1200,
  height: 800,
  alt: {en: "Photo", id: "Foto"},
};

const base: AdminAlbum = {
  id: "a1",
  slug: "story",
  category: "wedding",
  title: {en: "Story", id: "Cerita"},
  story: {en: "Story", id: "Cerita"},
  location: {en: "", id: ""},
  status: "draft",
  updatedAt: "2026-09-22T00:00:00.000Z",
  coverMediaId: "m1",
  sortOrder: 0,
  photos: [{media: baseMedia, position: 0}],
};

const actor = {userId: "admin-1", email: "admin@example.com", name: null};
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) console.warn("SKIP album race integration: TEST_DATABASE_URL unavailable");

type FakeAlbumStore = {
  row: {
    id: string;
    slug: string;
    category: "wedding" | "events" | "other";
    title_en: string;
    title_id: string;
    story_en: string;
    story_id: string;
    location_en: string;
    location_id: string;
    status: "draft" | "published";
    creation_key: string | null;
    updated_at: string;
    cover_media_id: string | null;
    sort_order: number;
  };
  photos: Array<{
    position: number;
    media_id: string;
    cloud_name: string;
    public_id: string;
    secure_url: string;
    width: number;
    height: number;
    alt_en: string;
    alt_id: string;
  }>;
  mediaIds: Set<string>;
  deleted: boolean;
};

function storeFor(album: AdminAlbum = base): FakeAlbumStore {
  return {
    row: {
      id: album.id,
      slug: album.slug,
      category: album.category,
      title_en: album.title.en,
      title_id: album.title.id,
      story_en: album.story.en,
      story_id: album.story.id,
      location_en: album.location.en,
      location_id: album.location.id,
      status: album.status,
      creation_key: null,
      updated_at: album.updatedAt,
      cover_media_id: album.coverMediaId,
      sort_order: album.sortOrder,
    },
    photos: album.photos.map((photo) => ({
      position: photo.position,
      media_id: photo.media.id,
      cloud_name: photo.media.cloudName,
      public_id: photo.media.publicId,
      secure_url: photo.media.secureUrl,
      width: photo.media.width,
      height: photo.media.height,
      alt_en: photo.media.alt.en,
      alt_id: photo.media.alt.id,
    })),
    mediaIds: new Set(album.photos.map((photo) => photo.media.id)),
    deleted: false,
  };
}

function transactionFor(store: FakeAlbumStore): <T>(work: (client: PoolClient) => Promise<T>) => Promise<T> {
  const client = {
    async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []): Promise<{rows: T[]}> {
      if (text.includes("FROM albums") && text.includes("WHERE creation_key = $1")) return {rows: store.row.creation_key === values[0] ? [store.row as unknown as T] : []};
      if (text.includes("FROM albums") && text.includes("WHERE slug = $1")) return {rows: store.row.slug === values[0] ? [store.row as unknown as T] : []};
      if (text.includes("FROM albums") && text.includes("WHERE id = $1")) return {rows: [store.row as unknown as T]};
      if (text.includes("FROM album_photos")) return {rows: store.photos as unknown as T[]};
      if (text.includes("FROM media_assets")) {
        const ids = Array.isArray(values[0]) ? values[0] as string[] : [];
        return {rows: ids.filter((id) => store.mediaIds.has(id)).map((id) => ({id} as unknown as T))};
      }
      if (text.startsWith("DELETE FROM album_photos")) {
        store.photos = [];
        return {rows: []};
      }
      if (text.startsWith("INSERT INTO album_photos")) {
        store.photos.push({
          position: Number(values[2]),
          media_id: String(values[1]),
          cloud_name: "test",
          public_id: `test/${values[1]}`,
          secure_url: `https://res.cloudinary.com/test/image/upload/test/${values[1]}`,
          width: 1200,
          height: 800,
          alt_en: String(values[3]),
          alt_id: String(values[4]),
        });
        return {rows: []};
      }
      if (text.startsWith("UPDATE albums SET cover_media_id")) {
        store.row.cover_media_id = values[1] as string | null;
        store.row.updated_at = new Date(Date.parse(store.row.updated_at) + 1).toISOString();
        return {rows: []};
      }
      if (text.startsWith("UPDATE albums SET slug")) {
        store.row.slug = String(values[0]);
        store.row.category = values[1] as FakeAlbumStore["row"]["category"];
        store.row.title_en = String(values[2]);
        store.row.title_id = String(values[3]);
        store.row.story_en = String(values[4]);
        store.row.story_id = String(values[5]);
        store.row.location_en = String(values[6]);
        store.row.location_id = String(values[7]);
        store.row.cover_media_id = values[8] as string | null;
        store.row.sort_order = Number(values[9]);
        store.row.updated_at = new Date(Date.parse(store.row.updated_at) + 1).toISOString();
        return {rows: []};
      }
      if (text.startsWith("INSERT INTO albums")) {
        store.row.creation_key = values[0] as string | null;
        store.row.slug = String(values[1]);
        store.row.category = values[2] as FakeAlbumStore["row"]["category"];
        store.row.title_en = String(values[3]);
        store.row.title_id = String(values[4]);
        store.row.story_en = String(values[5]);
        store.row.story_id = String(values[6]);
        store.row.location_en = String(values[7]);
        store.row.location_id = String(values[8]);
        store.row.cover_media_id = values[9] as string | null;
        store.row.sort_order = Number(values[10]);
        store.row.updated_at = new Date().toISOString();
        store.photos = [];
        return {rows: [store.row as unknown as T]};
      }
      if (text.startsWith("DELETE FROM albums")) {
        store.deleted = true;
        return {rows: []};
      }
      return {rows: []};
    },
  } as unknown as PoolClient;
  return async <T>(work: (client: PoolClient) => Promise<T>): Promise<T> => {
    const snapshot = {
      row: {...store.row},
      photos: store.photos.map((photo) => ({...photo})),
      mediaIds: new Set(store.mediaIds),
      deleted: store.deleted,
    };
    try {
      return await work(client);
    } catch (error) {
      store.row = {...snapshot.row};
      store.photos = snapshot.photos.map((photo) => ({...photo}));
      store.mediaIds = new Set(snapshot.mediaIds);
      store.deleted = snapshot.deleted;
      throw error;
    }
  };
}

test("requires both locale fields, one photo with both alt fields, and an owned cover", () => {
  expect(() => assertPublishable({...base, title: {en: "", id: "Cerita"}})).toThrow("PUBLISHED_ALBUM_INVALID");
  expect(() => assertPublishable({...base, story: {en: "Cerita", id: ""}})).toThrow("PUBLISHED_ALBUM_INVALID");
  expect(() => assertPublishable({...base, photos: [], coverMediaId: null})).toThrow("PUBLISHED_ALBUM_INVALID");
  expect(() => assertPublishable({...base, photos: [{...base.photos[0], media: {...baseMedia, alt: {en: "", id: "Foto"}}}]})).toThrow("PUBLISHED_ALBUM_INVALID");
  expect(() => assertPublishable({...base, photos: [{...base.photos[0], media: {...baseMedia, alt: {en: "Photo", id: ""}}}]})).toThrow("PUBLISHED_ALBUM_INVALID");
  expect(() => assertPublishable({...base, coverMediaId: "foreign"})).toThrow("PUBLISHED_ALBUM_INVALID");
  expect(() => assertPublishable({...base, category: "invalid" as AdminAlbum["category"]})).toThrow("PUBLISHED_ALBUM_INVALID");
  expect(() => assertPublishable(base)).not.toThrow();
});

test("rejects a published album after its last photo is removed", () => {
  expect(() => assertPublishable({...base, status: "published", photos: [], coverMediaId: null})).toThrow("PUBLISHED_ALBUM_INVALID");
});

test("rejects blank published story updates", () => {
  expect(() => assertPublishable({...base, status: "published", story: {en: "", id: "Cerita"}})).toThrow("PUBLISHED_ALBUM_INVALID");
});

test("parses strict bilingual album input and trims text", () => {
  expect(parseAlbumInput({
    slug: "  wedding-story ",
    category: "wedding",
    title: {en: "  Story ", id: " Cerita "},
    story: {en: "  A story ", id: " Sebuah cerita "},
    coverMediaId: null,
    sortOrder: 4,
  })).toEqual({
    slug: "wedding-story",
    category: "wedding",
    title: {en: "Story", id: "Cerita"},
    story: {en: "A story", id: "Sebuah cerita"},
    coverMediaId: null,
    sortOrder: 4,
  });
});

test("rejects unknown album fields and invalid slugs", () => {
  expect(() => parseAlbumInput({
    slug: "Story",
    category: "wedding",
    title: {en: "Story", id: "Cerita"},
    story: {en: "Story", id: "Cerita"},
    coverMediaId: null,
    sortOrder: 0,
    unexpected: true,
  })).toThrow("VALIDATION_FAILED");
});

test("rejects duplicate media IDs and non-contiguous positions", () => {
  const duplicateId = "00000000-0000-4000-8000-000000000001";
  const duplicate = [
    {mediaId: duplicateId, position: 0, alt: {en: "One", id: "Satu"}},
    {mediaId: duplicateId, position: 1, alt: {en: "Two", id: "Dua"}},
  ];
  expect(() => parseAlbumPhotosInput(duplicate)).toThrow("VALIDATION_FAILED");
  expect(() => parseAlbumPhotosInput([{mediaId: duplicateId, position: 1, alt: {en: "One", id: "Satu"}}])).toThrow("VALIDATION_FAILED");
});

test("requires a strict published boolean", () => {
  expect(parsePublishInput({published: true})).toEqual({published: true});
  expect(parsePublishInput({published: false})).toEqual({published: false});
  expect(() => parsePublishInput({published: "true"})).toThrow(HttpError);
  expect(() => parsePublishInput({published: true, extra: false})).toThrow("VALIDATION_FAILED");
});

test("rejects duplicate media IDs before locking or replacing photos", async () => {
  const store = storeFor();
  await expect(setAlbumPhotos(actor, base.id, [
    {mediaId: "m1", position: 0, alt: {en: "One", id: "Satu"}},
    {mediaId: "m1", position: 1, alt: {en: "Two", id: "Dua"}},
  ], {transaction: transactionFor(store)})).rejects.toMatchObject({status: 409, code: "DUPLICATE_MEDIA_ID"});
  expect(store.photos).toHaveLength(1);
});

test("does not create an album with a cover before its photos exist", async () => {
  const store = storeFor();
  await expect(createAlbum(actor, {
    slug: "new-story",
    category: "wedding",
    title: {en: "Story", id: "Cerita"},
    story: {en: "Story", id: "Cerita"},
    coverMediaId: "m1",
    sortOrder: 0,
  }, {transaction: transactionFor(store)})).rejects.toMatchObject({status: 409, code: "COVER_MEDIA_NOT_IN_ALBUM"});
});

test("keeps foreign media errors ahead of the cover ownership check", async () => {
  const store = storeFor();
  await expect(createAlbum(actor, {
    slug: "new-story",
    category: "wedding",
    title: {en: "Story", id: "Cerita"},
    story: {en: "Story", id: "Cerita"},
    coverMediaId: "foreign",
    sortOrder: 0,
  }, {transaction: transactionFor(store)})).rejects.toMatchObject({status: 409, code: "FOREIGN_MEDIA_ID"});
});

test("rejects a draft cover that is not one of its photos", async () => {
  const store = storeFor();
  store.mediaIds.add("m2");
  await expect(updateAlbum(actor, base.id, {
    slug: base.slug,
    category: base.category,
    title: base.title,
    story: base.story,
    coverMediaId: "m2",
    sortOrder: base.sortOrder,
  }, {transaction: transactionFor(store)})).rejects.toMatchObject({status: 409, code: "COVER_MEDIA_NOT_IN_ALBUM"});
});

test("rejects a stale album version before metadata mutation", async () => {
  const store = storeFor();
  const before = {...store.row};
  const dependencies = {transaction: transactionFor(store), expectedUpdatedAt: "stale-version"} as unknown as Parameters<typeof updateAlbum>[3];
  await expect(updateAlbum(actor, base.id, {
    slug: base.slug,
    category: base.category,
    title: base.title,
    story: base.story,
    coverMediaId: base.coverMediaId,
    sortOrder: base.sortOrder,
  }, dependencies)).rejects.toMatchObject({status: 409, code: "ALBUM_VERSION_CONFLICT"});
  expect(store.row).toEqual(before);
});

test("stores the album location on update", async () => {
  const store = storeFor();
  await updateAlbum(actor, base.id, {
    slug: base.slug,
    category: base.category,
    title: base.title,
    story: base.story,
    location: {en: "Bandung", id: "Bandung"},
    coverMediaId: base.coverMediaId,
    sortOrder: base.sortOrder,
  }, {transaction: transactionFor(store)});

  expect(store.row.location_en).toBe("Bandung");
  expect(store.row.location_id).toBe("Bandung");
});

test("updates the album version for metadata and photo mutations", async () => {
  const store = storeFor();
  const first = await updateAlbum(actor, base.id, {
    slug: base.slug,
    category: base.category,
    title: base.title,
    story: base.story,
    coverMediaId: base.coverMediaId,
    sortOrder: base.sortOrder,
  }, {transaction: transactionFor(store)});
  expect(first.updatedAt).not.toBe(base.updatedAt);
  const second = await setAlbumPhotos(actor, base.id, [{mediaId: "m1", position: 0, alt: baseMedia.alt}], {transaction: transactionFor(store)});
  expect(second.updatedAt).not.toBe(first.updatedAt);
});

test("replays a create only for the same persisted creation key and payload", async () => {
  const store = storeFor({...base, coverMediaId: null});
  store.row.creation_key = "00000000-0000-4000-8000-000000000001";
  const result = await createAlbum(actor, {
    slug: base.slug,
    category: base.category,
    title: base.title,
    story: base.story,
    coverMediaId: null,
    sortOrder: base.sortOrder,
  }, {transaction: transactionFor(store), idempotencyKey: store.row.creation_key});
  expect(result).toMatchObject({id: base.id, slug: base.slug, updatedAt: base.updatedAt});
  expect(result).not.toHaveProperty("creationKey");
});

test("rejects a same-key create when its payload differs", async () => {
  const store = storeFor({...base, coverMediaId: null});
  store.row.creation_key = "00000000-0000-4000-8000-000000000001";
  await expect(createAlbum(actor, {
    slug: base.slug,
    category: base.category,
    title: {en: "Changed", id: base.title.id},
    story: base.story,
    coverMediaId: null,
    sortOrder: base.sortOrder,
  }, {transaction: transactionFor(store), idempotencyKey: store.row.creation_key})).rejects.toMatchObject({status: 409, code: "IDEMPOTENCY_PAYLOAD_MISMATCH"});
});

test("reports a true slug collision instead of adopting the existing album", async () => {
  const store = storeFor({...base, coverMediaId: null});
  store.row.creation_key = null;
  await expect(createAlbum(actor, {
    slug: base.slug,
    category: base.category,
    title: base.title,
    story: base.story,
    coverMediaId: null,
    sortOrder: base.sortOrder,
  }, {transaction: transactionFor(store), idempotencyKey: "00000000-0000-4000-8000-000000000002"})).rejects.toMatchObject({status: 409, code: "ALBUM_SLUG_EXISTS"});
});

test("persists the creation key without returning it in the admin album shape", async () => {
  const store = storeFor();
  const key = "00000000-0000-4000-8000-000000000003";
  const result = await createAlbum(actor, {
    slug: "new-story",
    category: "wedding",
    title: {en: "New story", id: "Cerita baru"},
    story: {en: "Story", id: "Cerita"},
    coverMediaId: null,
    sortOrder: 1,
  }, {transaction: transactionFor(store), idempotencyKey: key});

  expect(store.row.creation_key).toBe(key);
  expect(result).not.toHaveProperty("creationKey");
});

test("rejects foreign media IDs while attaching album photos", async () => {
  const store = storeFor();
  await expect(setAlbumPhotos(actor, base.id, [
    {mediaId: "foreign", position: 0, alt: {en: "One", id: "Satu"}},
  ], {transaction: transactionFor(store)})).rejects.toMatchObject({status: 409, code: "FOREIGN_MEDIA_ID"});
  expect(store.photos).toHaveLength(1);
});

test("rolls back an attempted last-photo removal from a published album", async () => {
  const store = storeFor({...base, status: "published"});
  const before = {
    row: {...store.row},
    photos: store.photos.map((photo) => ({...photo})),
    mediaIds: [...store.mediaIds],
    deleted: store.deleted,
  };
  await expect(setAlbumPhotos(actor, base.id, [], {transaction: transactionFor(store)})).rejects.toMatchObject({status: 409, code: "PUBLISHED_ALBUM_INVALID"});
  expect({row: store.row, photos: store.photos, mediaIds: [...store.mediaIds], deleted: store.deleted}).toEqual(before);
});

test("rejects a blank story update on a published album", async () => {
  const store = storeFor({...base, status: "published"});
  await expect(updateAlbum(actor, base.id, {
    slug: base.slug,
    category: base.category,
    title: base.title,
    story: {en: "", id: base.story.id},
    coverMediaId: base.coverMediaId,
    sortOrder: base.sortOrder,
  }, {transaction: transactionFor(store)})).rejects.toMatchObject({status: 409, code: "PUBLISHED_ALBUM_INVALID"});
});

test("requires an album to be unpublished before deletion", async () => {
  const store = storeFor({...base, status: "published"});
  await expect(deleteAlbum(actor, base.id, {transaction: transactionFor(store)})).rejects.toMatchObject({status: 409, code: "ALBUM_MUST_BE_UNPUBLISHED"});
  expect(store.deleted).toBe(false);
});

test("keeps a committed album write successful when invalidation fails", async () => {
  const row = {
    id: "a2",
    slug: "new-story",
    category: "wedding" as const,
    title_en: "Story",
    title_id: "Cerita",
    story_en: "Story",
    story_id: "Cerita",
    status: "draft" as const,
    cover_media_id: null,
    sort_order: 0,
    updated_at: "2026-09-22T00:00:00.000Z",
  };
  const client = {
    async query<T extends Record<string, unknown>>(text: string): Promise<{rows: T[]}> {
      return text.startsWith("INSERT INTO albums") ? {rows: [row as unknown as T]} : {rows: []};
    },
  } as unknown as PoolClient;
  const logs: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => logs.push(message);
  try {
    await expect(createAlbum(actor, {
      slug: row.slug,
      category: row.category,
      title: {en: row.title_en, id: row.title_id},
      story: {en: row.story_en, id: row.story_id},
      coverMediaId: null,
      sortOrder: row.sort_order,
    }, {
      transaction: async (work) => work(client),
      invalidate: () => { throw new Error("revalidation unavailable"); },
    })).resolves.toMatchObject({id: row.id, slug: row.slug});
  } finally {
    console.error = originalError;
  }
  expect(logs.some((message) => message.includes("PUBLIC_PATH_INVALIDATION_FAILED"))).toBe(true);
});

test.skipIf(!testDatabaseUrl)("serializes concurrent media attach and delete operations", async () => {
  const pool = new Pool({connectionString: testDatabaseUrl, max: 3});
  const mediaId = randomUUID();
  const albumId = randomUUID();
  let releaseAttach: (() => void) | undefined;
  let releaseAttachLocked: (() => void) | undefined;
  let releaseDeleteStarted: (() => void) | undefined;
  const attachMayCommit = new Promise<void>((resolve) => { releaseAttach = resolve; });
  const attachLocked = new Promise<void>((resolve) => { releaseAttachLocked = resolve; });
  const deleteStarted = new Promise<void>((resolve) => { releaseDeleteStarted = resolve; });
  let deleteSettled = false;

  await pool.query(
    "INSERT INTO media_assets (id, cloud_name, public_id, secure_url, width, height, format, bytes, created_by) VALUES ($1, 'test', $2, $3, 1200, 800, 'jpg', 100, 'album-race-test')",
    [mediaId, `test/${mediaId}`, `https://res.cloudinary.com/test/image/upload/test/${mediaId}`],
  );
  await pool.query(
    "INSERT INTO albums (id, slug, category, title_en, title_id, story_en, story_id, status, sort_order) VALUES ($1, $2, 'wedding', 'Race', 'Race', 'Race story', 'Cerita race', 'draft', 0)",
    [albumId, `race-${mediaId}`],
  );

  const attach = (async (): Promise<void> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await lockMediaForAttach(client, [mediaId]);
      releaseAttachLocked?.();
      await attachMayCommit;
      await client.query("INSERT INTO album_photos(album_id, media_id, position, alt_en, alt_id) VALUES ($1, $2, 0, 'Race photo', 'Foto race')", [albumId, mediaId]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })();

  const deletion = (async (): Promise<unknown> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      releaseDeleteStarted?.();
      await client.query("DELETE FROM media_assets WHERE id = $1", [mediaId]);
      await client.query("COMMIT");
      return "deleted";
    } catch (error) {
      await client.query("ROLLBACK");
      return error;
    } finally {
      deleteSettled = true;
      client.release();
    }
  })();

  try {
    await attachLocked;
    await deleteStarted;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(deleteSettled).toBe(false);
    releaseAttach?.();
    await attach;
    const result = await deletion;
    expect(result).toMatchObject({code: "23503"});
  } finally {
    releaseAttach?.();
    await attach.catch(() => undefined);
    await deletion;
    await pool.query("DELETE FROM albums WHERE id = $1", [albumId]);
    await pool.query("DELETE FROM media_assets WHERE id = $1", [mediaId]);
    await pool.end();
  }
});
