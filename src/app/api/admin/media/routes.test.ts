import {expect, mock, beforeEach, test} from "bun:test";

import {HttpError} from "@/lib/errors";

const actor = {userId: "admin-1", email: "admin@example.com", name: null};
let authFailure: unknown = null;
let originFailure: unknown = null;
let serviceFailure: unknown = null;
let originCalls = 0;
let serviceCalls = 0;

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

mock.module("@/server/admin-media", () => ({
  createUploadIntent: async () => {
    serviceCalls += 1;
    if (serviceFailure) throw serviceFailure;
    return {};
  },
  listAdminMedia: async () => [],
  commitUploadedMedia: async () => {
    serviceCalls += 1;
    if (serviceFailure) throw serviceFailure;
    return {status: "created", media: {}};
  },
  getAdminMedia: async () => null,
  deleteMediaIfUnreferenced: async () => {
    serviceCalls += 1;
    if (serviceFailure) throw serviceFailure;
    return {status: "deleted", cleanup: "complete"};
  },
  listCleanupJournals: async () => [],
  retryCleanup: async () => {
    serviceCalls += 1;
    if (serviceFailure) throw serviceFailure;
    return {status: "resolved"};
  },
}));

const [{POST: createIntentPost}, {POST: commitPost}, {DELETE: deleteMedia}, {POST: retryPost}] = await Promise.all([
  import("@/app/api/admin/media/route"),
  import("@/app/api/admin/media/commit/route"),
  import("@/app/api/admin/media/[id]/route"),
  import("@/app/api/admin/media/cleanup/[id]/retry/route"),
]);

function jsonRequest(body: string, origin = "http://localhost:3000"): Request {
  return new Request("http://localhost:3000/api/admin/media", {
    method: "POST",
    body,
    headers: {origin, "content-type": "application/json"},
  });
}

beforeEach(() => {
  authFailure = null;
  originFailure = null;
  serviceFailure = null;
  originCalls = 0;
  serviceCalls = 0;
});

test("admin media mutations authenticate before origin checks or body reads", async () => {
  authFailure = new HttpError(401, "UNAUTHENTICATED", "session required");
  const request = jsonRequest("not-json");

  const response = await createIntentPost(request);

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({code: "UNAUTHENTICATED"});
  expect(originCalls).toBe(0);
  expect(request.bodyUsed).toBe(false);
  expect(serviceCalls).toBe(0);
});

test("mutation routes check origin before reading a request body", async () => {
  originFailure = new HttpError(403, "ORIGIN_FORBIDDEN", "origin required");
  const request = jsonRequest("not-json");

  const response = await createIntentPost(request);

  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({code: "ORIGIN_FORBIDDEN"});
  expect(originCalls).toBe(1);
  expect(request.bodyUsed).toBe(false);
  expect(serviceCalls).toBe(0);
});

test("body validation happens only after auth and origin checks", async () => {
  const request = jsonRequest("not-json");

  const response = await createIntentPost(request);

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({code: "INVALID_JSON"});
  expect(originCalls).toBe(1);
  expect(request.bodyUsed).toBe(true);
  expect(serviceCalls).toBe(0);
});

test("internal media errors return a stable redacted response", async () => {
  serviceFailure = new Error("CLOUDINARY_API_SECRET=provider-secret");
  const request = jsonRequest(JSON.stringify({fileName: "portrait.jpg", mimeType: "image/jpeg", bytes: 100}));

  const response = await createIntentPost(request);
  const body = await response.json() as Record<string, unknown>;

  expect(response.status).toBe(500);
  expect(body).toEqual({code: "MEDIA_INTENT_FAILED"});
  expect(body).not.toHaveProperty("message");
  expect(JSON.stringify(body)).not.toContain("provider-secret");
});

test("commit route also redacts provider failures", async () => {
  serviceFailure = new Error("provider-secret");
  const request = jsonRequest(JSON.stringify({
    intentId: "00000000-0000-4000-8000-000000000001",
    publicId: "elhaq/uploads/00000000-0000-4000-8000-000000000001",
    version: 7,
    signature: "aabbcc",
  }));

  const response = await commitPost(request);

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({code: "MEDIA_COMMIT_FAILED"});
});

test("delete and retry routes perform origin checks after authentication", async () => {
  originFailure = new HttpError(403, "ORIGIN_FORBIDDEN", "origin required");

  const deleteResponse = await deleteMedia(new Request("http://localhost:3000/api/admin/media/one", {method: "DELETE"}), {
    params: Promise.resolve({id: "one"}),
  });
  const retryResponse = await retryPost(new Request("http://localhost:3000/api/admin/media/cleanup/one/retry", {method: "POST"}), {
    params: Promise.resolve({id: "one"}),
  });

  expect(deleteResponse.status).toBe(403);
  expect(retryResponse.status).toBe(403);
  expect(await deleteResponse.json()).toEqual({code: "ORIGIN_FORBIDDEN"});
  expect(await retryResponse.json()).toEqual({code: "ORIGIN_FORBIDDEN"});
  expect(serviceCalls).toBe(0);
});
