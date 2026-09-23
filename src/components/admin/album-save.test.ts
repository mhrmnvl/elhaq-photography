import {expect, test} from "bun:test";

import type {AdminAlbum} from "@/lib/domain";
import {saveAlbum, type AlbumSaveMetadata, type AlbumSavePhoto} from "@/components/admin/album-save";

const metadata: AlbumSaveMetadata = {
  slug: "story",
  category: "wedding",
  title: {en: "Story", id: "Cerita"},
  story: {en: "Story", id: "Cerita"},
  coverMediaId: "m1",
  sortOrder: 0,
};

const photos: AlbumSavePhoto[] = [{mediaId: "m1", position: 0, alt: {en: "Photo", id: "Foto"}}];

const album: AdminAlbum = {
  id: "a1",
  ...metadata,
  status: "draft",
  updatedAt: "2026-09-22T00:00:00.000Z",
  photos: [{position: 0, media: {id: "m1", cloudName: "test", publicId: "test/m1", secureUrl: "https://example.com/m1.jpg", width: 640, height: 480, alt: photos[0].alt}}],
};

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {status});
}

test("creates without a cover, attaches photos, then sets the requested cover", async () => {
  const calls: Array<{url: string; init?: RequestInit}> = [];
  const request = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({url, init});
    if (calls.length === 1) return jsonResponse({...album, id: "a2", coverMediaId: null, photos: [], updatedAt: "v1"}, 201);
    if (calls.length === 2) return jsonResponse({...album, id: "a2", coverMediaId: null, updatedAt: "v2"});
    return jsonResponse({...album, id: "a2", updatedAt: "v3"});
  };

  const saved = await saveAlbum({albumId: null, metadata, photos, previousAlbum: null, request});

  expect(saved.coverMediaId).toBe("m1");
  expect(calls.map((call) => `${call.init?.method ?? "GET"} ${call.url}`)).toEqual([
    "POST /api/admin/albums",
    "PUT /api/admin/albums/a2/photos",
    "PATCH /api/admin/albums/a2",
  ]);
  expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({coverMediaId: null});
  expect(new Headers(calls[1].init?.headers).get("if-unmodified-since")).toBe("v1");
  expect(new Headers(calls[2].init?.headers).get("if-unmodified-since")).toBe("v2");
});

test("deletes a newly created draft when attaching its photos fails", async () => {
  const calls: string[] = [];
  const headers: Array<HeadersInit | undefined> = [];
  const request = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    headers.push(init?.headers);
    if (calls.length === 1) return jsonResponse({...album, id: "a2", coverMediaId: null, photos: [], updatedAt: "v1"}, 201);
    if (calls.length === 2) return jsonResponse({code: "FOREIGN_MEDIA_ID"}, 409);
    if (calls.length === 3) return jsonResponse({...album, id: "a2", coverMediaId: null, photos: [], updatedAt: "v1"});
    return jsonResponse({ok: true});
  };

  await expect(saveAlbum({albumId: null, metadata, photos, previousAlbum: null, request})).rejects.toMatchObject({code: "FOREIGN_MEDIA_ID"});
  expect(calls).toEqual([
    "POST /api/admin/albums",
    "PUT /api/admin/albums/a2/photos",
    "GET /api/admin/albums/a2",
    "DELETE /api/admin/albums/a2",
  ]);
  expect(new Headers(headers[3]).get("if-unmodified-since")).toBe("v1");
});

test("retries a lost create response with the same deterministic key", async () => {
  const calls: Array<{url: string; init?: RequestInit}> = [];
  const request = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({url, init});
    if (calls.length === 1) throw new Error("response lost");
    if (calls.length === 2) return jsonResponse({...album, id: "a2", coverMediaId: null, photos: [], updatedAt: "v1"}, 201);
    if (calls.length === 3) return jsonResponse({...album, id: "a2", coverMediaId: null, updatedAt: "v2"});
    return jsonResponse({...album, id: "a2", updatedAt: "v3"});
  };

  await saveAlbum({albumId: null, metadata, photos, previousAlbum: null, request});

  expect(calls.map((call) => `${call.init?.method ?? "GET"} ${call.url}`)).toEqual([
    "POST /api/admin/albums",
    "POST /api/admin/albums",
    "PUT /api/admin/albums/a2/photos",
    "PATCH /api/admin/albums/a2",
  ]);
  const firstKey = new Headers(calls[0].init?.headers).get("idempotency-key");
  const retryKey = new Headers(calls[1].init?.headers).get("idempotency-key");
  expect(firstKey).toMatch(/^[0-9a-f-]{36}$/);
  expect(retryKey).toBe(firstKey);
  expect(firstKey).not.toBe("album:story");
});

test("does not adopt a matching slug after both create responses are lost", async () => {
  const calls: string[] = [];
  const request = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    throw new Error("response lost");
  };

  await expect(saveAlbum({albumId: null, metadata, photos, previousAlbum: null, request})).rejects.toThrow("response lost");

  expect(calls).toEqual([
    "POST /api/admin/albums",
    "POST /api/admin/albums",
  ]);
});

