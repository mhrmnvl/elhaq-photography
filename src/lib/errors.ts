export type DomainErrorCode =
  | "DUPLICATE_MEDIA_ID"
  | "FOREIGN_MEDIA_ID"
  | "COVER_MEDIA_NOT_IN_ALBUM"
  | "ALBUM_SLUG_EXISTS"
  | "ALBUM_VERSION_CONFLICT"
  | "PUBLISHED_ALBUM_INVALID"
  | "ALBUM_MUST_BE_UNPUBLISHED"
  | "MEDIA_IN_USE"
  | "IDEMPOTENCY_PAYLOAD_MISMATCH"
  | "FEATURED_ALBUM_NOT_PUBLISHED";

export class HttpError<Code extends string = string> extends Error {
  constructor(readonly status: number, readonly code: Code, message: string) {
    super(`${code}: ${message}`);
    this.name = "HttpError";
  }
}

export class DomainError extends HttpError<DomainErrorCode> {
  constructor(status: number, code: DomainErrorCode, message: string) {
    super(status, code, message);
    this.name = "DomainError";
  }
}
