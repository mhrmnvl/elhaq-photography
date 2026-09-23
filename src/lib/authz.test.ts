import {afterEach, beforeEach, describe, expect, test} from "bun:test";

import {assertSameOrigin, isAllowedAdminIdentity, requireAdmin, type Session, type SessionReader} from "@/lib/authz";

const mutableEnv = process.env as unknown as Record<string, string | undefined>;
const readerFor = (session: Session | null): SessionReader => ({
  api: {getSession: async () => session},
});

const originalAdminEmail = process.env.ADMIN_EMAIL;
const originalAppUrl = process.env.APP_URL;
const originalNodeEnv = mutableEnv.NODE_ENV;
const originalLocalAuthBypass = process.env.LOCAL_AUTH_BYPASS;

beforeEach(() => {
  process.env.ADMIN_EMAIL = "admin@example.com";
  process.env.APP_URL = "http://localhost:3000";
  mutableEnv.NODE_ENV = "test";
  delete process.env.LOCAL_AUTH_BYPASS;
});

afterEach(() => {
  if (originalAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
  else process.env.ADMIN_EMAIL = originalAdminEmail;

  if (originalAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = originalAppUrl;

  if (originalNodeEnv === undefined) delete mutableEnv.NODE_ENV;
  else mutableEnv.NODE_ENV = originalNodeEnv;

  if (originalLocalAuthBypass === undefined) delete process.env.LOCAL_AUTH_BYPASS;
  else process.env.LOCAL_AUTH_BYPASS = originalLocalAuthBypass;
});

describe("requireAdmin", () => {
  test("rejects a missing session", async () => {
    await expect(requireAdmin(new Headers(), readerFor(null))).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });

  test("allows the localhost development bypass without a session", async () => {
    mutableEnv.NODE_ENV = "development";
    process.env.LOCAL_AUTH_BYPASS = "true";

    await expect(requireAdmin(new Headers(), readerFor(null))).resolves.toEqual({
      userId: "local-development",
      email: "admin@example.com",
      name: "Local development",
    });
  });

  test("does not bypass authentication on a remote development URL", async () => {
    mutableEnv.NODE_ENV = "development";
    process.env.LOCAL_AUTH_BYPASS = "true";
    process.env.APP_URL = "https://preview.example.com";

    await expect(requireAdmin(new Headers(), readerFor(null))).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });

  test("does not bypass authentication in production", async () => {
    mutableEnv.NODE_ENV = "production";
    process.env.LOCAL_AUTH_BYPASS = "true";

    await expect(requireAdmin(new Headers(), readerFor(null))).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });

  test("rejects a verified session for another email", async () => {
    const session = {user: {id: "u1", email: "other@example.com", emailVerified: true, name: "Other"}};

    await expect(requireAdmin(new Headers(), readerFor(session))).rejects.toMatchObject({
      status: 403,
      code: "ADMIN_EMAIL_NOT_ALLOWED",
    });
  });

  test("rejects an unverified allowlisted email", async () => {
    const session = {user: {id: "u1", email: "admin@example.com", emailVerified: false, name: "Admin"}};

    await expect(requireAdmin(new Headers(), readerFor(session))).rejects.toMatchObject({
      status: 403,
      code: "EMAIL_NOT_VERIFIED",
    });
  });

  test("rejects a truthy nonboolean verification value", async () => {
    const session = {user: {id: "u1", email: "admin@example.com", emailVerified: "false", name: "Admin"}} as unknown as Session;

    await expect(requireAdmin(new Headers(), readerFor(session))).rejects.toMatchObject({
      status: 403,
      code: "EMAIL_NOT_VERIFIED",
    });
  });

  test("returns the normalized allowlisted admin session", async () => {
    const session = {user: {id: "u1", email: "Admin@Example.com", emailVerified: true, name: "Admin"}};

    await expect(requireAdmin(new Headers(), readerFor(session))).resolves.toEqual({
      userId: "u1",
      email: "admin@example.com",
      name: "Admin",
    });
  });
});

test("rejects truthy nonboolean verification values in the shared policy", () => {
  for (const emailVerified of ["false", 1]) {
    expect(isAllowedAdminIdentity({
      email: "admin@example.com",
      emailVerified: emailVerified as unknown as boolean,
    }, "admin@example.com")).toBe(false);
  }
});

test("accepts the configured origin", () => {
  assertSameOrigin(new Request("http://localhost:3000/api/contact", {
    headers: {origin: "http://localhost:3000"},
  }));
});

test("rejects a missing or different origin", () => {
  expect(() => assertSameOrigin(new Request("http://localhost:3000/api/contact"))).toThrow("ORIGIN_FORBIDDEN");
  expect(() => assertSameOrigin(new Request("http://localhost:3000/api/contact", {
    headers: {origin: "https://evil.example"},
  }))).toThrow("ORIGIN_FORBIDDEN");
});
