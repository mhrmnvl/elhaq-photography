import {beforeEach, expect, mock, test} from "bun:test";

import {HttpError} from "@/lib/errors";

const actor = {userId: "admin-1", email: "admin@example.com", name: null};
let authFailure: unknown = null;
let originFailure: unknown = null;
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

mock.module("@/server/admin-private-links", () => ({
  parsePrivateClientLinkInput: (raw: unknown) => raw,
  listPrivateClientLinks: async () => [],
  createPrivateClientLink: async () => {
    serviceCalls += 1;
    return {id: "00000000-0000-4000-8000-000000000010"};
  },
  getPrivateClientLink: async () => ({id: "00000000-0000-4000-8000-000000000010"}),
  updatePrivateClientLink: async () => {
    serviceCalls += 1;
    return {id: "00000000-0000-4000-8000-000000000010"};
  },
  deletePrivateClientLink: async () => {
    serviceCalls += 1;
  },
}));

const [{PATCH, DELETE}] = await Promise.all([
  import("@/app/api/admin/private-links/[id]/route"),
]);

function request(body: string, method: string): Request {
  return new Request("http://localhost:3000/api/admin/private-links/00000000-0000-4000-8000-000000000010", {
    method,
    body,
    headers: {origin: "http://localhost:3000", "content-type": "application/json"},
  });
}

beforeEach(() => {
  authFailure = null;
  originFailure = null;
  originCalls = 0;
  serviceCalls = 0;
});

test("private link PATCH authenticates and checks origin before reading its body", async () => {
  authFailure = new HttpError(401, "UNAUTHENTICATED", "session required");
  const unauthenticated = request("not-json", "PATCH");
  const response = await PATCH(unauthenticated, {params: Promise.resolve({id: "00000000-0000-4000-8000-000000000010"})});

  expect(response.status).toBe(401);
  expect(unauthenticated.bodyUsed).toBe(false);
  expect(originCalls).toBe(0);

  authFailure = null;
  originFailure = new HttpError(403, "ORIGIN_FORBIDDEN", "origin required");
  const forbidden = request("not-json", "PATCH");
  const originResponse = await PATCH(forbidden, {params: Promise.resolve({id: "00000000-0000-4000-8000-000000000010"})});
  expect(originResponse.status).toBe(403);
  expect(forbidden.bodyUsed).toBe(false);
  expect(serviceCalls).toBe(0);
});

test("private link PATCH forwards parsed input and DELETE returns the service result", async () => {
  const patchResponse = await PATCH(request(JSON.stringify({albumName: "Gallery", driveUrl: "https://drive.google.com/example"}), "PATCH"), {
    params: Promise.resolve({id: "00000000-0000-4000-8000-000000000010"}),
  });
  const deleteResponse = await DELETE(new Request("http://localhost:3000/api/admin/private-links/00000000-0000-4000-8000-000000000010", {
    method: "DELETE",
    headers: {origin: "http://localhost:3000"},
  }), {params: Promise.resolve({id: "00000000-0000-4000-8000-000000000010"})});

  expect(patchResponse.status).toBe(200);
  expect(deleteResponse.status).toBe(200);
  expect(originCalls).toBe(2);
  expect(serviceCalls).toBe(2);
});

test("private link mutations reject an invalid UUID before reading the body or calling the service", async () => {
  const patchRequest = request("not-json", "PATCH");
  const response = await PATCH(patchRequest, {params: Promise.resolve({id: "not-a-uuid"})});

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({code: "INVALID_ID"});
  expect(patchRequest.bodyUsed).toBe(false);
  expect(serviceCalls).toBe(0);
});
