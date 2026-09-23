import {expect, test} from "bun:test";
import type {PoolClient} from "pg";
import {v2 as cloudinary} from "cloudinary";

import {commitUploadedMedia, createUploadIntent, deleteMediaIfUnreferenced, getAdminMedia, listAdminMedia, lockMediaForAttach, retryCleanup} from "@/server/admin-media";

test("creates one signed upload intent per declared file", async () => {
  const intentId = "00000000-0000-4000-8000-000000000001";
  const now = new Date("2026-09-21T12:00:00.000Z");
  let signedParams: Record<string, unknown> | undefined;
  let queryText = "";
  let queryValues: readonly unknown[] | undefined;

  const result = await createUploadIntent({userId: "admin-1", email: "admin@example.com", name: null}, {
    fileName: "portrait.jpg",
    mimeType: "image/jpeg",
    bytes: 100,
  }, {
    now: () => now,
    createId: () => intentId,
    env: {
      CLOUDINARY_CLOUD_NAME: "demo",
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
    },
    cloudinary: {
      signRequest: (params) => {
        signedParams = params;
        return "signature";
      },
      resource: async () => ({}),
      destroy: async () => ({}),
    },
    db: {
      async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []): Promise<{rows: T[]}> {
        void values;
        queryText = text;
        queryValues = values;
        return {rows: [{id: intentId, expires_at: new Date("2026-09-21T12:10:00.000Z")} as unknown as T]};
      },
    },
  });

  expect(result).toEqual({
    intentId,
    cloudName: "demo",
    apiKey: "key",
    timestamp: 1789992000,
    signature: "signature",
    publicId: `elhaq/uploads/${intentId}`,
    uploadUrl: "https://api.cloudinary.com/v1_1/demo/image/upload",
    expiresAt: "2026-09-21T12:10:00.000Z",
  });
  expect(Object.keys(result).sort()).toEqual(["apiKey", "cloudName", "expiresAt", "intentId", "publicId", "signature", "timestamp", "uploadUrl"]);
  expect(signedParams).toEqual({
    timestamp: 1789992000,
    public_id: `elhaq/uploads/${intentId}`,
    overwrite: false,
    allowed_formats: "jpg,png,webp,avif",
  });
  expect(queryText).toContain("INSERT INTO upload_intents");
  expect(queryValues).toEqual([intentId, "admin-1", `elhaq/uploads/${intentId}`, new Date("2026-09-21T12:10:00.000Z")]);
});

test("returns consumed media on retry without contacting Cloudinary", async () => {
  const intentId = "00000000-0000-4000-8000-000000000001";
  const publicId = `elhaq/uploads/${intentId}`;
  const mediaId = "00000000-0000-4000-8000-000000000002";
  let resourceCalls = 0;
  let destroyCalls = 0;
  const mediaRow = {
    id: mediaId,
    cloud_name: "demo",
    public_id: publicId,
    secure_url: `https://res.cloudinary.com/demo/image/upload/${publicId}`,
    width: 1200,
    height: 800,
    format: "jpg",
    bytes: 100,
    reference_count: "0",
  };
  const tx = {
    async query<T extends Record<string, unknown>>(text: string) {
      if (text.includes("FROM upload_intents")) {
        return {rows: [{
          id: intentId,
          admin_user_id: "admin-1",
          expected_public_id: publicId,
          expires_at: new Date("2026-09-21T12:10:00.000Z"),
          state: "consumed",
          used_at: new Date("2026-09-21T12:01:00.000Z"),
          media_id: mediaId,
        } as unknown as T]};
      }
      return {rows: [mediaRow as unknown as T]};
    },
  } as unknown as PoolClient;

  const result = await commitUploadedMedia({userId: "admin-1", email: "admin@example.com", name: null}, {
    intentId,
    publicId,
    version: 7,
    signature: cloudinary.utils.api_sign_request({public_id: publicId, version: 7}, "secret"),
  }, {
    env: {
      CLOUDINARY_CLOUD_NAME: "demo",
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
    },
    cloudinary: {
      signRequest: () => "signature",
      resource: async () => {
        resourceCalls += 1;
        throw new Error("must not look up consumed retry");
      },
      destroy: async () => {
        destroyCalls += 1;
        throw new Error("must not destroy consumed retry");
      },
    },
    transaction: async (work) => work(tx),
  });

  expect(result).toEqual({status: "duplicate", media: {
    id: mediaId,
    cloudName: "demo",
    publicId,
    secureUrl: `https://res.cloudinary.com/demo/image/upload/${publicId}`,
    width: 1200,
    height: 800,
    format: "jpg",
    bytes: 100,
    referenceCount: 0,
  }});
  expect(resourceCalls).toBe(0);
  expect(destroyCalls).toBe(0);
});

