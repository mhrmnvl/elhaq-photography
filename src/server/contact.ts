import {createHash} from "node:crypto";

import {getDb, type SqlExecutor, withTransaction} from "@/lib/db";
import {getServerEnv} from "@/lib/env";
import {parseContactInput, type ContactInput} from "@/lib/contact-validation";
import {consumeContactRateLimit, makeRateLimitFingerprint} from "@/lib/rate-limit";
import {getContactMailer} from "@/lib/resend";

export type ContactSubmitResult =
  | {ok: true; created: boolean; notificationStatus: "disabled" | "pending" | "sent" | "failed" | "unknown"}
  | {ok: false; kind: "validation"; fieldErrors: Record<string, string[]>}
  | {ok: false; kind: "rate_limited"; retryAfterSeconds: number}
  | {ok: false; kind: "idempotency_conflict"}
  | {ok: false; kind: "storage"};

export interface ContactMailer {
  send(input: {
    name: string;
    email: string | null;
    whatsapp: string | null;
    eventType: string;
    eventDate: string | null;
    eventLocation: string | null;
    message: string;
    replyTo?: string;
  }): Promise<{providerId: string}>;
}

export type ContactTransaction = <T>(work: (executor: SqlExecutor) => Promise<T>) => Promise<T>;

export function canonicalContactJson(input: Omit<ContactInput, "submissionKey">): string {
  return JSON.stringify([
    input.name,
    input.email,
    input.whatsapp,
    input.eventType,
    input.eventDate,
    input.eventLocation,
    input.message,
  ]);
}

type ContactRow = {
  id: string;
  payload_digest: string;
  notification_status: "disabled" | "pending" | "sent" | "failed";
};

type SavedContact =
  | {ok: true; id: string; created: boolean; notificationStatus: "disabled" | "pending" | "sent" | "failed" | "unknown"}
  | Extract<ContactSubmitResult, {ok: false}>;

function visibleResult(saved: SavedContact): ContactSubmitResult {
  if (!saved.ok) return saved;
  return {
    ok: true,
    created: saved.created,
    notificationStatus: saved.notificationStatus,
  };
}

export async function submitContact(
  raw: unknown,
  request: {ip: string},
  dependencies?: {
    executor?: SqlExecutor;
    transaction?: ContactTransaction;
    mailer?: ContactMailer | null;
    now?: () => Date;
  },
): Promise<ContactSubmitResult> {
  const parsed = parseContactInput(raw);
  if (!parsed.ok) return parsed;

  const input = parsed.value;
  const executor = dependencies?.executor ?? getDb();
  const transaction: ContactTransaction = dependencies?.transaction ?? ((work) => withTransaction((client) => work(client)));
  const fingerprint = makeRateLimitFingerprint(request.ip, getServerEnv().RATE_LIMIT_SECRET);
  const now = dependencies?.now?.() ?? new Date();
  const mailer = dependencies?.mailer === undefined ? getContactMailer() : dependencies.mailer;
  const payloadWithoutKey = {
    name: input.name,
    email: input.email,
    whatsapp: input.whatsapp,
    eventType: input.eventType,
    eventDate: input.eventDate,
    eventLocation: input.eventLocation,
    message: input.message,
  };
  const payloadDigest = createHash("sha256").update(canonicalContactJson(payloadWithoutKey)).digest("hex");

  let saved: SavedContact;
  try {
    saved = await transaction<SavedContact>(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`contact:${input.submissionKey}`]);
      const existing = await tx.query<ContactRow>(
        "SELECT id, payload_digest, notification_status FROM contact_messages WHERE submission_key = $1 FOR UPDATE",
        [input.submissionKey],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].payload_digest !== payloadDigest) return {ok: false, kind: "idempotency_conflict"};
        return {
          ok: true,
          id: existing.rows[0].id,
          created: false,
          notificationStatus: existing.rows[0].notification_status,
        };
      }

      const limit = await consumeContactRateLimit(tx, fingerprint, now, 5, 3_600_000);
      if (!limit.allowed) return {ok: false, kind: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds};

      const inserted = await tx.query<{id: string}>(
        "INSERT INTO contact_messages (submission_key, payload_digest, request_fingerprint, name, email, whatsapp, event_type, event_date, event_location, message, notification_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id",
        [
          input.submissionKey,
          payloadDigest,
          fingerprint,
          input.name,
          input.email,
          input.whatsapp,
          input.eventType,
          input.eventDate,
          input.eventLocation,
          input.message,
          mailer ? "pending" : "disabled",
        ],
      );
      const id = inserted.rows[0]?.id;
      if (!id) throw new Error("CONTACT_INSERT_RETURNED_NO_ID");
      return {
        ok: true,
        id,
        created: true,
        notificationStatus: mailer ? "pending" : "disabled",
      };
    });
  } catch {
    return {ok: false, kind: "storage"};
  }

  if (!saved.ok || !saved.created || !mailer) return visibleResult(saved);

  const updateNotification = async (
    status: "sent" | "failed",
    providerId: string | null,
    errorMessage: string | null,
  ): Promise<boolean> => {
    try {
      await executor.query(
        "UPDATE contact_messages SET notification_status = $1, notification_provider_id = $2, notification_error = $3, notification_attempted_at = $4 WHERE id = $5",
        [status, providerId, errorMessage, now, saved.id],
      );
      return true;
    } catch (error) {
      console.error(JSON.stringify({
        code: "NOTIFICATION_STATUS_UPDATE_FAILED",
        messageId: saved.id,
        error: error instanceof Error ? error.message : String(error),
      }));
      return false;
    }
  };

  try {
    const notification = await mailer.send({
      name: input.name,
      email: input.email,
      whatsapp: input.whatsapp,
      eventType: input.eventType,
      eventDate: input.eventDate,
      eventLocation: input.eventLocation,
      message: input.message,
      replyTo: input.email ?? undefined,
    });
    return visibleResult({
      ...saved,
      notificationStatus: (await updateNotification("sent", notification.providerId, null)) ? "sent" : "unknown",
    });
  } catch (error) {
    return visibleResult({
      ...saved,
      notificationStatus: (await updateNotification("failed", null, error instanceof Error ? error.message : String(error))) ? "failed" : "unknown",
    });
  }
}
