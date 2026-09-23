"use client";

import * as React from "react";

import {MediaPicker} from "@/components/admin/media-picker";
import {Button} from "@/components/ui/button";
import type {AdminAlbum, BilingualText, SiteSettingsDraft} from "@/lib/domain";

type FeaturedAlbum = Pick<AdminAlbum, "id" | "title" | "status">;

export type SettingsFormProps = {
  initialSettings: SiteSettingsDraft;
  featuredAlbums: readonly FeaturedAlbum[];
};

export const emptySiteSettings: SiteSettingsDraft = {
  brandName: "",
  logoMediaId: null,
  logoAlt: {en: "", id: ""},
  heroMediaId: null,
  heroAlt: {en: "", id: ""},
  personalIntroduction: {en: "", id: ""},
  aboutMediaId: null,
  aboutAlt: {en: "", id: ""},
  aboutStory: {en: "", id: ""},
  homeHeadline: {en: "", id: ""},
  homeDescription: {en: "", id: ""},
  services: {
    wedding: {title: {en: "", id: ""}, description: {en: "", id: ""}},
    events: {title: {en: "", id: ""}, description: {en: "", id: ""}},
    other: {title: {en: "", id: ""}, description: {en: "", id: ""}},
  },
  location: {en: "", id: ""},
  serviceArea: {en: "", id: ""},
  instagramUrl: null,
  whatsappNumber: null,
  featuredAlbumIds: [],
};

class SettingsRequestError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & {code?: string};
  if (!response.ok) throw new SettingsRequestError(payload.code ?? "SETTINGS_REQUEST_FAILED");
  return payload;
}

function messageFor(error: unknown): string {
  if (!(error instanceof SettingsRequestError)) return "The settings could not be saved. Try again.";
  if (error.code === "VALIDATION_FAILED") return "Check every required English and Indonesian field, plus the contact links.";
  if (error.code === "FOREIGN_MEDIA_ID") return "One selected media item is no longer available. Choose it again.";
  if (error.code === "FEATURED_ALBUM_NOT_PUBLISHED") return "Only published albums can be featured.";
  return "The settings could not be saved. Try again.";
}

function BilingualFields({
  id,
  label,
  value,
  onChange,
  maxLength,
  multiline = false,
  required = true,
}: {
  id: string;
  label: string;
  value: BilingualText;
  onChange: (next: BilingualText) => void;
  maxLength: number;
  multiline?: boolean;
  required?: boolean;
}): React.ReactElement {
  const Field = multiline ? "textarea" : "input";
  return (
    <fieldset className="grid gap-4 sm:grid-cols-2">
      <legend className="col-span-full text-sm font-medium">{label}</legend>
      <label className="grid gap-2" htmlFor={`${id}-en`}>
        English
        <Field id={`${id}-en`} value={value.en} onChange={(event) => onChange({...value, en: event.currentTarget.value})} maxLength={maxLength} required={required} rows={multiline ? 5 : undefined} />
      </label>
      <label className="grid gap-2" htmlFor={`${id}-id`}>
        Indonesian
        <Field id={`${id}-id`} value={value.id} onChange={(event) => onChange({...value, id: event.currentTarget.value})} maxLength={maxLength} required={required} rows={multiline ? 5 : undefined} />
      </label>
    </fieldset>
  );
}

function ServiceFields({
  name,
  value,
  onChange,
}: {
  name: string;
  value: SiteSettingsDraft["services"]["wedding"];
  onChange: (next: SiteSettingsDraft["services"]["wedding"]) => void;
}): React.ReactElement {
  return (
    <fieldset className="space-y-4 border-t border-[var(--line)] pt-5">
      <legend className="font-serif text-2xl">{name}</legend>
      <BilingualFields id={`service-${name.toLowerCase().replaceAll(" ", "-")}-title`} label="Service title" value={value.title} onChange={(title) => onChange({...value, title})} maxLength={5000} />
      <BilingualFields id={`service-${name.toLowerCase().replaceAll(" ", "-")}-description`} label="Service description" value={value.description} onChange={(description) => onChange({...value, description})} maxLength={5000} multiline />
    </fieldset>
  );
}

