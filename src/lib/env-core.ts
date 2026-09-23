import {HttpError} from "@/lib/errors";

export type ServerEnv = {
  readonly NODE_ENV: "development" | "test" | "production";
  readonly DATABASE_URL: string;
  readonly MIGRATION_DATABASE_URL: string;
  readonly BETTER_AUTH_SECRET: string;
  readonly APP_URL: string;
  readonly ADMIN_EMAIL: string;
  readonly GOOGLE_CLIENT_ID: string;
  readonly GOOGLE_CLIENT_SECRET: string;
  readonly CLOUDINARY_CLOUD_NAME: string;
  readonly CLOUDINARY_API_KEY: string;
  readonly CLOUDINARY_API_SECRET: string;
  readonly NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: string;
  readonly RATE_LIMIT_SECRET: string;
  readonly RESEND_ENABLED: boolean;
  readonly RESEND_API_KEY: string | null;
  readonly RESEND_FROM: string | null;
  readonly OWNER_EMAIL: string | null;
};

export function getServerEnv(): ServerEnv {
  const value = (name: string): string => {
    const result = process.env[name]?.trim();
    if (!result) {
      throw new HttpError(500, "CONFIGURATION_MISSING", `Missing server configuration: ${name}`);
    }
    return result;
  };
  const optional = (name: string): string | null => process.env[name]?.trim() || null;
  const enabled = process.env.RESEND_ENABLED === "true";

  return {
    NODE_ENV: process.env.NODE_ENV === "production" ? "production" : process.env.NODE_ENV === "test" ? "test" : "development",
    get DATABASE_URL() {
      return value("DATABASE_URL");
    },
    get MIGRATION_DATABASE_URL() {
      return value("MIGRATION_DATABASE_URL");
    },
    get BETTER_AUTH_SECRET() {
      return value("BETTER_AUTH_SECRET");
    },
    get APP_URL() {
      return value("APP_URL");
    },
    get ADMIN_EMAIL() {
      return value("ADMIN_EMAIL").toLowerCase();
    },
    get GOOGLE_CLIENT_ID() {
      return value("GOOGLE_CLIENT_ID");
    },
    get GOOGLE_CLIENT_SECRET() {
      return value("GOOGLE_CLIENT_SECRET");
    },
    get CLOUDINARY_CLOUD_NAME() {
      return value("CLOUDINARY_CLOUD_NAME");
    },
    get CLOUDINARY_API_KEY() {
      return value("CLOUDINARY_API_KEY");
    },
    get CLOUDINARY_API_SECRET() {
      return value("CLOUDINARY_API_SECRET");
    },
    get NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME() {
      return value("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
    },
    get RATE_LIMIT_SECRET() {
      return value("RATE_LIMIT_SECRET");
    },
    RESEND_ENABLED: enabled,
    RESEND_API_KEY: optional("RESEND_API_KEY"),
    RESEND_FROM: optional("RESEND_FROM"),
    OWNER_EMAIL: optional("OWNER_EMAIL"),
  };
}
