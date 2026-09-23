"use client";

import * as React from "react";
import {useRouter} from "next/navigation";

import {MediaPicker} from "@/components/admin/media-picker";
import {AlbumPhotoList, type AlbumPhotoDraft} from "@/components/admin/album-photo-list";
import {ApiFailure, readResponse, saveAlbum, SaveConsistencyError} from "@/components/admin/album-save";
import {Button} from "@/components/ui/button";
import type {AdminAlbum, AlbumCategory, BilingualText} from "@/lib/domain";

type AlbumForm = {
  slug: string;
  category: AlbumCategory;
  title: BilingualText;
  story: BilingualText;
  coverMediaId: string | null;
  sortOrder: number;
  photos: AlbumPhotoDraft[];
};

function formFromAlbum(album: AdminAlbum | null): AlbumForm {
  if (!album) return {slug: "", category: "wedding", title: {en: "", id: ""}, story: {en: "", id: ""}, coverMediaId: null, sortOrder: 0, photos: []};
  return {
    slug: album.slug,
    category: album.category,
    title: album.title,
    story: album.story,
    coverMediaId: album.coverMediaId,
    sortOrder: album.sortOrder,
    photos: album.photos.map((photo) => ({mediaId: photo.media.id, position: photo.position, alt: photo.media.alt, cloudName: photo.media.cloudName, publicId: photo.media.publicId, width: photo.media.width, height: photo.media.height})),
  };
}

function messageFor(error: unknown): string {
  if (error instanceof SaveConsistencyError) return "The save failed and the previous album could not be restored. Refresh before trying again.";
  if (!(error instanceof ApiFailure)) return "The request could not be completed. Try again.";
  if (error.code === "PUBLISHED_ALBUM_INVALID") return "Unpublish this album before making an edit that would leave it incomplete.";
  if (error.code === "ALBUM_VERSION_CONFLICT") return "This album changed elsewhere. Reload it before saving again.";
  if (error.code === "ALBUM_MUST_BE_UNPUBLISHED") return "Move the album to draft before deleting it.";
  if (error.code === "FOREIGN_MEDIA_ID") return "That media item is not available to this album.";
  if (error.code === "COVER_MEDIA_NOT_IN_ALBUM") return "Choose a cover photo that is included in the album.";
  if (error.code === "ALBUM_SLUG_EXISTS") return "An album with this slug already exists.";
  if (error.code === "DUPLICATE_MEDIA_ID") return "A photo appears more than once.";
  if (error.code === "VALIDATION_FAILED") return "Check the album fields and photo alternate text.";
  return "The request could not be completed. Try again.";
}