test("returns gone for a consumed intent whose metadata was deleted", async () => {
  const intentId = "00000000-0000-4000-8000-000000000016";
  const publicId = `elhaq/uploads/${intentId}`;
  let providerCalls = 0;
  const tx = {
    async query<T extends Record<string, unknown>>(text: string) {
      if (text.includes("FROM upload_intents")) return {rows: [{
        id: intentId,
        admin_user_id: "admin-1",
        expected_public_id: publicId,
        expires_at: new Date("2026-09-21T12:10:00.000Z"),
        state: "consumed",
        used_at: new Date("2026-09-21T12:01:00.000Z"),
        media_id: "00000000-0000-4000-8000-000000000017",
      } as unknown as T]};
      return {rows: [] as unknown as T[]};
    },
  } as unknown as PoolClient;

  await expect(commitUploadedMedia({userId: "admin-1", email: "admin@example.com", name: null}, {
    intentId,
    publicId,
    version: 7,
    signature: cloudinary.utils.api_sign_request({public_id: publicId, version: 7}, "secret"),
  }, {
    env: {
      CLOUDINARY_CLOUD_NAME: "demo",
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
    },
    cloudinary: {
      signRequest: () => "signature",
      resource: async () => {
        providerCalls += 1;
        return {};
      },
      destroy: async () => {
        providerCalls += 1;
        return {};
      },
    },
    transaction: async (work) => work(tx),
  })).rejects.toThrow("MEDIA_COMMIT_GONE");

  expect(providerCalls).toBe(0);
});

test("compensates an oversized resource only after ownership is verified", async () => {
  const intentId = "00000000-0000-4000-8000-000000000018";
  const publicId = `elhaq/uploads/${intentId}`;
  const journalId = "00000000-0000-4000-8000-000000000019";
  let destroyCalls = 0;
  const queryTexts: string[] = [];
  const tx = {
    async query<T extends Record<string, unknown>>(text: string) {
      queryTexts.push(text);
      if (text.includes("FROM upload_intents")) return {rows: [{
        id: intentId,
        admin_user_id: "admin-1",
        expected_public_id: publicId,
        expires_at: new Date("2026-09-21T12:10:00.000Z"),
        state: "open",
        used_at: null,
        media_id: null,
      } as unknown as T]};
      if (text.includes("INSERT INTO media_cleanup_journal")) return {rows: [{id: journalId} as unknown as T]};
      if (text.includes("RETURNING id, operation, status, media_id, cloud_name")) return {rows: [{id: journalId, operation: "upload_compensation", status: "pending", media_id: null, cloud_name: "demo", public_id: publicId, reason: "authoritative_resource_rejected", attempts: 0, last_attempt_at: null, created_at: new Date("2026-09-21T12:00:00.000Z"), resolved_at: null, claim_token: "claim-1", claim_expires_at: new Date("2026-09-21T12:05:00.000Z")} as unknown as T]};
      return {rows: [] as unknown as T[]};
    },
  } as unknown as PoolClient;

  await expect(commitUploadedMedia({userId: "admin-1", email: "admin@example.com", name: null}, {
    intentId,
    publicId,
    version: 7,
    signature: cloudinary.utils.api_sign_request({public_id: publicId, version: 7}, "secret"),
  }, {
    now: () => new Date("2026-09-21T12:00:00.000Z"),
    env: {
      CLOUDINARY_CLOUD_NAME: "demo",
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
    },
    cloudinary: {
      signRequest: () => "signature",
      resource: async () => ({
        resource_type: "image",
        type: "upload",
        version: 7,
        bytes: 5_242_881,
        format: "jpg",
        width: 1600,
        height: 1000,
        public_id: publicId,
         secure_url: `https://res.cloudinary.com/demo/image/upload/v7/${publicId}.jpg`,
      }),
      destroy: async () => {
        destroyCalls += 1;
        return {result: "ok"};
      },
    },
    db: {
      async query() {
        return {rows: []};
      },
    },
    transaction: async (work) => work(tx),
  })).rejects.toThrow("UPLOAD_TOO_LARGE");

  expect(queryTexts.some((text) => text.includes("INSERT INTO media_cleanup_journal"))).toBe(true);
  expect(destroyCalls).toBe(1);
});

