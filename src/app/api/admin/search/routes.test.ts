import {beforeEach, expect, mock, test} from "bun:test";

import {HttpError} from "@/lib/errors";

const actor = {userId: "admin-1", email: "admin@example.com", name: null};
const results = {albums: [{id: "album-1"}], messages: [{id: "message-1"}]};
let authFailure: unknown = null;
let searchCalls: string[] = [];

mock.module("@/lib/authz", () => ({
  requireAdmin: async () => {
    if (authFailure) throw authFailure;
    return actor;
  },
}));

mock.module("@/server/admin-search", () => ({
  searchAdminContent: async (_actor: unknown, query: string) => {
    searchCalls.push(query);
    return results;
  },
}));

const {GET} = await import("@/app/api/admin/search/route");

beforeEach(() => {
  authFailure = null;
  searchCalls = [];
});

test("authenticates before searching admin content", async () => {
  authFailure = new HttpError(401, "UNAUTHENTICATED", "session required");

  const response = await GET(new Request("http://localhost:3000/api/admin/search?q=private"));

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({code: "UNAUTHENTICATED"});
  expect(searchCalls).toEqual([]);
});

test("returns matches without browser caching", async () => {
  const response = await GET(new Request("http://localhost:3000/api/admin/search?q=bali"));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(results);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(searchCalls).toEqual(["bali"]);
});

test("rejects oversized queries without searching", async () => {
  const response = await GET(new Request(`http://localhost:3000/api/admin/search?q=${"a".repeat(101)}`));

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({code: "SEARCH_QUERY_TOO_LONG"});
  expect(searchCalls).toEqual([]);
});
