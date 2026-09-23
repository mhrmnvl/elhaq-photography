"use client";

import * as React from "react";

import {CloudinaryImage} from "@/components/cloudinary-image";
import {MediaUpload} from "@/components/admin/media-upload";
import {Button} from "@/components/ui/button";
import type {BilingualText, AdminMediaAsset} from "@/lib/domain";

export type MediaPickerProps = {
  label: string;
  value: string | null;
  onChange: (mediaId: string | null) => void;
  alt: BilingualText;
};

type LoadState = "loading" | "ready" | "error";

export function mergeMediaItems(current: readonly AdminMediaAsset[], incoming: readonly AdminMediaAsset[], requestItemIds: ReadonlySet<string>): AdminMediaAsset[] {
  const incomingIds = new Set(incoming.map((item) => item.id));
  return [...incoming, ...current.filter((item) => !requestItemIds.has(item.id) && !incomingIds.has(item.id))];
}

export function MediaPicker({label, value, onChange, alt}: MediaPickerProps): React.ReactElement {
  const headingId = React.useId();
  const [items, setItems] = React.useState<AdminMediaAsset[]>([]);
  const [loadState, setLoadState] = React.useState<LoadState>("loading");
  const itemsRef = React.useRef<AdminMediaAsset[]>([]);
  const requestSequence = React.useRef(0);

  const updateItems = (update: (current: AdminMediaAsset[]) => AdminMediaAsset[]): void => {
    setItems((current) => {
      const next = update(current);
      itemsRef.current = next;
      return next;
    });
  };

  const requestMedia = React.useCallback(async (): Promise<void> => {
    const requestId = ++requestSequence.current;
    const requestItemIds = new Set(itemsRef.current.map((item) => item.id));
    try {
      const response = await fetch("/api/admin/media");
      if (!response.ok) throw new Error(`Media request failed (${response.status})`);
      const data = await response.json() as {items: AdminMediaAsset[]};
      if (requestId !== requestSequence.current) return;
      updateItems((current) => mergeMediaItems(current, data.items, requestItemIds));
      setLoadState("ready");
    } catch {
      if (requestId === requestSequence.current) setLoadState("error");
    }
  }, []);

  const loadMedia = (): void => {
    setLoadState("loading");
    void requestMedia();
  };

  React.useEffect(() => {
    let cancelled = false;
    const requestId = ++requestSequence.current;
    const requestItemIds = new Set(itemsRef.current.map((item) => item.id));
    void fetch("/api/admin/media")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Media request failed (${response.status})`);
        return await response.json() as {items: AdminMediaAsset[]};
      })
      .then((data) => {
        if (cancelled || requestId !== requestSequence.current) return;
        updateItems((current) => mergeMediaItems(current, data.items, requestItemIds));
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled && requestId === requestSequence.current) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = items.find((item) => item.id === value) ?? null;
  const imageAlt = alt.en.trim() || alt.id.trim() || label;

  return (
    <section aria-labelledby={headingId} className="space-y-5 border-t border-[var(--line)] py-5">
      <h2 id={headingId} className="font-serif text-2xl font-normal">{label}</h2>
      {loadState === "loading" ? <p role="status" aria-live="polite">Loading media</p> : null}
      {loadState === "error" ? (
        <div className="space-y-2" role="alert">
          <p>Media could not be loaded.</p>
          <Button type="button" variant="outline" onClick={() => void loadMedia()}>Try again</Button>
        </div>
      ) : null}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Selected</h3>
        <ul aria-label={`${label} selected asset`}>
          {selected ? (
            <li className="flex flex-wrap items-start gap-4">
              <CloudinaryImage asset={selected} alt={imageAlt} sizes="128px" className="h-32 w-32 object-cover" />
              <div className="space-y-2">
                <p className="max-w-xs break-all text-sm">{selected.publicId}</p>
                <Button type="button" variant="outline" onClick={() => onChange(null)}>Remove</Button>
              </div>
            </li>
          ) : <li><p aria-live="polite">No photo selected.</p></li>}
        </ul>
      </div>
      {loadState === "ready" && items.length === 0 ? <p aria-live="polite">No media uploaded yet. Upload a photo to begin.</p> : null}
      {items.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-label={`${label} choices`}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="block min-h-11 w-full border border-[var(--line)] p-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
                aria-pressed={item.id === value}
                onClick={() => onChange(item.id)}
              >
                <CloudinaryImage asset={item} alt={imageAlt} sizes="(min-width: 768px) 25vw, 50vw" className="aspect-square w-full object-cover" />
                <span className="block truncate px-1 py-2 text-xs">{item.publicId}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <MediaUpload onComplete={(media) => { updateItems((current) => [media, ...current.filter((item) => item.id !== media.id)]); onChange(media.id); }} />
    </section>
  );
}
