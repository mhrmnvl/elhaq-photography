import "server-only";

import {timingSafeEqual} from "node:crypto";
import {v2 as cloudinary} from "cloudinary";
import {z} from "zod";

import {HttpError} from "@/lib/errors";
import {getServerEnv, type ServerEnv} from "@/lib/env";

export const MAX_UPLOAD_BYTES = 5_242_880;
export const SUPPORTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

export type UploadDeclaration = {fileName: string; mimeType: string; bytes: number};
export type CloudinaryResource = {
  resource_type: string;
  type: string;
  version: number;
  bytes: number;
  format: string;
  width: number;
  height: number;
  public_id: string;
  secure_url: string;
};

const uploadDeclarationSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(SUPPORTED_IMAGE_MIME_TYPES),
  bytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
}).strict();

export function parseUploadDeclaration(raw: unknown): UploadDeclaration {
  const result = uploadDeclarationSchema.safeParse(raw);
  if (!result.success) throw new HttpError(422, "UPLOAD_DECLARATION_INVALID", "Upload declaration is invalid");
  return result.data;
}

export type ClientUploadResult = {intentId: string; publicId: string; version: number; signature: string};
export type UploadIntent = {
  intentId: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  publicId: string;
  uploadUrl: string;
  expiresAt: string;
};
export type CloudinaryEnv = Pick<ServerEnv, "CLOUDINARY_CLOUD_NAME" | "CLOUDINARY_API_KEY" | "CLOUDINARY_API_SECRET">;
export type CloudinaryGateway = {
  signRequest: (params: Record<string, unknown>) => string;
  resource: (publicId: string, options: {resource_type: "image"; type: "upload"}) => Promise<unknown>;
  destroy: (publicId: string, options: {resource_type: "image"; type: "upload"}) => Promise<unknown>;
};

export function getCloudinaryGateway(env: CloudinaryEnv = getServerEnv()): CloudinaryGateway {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  return {
    signRequest: (params) => cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET),
    resource: (publicId, options) => cloudinary.api.resource(publicId, options),
    destroy: (publicId, options) => cloudinary.uploader.destroy(publicId, options),
  };
}

export function isValidUploadSignature(publicId: string, version: number, signature: string, apiSecret: string): boolean {
  const expected = cloudinary.utils.api_sign_request({public_id: publicId, version}, apiSecret);
  const actualBytes = Buffer.from(signature, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

const authoritativeResourceSchema = z.object({
  resource_type: z.string().min(1),
  type: z.string().min(1),
  version: z.number().int().positive(),
  bytes: z.number().int().nonnegative(),
  format: z.string().min(1),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  public_id: z.string().min(1),
  secure_url: z.string().min(1),
});

export function parseAuthoritativeResource(raw: unknown): CloudinaryResource {
  const result = authoritativeResourceSchema.safeParse(raw);
  if (!result.success) throw new HttpError(502, "CLOUDINARY_RESOURCE_INVALID", "Cloudinary resource response is invalid");
  return result.data;
}

const clientUploadResultSchema = z.object({
  intentId: z.string().uuid(),
  publicId: z.string().trim().min(1).max(255),
  version: z.number().int().positive(),
  signature: z.string().regex(/^[a-f0-9]+$/i),
}).strict();

export function parseClientUploadResult(raw: unknown): ClientUploadResult {
  const result = clientUploadResultSchema.safeParse(raw);
  if (!result.success) throw new HttpError(422, "UPLOAD_COMMIT_INVALID", "Upload commit is invalid");
  return result.data;
}

function invalid(code: string, message: string): never {
  throw new HttpError(422, code, message);
}

function isExpectedSecureUrl(secureUrl: string, expected: {cloudName: string; publicId: string; version: number; format: string}): boolean {
  try {
    const url = new URL(secureUrl);
    const prefix = `/${expected.cloudName}/image/upload/`;
    const path = url.pathname.slice(prefix.length);
    const expectedPath = `v${expected.version}/${expected.publicId}`;
    return url.protocol === "https:"
      && url.hostname === "res.cloudinary.com"
      && url.search === ""
      && url.hash === ""
      && url.pathname.slice(0, prefix.length) === prefix
      && (path === expectedPath || path === `${expectedPath}.${expected.format.toLowerCase()}`);
  } catch {
    return false;
  }
}

export function isVerifiedCloudinaryResource(actual: CloudinaryResource, expected: {cloudName: string; publicId: string; version: number}): boolean {
  return actual.resource_type === "image"
    && actual.type === "upload"
    && actual.version === expected.version
    && actual.public_id === expected.publicId
    && isExpectedSecureUrl(actual.secure_url, {...expected, format: actual.format});
}

export function validateAuthoritativeResource(actual: CloudinaryResource, expected: {cloudName: string; publicId: string; version: number}): void {
  if (actual.resource_type !== "image") invalid("UNSUPPORTED_RESOURCE", "Cloudinary resource is not an image");
  if (actual.type !== "upload") invalid("UNSUPPORTED_RESOURCE_TYPE", "Cloudinary resource type is not upload");
  if (actual.version !== expected.version) invalid("CLOUDINARY_VERSION_MISMATCH", "Cloudinary resource version does not match the upload");
  if (actual.bytes > MAX_UPLOAD_BYTES) invalid("UPLOAD_TOO_LARGE", "Cloudinary resource exceeds the upload limit");
  if (actual.public_id !== expected.publicId) invalid("FOREIGN_PUBLIC_ID", "Cloudinary public ID does not match the upload intent");
  if (!Number.isInteger(actual.width) || !Number.isInteger(actual.height) || actual.width < 1 || actual.height < 1) {
    invalid("INVALID_DIMENSIONS", "Cloudinary dimensions are invalid");
  }
  if (!Number.isInteger(actual.bytes) || actual.bytes < 1) invalid("INVALID_RESOURCE_BYTES", "Cloudinary bytes are invalid");
  if (!["jpg", "jpeg", "png", "webp", "avif"].includes(actual.format.toLowerCase())) {
    invalid("UNSUPPORTED_FORMAT", "Cloudinary format is not supported");
  }
  if (!isExpectedSecureUrl(actual.secure_url, {...expected, format: actual.format})) invalid("CLOUDINARY_URL_INVALID", "Cloudinary URL is not an expected secure image URL");
}
