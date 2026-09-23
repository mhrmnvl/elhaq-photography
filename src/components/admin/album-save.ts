import type {AdminAlbum, AlbumCategory, BilingualText} from "@/lib/domain";

export type AlbumSaveMetadata = {
  slug: string;
  category: AlbumCategory;
  title: BilingualText;
  story: BilingualText;
  coverMediaId: string | null;
  sortOrder: number;
};

export type AlbumSavePhoto = {
  mediaId: string;
  position: number;
  alt: BilingualText;
};

export type AlbumSaveRequest = (url: string, init?: RequestInit) => Promise<Response>;

export class ApiFailure extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export class SaveConsistencyError extends Error {
  readonly code = "SAVE_COMPENSATION_FAILED";

  constructor(readonly cause: unknown) {
    super("The album could not be restored after the save failed");
  }
}

export async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & {code?: string};
  if (!response.ok) throw new ApiFailure(payload.code ?? "REQUEST_FAILED");
  return payload;
}

function jsonRequest(method: string, body: unknown, updatedAt?: string, idempotencyKey?: string): RequestInit {
  const headers: Record<string, string> = {"content-type": "application/json"};
  if (updatedAt !== undefined) headers["if-unmodified-since"] = updatedAt;
  if (idempotencyKey !== undefined) headers["idempotency-key"] = idempotencyKey;
  return {method, headers, body: JSON.stringify(body)};
}

function newIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

function photosInput(album: AdminAlbum): AlbumSavePhoto[] {
  return album.photos.map((photo) => ({mediaId: photo.media.id, position: photo.position, alt: photo.media.alt}));
}

function metadataInput(album: AdminAlbum): AlbumSaveMetadata {
  return {
    slug: album.slug,
    category: album.category,
    title: album.title,
    story: album.story,
    coverMediaId: album.coverMediaId,
    sortOrder: album.sortOrder,
  };
}

function metadataMatches(album: AdminAlbum, metadata: AlbumSaveMetadata): boolean {
  return metadataFieldsMatch(album, metadata)
    && album.coverMediaId === metadata.coverMediaId;
}

function metadataFieldsMatch(album: AdminAlbum, metadata: AlbumSaveMetadata): boolean {
  return album.slug === metadata.slug.trim()
    && album.category === metadata.category
    && album.title.en === metadata.title.en.trim()
    && album.title.id === metadata.title.id.trim()
    && album.story.en === metadata.story.en.trim()
    && album.story.id === metadata.story.id.trim()
    && album.sortOrder === metadata.sortOrder;
}

function photosMatch(album: AdminAlbum, photos: readonly AlbumSavePhoto[]): boolean {
  return album.photos.length === photos.length && photos.every((photo, index) => {
    const actual = album.photos[index];
    return actual.position === photo.position
      && actual.media.id === photo.mediaId
      && actual.media.alt.en === photo.alt.en.trim()
      && actual.media.alt.id === photo.alt.id.trim();
  });
}

function albumMatchesSave(album: AdminAlbum, metadata: AlbumSaveMetadata, photos: readonly AlbumSavePhoto[], status: AdminAlbum["status"]): boolean {
  return album.status === status && metadataMatches(album, metadata) && photosMatch(album, photos);
}

function sameAlbumState(left: AdminAlbum, right: AdminAlbum): boolean {
  return albumMatchesSave(left, metadataInput(right), photosInput(right), right.status);
}

function photoMutationMatches(album: AdminAlbum, previousAlbum: AdminAlbum, photos: readonly AlbumSavePhoto[]): boolean {
  const coverMediaId = previousAlbum.coverMediaId !== null && photos.some((photo) => photo.mediaId === previousAlbum.coverMediaId)
    ? previousAlbum.coverMediaId
    : null;
  return albumMatchesSave(album, {...metadataInput(previousAlbum), coverMediaId}, photos, previousAlbum.status);
}

async function currentAlbum(request: AlbumSaveRequest, id: string): Promise<AdminAlbum> {
  return readResponse<AdminAlbum>(await request(`/api/admin/albums/${id}`, {method: "GET"}));
}

async function currentAfterFailure(request: AlbumSaveRequest, id: string): Promise<AdminAlbum> {
  try {
    return await currentAlbum(request, id);
  } catch (error) {
    throw new SaveConsistencyError(error);
  }
}

async function restoreAlbum(request: AlbumSaveRequest, album: AdminAlbum, current: AdminAlbum, photos: readonly AlbumSavePhoto[]): Promise<void> {
  if (!photoMutationMatches(current, album, photos)) throw new SaveConsistencyError(current);
  let restoredPhotos: AdminAlbum;
  try {
    restoredPhotos = await readResponse<AdminAlbum>(await request(`/api/admin/albums/${album.id}/photos`, jsonRequest("PUT", photosInput(album), current.updatedAt)));
  } catch (error) {
    const after = await currentAfterFailure(request, album.id);
    if (!sameAlbumState(after, album)) throw new SaveConsistencyError(error);
    restoredPhotos = after;
  }
  try {
    await readResponse<AdminAlbum>(await request(`/api/admin/albums/${album.id}`, jsonRequest("PATCH", metadataInput(album), restoredPhotos.updatedAt)));
  } catch (error) {
    const after = await currentAfterFailure(request, album.id);
    if (sameAlbumState(after, album)) return;
    throw new SaveConsistencyError(error);
  }
}

