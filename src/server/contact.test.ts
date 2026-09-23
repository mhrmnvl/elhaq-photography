import {afterEach, beforeEach, expect, test} from "bun:test";

import {POST} from "@/app/api/contact/route";
import type {QueryRow, SqlExecutor} from "@/lib/db";
import {getContactMailer} from "@/lib/resend";
import {submitContact, type ContactMailer, type ContactTransaction} from "@/server/contact";

const submissionKey = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-09-21T12:00:00.000Z");

function input(overrides: Record<string, unknown> = {}) {
  return {
    submissionKey,
    name: "Ari",
    email: "ari@example.com",
    whatsapp: null,
    eventType: "wedding",
    eventDate: "2028-02-29",
    eventLocation: "Bandung",
    message: "Please share availability.",
    ...overrides,
  };
}

type StoredMessage = {
  id: string;
  payload_digest: string;
  notification_status: "disabled" | "pending" | "sent" | "failed";
};

function fakeContactDependencies(options: {rateCount?: number; failStatusUpdate?: boolean} = {}) {
  const queries: {text: string; values: readonly unknown[]}[] = [];
  const state: {
    stored: StoredMessage | null;
    rateCount: number;
    failStatusUpdate: boolean;
  } = {
    stored: null,
    rateCount: options.rateCount ?? 0,
    failStatusUpdate: options.failStatusUpdate ?? false,
  };

  const executor: SqlExecutor = {
    async query<T extends QueryRow>(text: string, values: readonly unknown[] = []) {
      queries.push({text, values});
      if (text.includes("SELECT id, payload_digest, notification_status")) {
        return {rows: state.stored ? [state.stored as unknown as T] : []};
      }
      if (text.includes("INSERT INTO contact_rate_limits")) {
        state.rateCount += 1;
        return {rows: [{window_started_at: now, request_count: state.rateCount} as unknown as T]};
      }
      if (text.includes("INSERT INTO contact_messages")) {
        state.stored = {
          id: "message-1",
          payload_digest: String(values[1]),
          notification_status: values[10] === "pending" ? "pending" : "disabled",
        };
        return {rows: [{id: state.stored.id} as unknown as T]};
      }
      if (text.includes("UPDATE contact_messages SET notification_status")) {
        if (state.failStatusUpdate) throw new Error("STATUS_WRITE_FAILED");
        if (state.stored) state.stored.notification_status = String(values[0]) as StoredMessage["notification_status"];
        return {rows: [] as T[]};
      }
      return {rows: [] as T[]};
    },
  };
  const transaction: ContactTransaction = async (work) => work(executor);

  return {executor, transaction, queries, state};
}

function mailerThat(records: unknown[], failure?: Error): ContactMailer {
  return {
    async send(value) {
      records.push(value);
      if (failure) throw failure;
      return {providerId: "provider-1"};
    },
  };
}

const originalEnv = {
  APP_URL: process.env.APP_URL,
  RATE_LIMIT_SECRET: process.env.RATE_LIMIT_SECRET,
  RESEND_ENABLED: process.env.RESEND_ENABLED,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM: process.env.RESEND_FROM,
  OWNER_EMAIL: process.env.OWNER_EMAIL,
};

beforeEach(() => {
  process.env.APP_URL = "http://localhost:3000";
  process.env.RATE_LIMIT_SECRET = "test-rate-secret";
  process.env.RESEND_ENABLED = "false";
});

