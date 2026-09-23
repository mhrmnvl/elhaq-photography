import type {PoolClient} from "pg";

import {
  getCloudinaryGateway,
  isValidUploadSignature,
  isVerifiedCloudinaryResource,
  parseAuthoritativeResource,
  validateAuthoritativeResource,
  type CloudinaryEnv,
  type CloudinaryGateway,
  type ClientUploadResult,
  type UploadDeclaration,
  type UploadIntent,
} from "@/lib/cloudinary";
import {getDb, withTransaction, type SqlExecutor} from "@/lib/db";
import type {AdminSession} from "@/lib/authz";
import type {AdminMediaAsset, CleanupJournalEntry} from "@/lib/domain";
import {DomainError, HttpError} from "@/lib/errors";
import {getServerEnv} from "@/lib/env";

export type AdminMediaDependencies = {
  db?: SqlExecutor;
  cloudinary?: CloudinaryGateway;
  env?: CloudinaryEnv;
  now?: () => Date;
  createId?: () => string;
  transaction?: <T>(work: (client: PoolClient) => Promise<T>) => Promise<T>;
};

function dependencies(overrides: AdminMediaDependencies): Required<Pick<AdminMediaDependencies, "db" | "now" | "createId" | "transaction">> & AdminMediaDependencies {
  return {
    ...overrides,
    db: overrides.db ?? getDb(),
    now: overrides.now ?? (() => new Date()),
    createId: overrides.createId ?? (() => crypto.randomUUID()),
    transaction: overrides.transaction ?? ((work) => withTransaction(work)),
  };
}

function gateway(deps: AdminMediaDependencies): CloudinaryGateway {
  return deps.cloudinary ?? getCloudinaryGateway(deps.env);
}

type UploadIntentRow = {
  id: string;
  admin_user_id: string;
  expected_public_id: string;
  expires_at: Date | string;
  state: "open" | "consumed" | "compensation_pending";
  used_at: Date | string | null;
  media_id: string | null;
};

type MediaRow = {
  id: string;
  cloud_name: string;
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  reference_count: number | string;
};

type CleanupRow = {
  id: string;
  operation: "upload_compensation" | "remote_delete";
  status: "pending" | "resolved";
  media_id: string | null;
  cloud_name: string;
  public_id: string;
  reason: string;
  attempts: number;
  last_attempt_at: Date | string | null;
  created_at: Date | string;
  resolved_at: Date | string | null;
  claim_token: string | null;
  claim_expires_at: Date | string | null;
};

function envFor(deps: AdminMediaDependencies): CloudinaryEnv {
  if (deps.env) return deps.env;
  const env = getServerEnv();
  return {
    CLOUDINARY_CLOUD_NAME: env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: env.CLOUDINARY_API_SECRET,
  };
}

function mapMedia(row: MediaRow): AdminMediaAsset {
  return {
    id: row.id,
    cloudName: row.cloud_name,
    publicId: row.public_id,
    secureUrl: row.secure_url,
    width: row.width,
    height: row.height,
    format: row.format,
    bytes: row.bytes,
    referenceCount: Number(row.reference_count),
  };
}

