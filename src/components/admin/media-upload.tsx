"use client";

import * as React from "react";

import {Button} from "@/components/ui/button";
import type {UploadIntent} from "@/lib/cloudinary";
import type {AdminMediaAsset} from "@/lib/domain";

type UploadedResult = {public_id: string; version: number; signature: string};

export type UploadFileState = {
  id: string;
  name: string;
  status: "uploading" | "success" | "failed";
  message: string | null;
  mediaId: string | null;
};

type UploadParts = {
  intent?: UploadIntent;
  uploaded?: UploadedResult;
};

export type MediaUploadProps = {
  onComplete: (media: AdminMediaAsset) => void;
  label?: string;
};

type UploadItem = UploadFileState & {file: File; intent?: UploadIntent; uploaded?: UploadedResult};

class UploadFailure extends Error {
  constructor(message: string, readonly parts: UploadParts) {
    super(message);
    this.name = "UploadFailure";
  }
}

export function updateUploadItem<T extends {id: string}>(items: readonly T[], id: string, update: (item: T) => T): T[] {
  return items.map((item) => item.id === id ? update(item) : item);
}

export function getUploadRetryParts(item: Pick<UploadItem, "intent" | "uploaded">): UploadParts {
  return {intent: item.intent, uploaded: item.uploaded};
}

const uploadCopy = {
  en: {upload: "Upload photos", pending: "Uploading photos", uploading: "Uploading", uploaded: "Uploaded", complete: "Upload complete", failed: "Upload failed", retry: "Try again", results: "Upload results"},
  id: {upload: "Unggah foto", pending: "Mengunggah foto", uploading: "Mengunggah", uploaded: "Terunggah", complete: "Unggah selesai", failed: "Unggah gagal", retry: "Coba lagi", results: "Hasil unggahan"},
} as const;

function getUploadCopy(): (typeof uploadCopy)[keyof typeof uploadCopy] {
  if (typeof document !== "undefined" && document.documentElement.lang.toLowerCase().startsWith("id")) return uploadCopy.id;
  return uploadCopy.en;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Upload failed";
}

async function readUploadResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`Upload request failed (${response.status})`);
  return await response.json() as T;
}

async function executeUpload(file: File, parts: UploadParts = {}): Promise<{media: AdminMediaAsset; intent: UploadIntent; uploaded: UploadedResult}> {
  const intent = parts.intent ?? await readUploadResponse<UploadIntent>(await fetch("/api/admin/media", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({fileName: file.name, mimeType: file.type, bytes: file.size}),
  }));

  let uploaded = parts.uploaded;
  if (!uploaded) {
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", intent.apiKey);
      form.append("timestamp", String(intent.timestamp));
      form.append("public_id", intent.publicId);
      form.append("overwrite", "false");
      form.append("allowed_formats", "jpg,png,webp,avif");
      form.append("signature", intent.signature);
      uploaded = await readUploadResponse<UploadedResult>(await fetch(intent.uploadUrl, {method: "POST", body: form}));
    } catch (error) {
      throw new UploadFailure(errorMessage(error), {intent});
    }
  }

  try {
    const committed = await readUploadResponse<{status: "created" | "duplicate"; media: AdminMediaAsset}>(await fetch("/api/admin/media/commit", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({intentId: intent.intentId, publicId: uploaded.public_id, version: uploaded.version, signature: uploaded.signature}),
    }));
    if (!committed.media?.id || !["created", "duplicate"].includes(committed.status)) throw new Error("Upload commit did not return saved media");
    return {media: committed.media, intent, uploaded};
  } catch (error) {
    throw new UploadFailure(errorMessage(error), {intent, uploaded});
  }
}

export async function uploadOne(file: File): Promise<AdminMediaAsset> {
  return (await executeUpload(file)).media;
}

export function MediaUpload({onComplete, label}: MediaUploadProps): React.ReactElement {
  const inputId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const nextItemId = React.useRef(0);
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const copy = getUploadCopy();

  const updateItems = (update: (current: UploadItem[]) => UploadItem[]): void => setItems(update);

  const runUpload = async (id: string, file: File, parts: UploadParts = {}): Promise<void> => {
    updateItems((current) => updateUploadItem(current, id, (item) => ({...item, status: "uploading", message: null})));
    let result: {media: AdminMediaAsset; intent: UploadIntent; uploaded: UploadedResult};
    try {
      result = await executeUpload(file, parts);
    } catch (error) {
      const retryParts = error instanceof UploadFailure ? error.parts : parts;
      updateItems((items) => updateUploadItem(items, id, (item) => ({...item, status: "failed", message: errorMessage(error), intent: retryParts.intent, uploaded: retryParts.uploaded})));
      return;
    }
    updateItems((current) => updateUploadItem(current, id, (item) => ({...item, status: "success", message: copy.complete, mediaId: result.media.id, intent: result.intent, uploaded: result.uploaded})));
    onComplete(result.media);
  };

  const onFiles = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? []);
    event.currentTarget.value = "";
    const added = files.map((file, index) => ({
      id: `${inputId}-${nextItemId.current++}-${index}`,
      file,
      name: file.name,
      status: "uploading" as const,
      message: null,
      mediaId: null,
    }));
    updateItems((current) => [...current, ...added]);
    for (const item of added) void runUpload(item.id, item.file);
  };

  const pendingCount = items.filter((item) => item.status === "uploading").length;

  return (
    <div className="space-y-4">
      <Button type="button" onClick={() => inputRef.current?.click()}>{label ?? copy.upload}</Button>
      <input ref={inputRef} id={inputId} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple tabIndex={-1} aria-hidden="true" onChange={onFiles} />
      {pendingCount > 0 ? <p role="status" aria-live="polite">{copy.pending}</p> : null}
      {items.length > 0 ? (
        <ol aria-label={copy.results} aria-live="polite" className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] py-3">
              <span className="min-w-0 truncate">{item.name}</span>
              {item.status === "uploading" ? <span role="status">{copy.uploading}</span> : null}
              {item.status === "success" ? <span role="status">{copy.uploaded}</span> : null}
              {item.status === "failed" ? (
                <span className="flex items-center gap-3 text-sm" role="alert">
                  <span>{copy.failed}: {item.message}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => void runUpload(item.id, item.file, getUploadRetryParts(item))}>{copy.retry}</Button>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