test("commits metadata from the authoritative Cloudinary resource", async () => {
  const intentId = "00000000-0000-4000-8000-000000000003";
  const publicId = `elhaq/uploads/${intentId}`;
  const mediaId = "00000000-0000-4000-8000-000000000004";
  let resourceArguments: {publicId: string; options: unknown} | undefined;
  const queryTexts: string[] = [];
  const mediaRow = {
    id: mediaId,
    cloud_name: "demo",
    public_id: publicId,
    secure_url: `https://res.cloudinary.com/demo/image/upload/v1/${publicId}.jpg`,
    width: 1600,
    height: 1000,
    format: "jpg",
    bytes: 222,
    reference_count: "0",
  };
  const tx = {
    async query<T extends Record<string, unknown>>(text: string) {
      queryTexts.push(text);
      if (text.includes("FROM upload_intents")) {
        return {rows: [{
          id: intentId,
          admin_user_id: "admin-1",
          expected_public_id: publicId,
          expires_at: new Date("2026-09-21T12:10:00.000Z"),
          state: "open",
          used_at: null,
          media_id: null,
        } as unknown as T]};
      }
      if (text.includes("INSERT INTO media_assets")) return {rows: [mediaRow as unknown as T]};
      return {rows: []};
    },
  } as unknown as PoolClient;

  const result = await commitUploadedMedia({userId: "admin-1", email: "admin@example.com", name: null}, {
    intentId,
    publicId,
    version: 7,
    signature: cloudinary.utils.api_sign_request({public_id: publicId, version: 7}, "secret"),
  }, {
    now: () => new Date("2026-09-21T12:00:00.000Z"),
    env: {
      CLOUDINARY_CLOUD_NAME: "demo",
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
    },
    cloudinary: {
      signRequest: () => "signature",
      resource: async (receivedPublicId, options) => {
        resourceArguments = {publicId: receivedPublicId, options};
        return {
          resource_type: "image",
          type: "upload",
          version: 7,
          bytes: 222,
          format: "jpg",
          width: 1600,
          height: 1000,
          public_id: publicId,
          secure_url: `https://res.cloudinary.com/demo/image/upload/v7/${publicId}.jpg`,
        };
      },
      destroy: async () => ({}),
    },
    transaction: async (work) => work(tx),
  });

  expect(result).toEqual({status: "created", media: {
    id: mediaId,
    cloudName: "demo",
    publicId,
    secureUrl: `https://res.cloudinary.com/demo/image/upload/v1/${publicId}.jpg`,
    width: 1600,
    height: 1000,
    format: "jpg",
    bytes: 222,
    referenceCount: 0,
  }});
  expect(resourceArguments).toEqual({publicId, options: {resource_type: "image", type: "upload"}});
  expect(queryTexts.some((text) => text.includes("UPDATE upload_intents"))).toBe(true);
});

test("rejects foreign, expired, and compensation-pending intents before provider cleanup", async () => {
  const actor = {userId: "admin-1", email: "admin@example.com", name: null};
  const env = {
    CLOUDINARY_CLOUD_NAME: "demo",
    CLOUDINARY_API_KEY: "key",
    CLOUDINARY_API_SECRET: "secret",
  };
  let resourceCalls = 0;
  const makeTransaction = (intent: Record<string, unknown>) => async <T>(work: (client: PoolClient) => Promise<T>) => work({
    async query<U extends Record<string, unknown>>(text: string) {
        if (text.includes("FROM upload_intents")) return {rows: [intent as unknown as U]};
      return {rows: [] as unknown as U[]};
    },
  } as unknown as PoolClient);
  const cloudinaryGateway = {
    signRequest: () => "signature",
    resource: async () => {
      resourceCalls += 1;
      return {};
    },
    destroy: async () => ({}),
  };

  const intentId = "00000000-0000-4000-8000-000000000005";
  const expectedPublicId = `elhaq/uploads/${intentId}`;
  const result = {
    intentId,
    publicId: expectedPublicId,
    version: 7,
    signature: cloudinary.utils.api_sign_request({public_id: expectedPublicId, version: 7}, "secret"),
  };

  await expect(commitUploadedMedia(actor, {...result, publicId: "elhaq/uploads/foreign"}, {
    env,
    cloudinary: cloudinaryGateway,
    transaction: makeTransaction({id: intentId, admin_user_id: actor.userId, expected_public_id: expectedPublicId, expires_at: new Date("2026-09-21T12:10:00.000Z"), state: "open", used_at: null, media_id: null}),
  })).rejects.toThrow("FOREIGN_PUBLIC_ID");
  await expect(commitUploadedMedia(actor, result, {
    env,
    cloudinary: cloudinaryGateway,
    now: () => new Date("2026-09-21T12:11:00.000Z"),
    transaction: makeTransaction({id: intentId, admin_user_id: actor.userId, expected_public_id: expectedPublicId, expires_at: new Date("2026-09-21T12:10:00.000Z"), state: "open", used_at: null, media_id: null}),
  })).rejects.toThrow("UPLOAD_INTENT_EXPIRED");
  await expect(commitUploadedMedia(actor, result, {
    env,
    cloudinary: cloudinaryGateway,
    transaction: makeTransaction({id: intentId, admin_user_id: actor.userId, expected_public_id: expectedPublicId, expires_at: new Date("2026-09-21T12:10:00.000Z"), state: "compensation_pending", used_at: null, media_id: null}),
  })).rejects.toThrow("UPLOAD_INTENT_COMPENSATION_PENDING");
  expect(resourceCalls).toBe(0);
});

