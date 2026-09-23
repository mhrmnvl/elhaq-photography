import {createHmac} from "node:crypto";
import {isIP} from "node:net";

import {getServerEnv} from "@/lib/env";
import type {SqlExecutor} from "@/lib/db";

export function extractTrustedClientIp(request: Request): string {
  const platformIp = request.headers.get("x-vercel-forwarded-for")?.split(",", 1)[0]?.trim();
  if (platformIp && isIP(platformIp)) return platformIp;

  if (getServerEnv().NODE_ENV !== "production") {
    const hostname = new URL(request.url).hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return "127.0.0.1";
  }
  return "unknown";
}

export function makeRateLimitFingerprint(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

const rateLimitSql = `
INSERT INTO contact_rate_limits (fingerprint, window_started_at, request_count)
VALUES ($3, $1, 1)
ON CONFLICT (fingerprint) DO UPDATE SET
  window_started_at = CASE
    WHEN contact_rate_limits.window_started_at <= $1::timestamptz - ($2::bigint * interval '1 millisecond') THEN $1::timestamptz
    ELSE contact_rate_limits.window_started_at
  END,
  request_count = CASE
    WHEN contact_rate_limits.window_started_at <= $1::timestamptz - ($2::bigint * interval '1 millisecond') THEN 1
    ELSE contact_rate_limits.request_count + 1
  END
RETURNING window_started_at, request_count`;

export async function consumeContactRateLimit(
  executor: SqlExecutor,
  fingerprint: string,
  now: Date,
  limit: number,
  windowMs: number,
): Promise<{allowed: boolean; retryAfterSeconds: number}> {
  await executor.query(
    "DELETE FROM contact_rate_limits WHERE window_started_at < $1::timestamptz - ($2::bigint * interval '1 millisecond')",
    [now, windowMs],
  );
  const result = await executor.query<{window_started_at: Date; request_count: number}>(rateLimitSql, [now, windowMs, fingerprint]);
  const row = result.rows[0];
  if (!row) throw new Error("RATE_LIMIT_ROW_MISSING");

  const windowStartedAt = row.window_started_at instanceof Date ? row.window_started_at : new Date(row.window_started_at);
  const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now.getTime() - windowStartedAt.getTime())) / 1000));
  return {
    allowed: row.request_count <= limit,
    retryAfterSeconds: row.request_count <= limit ? 0 : retryAfterSeconds,
  };
}
