"use client";

import * as React from "react";
import {toast} from "sonner";
import {useRouter} from "next/navigation";

import {CloudinaryImage} from "@/components/cloudinary-image";
import {MediaPickerDialog} from "@/components/admin/media-picker-dialog";
import {AlbumPhotoList, type AlbumPhotoDraft} from "@/components/admin/album-photo-list";
import {ApiFailure, readResponse, saveAlbum, SaveConsistencyError} from "@/components/admin/album-save";
import {Button} from "@/components/ui/button";
import {FormErrorMessage} from "@/components/ui/form";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Textarea} from "@/components/ui/textarea";
import {albumEditorSchema, validateWithZod} from "@/lib/form-validation";
import type {AdminAlbum, AdminMediaAsset, AlbumCategory, BilingualText} from "@/lib/domain";
import {cn} from "@/lib/utils";
import {ImageIcon, ImagePlus} from "lucide-react";

type AlbumForm = {
  slug: string;
  category: AlbumCategory;
  title: BilingualText;
  story: BilingualText;
  location: BilingualText;
  coverMediaId: string | null;
  sortOrder: number;
  photos: AlbumPhotoDraft[];
};

function formFromAlbum(album: AdminAlbum | null): AlbumForm {
  if (!album) return {slug: "", category: "wedding", title: {en: "", id: ""}, story: {en: "", id: ""}, location: {en: "", id: ""}, coverMediaId: null, sortOrder: 0, photos: []};
  return {
    slug: album.slug,
    category: album.category,
    title: album.title,
    story: album.story,
    location: album.location,
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
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = React.useState("general");
  const [coverPickerOpen, setCoverPickerOpen] = React.useState(false);
  const [photoPickerOpen, setPhotoPickerOpen] = React.useState(false);

  React.useEffect(() => {
    setForm(formFromAlbum(initialAlbum));
    setCommittedAlbum(initialAlbum);
    setStatus(initialAlbum?.status ?? "draft");
    setAlbumId(initialAlbum?.id ?? null);
    setErrors({});
    setActiveTab("general");
  }, [initialAlbum]);

  const generalErrorCount = ["slug", "category", "title.en", "title.id", "story.en", "story.id", "sortOrder"].filter((key) => Boolean(errors[key])).length;
  const photosErrorCount = Object.keys(errors).filter((key) => key.startsWith("photos") || key === "photos").length;
  const coverErrorCount = Boolean(errors.coverMediaId) ? 1 : 0;

  const clearError = (key: string): void => {
    if (errors[key]) setErrors((prev) => ({...prev, [key]: ""}));
  };

  const updateBilingual = (field: "title" | "story" | "location", locale: "en" | "id", value: string): void => {
    setForm((current) => ({...current, [field]: {...current[field], [locale]: value}}));
    clearError(`${field}.${locale}`);
  };

  const addPhoto = (mediaId: string | null, asset?: AdminMediaAsset): void => {
    if (!mediaId) return;
    setForm((current) => current.photos.some((photo) => photo.mediaId === mediaId) ? current : {
      ...current,
      photos: [
        ...current.photos,
        {
          mediaId,
          position: current.photos.length,
          alt: {en: "", id: ""},
          cloudName: asset?.cloudName,
          publicId: asset?.publicId,
          width: asset?.width,
          height: asset?.height,
        },
      ],
      coverMediaId: current.coverMediaId ?? mediaId,
    });
  };

  const addPhotos = (assets: AdminMediaAsset[]): void => {
    if (assets.length === 0) return;
    setForm((current) => {
      let updatedPhotos = [...current.photos];
      let coverId = current.coverMediaId;
      for (const asset of assets) {
        if (!updatedPhotos.some((photo) => photo.mediaId === asset.id)) {
          updatedPhotos.push({
            mediaId: asset.id,
            position: updatedPhotos.length,
            alt: {en: "", id: ""},
            cloudName: asset.cloudName,
            publicId: asset.publicId,
            width: asset.width,
            height: asset.height,
          });
          if (!coverId) coverId = asset.id;
        }
      }
      return {...current, photos: updatedPhotos, coverMediaId: coverId};
    });
  };

  const selectCover = (mediaId: string | null, asset?: AdminMediaAsset): void => {
    if (!mediaId) {
      setForm((current) => ({...current, coverMediaId: null}));
      return;
    }
    setForm((current) => {
      const existing = current.photos.find((photo) => photo.mediaId === mediaId);
      if (existing) {
        return {...current, coverMediaId: mediaId};
      }
      return {
        ...current,
        coverMediaId: mediaId,
        photos: [
          ...current.photos,
          {
            mediaId,
            position: current.photos.length,
            alt: {en: "", id: ""},
            cloudName: asset?.cloudName,
            publicId: asset?.publicId,
            width: asset?.width,
            height: asset?.height,
          },
        ],
      };
    });
  };

  const save = async (): Promise<void> => {
    if (pending) return;
    const validation = validateWithZod(albumEditorSchema, form);
    if (!validation.ok) {
      setErrors(validation.errors);
      toast.error("Please check the highlighted fields below.");
      const errKeys = Object.keys(validation.errors);
      if (errKeys.some((k) => ["slug", "category", "title.en", "title.id", "story.en", "story.id", "sortOrder"].includes(k))) {
        setActiveTab("general");
      } else if (errKeys.some((k) => k.startsWith("photos") || k === "photos")) {
        setActiveTab("photos");
      } else if (errKeys.includes("coverMediaId")) {
        setActiveTab("cover");
      }
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const updated = await saveAlbum({
        albumId,
        metadata: {slug: form.slug, category: form.category, title: form.title, story: form.story, location: form.location, coverMediaId: form.coverMediaId, sortOrder: form.sortOrder},
        photos: form.photos.map(({mediaId, position, alt}) => ({mediaId, position, alt})),
        previousAlbum: committedAlbum,
      });
      setAlbumId(updated.id);
      setStatus(updated.status);
      setForm(formFromAlbum(updated));
      setCommittedAlbum(updated);
      toast.success("Album saved.");
      if (!albumId) router.push(`/admin/albums/${updated.id}`);
    } catch (requestError) {
      toast.error(messageFor(requestError));
    } finally {
      setPending(false);
    }
  };

  const changePublication = async (published: boolean): Promise<void> => {
    if (!albumId || !committedAlbum || pending) return;
    setPending(true);
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
      toast.success(published ? "Album published." : "Album moved to draft.");
    } catch (requestError) {
      toast.error(messageFor(requestError));
    } finally {
      setPending(false);
    }
  };

  const removeAlbum = async (): Promise<void> => {
    if (!albumId || !committedAlbum || pending || !window.confirm("Delete this album?")) return;
    setPending(true);
    try {
      const response = await fetch(`/api/admin/albums/${albumId}`, {method: "DELETE", headers: {"if-unmodified-since": committedAlbum.updatedAt}});
      await readResponse<{ok: true}>(response);
      router.push("/admin/albums");
    } catch (requestError) {
      toast.error(messageFor(requestError));
      setPending(false);
    }
  };

  const coverPhoto = form.photos.find((photo) => photo.mediaId === form.coverMediaId);
  const coverAlt = coverPhoto?.alt ?? {en: "", id: ""};

  return (
    <form
      className="admin-form flex flex-1 flex-col space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      noValidate
    >
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--charcoal)] sm:text-3xl m-0">
          {albumId ? "Edit album" : "Create album"}
        </h1>
        {albumId ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide border",
              status === "published"
                ? "bg-emerald-500/10 text-emerald-800 border-emerald-600/20"
                : "bg-amber-500/10 text-amber-800 border-amber-600/20"
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                status === "published" ? "bg-emerald-600" : "bg-amber-600"
              )}
            />
            <span>{status === "published" ? "Published" : "Draft"}</span>
          </span>
        ) : null}
      </header>
      <Tabs value={activeTab} onValueChange={setActiveTab} variant="line" className="w-full space-y-6 flex-1 flex flex-col">
        <TabsList variant="line">
          <TabsTrigger value="general">
            <span>General info</span>
            {generalErrorCount > 0 ? (
              <span className="size-1.5 rounded-full bg-destructive" aria-label={`${generalErrorCount} errors`} />
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="photos">
            <span>Photos</span>
            <span className="rounded-full bg-muted/80 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {form.photos.length}
            </span>
            {photosErrorCount > 0 ? (
              <span className="size-1.5 rounded-full bg-destructive" aria-label={`${photosErrorCount} errors`} />
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="cover">
            <span>Cover & Status</span>
            {coverErrorCount > 0 ? (
              <span className="size-1.5 rounded-full bg-destructive" aria-label="Error in cover photo" />
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" forceMount className="data-[state=inactive]:hidden space-y-5 outline-none flex-1">
          <div className="grid gap-1 max-w-xl">
            <div className="contact-field"><Input id="album-slug" value={form.slug} onChange={(event) => {setForm({...form, slug: event.currentTarget.value}); clearError("slug");}} placeholder="wedding-story" maxLength={120} aria-invalid={Boolean(errors.slug)} aria-describedby={errors.slug ? "album-slug-error" : undefined} required /><Label className="contact-field__label" htmlFor="album-slug">Slug</Label></div>
            <FormErrorMessage id="album-slug-error" message={errors.slug} />
          </div>
          <div className="contact-field" data-floating="true">
            <Select value={form.category} onValueChange={(category) => setForm({...form, category: category as AlbumCategory})}>
              <SelectTrigger id="album-category" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="wedding">Wedding</SelectItem>
                <SelectItem value="events">Events</SelectItem>
                <SelectItem value="other">Other photography</SelectItem>
              </SelectContent>
            </Select>
            <Label className="contact-field__label" htmlFor="album-category">Category</Label>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-1">
              <div className="contact-field"><Input id="album-title-en" placeholder=" " value={form.title.en} onChange={(event) => updateBilingual("title", "en", event.currentTarget.value)} maxLength={160} aria-invalid={Boolean(errors["title.en"])} aria-describedby={errors["title.en"] ? "album-title-en-error" : undefined} required /><Label className="contact-field__label" htmlFor="album-title-en">English title</Label></div>
              <FormErrorMessage id="album-title-en-error" message={errors["title.en"]} />
            </div>
            <div className="grid gap-1">
              <div className="contact-field"><Input id="album-title-id" placeholder=" " value={form.title.id} onChange={(event) => updateBilingual("title", "id", event.currentTarget.value)} maxLength={160} aria-invalid={Boolean(errors["title.id"])} aria-describedby={errors["title.id"] ? "album-title-id-error" : undefined} required /><Label className="contact-field__label" htmlFor="album-title-id">Indonesian title</Label></div>
              <FormErrorMessage id="album-title-id-error" message={errors["title.id"]} />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-1">
              <div className="contact-field contact-field--textarea"><Textarea id="album-story-en" placeholder=" " value={form.story.en} onChange={(event) => updateBilingual("story", "en", event.currentTarget.value)} maxLength={5000} rows={6} aria-invalid={Boolean(errors["story.en"])} aria-describedby={errors["story.en"] ? "album-story-en-error" : undefined} required /><Label className="contact-field__label" htmlFor="album-story-en">English story</Label></div>
              <FormErrorMessage id="album-story-en-error" message={errors["story.en"]} />
            </div>
            <div className="grid gap-1">
              <div className="contact-field contact-field--textarea"><Textarea id="album-story-id" placeholder=" " value={form.story.id} onChange={(event) => updateBilingual("story", "id", event.currentTarget.value)} maxLength={5000} rows={6} aria-invalid={Boolean(errors["story.id"])} aria-describedby={errors["story.id"] ? "album-story-id-error" : undefined} required /><Label className="contact-field__label" htmlFor="album-story-id">Indonesian story</Label></div>
              <FormErrorMessage id="album-story-id-error" message={errors["story.id"]} />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-1">
              <div className="contact-field"><Input id="album-location-en" placeholder=" " value={form.location.en} onChange={(event) => updateBilingual("location", "en", event.currentTarget.value)} maxLength={160} aria-invalid={Boolean(errors["location.en"])} aria-describedby={errors["location.en"] ? "album-location-en-error" : undefined} /><Label className="contact-field__label" htmlFor="album-location-en">English location</Label></div>
              <FormErrorMessage id="album-location-en-error" message={errors["location.en"]} />
            </div>
            <div className="grid gap-1">
              <div className="contact-field"><Input id="album-location-id" placeholder=" " value={form.location.id} onChange={(event) => updateBilingual("location", "id", event.currentTarget.value)} maxLength={160} aria-invalid={Boolean(errors["location.id"])} aria-describedby={errors["location.id"] ? "album-location-id-error" : undefined} /><Label className="contact-field__label" htmlFor="album-location-id">Indonesian location</Label></div>
              <FormErrorMessage id="album-location-id-error" message={errors["location.id"]} />
            </div>
          </div>
          <div className="grid gap-1 max-w-xs">
            <div className="contact-field"><Input id="album-sort-order" type="number" min={0} max={10000} step={1} placeholder=" " value={form.sortOrder} onChange={(event) => {setForm({...form, sortOrder: Number(event.currentTarget.value)}); clearError("sortOrder");}} aria-invalid={Boolean(errors.sortOrder)} aria-describedby={errors.sortOrder ? "album-sort-order-error" : undefined} required /><Label className="contact-field__label" htmlFor="album-sort-order">Display order</Label></div>
            <FormErrorMessage id="album-sort-order-error" message={errors.sortOrder} />
          </div>
        </TabsContent>

        <TabsContent value="photos" forceMount className="data-[state=inactive]:hidden space-y-6 outline-none flex-1">
          <AlbumPhotoList
            photos={form.photos}
            coverMediaId={form.coverMediaId}
            onSetCover={(mediaId) => selectCover(mediaId, form.photos.find((photo) => photo.mediaId === mediaId) as unknown as AdminMediaAsset)}
            onAddPhoto={() => setPhotoPickerOpen(true)}
            onChange={(photos) => setForm({...form, photos, coverMediaId: form.coverMediaId && photos.some((photo) => photo.mediaId === form.coverMediaId) ? form.coverMediaId : null})}
          />
        </TabsContent>

        <TabsContent value="cover" forceMount className="data-[state=inactive]:hidden space-y-6 outline-none flex-1">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start py-1">
            {/* Left Column: Cover Preview */}
            <div className="md:col-span-5">
              {coverPhoto && coverPhoto.cloudName && coverPhoto.publicId ? (
                <div className="relative group overflow-hidden rounded-xl border border-border bg-muted aspect-4/3 shadow-xs">
                  <CloudinaryImage
                    asset={{
                      cloudName: coverPhoto.cloudName,
                      publicId: coverPhoto.publicId,
                      width: coverPhoto.width ?? 800,
                      height: coverPhoto.height ?? 600,
                    }}
                    alt={coverAlt.en || coverAlt.id || "Cover preview"}
                    sizes="(min-width: 768px) 35vw, 90vw"
                    className="size-full object-cover"
                  />
                  <div className="absolute top-2.5 left-2.5">
                    <span className="inline-flex items-center rounded-md bg-black/75 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs">
                      Cover
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setCoverPickerOpen(true)}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 p-8 text-center aspect-4/3 cursor-pointer hover:border-foreground/40 hover:bg-muted/40 transition-colors"
                >
                  <div className="size-11 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
                    <ImageIcon className="size-5" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No cover photo selected</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                    Click here or use the button on the right to select a cover.
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: Actions & Status */}
            <div className="md:col-span-7 space-y-5">
              <div className="rounded-xl border border-border p-5 bg-card space-y-3.5 shadow-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setCoverPickerOpen(true)}
                    className="gap-1.5"
                  >
                    <ImagePlus className="size-4" />
                    <span>{form.coverMediaId ? "Change cover photo" : "Choose cover photo"}</span>
                  </Button>
                  {form.coverMediaId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => selectCover(null)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      Remove cover
                    </Button>
                  ) : null}
                </div>

                {form.photos.length > 0 ? (
                  <div className="pt-3 border-t border-border/60">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Or select from existing album photos:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {form.photos.map((photo, index) => {
                        const isCover = photo.mediaId === form.coverMediaId;
                        return (
                          <button
                            key={photo.mediaId}
                            type="button"
                            onClick={() => selectCover(photo.mediaId, photo as unknown as AdminMediaAsset)}
                            className={cn(
                              "relative size-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isCover
                                ? "border-foreground ring-2 ring-primary/20 scale-105"
                                : "border-border hover:border-foreground/50 opacity-75 hover:opacity-100"
                            )}
                            title={`Select photo #${index + 1} as cover`}
                          >
                            {photo.cloudName && photo.publicId ? (
                              <CloudinaryImage
                                asset={{
                                  cloudName: photo.cloudName,
                                  publicId: photo.publicId,
                                  width: photo.width ?? 120,
                                  height: photo.height ?? 120,
                                }}
                                alt=""
                                sizes="48px"
                                className="size-full object-cover"
                              />
                            ) : (
                              <span className="size-full flex items-center justify-center text-[10px] bg-muted font-mono">
                                #{index + 1}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-border p-5 bg-card space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-foreground m-0">Publication status</h3>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide border",
                      status === "published"
                        ? "bg-emerald-500/10 text-emerald-800 border-emerald-600/20"
                        : "bg-amber-500/10 text-amber-800 border-amber-600/20"
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        status === "published" ? "bg-emerald-600" : "bg-amber-600"
                      )}
                    />
                    <span>{status === "published" ? "Published" : "Draft"}</span>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed m-0">
                  {status === "published"
                    ? "This album is currently published and visible to the public in your portfolio."
                    : "This album is saved as a draft and is only visible to administrators."}
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      {/* Flexible spacer: on a short panel it absorbs the leftover height so the footer lands on the
          panel floor; on a tall panel it collapses to zero and the footer follows the content. */}
      <div aria-hidden="true" className="flex-1" />

      <footer className="-mx-4 sm:-mx-5 border-t border-border px-4 py-1.5 sm:py-2 sm:px-5 bg-background rounded-b-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            type="submit"
            disabled={pending}
            className="px-4"
          >
            {pending ? "Saving" : (albumId ? "Save changes" : "Create album")}
          </Button>
          {albumId ? (
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => void changePublication(status !== "published")}
              disabled={pending}
            >
              {status === "published" ? "Move to draft" : "Publish"}
            </Button>
          ) : null}
        </div>
        {albumId ? (
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={() => void removeAlbum()}
            disabled={pending}
            className="text-destructive hover:bg-destructive/10"
          >
            Delete album
          </Button>
        ) : null}
      </footer>

      <MediaPickerDialog
        open={coverPickerOpen}
        onOpenChange={setCoverPickerOpen}
        title="Select cover photo"
        description="Choose a photograph to represent this album as its cover."
        selectedId={form.coverMediaId}
        onSelect={(mediaId, asset) => selectCover(mediaId, asset)}
        confirmLabel="Use as cover"
      />

      <MediaPickerDialog
        open={photoPickerOpen}
        onOpenChange={setPhotoPickerOpen}
        title="Add photos to album"
        description="Choose a photograph from your media library or upload a new one to add to this album."
        onSelect={(mediaId, asset) => addPhoto(mediaId, asset)}
        onSelectMultiple={(assets) => addPhotos(assets)}
        confirmLabel="Add to album"
      />
    </form>
  );
}