test("keeps a new album when its final response is lost after commit", async () => {
  const created = {...album, id: "a2", coverMediaId: null, photos: []};
  const withPhotos = {...album, id: "a2", coverMediaId: null};
  const intended = {...album, id: "a2"};
  const calls: string[] = [];
  const request = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (calls.length === 1) return jsonResponse(created, 201);
    if (calls.length === 2) return jsonResponse(withPhotos);
    if (calls.length === 3) throw new Error("response lost");
    return jsonResponse(intended);
  };

  await expect(saveAlbum({albumId: null, metadata, photos, previousAlbum: null, request})).resolves.toEqual(intended);
  expect(calls).toEqual([
    "POST /api/admin/albums",
    "PUT /api/admin/albums/a2/photos",
    "PATCH /api/admin/albums/a2",
    "GET /api/admin/albums/a2",
  ]);
});

test("restores the prior photos and metadata when the second existing-album mutation fails", async () => {
  const nextPhotos: AlbumSavePhoto[] = [{mediaId: "m2", position: 0, alt: {en: "New photo", id: "Foto baru"}}];
  const nextMetadata = {...metadata, coverMediaId: "m2", story: {en: "New story", id: "Cerita baru"}};
  const intermediate: AdminAlbum = {...album, coverMediaId: null, updatedAt: "v2", photos: [{position: 0, media: {...album.photos[0].media, id: "m2", publicId: "test/m2", secureUrl: "https://example.com/m2.jpg", alt: nextPhotos[0].alt}}]};
  const calls: string[] = [];
  const headers: Array<HeadersInit | undefined> = [];
  const request = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    headers.push(init?.headers);
    if (calls.length === 1) return jsonResponse(intermediate);
    if (calls.length === 2) return jsonResponse({code: "PUBLISHED_ALBUM_INVALID"}, 409);
    if (calls.length === 3) return jsonResponse(intermediate);
    if (calls.length === 4) return jsonResponse({...album, updatedAt: "v3"});
    return jsonResponse(album);
  };

  await expect(saveAlbum({albumId: album.id, metadata: nextMetadata, photos: nextPhotos, previousAlbum: album, request})).rejects.toMatchObject({code: "PUBLISHED_ALBUM_INVALID"});
  expect(calls).toEqual([
    "PUT /api/admin/albums/a1/photos",
    "PATCH /api/admin/albums/a1",
    "GET /api/admin/albums/a1",
    "PUT /api/admin/albums/a1/photos",
    "PATCH /api/admin/albums/a1",
  ]);
  expect(new Headers(headers[3]).get("if-unmodified-since")).toBe("v2");
  expect(new Headers(headers[4]).get("if-unmodified-since")).toBe("v3");
});

test("does not restore over a concurrent album change", async () => {
  const nextPhotos: AlbumSavePhoto[] = [{mediaId: "m2", position: 0, alt: {en: "New photo", id: "Foto nuevo"}}];
  const nextMetadata = {...metadata, coverMediaId: "m2"};
  const intermediate: AdminAlbum = {...album, coverMediaId: null, updatedAt: "v2", photos: [{position: 0, media: {...album.photos[0].media, id: "m2", publicId: "test/m2", secureUrl: "https://example.com/m2.jpg", alt: nextPhotos[0].alt}}]};
  const concurrent: AdminAlbum = {...intermediate, story: {en: "Concurrent story", id: "Cerita bersamaan"}};
  const calls: string[] = [];
  const headers: Array<HeadersInit | undefined> = [];
  const request = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    headers.push(init?.headers);
    if (calls.length === 1) return jsonResponse(intermediate);
    if (calls.length === 2) return jsonResponse({code: "PUBLISHED_ALBUM_INVALID"}, 409);
    if (calls.length === 3) return jsonResponse(intermediate);
    if (calls.length === 4) return jsonResponse({code: "ALBUM_VERSION_CONFLICT"}, 409);
    return jsonResponse({...concurrent, updatedAt: "v3"});
  };

  await expect(saveAlbum({albumId: album.id, metadata: nextMetadata, photos: nextPhotos, previousAlbum: album, request})).rejects.toMatchObject({code: "SAVE_COMPENSATION_FAILED"});
  expect(calls).toEqual([
    "PUT /api/admin/albums/a1/photos",
    "PATCH /api/admin/albums/a1",
    "GET /api/admin/albums/a1",
    "PUT /api/admin/albums/a1/photos",
    "GET /api/admin/albums/a1",
  ]);
  expect(new Headers(headers[3]).get("if-unmodified-since")).toBe("v2");
});

test("accepts an intended album after a lost metadata response", async () => {
  const nextPhotos: AlbumSavePhoto[] = [{mediaId: "m2", position: 0, alt: {en: "New photo", id: "Foto nuevo"}}];
  const nextMetadata = {...metadata, coverMediaId: "m2"};
  const intermediate: AdminAlbum = {...album, coverMediaId: null, updatedAt: "v2", photos: [{position: 0, media: {...album.photos[0].media, id: "m2", publicId: "test/m2", secureUrl: "https://example.com/m2.jpg", alt: nextPhotos[0].alt}}]};
  const intended: AdminAlbum = {...intermediate, ...nextMetadata, updatedAt: "v3"};
  const calls: string[] = [];
  const request = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (calls.length === 1) return jsonResponse(intermediate);
    if (calls.length === 2) throw new Error("response lost");
    return jsonResponse(intended);
  };

  await expect(saveAlbum({albumId: album.id, metadata: nextMetadata, photos: nextPhotos, previousAlbum: album, request})).resolves.toEqual(intended);
  expect(calls).toEqual([
    "PUT /api/admin/albums/a1/photos",
    "PATCH /api/admin/albums/a1",
    "GET /api/admin/albums/a1",
  ]);
});
