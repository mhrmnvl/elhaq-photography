import {beforeEach, expect, mock, test} from "bun:test";

import {HttpError} from "@/lib/errors";

const actor = {userId: "admin-1", email: "admin@example.com", name: null};
let authFailure: unknown = null;
let originFailure: unknown = null;
let serviceFailure: unknown = null;
let originCalls = 0;
let serviceCalls = 0;
let parsedPhotos: unknown;
let mutationVersion: string | undefined;
let idempotencyKey: string | undefined;

mock.module("@/lib/authz", () => ({
  requireAdmin: async () => {
    if (authFailure) throw authFailure;
    return actor;
  },
  assertSameOrigin: () => {
    originCalls += 1;
    if (originFailure) throw originFailure;
  },
}));

mock.module("@/server/admin-albums", () => ({
  createAlbum: async (_actor: unknown, _input: unknown, overrides?: {idempotencyKey?: string}) => {
    serviceCalls += 1;
    idempotencyKey = overrides?.idempotencyKey;
    if (serviceFailure) throw serviceFailure;
    return {id: "album-1"};
  },
  listAdminAlbums: async () => [],
  getAdminAlbum: async () => null,
  updateAlbum: async (_actor: unknown, _id: string, _input: unknown, overrides?: {expectedUpdatedAt?: string}) => {
    mutationVersion = overrides?.expectedUpdatedAt;
    return {id: "album-1"};
  },
  deleteAlbum: async () => {
    serviceCalls += 1;
    if (serviceFailure) throw serviceFailure;
  },
  parseAlbumInput: (raw: unknown) => raw,
  parseAlbumPhotosInput: (raw: unknown) => {
    parsedPhotos = raw;
    return raw;
  },
  parsePublishInput: (raw: unknown) => raw,
  setAlbumPhotos: async (_actor: unknown, _id: string, photos: unknown, overrides?: {expectedUpdatedAt?: string}) => {
    serviceCalls += 1;
    parsedPhotos = photos;
    mutationVersion = overrides?.expectedUpdatedAt;
    if (serviceFailure) throw serviceFailure;
    return {id: "album-1"};
  },
  publishAlbum: async () => ({id: "album-1"}),
  unpublishAlbum: async () => ({id: "album-1"}),
}));

const [{POST: createPost}, {PATCH: albumPatch}, {PUT: photosPut}] = await Promise.all([
  import("@/app/api/admin/albums/route"),
  import("@/app/api/admin/albums/[id]/route"),
  import("@/app/api/admin/albums/[id]/photos/route"),
]);

function jsonRequest(body: string, origin = "http://localhost:3000", extraHeaders: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/admin/albums", {
    method: "POST",
    body,
    headers: {origin, "content-type": "application/json", ...extraHeaders},
  });
}

beforeEach(() => {
  authFailure = null;
  originFailure = null;
  serviceFailure = null;
  originCalls = 0;
  serviceCalls = 0;
  parsedPhotos = undefined;
  mutationVersion = undefined;
  idempotencyKey = undefined;
});

test("album mutations authenticate before origin checks or body reads", async () => {
  authFailure = new HttpError(401, "UNAUTHENTICATED", "session required");
  const request = jsonRequest("not-json");

  const response = await createPost(request);

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({code: "UNAUTHENTICATED"});
  expect(originCalls).toBe(0);
  expect(request.bodyUsed).toBe(false);
  expect(serviceCalls).toBe(0);
});

test("album mutations check origin before reading a request body", async () => {
  originFailure = new HttpError(403, "ORIGIN_FORBIDDEN", "origin required");
  const request = jsonRequest("not-json");

  const response = await createPost(request);

  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({code: "ORIGIN_FORBIDDEN"});
  expect(originCalls).toBe(1);
  expect(request.bodyUsed).toBe(false);
  expect(serviceCalls).toBe(0);
});

test("create route passes its idempotency key to the service", async () => {
  const response = await createPost(jsonRequest("{}", "http://localhost:3000", {"idempotency-key": "album:story"}));

  expect(response.status).toBe(201);
  expect(idempotencyKey).toBe("album:story");
});

test("create route requires an idempotency key before reading the body", async () => {
  const request = jsonRequest("not-json");
  const response = await createPost(request);

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({code: "IDEMPOTENCY_KEY_REQUIRED"});
  expect(request.bodyUsed).toBe(false);
  expect(serviceCalls).toBe(0);
});

test("create route rejects malformed idempotency keys", async () => {
  const response = await createPost(jsonRequest("{}", "http://localhost:3000", {"idempotency-key": "not a key"}));

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({code: "INVALID_IDEMPOTENCY_KEY"});
  expect(serviceCalls).toBe(0);
});

test("photos route passes its array body to the photo parser and service", async () => {
  const body = [{mediaId: "m1", position: 0, alt: {en: "Photo", id: "Foto"}}];
  const response = await photosPut(jsonRequest(JSON.stringify(body), "http://localhost:3000", {"if-unmodified-since": "v1"}), {params: Promise.resolve({id: "album-1"})});

  expect(response.status).toBe(200);
  expect(parsedPhotos).toEqual(body);
  expect(serviceCalls).toBe(1);
  expect(mutationVersion).toBe("v1");
});

test("metadata route passes the album version to its service", async () => {
  const response = await albumPatch(jsonRequest(JSON.stringify({}), "http://localhost:3000", {"if-unmodified-since": "v2"}), {params: Promise.resolve({id: "album-1"})});

  expect(response.status).toBe(200);
  expect(mutationVersion).toBe("v2");
});

test("typed album conflicts are returned without being hidden", async () => {
  serviceFailure = new HttpError(409, "PUBLISHED_ALBUM_INVALID", "invalid published album");
  const response = await createPost(jsonRequest(JSON.stringify({}), "http://localhost:3000", {"idempotency-key": "00000000-0000-4000-8000-000000000001"}));

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({code: "PUBLISHED_ALBUM_INVALID"});
});