test("journals metadata failure before destroying a verified upload", async () => {
  const intentId = "00000000-0000-4000-8000-000000000006";
  const publicId = `elhaq/uploads/${intentId}`;
  const journalId = "00000000-0000-4000-8000-000000000007";
  const queryTexts: string[] = [];
  let destroyCalls = 0;
  const tx = {
    async query<T extends Record<string, unknown>>(text: string) {
      queryTexts.push(text);
      if (text.includes("FROM upload_intents")) return {rows: [{
        id: intentId,
        admin_user_id: "admin-1",
        expected_public_id: publicId,
        expires_at: new Date("2026-09-21T12:10:00.000Z"),
        state: "open",
        used_at: null,
        media_id: null,
      } as unknown as T]};
      if (text.includes("INSERT INTO media_assets")) throw new Error("metadata insert failed");
      if (text.includes("INSERT INTO media_cleanup_journal")) return {rows: [{id: journalId} as unknown as T]};
      if (text.includes("RETURNING id, operation, status, media_id, cloud_name")) return {rows: [{id: journalId, operation: "upload_compensation", status: "pending", media_id: null, cloud_name: "demo", public_id: publicId, reason: "media_metadata_insert_failed", attempts: 0, last_attempt_at: null, created_at: new Date("2026-09-21T12:00:00.000Z"), resolved_at: null, claim_token: "claim-1", claim_expires_at: new Date("2026-09-21T12:05:00.000Z")} as unknown as T]};
      return {rows: [] as unknown as T[]};
    },
  } as unknown as PoolClient;
  const dbQueries: string[] = [];

  await expect(commitUploadedMedia({userId: "admin-1", email: "admin@example.com", name: null}, {
    intentId,
    publicId,
    version: 7,
    signature: cloudinary.utils.api_sign_request({public_id: publicId, version: 7}, "secret"),
  }, {
    now: () => new Date("2026-09-21T12:00:00.000Z"),
    env: {
      CLOUDINARY_CLOUD_NAME: "demo",
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
    },
    cloudinary: {
      signRequest: () => "signature",
      resource: async () => ({
        resource_type: "image",
        type: "upload",
        version: 7,
        bytes: 222,
        format: "jpg",
        width: 1600,
        height: 1000,
        public_id: publicId,
        secure_url: `https://res.cloudinary.com/demo/image/upload/v7/${publicId}.jpg`,
      }),
      destroy: async () => {
        destroyCalls += 1;
        return {result: "ok"};
      },
    },
    db: {
      async query(text) {
        dbQueries.push(text);
        return {rows: []};
      },
    },
    transaction: async (work) => work(tx),
  })).rejects.toThrow("MEDIA_METADATA_FAILED");

  expect(queryTexts).toEqual(expect.arrayContaining([
    "SAVEPOINT media_metadata",
    "ROLLBACK TO SAVEPOINT media_metadata",
  ]));
  expect(queryTexts.some((text) => text.includes("INSERT INTO media_cleanup_journal"))).toBe(true);
  expect(queryTexts.some((text) => text.includes("UPDATE upload_intents"))).toBe(true);
  expect(dbQueries.some((text) => text.includes("status = 'resolved'"))).toBe(true);
  expect(destroyCalls).toBe(1);
});