afterEach(() => {
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("saves before a notification failure and exposes only a saved result", async () => {
  const dependencies = fakeContactDependencies();
  const sent: unknown[] = [];
  const result = await submitContact(input(), {ip: "203.0.113.7"}, {
    ...dependencies,
    mailer: mailerThat(sent, new Error("provider rejected")),
    now: () => now,
  });

  expect(result).toEqual({ok: true, created: true, notificationStatus: "failed"});
  expect(dependencies.state.stored).toMatchObject({notification_status: "failed"});
  expect(sent).toHaveLength(1);
});

test("returns unknown when the saved notification status cannot be updated", async () => {
  const dependencies = fakeContactDependencies({failStatusUpdate: true});
  const result = await submitContact(input(), {ip: "203.0.113.7"}, {
    ...dependencies,
    mailer: mailerThat([]),
    now: () => now,
  });

  expect(result).toEqual({ok: true, created: true, notificationStatus: "unknown"});
  expect(dependencies.state.stored).toMatchObject({notification_status: "pending"});
});

test("disabled mail saves with a disabled notification status", async () => {
  const dependencies = fakeContactDependencies();
  const result = await submitContact(input(), {ip: "203.0.113.7"}, {
    ...dependencies,
    mailer: null,
    now: () => now,
  });

  expect(result).toEqual({ok: true, created: true, notificationStatus: "disabled"});
  expect(dependencies.state.stored).toMatchObject({notification_status: "disabled"});
});

test("same-key duplicate returns confirmation without quota or mail replay", async () => {
  const dependencies = fakeContactDependencies();
  const sent: unknown[] = [];
  const mailer = mailerThat(sent);
  const first = await submitContact(input(), {ip: "203.0.113.7"}, {...dependencies, mailer, now: () => now});
  const queryCountAfterFirst = dependencies.queries.length;
  const second = await submitContact(input(), {ip: "203.0.113.7"}, {...dependencies, mailer, now: () => now});

  expect(first).toEqual({ok: true, created: true, notificationStatus: "sent"});
  expect(second).toEqual({ok: true, created: false, notificationStatus: "sent"});
  expect(sent).toHaveLength(1);
  expect(dependencies.queries.slice(queryCountAfterFirst).some(({text}) => text.includes("contact_rate_limits"))).toBe(false);
});

test("same-key different payload returns an idempotency conflict", async () => {
  const dependencies = fakeContactDependencies();
  const sent: unknown[] = [];
  const mailer = mailerThat(sent);
  await submitContact(input(), {ip: "203.0.113.7"}, {...dependencies, mailer, now: () => now});

  const result = await submitContact(input({message: "A different request."}), {ip: "203.0.113.7"}, {
    ...dependencies,
    mailer,
    now: () => now,
  });

  expect(result).toEqual({ok: false, kind: "idempotency_conflict"});
  expect(sent).toHaveLength(1);
});

test("rejects a request after the fifth rate-limited submission", async () => {
  const dependencies = fakeContactDependencies({rateCount: 5});
  const sent: unknown[] = [];
  const result = await submitContact(input(), {ip: "203.0.113.7"}, {
    ...dependencies,
    mailer: mailerThat(sent),
    now: () => now,
  });

  expect(result).toMatchObject({ok: false, kind: "rate_limited"});
  if (result.ok || result.kind !== "rate_limited") throw new Error("expected rate limit result");
  expect(result.retryAfterSeconds).toBeGreaterThan(0);
  expect(sent).toHaveLength(0);
  expect(dependencies.state.stored).toBeNull();
});

test("missing enabled-mail configuration fails after the message is saved", async () => {
  process.env.RESEND_ENABLED = "true";
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
  delete process.env.OWNER_EMAIL;
  const mailer = getContactMailer();
  expect(mailer).not.toBeNull();

  const dependencies = fakeContactDependencies();
  const result = await submitContact(input(), {ip: "203.0.113.7"}, {
    ...dependencies,
    mailer,
    now: () => now,
  });

  expect(result).toEqual({ok: true, created: true, notificationStatus: "failed"});
  expect(dependencies.state.stored).toMatchObject({notification_status: "failed"});
});

test("canonical payload changes when a normalized field changes", async () => {
  const dependencies = fakeContactDependencies();
  const first = await submitContact(input({email: "ARI@example.com"}), {ip: "203.0.113.7"}, {
    ...dependencies,
    mailer: null,
    now: () => now,
  });
  const second = await submitContact(input({email: "other@example.com"}), {ip: "203.0.113.7"}, {
    ...dependencies,
    mailer: null,
    now: () => now,
  });

  expect(first).toEqual({ok: true, created: true, notificationStatus: "disabled"});
  expect(second).toEqual({ok: false, kind: "idempotency_conflict"});
});

test("route rejects a missing origin without exposing internals", async () => {
  const response = await POST(new Request("http://localhost:3000/api/contact", {
    method: "POST",
    body: JSON.stringify(input()),
    headers: {"content-type": "application/json"},
  }));

  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ok: false, code: "ORIGIN_FORBIDDEN"});
});

test("route maps validation to field errors only", async () => {
  const response = await POST(new Request("http://localhost:3000/api/contact", {
    method: "POST",
    body: JSON.stringify({submissionKey}),
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
  }));
  const body = await response.json() as Record<string, unknown>;

  expect(response.status).toBe(400);
  expect(body.ok).toBe(false);
  expect(body.code).toBe("VALIDATION_FAILED");
  expect(body).not.toHaveProperty("message");
  expect(body).not.toHaveProperty("id");
});
