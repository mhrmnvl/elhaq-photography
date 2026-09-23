import {expect, test} from "bun:test";

import {MAX_UPLOAD_BYTES, isValidUploadSignature, parseAuthoritativeResource, parseClientUploadResult, parseUploadDeclaration, validateAuthoritativeResource} from "@/lib/cloudinary";

test("uses five MiB as the public image limit", () => {
  expect(MAX_UPLOAD_BYTES).toBe(5_242_880);
});

test("rejects an authoritative non-image or oversized resource", () => {
  const expected = {cloudName: "a", publicId: "elhaq/uploads/x", version: 1};

  expect(() => validateAuthoritativeResource({
    resource_type: "raw",
    type: "upload",
    version: 1,
    bytes: 1,
    format: "jpg",
    width: 100,
    height: 100,
    public_id: "elhaq/uploads/x",
    secure_url: "https://res.cloudinary.com/a/image/upload/x",
  }, expected)).toThrow("UNSUPPORTED_RESOURCE");

  expect(() => validateAuthoritativeResource({
    resource_type: "image",
    type: "upload",
    version: 1,
    bytes: MAX_UPLOAD_BYTES + 1,
    format: "jpg",
    width: 100,
    height: 100,
    public_id: "elhaq/uploads/x",
    secure_url: "https://res.cloudinary.com/a/image/upload/x",
  }, expected)).toThrow("UPLOAD_TOO_LARGE");
});

test("parses only a strict supported upload declaration", () => {
  expect(parseUploadDeclaration({fileName: "portrait.jpg", mimeType: "image/jpeg", bytes: 100})).toEqual({
    fileName: "portrait.jpg",
    mimeType: "image/jpeg",
    bytes: 100,
  });
  expect(() => parseUploadDeclaration({fileName: "portrait.jpg", mimeType: "image/jpeg", bytes: 100, extra: true})).toThrow("UPLOAD_DECLARATION_INVALID");
  expect(() => parseUploadDeclaration({fileName: "portrait.jpg", mimeType: "image/gif", bytes: 100})).toThrow("UPLOAD_DECLARATION_INVALID");
});

test("parses only a strict client upload result", () => {
  expect(parseClientUploadResult({
    intentId: "00000000-0000-4000-8000-000000000001",
    publicId: "elhaq/uploads/00000000-0000-4000-8000-000000000001",
    version: 7,
    signature: "aabbcc",
  })).toEqual({
    intentId: "00000000-0000-4000-8000-000000000001",
    publicId: "elhaq/uploads/00000000-0000-4000-8000-000000000001",
    version: 7,
    signature: "aabbcc",
  });
  expect(() => parseClientUploadResult({
    intentId: "00000000-0000-4000-8000-000000000001",
    publicId: "elhaq/uploads/00000000-0000-4000-8000-000000000001",
    version: 7,
    signature: "aabbcc",
    extra: true,
  })).toThrow("UPLOAD_COMMIT_INVALID");
});

test("requires the authoritative resource to match the signed cloud and supported image shape", () => {
  const expected = {cloudName: "a", publicId: "elhaq/uploads/x", version: 7};
  const valid = {
    resource_type: "image",
    type: "upload",
    version: 7,
    bytes: 100,
    format: "webp",
    width: 100,
    height: 100,
    public_id: "elhaq/uploads/x",
    secure_url: "https://res.cloudinary.com/a/image/upload/v7/elhaq/uploads/x.webp",
  };

  expect(() => validateAuthoritativeResource({...valid, public_id: "elhaq/uploads/other"}, expected)).toThrow("FOREIGN_PUBLIC_ID");
  expect(() => validateAuthoritativeResource({...valid, secure_url: "https://res.cloudinary.com/other/image/upload/x"}, expected)).toThrow("CLOUDINARY_URL_INVALID");
  expect(() => validateAuthoritativeResource({...valid, secure_url: "https://res.cloudinary.com/a/image/upload/v7/elhaq/uploads/other.webp"}, expected)).toThrow("CLOUDINARY_URL_INVALID");
  expect(() => validateAuthoritativeResource({...valid, version: 8, secure_url: "https://res.cloudinary.com/a/image/upload/v8/elhaq/uploads/x.webp"}, expected)).toThrow("CLOUDINARY_VERSION_MISMATCH");
  expect(() => validateAuthoritativeResource({...valid, type: "authenticated"}, expected)).toThrow("UNSUPPORTED_RESOURCE_TYPE");
  expect(() => validateAuthoritativeResource({...valid, format: "gif"}, expected)).toThrow("UNSUPPORTED_FORMAT");
  expect(() => validateAuthoritativeResource({...valid, width: 0}, expected)).toThrow("INVALID_DIMENSIONS");
  expect(() => validateAuthoritativeResource(valid, expected)).not.toThrow();
});

test("requires version and delivery type in the authoritative response", () => {
  const resource = {
    resource_type: "image",
    type: "upload",
    version: 7,
    bytes: 100,
    format: "webp",
    width: 100,
    height: 100,
    public_id: "elhaq/uploads/x",
    secure_url: "https://res.cloudinary.com/a/image/upload/v7/elhaq/uploads/x.webp",
  };

  expect(parseAuthoritativeResource(resource)).toEqual(resource);
  expect(() => parseAuthoritativeResource({...resource, version: undefined})).toThrow("CLOUDINARY_RESOURCE_INVALID");
  expect(() => parseAuthoritativeResource({...resource, type: undefined})).toThrow("CLOUDINARY_RESOURCE_INVALID");
});

test("verifies the Cloudinary signature over the returned public ID and version", () => {
  expect(isValidUploadSignature(
    "elhaq/uploads/00000000-0000-4000-8000-000000000001",
    7,
    "aabbcc",
    "secret",
  )).toBe(false);
  expect(isValidUploadSignature(
    "elhaq/uploads/00000000-0000-4000-8000-000000000001",
    7,
    "6be245c290ee65e4a845996efe74ae0777347d23",
    "secret",
  )).toBe(true);
});