async function deleteCreatedAlbum(request: AlbumSaveRequest, id: string, updatedAt: string): Promise<void> {
  try {
    await readResponse(await request(`/api/admin/albums/${id}`, {method: "DELETE", headers: {"if-unmodified-since": updatedAt}}));
  } catch (error) {
    try {
      await currentAlbum(request, id);
    } catch (verificationError) {
      if (verificationError instanceof ApiFailure && verificationError.code === "ALBUM_NOT_FOUND") return;
    }
    throw error;
  }
}

async function cleanupCreatedAlbum(
  request: AlbumSaveRequest,
  created: AdminAlbum,
  metadata: AlbumSaveMetadata,
  photos: readonly AlbumSavePhoto[],
  failure: unknown,
): Promise<AdminAlbum> {
  const current = await currentAfterFailure(request, created.id);
  if (albumMatchesSave(current, metadata, photos, created.status)) return current;
  if (!sameAlbumState(current, created) && !photoMutationMatches(current, created, photos)) {
    throw new SaveConsistencyError(failure);
  }
  try {
    await deleteCreatedAlbum(request, created.id, current.updatedAt);
  } catch (compensationError) {
    throw new SaveConsistencyError(compensationError);
  }
  throw failure;
}

async function saveExistingAlbum(
  request: AlbumSaveRequest,
  albumId: string,
  metadata: AlbumSaveMetadata,
  photos: readonly AlbumSavePhoto[],
  previousAlbum: AdminAlbum,
): Promise<AdminAlbum> {
  let photosResult: AdminAlbum;
  try {
    photosResult = await readResponse<AdminAlbum>(await request(`/api/admin/albums/${albumId}/photos`, jsonRequest("PUT", photos, previousAlbum.updatedAt)));
  } catch (error) {
    const current = await currentAfterFailure(request, albumId);
    if (albumMatchesSave(current, metadata, photos, previousAlbum.status)) return current;
    if (!photoMutationMatches(current, previousAlbum, photos)) {
      if (sameAlbumState(current, previousAlbum)) throw error;
      throw new SaveConsistencyError(error);
    }
    photosResult = current;
  }

  try {
    return await readResponse<AdminAlbum>(await request(`/api/admin/albums/${albumId}`, jsonRequest("PATCH", metadata, photosResult.updatedAt)));
  } catch (error) {
    const current = await currentAfterFailure(request, albumId);
    if (albumMatchesSave(current, metadata, photos, previousAlbum.status)) return current;
    if (!photoMutationMatches(current, previousAlbum, photos)) throw new SaveConsistencyError(error);
    try {
      await restoreAlbum(request, previousAlbum, current, photos);
    } catch (compensationError) {
      throw compensationError instanceof SaveConsistencyError ? compensationError : new SaveConsistencyError(compensationError);
    }
    throw error;
  }
}

export async function saveAlbum({
  albumId,
  metadata,
  photos,
  previousAlbum,
  request = fetch,
}: {
  albumId: string | null;
  metadata: AlbumSaveMetadata;
  photos: readonly AlbumSavePhoto[];
  previousAlbum: AdminAlbum | null;
  request?: AlbumSaveRequest;
}): Promise<AdminAlbum> {
  if (!albumId) {
    const idempotencyKey = newIdempotencyKey();
    let created: AdminAlbum;
    try {
      created = await readResponse<AdminAlbum>(await request("/api/admin/albums", jsonRequest("POST", {...metadata, coverMediaId: null}, undefined, idempotencyKey)));
    } catch (error) {
      if (error instanceof ApiFailure) throw error;
      try {
        created = await readResponse<AdminAlbum>(await request("/api/admin/albums", jsonRequest("POST", {...metadata, coverMediaId: null}, undefined, idempotencyKey)));
      } catch (retryError) {
        throw retryError;
      }
    }
    try {
      const withPhotos = await readResponse<AdminAlbum>(await request(`/api/admin/albums/${created.id}/photos`, jsonRequest("PUT", photos, created.updatedAt)));
      if (metadata.coverMediaId === null) return withPhotos;
      return await readResponse<AdminAlbum>(await request(`/api/admin/albums/${created.id}`, jsonRequest("PATCH", metadata, withPhotos.updatedAt)));
    } catch (error) {
      return cleanupCreatedAlbum(request, created, metadata, photos, error);
    }
  }

  if (!previousAlbum) throw new Error("Missing album snapshot for save compensation");
  return saveExistingAlbum(request, albumId, metadata, photos, previousAlbum);
}