test("fails closed when the compensation journal is unavailable", async () => {
  const intentId = "00000000-0000-4000-8000-000000000008";
  const publicId = `elhaq/uploads/${intentId}`;
  let destroyCalls = 0;
  const tx = {
    async query<T extends Record<string, unknown>>(text: string) {
      if (text.includes("FROM upload_intents")) return {rows: [{
        id: intentId,
        admin_user_id: "admin-1",
        expected_public_id: publicId,
        expires_at: new Date("2026-09-21T12:10:00.000Z"),
        state: "open",
        used_at: null,
        media_id: null,
      } as unknown as T]};
      if (text.includes("INSERT INTO media_assets")) throw new Error("metadata insert failed");
      if (text.includes("INSERT INTO media_cleanup_journal")) throw new Error("database unavailable");
      return {rows: [] as unknown as T[]};
    },
  } as unknown as PoolClient;
  const logs: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => logs.push(message);

  try {
    await expect(commitUploadedMedia({userId: "admin-1", email: "admin@example.com", name: null}, {
      intentId,
      publicId,
      version: 7,
      signature: cloudinary.utils.api_sign_request({public_id: publicId, version: 7}, "secret"),
    }, {
      now: () => new Date("2026-09-21T12:00:00.000Z"),
      env: {
        CLOUDINARY_CLOUD_NAME: "demo",
        CLOUDINARY_API_KEY: "key",
        CLOUDINARY_API_SECRET: "secret",
      },
      cloudinary: {
        signRequest: () => "signature",
        resource: async () => ({
          resource_type: "image",
          type: "upload",
          version: 7,
          bytes: 222,
          format: "jpg",
          width: 1600,
          height: 1000,
          public_id: publicId,
          secure_url: `https://res.cloudinary.com/demo/image/upload/v7/${publicId}.jpg`,
        }),
        destroy: async () => {
          destroyCalls += 1;
          return {result: "ok"};
        },
      },
      transaction: async (work) => work(tx),
    })).rejects.toThrow("CLEANUP_JOURNAL_UNAVAILABLE");
  } finally {
    console.error = originalError;
  }

  expect(destroyCalls).toBe(0);
  expect(logs.some((message) => message.includes("CLEANUP_JOURNAL_UNAVAILABLE") && message.includes(publicId))).toBe(true);
});

test("locks unique media IDs in sorted order and rejects missing IDs", async () => {
  const first = "00000000-0000-4000-8000-000000000010";
  const second = "00000000-0000-4000-8000-000000000009";
  let receivedValues: readonly unknown[] | undefined;
  const tx = {
    async query<T extends Record<string, unknown>>(text: string, values?: readonly unknown[]) {
      receivedValues = values;
      expect(text).toContain("ORDER BY id FOR UPDATE");
      return {rows: [{id: second} as unknown as T, {id: first} as unknown as T]};
    },
  } as unknown as PoolClient;

  await lockMediaForAttach(tx, [first, second, first]);
  expect(receivedValues).toEqual([[second, first]]);

  const missingTx = {
    async query<T extends Record<string, unknown>>() {
      return {rows: [{id: first} as unknown as T]};
    },
  } as unknown as PoolClient;
  await expect(lockMediaForAttach(missingTx, [first, second])).rejects.toThrow("FOREIGN_MEDIA_ID");
});

test("lists media with explicit reference counts and fetches one item directly", async () => {
  const row = {
    id: "00000000-0000-4000-8000-000000000011",
    cloud_name: "demo",
    public_id: "elhaq/uploads/one",
    secure_url: "https://res.cloudinary.com/demo/image/upload/elhaq/uploads/one.jpg",
    width: 100,
    height: 80,
    format: "jpg",
    bytes: 123,
    reference_count: "2",
  };
  const queries: string[] = [];
  const db = {
    async query<T extends Record<string, unknown>>(text: string) {
      queries.push(text);
      return {rows: [row as unknown as T]};
    },
  };
  const actor = {userId: "admin-1", email: "admin@example.com", name: null};

  await expect(listAdminMedia(actor, {db})).resolves.toEqual([{
    id: row.id,
    cloudName: "demo",
    publicId: row.public_id,
    secureUrl: row.secure_url,
    width: 100,
    height: 80,
    format: "jpg",
    bytes: 123,
    referenceCount: 2,
  }]);
  await expect(getAdminMedia(actor, row.id, {db})).resolves.toEqual({
    id: row.id,
    cloudName: "demo",
    publicId: row.public_id,
    secureUrl: row.secure_url,
    width: 100,
    height: 80,
    format: "jpg",
    bytes: 123,
    referenceCount: 2,
  });
  expect(queries.some((text) => text.includes("ORDER BY m.created_at DESC, m.id"))).toBe(true);
});

