import {APIError} from "better-auth/api";
import {betterAuth, type BetterAuthOptions} from "better-auth";

import {getPool} from "@/lib/db-core";
import {getServerEnv} from "@/lib/env-core";
import {isAllowedAdminIdentity} from "@/lib/identity-policy";

let authInstance: ReturnType<typeof betterAuth> | undefined;

export function getAuth(): ReturnType<typeof betterAuth> {
  if (authInstance) return authInstance;

  const env = getServerEnv();
  const options: BetterAuthOptions = {
    database: getPool(),
    baseURL: env.APP_URL,
    trustedOrigins: [env.APP_URL],
    secret: env.BETTER_AUTH_SECRET,
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        requireEmailVerification: true,
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!isAllowedAdminIdentity({email: user.email, emailVerified: user.emailVerified}, env.ADMIN_EMAIL)) {
              throw new APIError("FORBIDDEN", {message: "This Google account is not allowed"});
            }
          },
        },
      },
    },
    advanced: {
      useSecureCookies: env.NODE_ENV === "production",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
      },
    },
  };
  const auth = betterAuth(options);
  authInstance = auth;

  return auth;
}
