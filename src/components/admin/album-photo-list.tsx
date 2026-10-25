"use client";

import * as React from "react";
import {ChevronDown, ChevronUp, ImageIcon, ImagePlus, Trash2} from "lucide-react";

import {CloudinaryImage} from "@/components/cloudinary-image";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import type {BilingualText} from "@/lib/domain";
import {cn} from "@/lib/utils";

export type AlbumPhotoDraft = {
  mediaId: string;
  position: number;
  alt: BilingualText;
  cloudName?: string;
  publicId?: string;
  width?: number;
  height?: number;
};

export type AlbumPhotoListProps = {
  photos: readonly AlbumPhotoDraft[];
  onChange: (photos: AlbumPhotoDraft[]) => void;
  onAddPhoto?: () => void;
  bordered?: boolean;
  coverMediaId?: string | null;
  onSetCover?: (mediaId: string) => void;
};

function withPositions(photos: readonly AlbumPhotoDraft[]): AlbumPhotoDraft[] {
  return photos.map((photo, position) => ({...photo, position}));
}

export function AlbumPhotoList({
  photos,
  onChange,
  onAddPhoto,
  bordered = false,
  coverMediaId = null,
  onSetCover,
}: AlbumPhotoListProps): React.ReactElement {
  const move = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(withPositions(next));
  };

  const updateAlt = (index: number, locale: "en" | "id", value: string): void => {
    onChange(
      photos.map((photo, photoIndex) =>
        photoIndex === index ? {...photo, alt: {...photo.alt, [locale]: value}} : photo
      )
    );
  };

  const remove = (index: number): void => {
    onChange(withPositions(photos.filter((_, photoIndex) => photoIndex !== index)));
  };

  return (
    <section
      aria-labelledby="album-photos-heading"
      className={cn("space-y-6", bordered && "border-t border-[var(--line)]/25 py-6")}
    >
      {photos.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start py-1">
          {/* Left Column: Preview Placeholder */}
          <div
            onClick={onAddPhoto}
            className="md:col-span-5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 p-8 text-center aspect-4/3 cursor-pointer hover:border-foreground/40 hover:bg-muted/40 transition-colors"
          >
            <div className="size-11 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
              <ImageIcon className="size-5" />
            </div>
            <p className="text-sm font-medium text-foreground">No photos in this album</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
              Photographs you add will appear in your public gallery portfolio.
            </p>
          </div>

          {/* Right Column: Actions */}
          <div className="md:col-span-7 space-y-4">
            <div className="rounded-xl border border-border p-5 bg-card space-y-3 shadow-xs">
              <div>
                <h3 id="album-photos-heading" className="text-base font-semibold text-foreground m-0">
                  Add photos
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-normal">
                  Select pictures from your media library or upload new high-resolution captures.
                </p>
              </div>
              {onAddPhoto ? (
                <Button type="button" size="sm" onClick={onAddPhoto} className="gap-1.5 cursor-pointer">
                  <ImagePlus className="size-4" />
                  <span>Choose from media library</span>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-[var(--line)]/20">
            <div>
              <div className="flex items-center gap-2.5">
                <h2
                  id="album-photos-heading"
                  className="text-base font-semibold tracking-tight text-[var(--charcoal)] m-0"
                >
                  Photos
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/60">
                  {photos.length} {photos.length === 1 ? "photo" : "photos"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Curate the display order and write bilingual alt descriptions for accessibility and SEO.
              </p>
            </div>
            {onAddPhoto ? (
              <Button
                type="button"
                size="sm"
                onClick={onAddPhoto}
                className="gap-1.5 cursor-pointer bg-[var(--charcoal)] text-[var(--ivory)] hover:bg-[var(--charcoal)]/90 shadow-2xs"
              >
                <ImagePlus className="size-4" />
                <span>Add photo</span>
              </Button>
            ) : null}
          </div>

          <ol className="space-y-4">
            {photos.map((photo, index) => {
              const isCover = Boolean(coverMediaId && photo.mediaId === coverMediaId);
              const cleanId = (photo.publicId || photo.mediaId).split("/").pop();

              return (
                <li
                  key={photo.mediaId}
                  className="group relative rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition-all duration-150 hover:border-border hover:shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
                    {/* Thumbnail Preview - clean photo only, no overlays */}
                    <div className="relative size-24 sm:size-28 shrink-0 rounded-lg overflow-hidden border border-border/80 bg-muted/40 group/thumb shadow-2xs">
                      {photo.cloudName && photo.publicId && photo.width && photo.height ? (
                        <CloudinaryImage
                          asset={{
                            cloudName: photo.cloudName,
                            publicId: photo.publicId,
                            width: photo.width,
                            height: photo.height,
                          }}
                          alt=""
                          sizes="(min-width: 640px) 112px, 96px"
                          className="size-full object-cover transition-transform duration-200 group-hover/thumb:scale-105"
                        />
                      ) : (
                        <div className="flex size-full flex-col items-center justify-center p-2 text-center text-xs text-muted-foreground">
                          <ImageIcon className="size-5 mb-1 opacity-60" />
                          <span className="font-mono text-[10px]">#{index + 1}</span>
                        </div>
                      )}
                    </div>

                    {/* Metadata & Controls */}
                    <div className="min-w-0 flex-1 w-full space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border/60">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-xs font-semibold bg-muted text-foreground border border-border/60">
                            #{index + 1}
                          </span>

                          {isCover ? (
                            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-[var(--charcoal)] text-[var(--ivory)] shadow-2xs">
                              Cover photo
                            </span>
                          ) : onSetCover ? (
                            <button
                              type="button"
                              onClick={() => onSetCover(photo.mediaId)}
                              className="inline-flex items-center text-[11px] text-muted-foreground hover:text-foreground hover:underline underline-offset-4 transition-colors cursor-pointer"
                              title="Use this photo as album cover"
                            >
                              Set as cover
                            </button>
                          ) : null}

                          {photo.width && photo.height ? (
                            <span className="hidden sm:inline-block text-[11px] font-mono text-muted-foreground/75">
                              · {photo.width} × {photo.height} px
                            </span>
                          ) : null}

                          <span
                            className="text-[11px] font-mono text-muted-foreground/60 truncate max-w-[140px] sm:max-w-[200px]"
                            title={photo.publicId || photo.mediaId}
                          >
                            · {cleanId}
                          </span>
                        </div>

                        {/* Reorder and Delete Action Cluster */}
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
                          <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5 shadow-2xs">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Move photo ${index + 1} up`}
                              title="Move up"
                              disabled={index === 0}
                              onClick={() => move(index, -1)}
                              className="size-7 rounded-md text-foreground disabled:opacity-25 hover:bg-muted cursor-pointer"
                            >
                              <ChevronUp className="size-4" />
                            </Button>
                            <div className="w-px h-3.5 bg-border/70 my-auto" />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Move photo ${index + 1} down`}
                              title="Move down"
                              disabled={index === photos.length - 1}
                              onClick={() => move(index, 1)}
                              className="size-7 rounded-md text-foreground disabled:opacity-25 hover:bg-muted cursor-pointer"
                            >
                              <ChevronDown className="size-4" />
                            </Button>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove photo ${index + 1}`}
                            title="Remove photo"
                            onClick={() => remove(index)}
                            className="size-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Bilingual Alt Text Inputs */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="contact-field">
                          <Input
                            id={`photo-${photo.mediaId}-en`}
                            placeholder=" "
                            value={photo.alt.en}
                            onChange={(event) => updateAlt(index, "en", event.currentTarget.value)}
                            maxLength={200}
                            required
                          />
                          <Label className="contact-field__label" htmlFor={`photo-${photo.mediaId}-en`}>
                            English alt text
                          </Label>
                        </div>
                        <div className="contact-field">
                          <Input
                            id={`photo-${photo.mediaId}-id`}
                            placeholder=" "
                            value={photo.alt.id}
                            onChange={(event) => updateAlt(index, "id", event.currentTarget.value)}
                            maxLength={200}
                            required
                          />
                          <Label className="contact-field__label" htmlFor={`photo-${photo.mediaId}-id`}>
                            Indonesian alt text
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