test("blocks deletion while any album or settings reference remains", async () => {
  let destroyCalls = 0;
  let deleteCalls = 0;
  const tx = {
    async query<T extends Record<string, unknown>>(text: string) {
      if (text.includes("FROM media_assets") && text.includes("FOR UPDATE")) {
        return {rows: [{id: "00000000-0000-4000-8000-000000000012", public_id: "elhaq/uploads/shared"} as unknown as T]};
      }
      if (text.includes("reference_count")) return {rows: [{reference_count: "1"} as unknown as T]};
      if (text.includes("DELETE FROM media_assets")) deleteCalls += 1;
      return {rows: [] as unknown as T[]};
    },
  } as unknown as PoolClient;

  await expect(deleteMediaIfUnreferenced({userId: "admin-1", email: "admin@example.com", name: null}, "00000000-0000-4000-8000-000000000012", {
    cloudinary: {
      signRequest: () => "signature",
      resource: async () => ({}),
      destroy: async () => {
        destroyCalls += 1;
        return {};
      },
    },
    transaction: async (work) => work(tx),
  })).resolves.toEqual({status: "in_use"});

  expect(deleteCalls).toBe(0);
  expect(destroyCalls).toBe(0);
});

test("reports pending cleanup when committed deletion cannot reach Cloudinary", async () => {
  const mediaId = "00000000-0000-4000-8000-000000000013";
  const journalId = "00000000-0000-4000-8000-000000000014";
  const tx = {
    async query<T extends Record<string, unknown>>(text: string) {
      if (text.includes("FROM media_assets") && text.includes("FOR UPDATE")) return {rows: [{id: mediaId, cloud_name: "demo", public_id: "elhaq/uploads/deleted"} as unknown as T]};
      if (text.includes("reference_count")) return {rows: [{reference_count: "0"} as unknown as T]};
      if (text.includes("INSERT INTO media_cleanup_journal")) return {rows: [{id: journalId} as unknown as T]};
      if (text.includes("RETURNING id, operation, status, media_id, cloud_name")) return {rows: [{id: journalId, operation: "remote_delete", status: "pending", media_id: mediaId, cloud_name: "demo", public_id: "elhaq/uploads/deleted", reason: "admin_media_delete", attempts: 0, last_attempt_at: null, created_at: new Date("2026-09-21T12:00:00.000Z"), resolved_at: null, claim_token: "claim-1", claim_expires_at: new Date("2026-09-21T12:05:00.000Z")} as unknown as T]};
      return {rows: [] as unknown as T[]};
    },
  } as unknown as PoolClient;
  const dbQueries: string[] = [];
  const logs: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => logs.push(message);

  try {
    await expect(deleteMediaIfUnreferenced({userId: "admin-1", email: "admin@example.com", name: null}, mediaId, {
      cloudinary: {
        signRequest: () => "signature",
        resource: async () => ({}),
        destroy: async () => {
          throw new Error("Cloudinary unavailable");
        },
      },
      db: {
        async query(text) {
          dbQueries.push(text);
          return {rows: []};
        },
      },
      transaction: async (work) => work(tx),
    })).resolves.toEqual({status: "deleted", cleanup: "pending"});
  } finally {
    console.error = originalError;
  }

  expect(dbQueries.some((text) => text.includes("attempts = attempts + 1"))).toBe(true);
  expect(logs.some((message) => message.includes("CLOUDINARY_CLEANUP_FAILED"))).toBe(true);
});

test("leaves cleanup pending when Cloudinary returns an ambiguous result", async () => {
  const mediaId = "00000000-0000-4000-8000-000000000020";
  const journalId = "00000000-0000-4000-8000-000000000021";
  const publicId = "elhaq/uploads/ambiguous";
  let destroyCalls = 0;
  const tx = {
    async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      if (text.includes("FROM media_assets") && text.includes("FOR UPDATE")) {
        return {rows: [{id: mediaId, cloud_name: "demo", public_id: publicId} as unknown as T]};
      }
      if (text.includes("reference_count")) return {rows: [{reference_count: "0"} as unknown as T]};
      if (text.includes("INSERT INTO media_cleanup_journal")) return {rows: [{id: journalId} as unknown as T]};
      if (text.includes("RETURNING id, operation, status, media_id, cloud_name")) return {rows: [{
        id: journalId,
        operation: "remote_delete",
        status: "pending",
        media_id: mediaId,
        cloud_name: "demo",
        public_id: publicId,
        reason: "admin_media_delete",
        attempts: 0,
        last_attempt_at: null,
        created_at: new Date("2026-09-21T12:00:00.000Z"),
        resolved_at: null,
        claim_token: String(values[1]),
        claim_expires_at: new Date("2026-09-21T12:05:00.000Z"),
      } as unknown as T]};
      if (text.includes("FROM media_cleanup_journal")) {
        return {rows: [{
          id: journalId,
          operation: "remote_delete",
          status: "pending",
          media_id: mediaId,
          cloud_name: "demo",
          public_id: publicId,
          reason: "admin_media_delete",
          attempts: 0,
          last_attempt_at: null,
          created_at: new Date("2026-09-21T12:00:00.000Z"),
          resolved_at: null,
          claim_token: null,
          claim_expires_at: null,
        } as unknown as T]};
      }
      return {rows: [] as T[]};
    },
  } as unknown as PoolClient;
  const logs: string[] = [];
  const originalError = console.error;
  console.error = (message: string) => logs.push(message);

  try {
    await expect(deleteMediaIfUnreferenced({userId: "admin-1", email: "admin@example.com", name: null}, mediaId, {
      env: {
        CLOUDINARY_CLOUD_NAME: "demo",
        CLOUDINARY_API_KEY: "key",
        CLOUDINARY_API_SECRET: "secret",
      },
      cloudinary: {
        signRequest: () => "signature",
        resource: async () => ({}),
        destroy: async () => {
          destroyCalls += 1;
          return {};
        },
      },
      db: {
        async query<T extends Record<string, unknown>>() {
          return {rows: [{id: journalId} as unknown as T]};
        },
      },
      transaction: async (work) => work(tx),
    })).resolves.toEqual({status: "deleted", cleanup: "pending"});
  } finally {
    console.error = originalError;
  }

  expect(destroyCalls).toBe(1);
  expect(logs.some((message) => message.includes("CLOUDINARY_CLEANUP_UNCONFIRMED"))).toBe(true);
});

