"use client";

import * as React from "react";

import {CloudinaryImage} from "@/components/cloudinary-image";
import {Button} from "@/components/ui/button";
import type {BilingualText} from "@/lib/domain";

export type AlbumPhotoDraft = {
  mediaId: string;
  position: number;
  alt: BilingualText;
  cloudName?: string;
  publicId?: string;
  width?: number;
  height?: number;
};

type AlbumPhotoListProps = {
  photos: readonly AlbumPhotoDraft[];
  onChange: (photos: AlbumPhotoDraft[]) => void;
};

function withPositions(photos: readonly AlbumPhotoDraft[]): AlbumPhotoDraft[] {
  return photos.map((photo, position) => ({...photo, position}));
}

export function AlbumPhotoList({photos, onChange}: AlbumPhotoListProps): React.ReactElement {
  const move = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(withPositions(next));
  };

  const updateAlt = (index: number, locale: "en" | "id", value: string): void => {
    onChange(photos.map((photo, photoIndex) => photoIndex === index ? {...photo, alt: {...photo.alt, [locale]: value}} : photo));
  };

  const remove = (index: number): void => {
    onChange(withPositions(photos.filter((_, photoIndex) => photoIndex !== index)));
  };

  return (
    <section aria-labelledby="album-photos-heading" className="space-y-5 border-t border-[var(--line)] py-5">
      <h2 id="album-photos-heading" className="font-serif text-2xl">Photos</h2>
      {photos.length === 0 ? <p aria-live="polite">No photos added yet. Use the media picker to add one.</p> : null}
      <ol className="space-y-5">
        {photos.map((photo, index) => (
          <li key={photo.mediaId} className="space-y-4 border border-[var(--line)] p-4">
            <div className="flex flex-wrap items-start gap-4">
              {photo.cloudName && photo.publicId && photo.width && photo.height ? <CloudinaryImage asset={{cloudName: photo.cloudName, publicId: photo.publicId, width: photo.width, height: photo.height}} alt="" sizes="160px" className="h-28 w-40 object-cover" /> : <p className="flex h-28 w-40 items-center justify-center border border-[var(--line)] p-3 text-sm">Selected media</p>}
              <div className="min-w-0 flex-1 space-y-2">
                <p className="break-all text-sm">Media ID: {photo.mediaId}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="min-h-11 min-w-11" aria-label={`Move photo ${index + 1} up`} onClick={() => move(index, -1)} disabled={index === 0}>Up</Button>
                  <Button type="button" variant="outline" className="min-h-11 min-w-11" aria-label={`Move photo ${index + 1} down`} onClick={() => move(index, 1)} disabled={index === photos.length - 1}>Down</Button>
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => remove(index)}>Remove photo</Button>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2" htmlFor={`photo-${photo.mediaId}-en`}>English alt text<input id={`photo-${photo.mediaId}-en`} value={photo.alt.en} onChange={(event) => updateAlt(index, "en", event.currentTarget.value)} maxLength={200} required /></label>
              <label className="grid gap-2" htmlFor={`photo-${photo.mediaId}-id`}>Indonesian alt text<input id={`photo-${photo.mediaId}-id`} value={photo.alt.id} onChange={(event) => updateAlt(index, "id", event.currentTarget.value)} maxLength={200} required /></label>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