function iso(value: Date | string | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

function mapCleanup(row: CleanupRow): CleanupJournalEntry {
  return {
    id: row.id,
    operation: row.operation,
    status: row.status,
    mediaId: row.media_id,
    cloudName: row.cloud_name,
    publicId: row.public_id,
    reason: row.reason,
    attempts: row.attempts,
    lastAttemptAt: iso(row.last_attempt_at),
    createdAt: new Date(row.created_at).toISOString(),
    resolvedAt: iso(row.resolved_at),
  };
}

class CleanupJournalUnavailable extends Error {
  constructor(readonly publicId: string, readonly cause: unknown) {
    super("Cleanup journal could not be persisted");
    this.name = "CleanupJournalUnavailable";
  }
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function recordUploadCompensation(tx: PoolClient, intentId: string, cloudName: string, publicId: string, reason: string): Promise<string> {
  try {
    const journal = await tx.query<{id: string}>(
      `INSERT INTO media_cleanup_journal (operation, status, cloud_name, public_id, reason)
       VALUES ('upload_compensation', 'pending', $1, $2, $3)
       RETURNING id`,
      [cloudName, publicId, reason],
    );
    const journalId = journal.rows[0]?.id;
    if (!journalId) throw new Error("CLEANUP_JOURNAL_INSERT_EMPTY");
    await tx.query("UPDATE upload_intents SET state = 'compensation_pending' WHERE id = $1", [intentId]);
    await tx.query("RELEASE SAVEPOINT media_metadata");
    return journalId;
  } catch (error) {
    throw new CleanupJournalUnavailable(publicId, error);
  }
}

type CleanupClaim =
  | {status: "claimed"; row: CleanupRow; token: string}
  | {status: "resolved"}
  | {status: "busy"};

async function claimCleanup(deps: AdminMediaDependencies, journalId: string): Promise<CleanupClaim> {
  const configured = dependencies(deps);
  const now = configured.now();
  const token = configured.createId();
  return configured.transaction(async (tx) => {
    const claimed = await tx.query<CleanupRow>(
      `UPDATE media_cleanup_journal
          SET claim_token = $2, claim_expires_at = $3
        WHERE id = $1
          AND status = 'pending'
          AND (claim_token IS NULL OR claim_expires_at <= $4)
      RETURNING id, operation, status, media_id, cloud_name, public_id, reason, attempts, last_attempt_at, created_at, resolved_at, claim_token, claim_expires_at`,
      [journalId, token, new Date(now.getTime() + 5 * 60_000), now],
    );
    if (claimed.rows[0]) return {status: "claimed", row: claimed.rows[0], token};

    const current = await tx.query<{status: "pending" | "resolved"}>(
      "SELECT status FROM media_cleanup_journal WHERE id = $1",
      [journalId],
    );
    if (!current.rows[0]) throw new HttpError(404, "CLEANUP_NOT_FOUND", "Cleanup journal entry was not found");
    return current.rows[0].status === "resolved" ? {status: "resolved"} : {status: "busy"};
  });
}

function isDestroySuccess(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const status = (result as {result?: unknown}).result;
  return status === "ok" || status === "not found";
}

async function settleCleanup(deps: AdminMediaDependencies, journalId: string): Promise<"complete" | "pending"> {
  const claim = await claimCleanup(deps, journalId);
  if (claim.status === "resolved") return "complete";
  if (claim.status === "busy") return "pending";

  const configured = dependencies(deps);
  const {row, token} = claim;
  const updatePending = async (): Promise<void> => {
    try {
      await configured.db.query(
        `UPDATE media_cleanup_journal
            SET attempts = attempts + 1, last_attempt_at = now(), claim_token = NULL, claim_expires_at = NULL
          WHERE id = $1 AND claim_token = $2`,
        [journalId, token],
      );
    } catch (error) {
      console.error(JSON.stringify({code: "CLEANUP_JOURNAL_UPDATE_FAILED", publicId: row.public_id, error: safeError(error)}));
    }
  };

  let remoteResult: unknown;
  try {
    const env = envFor(deps);
    if (row.cloud_name !== env.CLOUDINARY_CLOUD_NAME) {
      console.error(JSON.stringify({code: "CLEANUP_CLOUD_MISMATCH", publicId: row.public_id}));
      await updatePending();
      return "pending";
    }
    remoteResult = await gateway(deps).destroy(row.public_id, {resource_type: "image", type: "upload"});
  } catch (error) {
    console.error(JSON.stringify({code: "CLOUDINARY_CLEANUP_FAILED", publicId: row.public_id, error: safeError(error)}));
    await updatePending();
    return "pending";
  }

  if (!isDestroySuccess(remoteResult)) {
    console.error(JSON.stringify({code: "CLOUDINARY_CLEANUP_UNCONFIRMED", publicId: row.public_id}));
    await updatePending();
    return "pending";
  }

  try {
    await configured.db.query(
      `UPDATE media_cleanup_journal
          SET status = 'resolved', resolved_at = now(), claim_token = NULL, claim_expires_at = NULL
        WHERE id = $1 AND claim_token = $2`,
      [journalId, token],
    );
  } catch (error) {
    console.error(JSON.stringify({code: "CLEANUP_JOURNAL_UPDATE_FAILED", publicId: row.public_id, error: safeError(error)}));
    return "pending";
  }
  return "complete";
}

export async function createUploadIntent(actor: AdminSession, declaration: UploadDeclaration, overrides: AdminMediaDependencies = {}): Promise<UploadIntent> {
  const deps = dependencies(overrides);
  const now = deps.now();
  const timestamp = Math.floor(now.getTime() / 1000);
  const intentId = deps.createId();
  const publicId = `elhaq/uploads/${intentId}`;
  const expiresAt = new Date((timestamp + 600) * 1000);
  const env = envFor(deps);
  const cloudinary = gateway(deps);
  const signature = cloudinary.signRequest({
    timestamp,
    public_id: publicId,
    overwrite: false,
    allowed_formats: "jpg,png,webp,avif",
  });

  await deps.db.query(
    `INSERT INTO upload_intents (id, admin_user_id, expected_public_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [intentId, actor.userId, publicId, expiresAt],
  );

  return {
    intentId,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp,
    signature,
    publicId,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function lockMediaForAttach(tx: PoolClient, mediaIds: readonly string[]): Promise<void> {
  const ids = [...new Set(mediaIds)].sort();
  if (ids.length === 0) return;
  const result = await tx.query<{id: string}>(
    "SELECT id FROM media_assets WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE",
    [ids],
  );
  const returnedIds = result.rows.map((row) => row.id);
  if (returnedIds.length !== ids.length || returnedIds.some((id, index) => id !== ids[index])) {
    throw new DomainError(409, "FOREIGN_MEDIA_ID", "One or more media IDs are not owned by this application");
  }
}

const mediaSelect = `
  SELECT m.id, m.cloud_name, m.public_id, m.secure_url, m.width, m.height, m.format, m.bytes,
         (SELECT count(*) FROM album_photos ap WHERE ap.media_id = m.id)
         + (SELECT count(*) FROM albums a WHERE a.cover_media_id = m.id)
         + (SELECT count(*) FROM site_settings s WHERE s.logo_media_id = m.id)
         + (SELECT count(*) FROM site_settings s WHERE s.hero_media_id = m.id)
         + (SELECT count(*) FROM site_settings s WHERE s.about_media_id = m.id) AS reference_count
    FROM media_assets m`;

const mediaReferenceCount = `
  SELECT (SELECT count(*) FROM album_photos ap WHERE ap.media_id = $1)
       + (SELECT count(*) FROM albums a WHERE a.cover_media_id = $1)
       + (SELECT count(*) FROM site_settings s WHERE s.logo_media_id = $1)
       + (SELECT count(*) FROM site_settings s WHERE s.hero_media_id = $1)
       + (SELECT count(*) FROM site_settings s WHERE s.about_media_id = $1) AS reference_count`;

export async function listAdminMedia(actor: AdminSession, overrides: AdminMediaDependencies = {}): Promise<readonly AdminMediaAsset[]> {
  void actor;
  const result = await dependencies(overrides).db.query<MediaRow>(`${mediaSelect} ORDER BY m.created_at DESC, m.id`);
  return result.rows.map(mapMedia);
}

export async function getAdminMedia(actor: AdminSession, id: string, overrides: AdminMediaDependencies = {}): Promise<AdminMediaAsset | null> {
  void actor;
  const result = await dependencies(overrides).db.query<MediaRow>(`${mediaSelect} WHERE m.id = $1`, [id]);
  return result.rows[0] ? mapMedia(result.rows[0]) : null;
}

export async function deleteMediaIfUnreferenced(actor: AdminSession, id: string, overrides: AdminMediaDependencies = {}): Promise<{status: "deleted"; cleanup: "complete" | "pending"} | {status: "in_use"}> {
  void actor;
  const deps = dependencies(overrides);
  const outcome = await deps.transaction(async (tx) => {
    const mediaResult = await tx.query<{id: string; cloud_name: string; public_id: string}>(
      "SELECT id, cloud_name, public_id FROM media_assets WHERE id = $1 FOR UPDATE",
      [id],
    );
    const media = mediaResult.rows[0];
    if (!media) throw new HttpError(404, "MEDIA_NOT_FOUND", "Media was not found");
    const references = await tx.query<{reference_count: number | string}>(mediaReferenceCount, [id]);
    if (Number(references.rows[0]?.reference_count ?? 0) > 0) return {status: "in_use" as const};
    const journal = await tx.query<{id: string}>(
      `INSERT INTO media_cleanup_journal (operation, status, media_id, cloud_name, public_id, reason)
       VALUES ('remote_delete', 'pending', $1, $2, $3, 'admin_media_delete')
       RETURNING id`,
      [id, media.cloud_name, media.public_id],
    );
    const journalId = journal.rows[0]?.id;
    if (!journalId) throw new HttpError(503, "CLEANUP_JOURNAL_UNAVAILABLE", "Cleanup could not be recorded");
    await tx.query("DELETE FROM media_assets WHERE id = $1", [id]);
    return {status: "deleted" as const, journalId, publicId: media.public_id};
  });

  if (outcome.status === "in_use") return outcome;
  const cleanup = await settleCleanup(deps, outcome.journalId);
  return {status: "deleted", cleanup};
}

export async function listCleanupJournals(actor: AdminSession, overrides: AdminMediaDependencies = {}): Promise<readonly CleanupJournalEntry[]> {
  void actor;
  const result = await dependencies(overrides).db.query<CleanupRow>(
    `SELECT id, operation, status, media_id, cloud_name, public_id, reason, attempts, last_attempt_at, created_at, resolved_at, claim_token, claim_expires_at
       FROM media_cleanup_journal
      WHERE status = 'pending'
      ORDER BY created_at, id`,
  );
  return result.rows.map(mapCleanup);
}

export async function retryCleanup(actor: AdminSession, journalId: string, overrides: AdminMediaDependencies = {}): Promise<{status: "resolved" | "pending"}> {
  void actor;
  const deps = dependencies(overrides);
  const cleanup = await settleCleanup(deps, journalId);
  return {status: cleanup === "complete" ? "resolved" : "pending"};
}

export async function commitUploadedMedia(actor: AdminSession, result: ClientUploadResult, overrides: AdminMediaDependencies = {}): Promise<{status: "created"; media: AdminMediaAsset} | {status: "duplicate"; media: AdminMediaAsset}> {
  const deps = dependencies(overrides);
  const env = envFor(deps);
  const signatureValid = isValidUploadSignature(result.publicId, result.version, result.signature, env.CLOUDINARY_API_SECRET);

  let outcome: {status: "created"; media: AdminMediaAsset} | {status: "duplicate"; media: AdminMediaAsset} | {kind: "compensation"; journalId: string; publicId: string; error: HttpError};
  try {
    outcome = await deps.transaction(async (tx) => {
    const intentResult = await tx.query<UploadIntentRow>(
      `SELECT id, admin_user_id, expected_public_id, expires_at, state, used_at, media_id
         FROM upload_intents
        WHERE id = $1 AND admin_user_id = $2
        FOR UPDATE`,
      [result.intentId, actor.userId],
    );
    const intent = intentResult.rows[0];
    if (!intent) throw new HttpError(404, "UPLOAD_INTENT_NOT_FOUND", "Upload intent was not found");
    if (result.publicId !== intent.expected_public_id) throw new HttpError(422, "FOREIGN_PUBLIC_ID", "Cloudinary public ID does not match the upload intent");
    if (!signatureValid) throw new HttpError(422, "UPLOAD_SIGNATURE_INVALID", "Cloudinary upload signature is invalid");

    if (intent.state === "consumed") {
      if (!intent.media_id) throw new HttpError(410, "MEDIA_COMMIT_GONE", "Committed media metadata is unavailable");
      const mediaResult = await tx.query<MediaRow>(
        `SELECT m.id, m.cloud_name, m.public_id, m.secure_url, m.width, m.height, m.format, m.bytes,
                (SELECT count(*) FROM album_photos ap WHERE ap.media_id = m.id)
                + (SELECT count(*) FROM albums a WHERE a.cover_media_id = m.id)
                + (SELECT count(*) FROM site_settings s WHERE s.logo_media_id = m.id)
                + (SELECT count(*) FROM site_settings s WHERE s.hero_media_id = m.id)
                + (SELECT count(*) FROM site_settings s WHERE s.about_media_id = m.id) AS reference_count
           FROM media_assets m
          WHERE m.id = $1`,
        [intent.media_id],
      );
      if (!mediaResult.rows[0]) throw new HttpError(410, "MEDIA_COMMIT_GONE", "Committed media metadata is unavailable");
      return {status: "duplicate", media: mapMedia(mediaResult.rows[0])};
    }

    if (intent.state === "compensation_pending") throw new HttpError(409, "UPLOAD_INTENT_COMPENSATION_PENDING", "Upload intent requires cleanup before retry");
    if (new Date(intent.expires_at).getTime() <= deps.now().getTime()) throw new HttpError(410, "UPLOAD_INTENT_EXPIRED", "Upload intent has expired");

    await tx.query("SAVEPOINT media_metadata");
    let actual: ReturnType<typeof parseAuthoritativeResource> | undefined;
    try {
      actual = parseAuthoritativeResource(await gateway(deps).resource(result.publicId, {resource_type: "image", type: "upload"}));
      validateAuthoritativeResource(actual, {cloudName: env.CLOUDINARY_CLOUD_NAME, publicId: intent.expected_public_id, version: result.version});
    } catch (error) {
      if (actual && isVerifiedCloudinaryResource(actual, {cloudName: env.CLOUDINARY_CLOUD_NAME, publicId: intent.expected_public_id, version: result.version})) {
        try {
          await tx.query("ROLLBACK TO SAVEPOINT media_metadata");
          const journalId = await recordUploadCompensation(tx, intent.id, env.CLOUDINARY_CLOUD_NAME, actual.public_id, "authoritative_resource_rejected");
          return {
            kind: "compensation",
            journalId,
            publicId: actual.public_id,
            error: error instanceof HttpError ? error : new HttpError(502, "CLOUDINARY_RESOURCE_INVALID", "Cloudinary resource is invalid"),
          };
        } catch (journalError) {
          if (journalError instanceof CleanupJournalUnavailable) throw journalError;
          throw new CleanupJournalUnavailable(actual.public_id, journalError);
        }
      }
      try {
        await tx.query("ROLLBACK TO SAVEPOINT media_metadata");
      } catch {
        // The surrounding transaction still rolls back an unverified resource.
      }
      throw error;
    }

      try {
        const mediaResult = await tx.query<MediaRow>(
        `INSERT INTO media_assets (cloud_name, public_id, secure_url, width, height, format, bytes, upload_intent_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, cloud_name, public_id, secure_url, width, height, format, bytes, 0 AS reference_count`,
        [env.CLOUDINARY_CLOUD_NAME, actual.public_id, actual.secure_url, actual.width, actual.height, actual.format.toLowerCase(), actual.bytes, intent.id, actor.userId],
      );
        if (!mediaResult.rows[0]) throw new Error("MEDIA_INSERT_EMPTY");
        await tx.query(
          `UPDATE upload_intents SET state = 'consumed', used_at = now(), media_id = $2 WHERE id = $1`,
          [intent.id, mediaResult.rows[0].id],
        );
        await tx.query("RELEASE SAVEPOINT media_metadata");
        return {status: "created", media: mapMedia(mediaResult.rows[0])};
      } catch {
        try {
          await tx.query("ROLLBACK TO SAVEPOINT media_metadata");
          const journalId = await recordUploadCompensation(tx, intent.id, env.CLOUDINARY_CLOUD_NAME, actual.public_id, "media_metadata_insert_failed");
          return {
            kind: "compensation",
            journalId,
            publicId: actual.public_id,
            error: new HttpError(500, "MEDIA_METADATA_FAILED", "Media metadata could not be saved"),
          };
        } catch (journalError) {
          if (journalError instanceof CleanupJournalUnavailable) throw journalError;
          throw new CleanupJournalUnavailable(actual.public_id, journalError);
        }
      }
    });
  } catch (error) {
    if (error instanceof CleanupJournalUnavailable) {
      console.error(JSON.stringify({code: "CLEANUP_JOURNAL_UNAVAILABLE", publicId: error.publicId, error: safeError(error.cause)}));
      throw new HttpError(503, "CLEANUP_JOURNAL_UNAVAILABLE", "Cleanup could not be recorded");
    }
    throw error;
  }

  if ("kind" in outcome) {
    await settleCleanup(deps, outcome.journalId);
    throw outcome.error;
  }
  return outcome;
}
