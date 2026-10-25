import {beforeEach, expect, mock, test} from "bun:test";

import {HttpError} from "@/lib/errors";

const actor = {userId: "admin-1", email: "admin@example.com", name: null};
let authFailure: unknown = null;
let originFailure: unknown = null;
let originCalls = 0;
const scopedCalls: Array<{scope: string; values: unknown}> = [];
let wholeDraftInput: unknown = null;

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

mock.module("@/server/admin-settings", () => ({
  parseSettingsScopeInput: (scope: string, values: unknown) => {
    if (scope !== "brand" && scope !== "home" && scope !== "about" && scope !== "services" && scope !== "contact" && scope !== "featured") {
      throw new HttpError(422, "UNKNOWN_SETTINGS_SCOPE", "Unknown settings scope");
    }
    return values;
  },
  parseSiteSettingsInput: (raw: unknown) => raw,
  saveSettingsScope: async (_actor: unknown, scope: string, values: unknown) => {
    scopedCalls.push({scope, values});
    return {brandName: "saved"};
  },
  saveSiteSettings: async (_actor: unknown, input: unknown) => {
    wholeDraftInput = input;
    return input;
  },
  getAdminSettings: async () => null,
}));

const {PATCH} = await import("@/app/api/admin/settings/route");

function request(body: string): Request {
  return new Request("http://localhost:3000/api/admin/settings", {
    method: "PATCH",
    body,
    headers: {origin: "http://localhost:3000", "content-type": "application/json"},
  });
}

beforeEach(() => {
  authFailure = null;
  originFailure = null;
  originCalls = 0;
  scopedCalls.length = 0;
  wholeDraftInput = null;
});

test("settings PATCH authenticates and checks origin before reading its body", async () => {
  authFailure = new HttpError(401, "UNAUTHENTICATED", "session required");
  const unauthenticated = request("not-json");
  const response = await PATCH(unauthenticated);

  expect(response.status).toBe(401);
  expect(unauthenticated.bodyUsed).toBe(false);
  expect(originCalls).toBe(0);

  authFailure = null;
  originFailure = new HttpError(403, "ORIGIN_FORBIDDEN", "origin required");
  const forbidden = request("not-json");
  const originResponse = await PATCH(forbidden);
  expect(originResponse.status).toBe(403);
  expect(forbidden.bodyUsed).toBe(false);
});

test("a scoped body saves only that scope", async () => {
  const values = {brandName: "Elhaq Photography", logoMediaId: null, logoAlt: {en: "", id: ""}};
  const response = await PATCH(request(JSON.stringify({scope: "brand", values})));

  expect(response.status).toBe(200);
  expect(originCalls).toBe(1);
  expect(scopedCalls).toEqual([{scope: "brand", values}]);
  expect(wholeDraftInput).toBeNull();
});

test("a body without a scope keeps the whole-draft save", async () => {
  const draft = {brandName: "Elhaq Photography"};
  const response = await PATCH(request(JSON.stringify(draft)));

  expect(response.status).toBe(200);
  expect(wholeDraftInput).toEqual(draft);
  expect(scopedCalls).toEqual([]);
});

test("an unknown scope is rejected without saving", async () => {
  const response = await PATCH(request(JSON.stringify({scope: "nope", values: {}})));

  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({code: "UNKNOWN_SETTINGS_SCOPE"});
  expect(scopedCalls).toEqual([]);
  expect(wholeDraftInput).toBeNull();
});