export function SettingsForm({initialSettings, featuredAlbums}: SettingsFormProps): React.ReactElement {
  const [form, setForm] = React.useState<SiteSettingsDraft>(initialSettings);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const update = <K extends keyof SiteSettingsDraft>(field: K, value: SiteSettingsDraft[K]): void => {
    setForm((current) => ({...current, [field]: value}));
  };

  const toggleFeatured = (id: string, checked: boolean): void => {
    setForm((current) => ({
      ...current,
      featuredAlbumIds: checked
        ? [...current.featuredAlbumIds, id]
        : current.featuredAlbumIds.filter((albumId) => albumId !== id),
    }));
  };

  const save = async (): Promise<void> => {
    if (pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: {"content-type": "application/json"},
        body: JSON.stringify(form),
      });
      const saved = await readResponse<SiteSettingsDraft>(response);
      setForm(saved);
      setNotice("Website settings saved.");
    } catch (requestError) {
      setError(messageFor(requestError));
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="space-y-8" onSubmit={(event) => {event.preventDefault(); void save();}}>
      <header className="space-y-3">
        <p className="text-sm">Content and contact details</p>
        <h1 className="font-serif text-5xl">Website settings</h1>
        <p className="max-w-2xl">Keep the English and Indonesian content aligned. Empty optional media can use empty alternate text.</p>
      </header>

      <section className="space-y-5 border-t border-[var(--line)] pt-5">
        <h2 className="font-serif text-3xl">Brand</h2>
        <label className="grid max-w-xl gap-2" htmlFor="settings-brand-name">Brand name<input id="settings-brand-name" value={form.brandName} onChange={(event) => update("brandName", event.currentTarget.value)} maxLength={160} required /></label>
        <MediaPicker label="Logo" value={form.logoMediaId} alt={form.logoAlt} onChange={(logoMediaId) => update("logoMediaId", logoMediaId)} />
        <BilingualFields id="settings-logo-alt" label="Logo alternate text" value={form.logoAlt} onChange={(logoAlt) => update("logoAlt", logoAlt)} maxLength={200} required={form.logoMediaId !== null} />
      </section>

      <section className="space-y-5 border-t border-[var(--line)] pt-5">
        <h2 className="font-serif text-3xl">Home</h2>
        <MediaPicker label="Hero photo" value={form.heroMediaId} alt={form.heroAlt} onChange={(heroMediaId) => update("heroMediaId", heroMediaId)} />
        <BilingualFields id="settings-hero-alt" label="Hero photo alternate text" value={form.heroAlt} onChange={(heroAlt) => update("heroAlt", heroAlt)} maxLength={200} required={form.heroMediaId !== null} />
        <BilingualFields id="settings-home-headline" label="Home headline" value={form.homeHeadline} onChange={(homeHeadline) => update("homeHeadline", homeHeadline)} maxLength={5000} />
        <BilingualFields id="settings-home-description" label="Home description" value={form.homeDescription} onChange={(homeDescription) => update("homeDescription", homeDescription)} maxLength={5000} multiline />
        <BilingualFields id="settings-introduction" label="Personal introduction" value={form.personalIntroduction} onChange={(personalIntroduction) => update("personalIntroduction", personalIntroduction)} maxLength={5000} multiline />
      </section>

      <section className="space-y-5 border-t border-[var(--line)] pt-5">
        <h2 className="font-serif text-3xl">About</h2>
        <MediaPicker label="About photo" value={form.aboutMediaId} alt={form.aboutAlt} onChange={(aboutMediaId) => update("aboutMediaId", aboutMediaId)} />
        <BilingualFields id="settings-about-alt" label="About photo alternate text" value={form.aboutAlt} onChange={(aboutAlt) => update("aboutAlt", aboutAlt)} maxLength={200} required={form.aboutMediaId !== null} />
        <BilingualFields id="settings-about-story" label="About story" value={form.aboutStory} onChange={(aboutStory) => update("aboutStory", aboutStory)} maxLength={5000} multiline />
      </section>

      <section className="space-y-5">
        <h2 className="font-serif text-3xl">Services</h2>
        <ServiceFields name="Wedding" value={form.services.wedding} onChange={(wedding) => update("services", {...form.services, wedding})} />
        <ServiceFields name="Events" value={form.services.events} onChange={(events) => update("services", {...form.services, events})} />
        <ServiceFields name="Other photography" value={form.services.other} onChange={(other) => update("services", {...form.services, other})} />
      </section>

      <section className="space-y-5 border-t border-[var(--line)] pt-5">
        <h2 className="font-serif text-3xl">Location and contact</h2>
        <BilingualFields id="settings-location" label="Location" value={form.location} onChange={(location) => update("location", location)} maxLength={5000} />
        <BilingualFields id="settings-service-area" label="Service area" value={form.serviceArea} onChange={(serviceArea) => update("serviceArea", serviceArea)} maxLength={5000} />
        <label className="grid max-w-xl gap-2" htmlFor="settings-instagram">Instagram URL<input id="settings-instagram" type="url" value={form.instagramUrl ?? ""} onChange={(event) => update("instagramUrl", event.currentTarget.value || null)} placeholder="https://instagram.com/your-profile" /></label>
        <label className="grid max-w-xl gap-2" htmlFor="settings-whatsapp">WhatsApp number<input id="settings-whatsapp" type="tel" value={form.whatsappNumber ?? ""} onChange={(event) => update("whatsappNumber", event.currentTarget.value || null)} placeholder="Your WhatsApp number" maxLength={32} /></label>
      </section>

      <section className="space-y-4 border-t border-[var(--line)] pt-5">
        <div>
          <h2 className="font-serif text-3xl">Featured albums</h2>
          <p className="mt-2">Only published albums can appear in Selected Stories.</p>
        </div>
        {featuredAlbums.length === 0 ? <p>No albums are available yet. Create and publish an album first.</p> : (
          <fieldset className="grid gap-3">
            <legend className="sr-only">Published albums</legend>
            {featuredAlbums.map((album) => (
              <label key={album.id} className="flex min-h-11 items-center gap-3">
                <input type="checkbox" checked={form.featuredAlbumIds.includes(album.id)} onChange={(event) => toggleFeatured(album.id, event.currentTarget.checked)} disabled={album.status !== "published"} />
                <span>{album.title.en} <span className="text-sm">({album.status === "published" ? "Published" : "Draft"})</span></span>
              </label>
            ))}
          </fieldset>
        )}
      </section>

      {error ? <p role="alert" aria-live="polite">{error}</p> : null}
      {notice ? <p role="status" aria-live="polite">{notice}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Saving" : "Save settings"}</Button>
    </form>
  );
}