export function AlbumEditor({initialAlbum}: {initialAlbum: AdminAlbum | null}): React.ReactElement {
  const router = useRouter();
  const [form, setForm] = React.useState<AlbumForm>(() => formFromAlbum(initialAlbum));
  const [committedAlbum, setCommittedAlbum] = React.useState<AdminAlbum | null>(initialAlbum);
  const [status, setStatus] = React.useState<"draft" | "published">(initialAlbum?.status ?? "draft");
  const [albumId, setAlbumId] = React.useState<string | null>(initialAlbum?.id ?? null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const updateBilingual = (field: "title" | "story", locale: "en" | "id", value: string): void => {
    setForm((current) => ({...current, [field]: {...current[field], [locale]: value}}));
  };

  const addPhoto = (mediaId: string | null): void => {
    if (!mediaId) return;
    setForm((current) => current.photos.some((photo) => photo.mediaId === mediaId) ? current : {
      ...current,
      photos: [...current.photos, {mediaId, position: current.photos.length, alt: {en: "", id: ""}}],
      coverMediaId: current.coverMediaId ?? mediaId,
    });
  };

  const selectCover = (mediaId: string | null): void => {
    if (!mediaId) {
      setForm((current) => ({...current, coverMediaId: null}));
      return;
    }
    setForm((current) => current.photos.some((photo) => photo.mediaId === mediaId) ? {...current, coverMediaId: mediaId} : {
      ...current,
      coverMediaId: mediaId,
      photos: [...current.photos, {mediaId, position: current.photos.length, alt: {en: "", id: ""}}],
    });
  };

  const save = async (): Promise<void> => {
    if (pending) return;
    if (form.photos.some((photo) => !photo.alt.en.trim() || !photo.alt.id.trim())) {
      setError("Add English and Indonesian alternate text for every photo.");
      return;
    }
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await saveAlbum({
        albumId,
        metadata: {slug: form.slug, category: form.category, title: form.title, story: form.story, coverMediaId: form.coverMediaId, sortOrder: form.sortOrder},
        photos: form.photos.map(({mediaId, position, alt}) => ({mediaId, position, alt})),
        previousAlbum: committedAlbum,
      });
      setAlbumId(updated.id);
      setStatus(updated.status);
      setForm(formFromAlbum(updated));
      setCommittedAlbum(updated);
      setNotice("Album saved.");
      if (!albumId) router.push(`/admin/albums/${updated.id}`);
    } catch (requestError) {
      setError(messageFor(requestError));
    } finally {
      setPending(false);
    }
  };

  const changePublication = async (published: boolean): Promise<void> => {
    if (!albumId || !committedAlbum || pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/albums/${albumId}/publish`, {
        method: "POST",
        headers: {"content-type": "application/json", "if-unmodified-since": committedAlbum.updatedAt},
        body: JSON.stringify({published}),
      });
      const updated = await readResponse<AdminAlbum>(response);
      setStatus(updated.status);
      setForm(formFromAlbum(updated));
      setCommittedAlbum(updated);
      setNotice(published ? "Album published." : "Album moved to draft.");
    } catch (requestError) {
      setError(messageFor(requestError));
    } finally {
      setPending(false);
    }
  };

  const removeAlbum = async (): Promise<void> => {
    if (!albumId || !committedAlbum || pending || !window.confirm("Delete this album?")) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/albums/${albumId}`, {method: "DELETE", headers: {"if-unmodified-since": committedAlbum.updatedAt}});
      await readResponse<{ok: true}>(response);
      router.push("/admin/albums");
    } catch (requestError) {
      setError(messageFor(requestError));
      setPending(false);
    }
  };

  const coverAlt = form.photos.find((photo) => photo.mediaId === form.coverMediaId)?.alt ?? {en: "", id: ""};

  return (
    <form className="space-y-6" onSubmit={(event) => {event.preventDefault(); void save();}}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm">Status: {status === "published" ? "Published" : "Draft"}</p>
          <h1 className="mt-2 font-serif text-4xl">{albumId ? "Edit album" : "Create album"}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {albumId ? <Button type="button" variant="outline" onClick={() => void changePublication(status !== "published")} disabled={pending}>{status === "published" ? "Move to draft" : "Publish"}</Button> : null}
          {albumId ? <Button type="button" variant="outline" onClick={() => void removeAlbum()} disabled={pending}>Delete album</Button> : null}
        </div>
      </div>
      <div className="grid gap-5 border-t border-[var(--line)] pt-5">
        <label className="grid gap-2" htmlFor="album-slug">Slug<input id="album-slug" value={form.slug} onChange={(event) => setForm({...form, slug: event.currentTarget.value})} placeholder="wedding-story" maxLength={120} required /></label>
        <label className="grid gap-2" htmlFor="album-category">Category<select id="album-category" value={form.category} onChange={(event) => setForm({...form, category: event.currentTarget.value as AlbumCategory})}><option value="wedding">Wedding</option><option value="events">Events</option><option value="other">Other photography</option></select></label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2" htmlFor="album-title-en">English title<input id="album-title-en" value={form.title.en} onChange={(event) => updateBilingual("title", "en", event.currentTarget.value)} maxLength={160} required /></label>
          <label className="grid gap-2" htmlFor="album-title-id">Indonesian title<input id="album-title-id" value={form.title.id} onChange={(event) => updateBilingual("title", "id", event.currentTarget.value)} maxLength={160} required /></label>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2" htmlFor="album-story-en">English story<textarea id="album-story-en" value={form.story.en} onChange={(event) => updateBilingual("story", "en", event.currentTarget.value)} maxLength={5000} rows={6} required /></label>
          <label className="grid gap-2" htmlFor="album-story-id">Indonesian story<textarea id="album-story-id" value={form.story.id} onChange={(event) => updateBilingual("story", "id", event.currentTarget.value)} maxLength={5000} rows={6} required /></label>
        </div>
        <label className="grid max-w-xs gap-2" htmlFor="album-sort-order">Display order<input id="album-sort-order" type="number" min={0} max={10000} step={1} value={form.sortOrder} onChange={(event) => setForm({...form, sortOrder: Number(event.currentTarget.value)})} required /></label>
      </div>
      <MediaPicker label="Add photo" value={null} onChange={addPhoto} alt={{en: "", id: ""}} />
      <AlbumPhotoList photos={form.photos} onChange={(photos) => setForm({...form, photos, coverMediaId: form.coverMediaId && photos.some((photo) => photo.mediaId === form.coverMediaId) ? form.coverMediaId : null})} />
      <MediaPicker label="Cover photo" value={form.coverMediaId} onChange={selectCover} alt={coverAlt} />
      {error ? <p role="alert" aria-live="polite">{error}</p> : null}
      {notice ? <p role="status" aria-live="polite">{notice}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Saving" : "Save changes"}</Button>
    </form>
  );
}
