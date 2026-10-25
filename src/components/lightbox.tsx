"use client";

import * as React from "react";
import {useTranslations} from "next-intl";

import {PublicPhoto} from "@/components/public-photo";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog";
import type {AlbumPhoto, Locale} from "@/lib/domain";

type Props = {photos: readonly AlbumPhoto[]; locale: Locale};

export function adjacentPhotoIndex(index: number, direction: -1 | 1, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, index + direction));
}

export function shouldSwipe(deltaX: number, deltaY: number, threshold = 50): boolean {
  return Math.abs(deltaX) >= threshold && Math.abs(deltaX) > Math.abs(deltaY);
}

export function LightboxGallery({photos, locale}: Props): React.ReactElement {
  const t = useTranslations();
  const [index, setIndex] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const pointerStart = React.useRef<{x: number; y: number} | null>(null);
  const activePhoto = photos[index];

  const close = (): void => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="grid gap-6 md:grid-cols-2">
        {photos.map((photo, photoIndex) => (
          <Button
            key={photo.media.id}
            type="button"
            variant="ghost"
            className="block min-h-11 min-w-11 w-full h-auto p-0 text-left hover:bg-transparent"
            onClick={(event) => {
              triggerRef.current = event.currentTarget;
              setIndex(photoIndex);
              setOpen(true);
            }}
            aria-label={`${t("actions.openPhoto")} ${photo.media.alt[locale]}`}
          >
            <PublicPhoto asset={photo.media} locale={locale} />
          </Button>
        ))}
      </div>
      {activePhoto ? (
        <DialogContent
          showCloseButton={false}
          className="max-h-[90dvh] max-w-5xl overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setIndex(adjacentPhotoIndex(index, -1, photos.length));
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              setIndex(adjacentPhotoIndex(index, 1, photos.length));
            }
          }}
        >
          <DialogTitle>{activePhoto.media.alt[locale]}</DialogTitle>
          <DialogDescription>{t("a11y.photoPosition", {current: index + 1, total: photos.length})}</DialogDescription>
          <div
            className="touch-pan-y"
            onPointerDown={(event) => {
              pointerStart.current = {x: event.clientX, y: event.clientY};
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={(event) => {
              const start = pointerStart.current;
              pointerStart.current = null;
              if (start && shouldSwipe(event.clientX - start.x, event.clientY - start.y)) {
                setIndex(adjacentPhotoIndex(index, event.clientX < start.x ? 1 : -1, photos.length));
              }
            }}
            onPointerCancel={() => {
              pointerStart.current = null;
            }}
          >
            <PublicPhoto asset={activePhoto.media} locale={locale} large />
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" disabled={index === 0} onClick={() => setIndex(adjacentPhotoIndex(index, -1, photos.length))}>{t("actions.previous")}</Button>
            <Button type="button" variant="outline" onClick={close}>{t("actions.close")}</Button>
            <Button type="button" disabled={index === photos.length - 1} onClick={() => setIndex(adjacentPhotoIndex(index, 1, photos.length))}>{t("actions.next")}</Button>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
