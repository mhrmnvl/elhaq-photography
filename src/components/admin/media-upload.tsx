"use client";

import * as React from "react";

import {AlertCircle, CheckCircle2, FileImage, ImagePlus, Loader2, RefreshCw, Trash2, UploadCloud} from "lucide-react";

import {Button} from "@/components/ui/button";
import type {UploadIntent} from "@/lib/cloudinary";
import type {AdminMediaAsset} from "@/lib/domain";
import {cn} from "@/lib/utils";

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
  onRemove?: (id: string, mediaId: string | null) => void;
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
  en: {
    upload: "Upload photos",
    pending: "Uploading photos",
    uploading: "Uploading",
    uploaded: "Uploaded",
    complete: "Upload complete",
    failed: "Upload failed",
    retry: "Try again",
    results: "Upload results",
    dragTitle: "Drag and drop photos here, or browse",
    dragActive: "Drop photos here to upload",
    browse: "Browse files",
    formats: "Supports JPG, PNG, WebP, and AVIF up to high resolution",
    remove: "Remove photo",
  },
  id: {
    upload: "Unggah foto",
    pending: "Mengunggah foto",
    uploading: "Mengunggah",
    uploaded: "Terunggah",
    complete: "Unggah selesai",
    failed: "Unggah gagal",
    retry: "Coba lagi",
    results: "Hasil unggahan",
    dragTitle: "Tarik dan lepas foto di sini, atau telusuri",
    dragActive: "Lepaskan foto di sini untuk mengunggah",
    browse: "Pilih file",
    formats: "Mendukung JPG, PNG, WebP, dan AVIF resolusi tinggi",
    remove: "Hapus foto",
  },
} as const;

function getUploadCopy(): (typeof uploadCopy)[keyof typeof uploadCopy] {
  if (typeof document !== "undefined" && document.documentElement.lang.toLowerCase().startsWith("id")) return uploadCopy.id;
  return uploadCopy.en;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function UploadItemCard({
  item,
  copy,
  onRetry,
  onRemove,
}: {
  item: UploadItem;
  copy: ReturnType<typeof getUploadCopy>;
  onRetry: () => void;
  onRemove: () => void;
}): React.ReactElement {
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!item.file || !item.file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(item.file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [item.file]);

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-2xs transition-all">
      <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <FileImage className="size-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-medium text-foreground">{item.name}</p>
          <span className="text-[11px] text-muted-foreground shrink-0">{formatBytes(item.file.size)}</span>
        </div>
        {item.status === "uploading" ? (
          <div className="space-y-1.5">
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              <span>{copy.uploading}...</span>
            </div>
          </div>
        ) : null}
        {item.status === "success" ? (
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
            <CheckCircle2 className="size-3.5" />
            <span>{copy.uploaded}</span>
          </div>
        ) : null}
        {item.status === "failed" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-destructive">
              <AlertCircle className="size-3.5 shrink-0" />
              <span className="truncate max-w-[200px]">{item.message || copy.failed}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="h-6 px-2 text-[11px] gap-1"
            >
              <RefreshCw className="size-2.5" />
              <span>{copy.retry}</span>
            </Button>
          </div>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="size-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        title={copy.remove}
        aria-label={`${copy.remove} ${item.name}`}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  );
}

export function MediaUpload({onComplete, onRemove, label}: MediaUploadProps): React.ReactElement {
  const inputId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const nextItemId = React.useRef(0);
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
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

  const handleRemove = (id: string, mediaId: string | null): void => {
    updateItems((current) => current.filter((item) => item.id !== id));
    if (mediaId) {
      void fetch(`/api/admin/media/${mediaId}`, {method: "DELETE"});
    }
    onRemove?.(id, mediaId);
  };

  const handleFiles = (files: File[]): void => {
    const validFiles = files.filter((file) => file.type.startsWith("image/"));
    if (validFiles.length === 0) return;
    const added = validFiles.map((file, index) => ({
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

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? []);
    event.currentTarget.value = "";
    handleFiles(files);
  };

  return (
    <div className="space-y-5">
      <div
        role="button"
        tabIndex={0}
        aria-label={label ?? copy.dragTitle}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(true);
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragging(false);
          const droppedFiles = Array.from(event.dataTransfer.files ?? []);
          if (droppedFiles.length > 0) handleFiles(droppedFiles);
        }}
        className={cn(
          "group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 sm:p-10 text-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isDragging
            ? "border-foreground bg-muted/40 scale-[1.005]"
            : "border-border bg-muted/15 hover:border-foreground/40 hover:bg-muted/25"
        )}
      >
        <div className="size-12 rounded-full bg-background border border-border/80 flex items-center justify-center text-muted-foreground shadow-2xs mb-3.5 transition-transform group-hover:scale-105">
          <UploadCloud className="size-5 text-foreground/80" />
        </div>
        <h4 className="text-sm font-semibold text-foreground m-0">
          {isDragging ? copy.dragActive : (label ?? copy.dragTitle)}
        </h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
          {copy.formats}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-4 gap-1.5 pointer-events-none"
          tabIndex={-1}
        >
          <ImagePlus className="size-3.5" />
          <span>{copy.browse}</span>
        </Button>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        onChange={onFileInputChange}
      />

      {items.length > 0 ? (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
            {copy.results}
          </p>
          <ol aria-label={copy.results} aria-live="polite" className="space-y-2.5">
            {items.map((item) => (
              <UploadItemCard
                key={item.id}
                item={item}
                copy={copy}
                onRetry={() => void runUpload(item.id, item.file, getUploadRetryParts(item))}
                onRemove={() => handleRemove(item.id, item.mediaId)}
              />
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
