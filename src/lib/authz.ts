import "server-only";

import {getAuth} from "@/lib/auth";
import {HttpError} from "@/lib/errors";
import {getServerEnv} from "@/lib/env";
import {isAllowedAdminIdentity, normalizeEmail} from "@/lib/identity-policy";

export {isAllowedAdminIdentity, normalizeEmail};

export type AdminSession = {userId: string; email: string; name: string | null};
export type Session = {user: {id: string; email: string; emailVerified: boolean; name?: string | null}};
export type SessionReader = {api: {getSession(input: {headers: Headers}): Promise<Session | null>}};

function isLocalDevelopmentUrl(value: string): boolean {
  try {
    const {hostname, protocol} = new URL(value);
    return protocol === "http:" && new Set(["localhost", "127.0.0.1", "[::1]", "::1"]).has(hostname);
  } catch {
    return false;
  }
}

export async function requireAdmin(headers: Headers, reader?: SessionReader): Promise<AdminSession> {
  const env = getServerEnv();
  if (process.env.NODE_ENV === "development" && env.LOCAL_AUTH_BYPASS && isLocalDevelopmentUrl(env.APP_URL)) {
    return {userId: "local-development", email: env.ADMIN_EMAIL, name: "Local development"};
  }

  const session = await (reader ?? {api: getAuth().api}).api.getSession({headers});
  if (!session) throw new HttpError(401, "UNAUTHENTICATED", "Admin session required");

  if (session.user.emailVerified !== true) throw new HttpError(403, "EMAIL_NOT_VERIFIED", "Verified admin email required");
  if (!isAllowedAdminIdentity(session.user, env.ADMIN_EMAIL)) {
    throw new HttpError(403, "ADMIN_EMAIL_NOT_ALLOWED", "Admin email is not allowed");
  }

  return {userId: session.user.id, email: normalizeEmail(session.user.email), name: session.user.name ?? null};
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const appOrigin = new URL(getServerEnv().APP_URL).origin;
  if (!origin || origin !== appOrigin) {
    throw new HttpError(403, "ORIGIN_FORBIDDEN", "Request origin is not allowed");
  }
}