test("refuses cleanup when the journal belongs to another Cloudinary cloud", async () => {
  const journalId = "00000000-0000-4000-8000-000000000022";
  let destroyCalls = 0;
  const tx = {
    async query<T extends Record<string, unknown>>() {
      return {rows: [{
        id: journalId,
        operation: "remote_delete",
        status: "pending",
        media_id: null,
        cloud_name: "previous-cloud",
        public_id: "elhaq/uploads/rotated",
        reason: "admin_media_delete",
        attempts: 1,
        last_attempt_at: null,
        created_at: new Date("2026-09-21T12:00:00.000Z"),
        resolved_at: null,
        claim_token: null,
        claim_expires_at: null,
      } as unknown as T]};
    },
  } as unknown as PoolClient;

  await expect(retryCleanup({userId: "admin-1", email: "admin@example.com", name: null}, journalId, {
    env: {
      CLOUDINARY_CLOUD_NAME: "current-cloud",
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
    },
    cloudinary: {
      signRequest: () => "signature",
      resource: async () => ({}),
      destroy: async () => {
        destroyCalls += 1;
        return {result: "ok"};
      },
    },
    transaction: async (work) => work(tx),
  })).resolves.toEqual({status: "pending"});

  expect(destroyCalls).toBe(0);
});

test("rejects a Cloudinary resource whose authoritative version differs from the signed upload", async () => {
  const intentId = "00000000-0000-4000-8000-000000000023";
  const publicId = `elhaq/uploads/${intentId}`;
  let destroyCalls = 0;
  const tx = {
    async query<T extends Record<string, unknown>>(text: string) {
      if (text.includes("FROM upload_intents")) return {rows: [{
        id: intentId,
        admin_user_id: "admin-1",
        expected_public_id: publicId,
        expires_at: new Date("2026-09-21T12:10:00.000Z"),
        state: "open",
        used_at: null,
        media_id: null,
      } as unknown as T]};
      if (text.includes("INSERT INTO media_cleanup_journal")) return {rows: [{id: "00000000-0000-4000-8000-000000000024"} as unknown as T]};
      return {rows: [] as T[]};
    },
  } as unknown as PoolClient;

  await expect(commitUploadedMedia({userId: "admin-1", email: "admin@example.com", name: null}, {
    intentId,
    publicId,
    version: 7,
    signature: cloudinary.utils.api_sign_request({public_id: publicId, version: 7}, "secret"),
  }, {
    now: () => new Date("2026-09-21T12:00:00.000Z"),
    env: {
      CLOUDINARY_CLOUD_NAME: "demo",
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
    },
    cloudinary: {
      signRequest: () => "signature",
      resource: async () => ({
        resource_type: "image",
        type: "upload",
        version: 8,
        bytes: 222,
        format: "jpg",
        width: 1600,
        height: 1000,
        public_id: publicId,
        secure_url: `https://res.cloudinary.com/demo/image/upload/v8/${publicId}.jpg`,
      }),
      destroy: async () => {
        destroyCalls += 1;
        return {result: "ok"};
      },
    },
    transaction: async (work) => work(tx),
  })).rejects.toThrow("CLOUDINARY_VERSION_MISMATCH");

  expect(destroyCalls).toBe(0);
});

test("retries a pending cleanup and resolves its journal", async () => {
  const journalId = "00000000-0000-4000-8000-000000000015";
  const publicId = "elhaq/uploads/retry";
  let destroyCalls = 0;
  const tx = {
    async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      if (!text.includes("RETURNING id, operation, status, media_id, cloud_name")) return {rows: [] as T[]};
      return {rows: [{
        id: journalId,
        operation: "remote_delete",
        status: "pending",
        media_id: null,
        cloud_name: "demo",
        public_id: publicId,
        reason: "admin_media_delete",
        attempts: 1,
        last_attempt_at: null,
        created_at: new Date("2026-09-21T12:00:00.000Z"),
        resolved_at: null,
        claim_token: String(values[1]),
        claim_expires_at: new Date("2026-09-21T12:05:00.000Z"),
      } as unknown as T]};
    },
  } as unknown as PoolClient;
  const dbQueries: string[] = [];

  await expect(retryCleanup({userId: "admin-1", email: "admin@example.com", name: null}, journalId, {
    env: {
      CLOUDINARY_CLOUD_NAME: "demo",
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
    },
    cloudinary: {
      signRequest: () => "signature",
      resource: async () => ({}),
      destroy: async () => {
        destroyCalls += 1;
        return {result: "ok"};
      },
    },
    db: {
      async query(text) {
        dbQueries.push(text);
        return {rows: []};
      },
    },
    transaction: async (work) => work(tx),
  })).resolves.toEqual({status: "resolved"});

  expect(destroyCalls).toBe(1);
  expect(dbQueries.some((text) => text.includes("status = 'resolved'"))).toBe(true);
});

test("does not run a concurrent cleanup retry while another retry holds its lease", async () => {
  const journalId = "00000000-0000-4000-8000-000000000025";
  const row = {
    id: journalId,
    operation: "remote_delete" as const,
    status: "pending" as const,
    media_id: null,
    cloud_name: "demo",
    public_id: "elhaq/uploads/concurrent",
    reason: "admin_media_delete",
    attempts: 1,
    last_attempt_at: null,
    created_at: new Date("2026-09-21T12:00:00.000Z"),
    resolved_at: null,
    claim_token: null as string | null,
    claim_expires_at: null as Date | null,
  };
  let tokenNumber = 0;
  let destroyCalls = 0;
  let resolveStarted: (() => void) | undefined;
  let resolveDestroy: ((value: {result: "ok"}) => void) | undefined;
  const destroyStarted = new Promise<void>((resolve) => {
    resolveStarted = resolve;
  });
  const destroyResult = new Promise<{result: "ok"}>((resolve) => {
    resolveDestroy = resolve;
  });
  const tx = {
    async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      if (text.includes("SET claim_token")) {
        const expiresAt = values[3] instanceof Date ? values[3] : new Date("2026-09-21T12:01:00.000Z");
        if (row.claim_token && row.claim_expires_at && row.claim_expires_at > expiresAt) return {rows: [] as T[]};
        row.claim_token = String(values[1]);
        row.claim_expires_at = new Date("2026-09-21T12:05:00.000Z");
        return {rows: [{...row} as unknown as T]};
      }
      if (text.includes("SELECT status FROM media_cleanup_journal")) return {rows: [{status: row.status} as unknown as T]};
      return {rows: [] as T[]};
    },
  } as unknown as PoolClient;

  const dependencies = {
    env: {
      CLOUDINARY_CLOUD_NAME: "demo",
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
    },
    createId: () => `claim-${++tokenNumber}`,
    now: () => new Date("2026-09-21T12:01:00.000Z"),
    cloudinary: {
      signRequest: () => "signature",
      resource: async () => ({}),
      destroy: async () => {
        destroyCalls += 1;
        resolveStarted?.();
        return destroyResult;
      },
    },
    db: {
      async query<T extends Record<string, unknown>>() {
        return {rows: [{id: journalId} as unknown as T]};
      },
    },
    transaction: async <T>(work: (client: PoolClient) => Promise<T>) => work(tx),
  };

  const actor = {userId: "admin-1", email: "admin@example.com", name: null};
  const first = retryCleanup(actor, journalId, dependencies);
  await destroyStarted;
  await expect(retryCleanup(actor, journalId, dependencies)).resolves.toEqual({status: "pending"});
  expect(destroyCalls).toBe(1);

  resolveDestroy?.({result: "ok"});
  await expect(first).resolves.toEqual({status: "resolved"});
});
