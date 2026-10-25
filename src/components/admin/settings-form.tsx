"use client";

import * as React from "react";
import {ImageIcon, X} from "lucide-react";
import {toast} from "sonner";

import {CloudinaryImage} from "@/components/cloudinary-image";
import {MediaPickerDialog} from "@/components/admin/media-picker-dialog";
import {Button} from "@/components/ui/button";
import {FeaturedAlbumsTable} from "@/components/admin/featured-albums-table";
import {FormErrorMessage} from "@/components/ui/form";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Textarea} from "@/components/ui/textarea";
import {cn} from "@/lib/utils";
import type {AdminAlbum, AdminMediaAsset, BilingualText, SiteSettingsDraft} from "@/lib/domain";
import {emptySiteSettings, settingsScopes, type SettingsScope} from "@/lib/settings-scopes";
import {
  clearDirty,
  fieldErrorsCleared,
  markDirty,
  saveSettingsScopeDraft,
  scopeErrorCount,
  scopeErrorsCleared,
} from "@/components/admin/settings-scope-save";

export {emptySiteSettings};

type FeaturedAlbum = Pick<AdminAlbum, "id" | "title" | "status">;

type MediaField = "logoMediaId" | "heroMediaId" | "aboutMediaId";

// Visual size stays small (dense admin UI); the invisible pseudo-element grows the pointer and
// touch target to 44px tall (WCAG 2.5.5, Apple HIG). Labelled buttons are already wider than
// 44px, so the hit area only expands vertically and cannot overlap the neighbouring control.
const TAP_TARGET = "relative after:absolute after:inset-x-0 after:top-1/2 after:h-[44px] after:-translate-y-1/2 after:content-['']";

const mediaSlots: Record<MediaField, {label: string; frame: string; alt: "logoAlt" | "heroAlt" | "aboutAlt"}> = {
  logoMediaId: {label: "logo", frame: "aspect-square w-full", alt: "logoAlt"},
  heroMediaId: {label: "hero photo", frame: "aspect-4/3 max-w-md w-full", alt: "heroAlt"},
  aboutMediaId: {label: "about photo", frame: "aspect-4/3 max-w-md w-full", alt: "aboutAlt"},
};

function MediaSlot({
  label,
  frame,
  value,
  asset,
  alt,
  onOpen,
  onRemove,
}: {
  label: string;
  frame: string;
  value: string | null;
  asset: AdminMediaAsset | null;
  alt: BilingualText;
  onOpen: () => void;
  onRemove: () => void;
}): React.ReactElement {
  const previewAlt = alt.en.trim() || alt.id.trim() || `${label} preview`;

  if (value) {
    return (
      <div className="relative w-full">
        <div className={cn("group overflow-hidden rounded-xl border border-border bg-muted shadow-xs", frame)}>
          {/* Clicking the picture is the change action; the bottom Save persists it. */}
          <button
            type="button"
            aria-label={`Choose ${label}`}
            onClick={onOpen}
            className="block size-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
          >
            {asset ? (
              <CloudinaryImage
                asset={asset}
                alt={previewAlt}
                sizes="(min-width: 768px) 35vw, 90vw"
                className="size-full object-cover transition-transform duration-200 group-hover:scale-102"
              />
            ) : (
              <span className="flex size-full items-center justify-center p-4 text-center text-sm text-muted-foreground font-mono">
                Selected photo
              </span>
            )}
          </button>
        </div>
        {/* Sits just outside the picture corner, so it is never lost in the image. */}
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className="absolute -right-2 -top-2 z-10 inline-flex size-7 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-destructive shadow-xs transition-colors hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] after:absolute after:inset-x-0 after:top-1/2 after:h-[44px] after:-translate-y-1/2 after:content-['']"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Choose ${label}`}
      onClick={onOpen}
      className={cn(
        "group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 text-center transition-all hover:border-foreground/40 hover:bg-muted/35 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] shrink-0",
        "p-5 sm:p-6 w-full",
        frame
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center rounded-full bg-muted text-muted-foreground transition-transform group-hover:scale-105",
          "size-10 mb-2.5"
        )}
      >
        <ImageIcon className="size-5" />
      </span>
      <span className={cn("font-medium text-foreground", label === "logo" ? "text-sm font-semibold" : "text-sm")}>
        Add {label}
      </span>
      <span className={cn("text-muted-foreground", label === "logo" ? "mt-0.5 text-xs" : "mt-1 text-xs")}>
        Browse or upload
      </span>
    </button>
  );
}

export type SettingsFormProps = {
  initialSettings: SiteSettingsDraft;
  featuredAlbums: readonly FeaturedAlbum[];
  initialScope?: SettingsScope;
};

const scopeLabels: Record<SettingsScope, string> = {
  brand: "Brand",
  home: "Home",
  about: "About",
  services: "Services",
  contact: "Contact",
  featured: "Featured albums",
};

function BilingualFields({
  id,
  label,
  value,
  onChange,
  maxLength,
  multiline = false,
  required = true,
  errorEn,
  errorId,
}: {
  id: string;
  label: string;
  value: BilingualText;
  onChange: (next: BilingualText) => void;
  maxLength: number;
  multiline?: boolean;
  required?: boolean;
  errorEn?: string;
  errorId?: string;
}): React.ReactElement {
  // Two-language pair: the floating label names the language and exactly what the field holds.
  const fieldName = label.toLowerCase();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-1">
        <div className={`contact-field${multiline ? " contact-field--textarea" : ""}`}>
          {multiline ? (
            <Textarea
              id={`${id}-en`}
              placeholder=" "
              value={value.en}
              onChange={(event) => onChange({...value, en: event.currentTarget.value})}
              maxLength={maxLength}
              required={required}
              rows={5}
              aria-invalid={errorEn ? "true" : undefined}
              aria-describedby={errorEn ? `${id}-en-error` : undefined}
            />
          ) : (
            <Input
              id={`${id}-en`}
              placeholder=" "
              value={value.en}
              onChange={(event) => onChange({...value, en: event.currentTarget.value})}
              maxLength={maxLength}
              required={required}
              aria-invalid={errorEn ? "true" : undefined}
              aria-describedby={errorEn ? `${id}-en-error` : undefined}
            />
          )}
          <Label className="contact-field__label" htmlFor={`${id}-en`}>{`English ${fieldName}`}</Label>
        </div>
        <FormErrorMessage id={`${id}-en-error`} message={errorEn} />
      </div>
      <div className="grid gap-1">
        <div className={`contact-field${multiline ? " contact-field--textarea" : ""}`}>
          {multiline ? (
            <Textarea
              id={`${id}-id`}
              placeholder=" "
              value={value.id}
              onChange={(event) => onChange({...value, id: event.currentTarget.value})}
              maxLength={maxLength}
              required={required}
              rows={5}
              aria-invalid={errorId ? "true" : undefined}
              aria-describedby={errorId ? `${id}-id-error` : undefined}
            />
          ) : (
            <Input
              id={`${id}-id`}
              placeholder=" "
              value={value.id}
              onChange={(event) => onChange({...value, id: event.currentTarget.value})}
              maxLength={maxLength}
              required={required}
              aria-invalid={errorId ? "true" : undefined}
              aria-describedby={errorId ? `${id}-id-error` : undefined}
            />
          )}
          <Label className="contact-field__label" htmlFor={`${id}-id`}>{`Indonesian ${fieldName}`}</Label>
        </div>
        <FormErrorMessage id={`${id}-id-error`} message={errorId} />
      </div>
    </div>
  );
}

function ServiceFields({
  name,
  fieldKey,
  value,
  onChange,
  errors = {},
}: {
  name: string;
  fieldKey: "wedding" | "events" | "other";
  value: SiteSettingsDraft["services"]["wedding"];
  onChange: (next: SiteSettingsDraft["services"]["wedding"]) => void;
  errors?: Record<string, string>;
}): React.ReactElement {
  return (
    <div className="space-y-5">
      <BilingualFields
        id={`service-${fieldKey}-title`}
        label={`${name} title`}
        value={value.title}
        onChange={(title) => onChange({...value, title})}
        maxLength={5000}
        errorEn={errors[`services.${fieldKey}.title.en`]}
        errorId={errors[`services.${fieldKey}.title.id`]}
      />
      <BilingualFields
        id={`service-${fieldKey}-description`}
        label={`${name} description`}
        value={value.description}
        onChange={(description) => onChange({...value, description})}
        maxLength={5000}
        multiline
        errorEn={errors[`services.${fieldKey}.description.en`]}
        errorId={errors[`services.${fieldKey}.description.id`]}
      />
    </div>
  );
}

export function SettingsForm({initialSettings, featuredAlbums, initialScope = "brand"}: SettingsFormProps): React.ReactElement {
  const [form, setForm] = React.useState(initialSettings);
  const [activeScope, setActiveScope] = React.useState<SettingsScope>(initialScope);
  const [dirty, setDirty] = React.useState<ReadonlySet<SettingsScope>>(new Set());
  const [savingScope, setSavingScope] = React.useState<SettingsScope | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [assets, setAssets] = React.useState<Record<string, AdminMediaAsset>>({});
  const [pickerField, setPickerField] = React.useState<MediaField | null>(null);

  // Previews need the asset (cloud name, public id). The picker dialog fetches the same
  // endpoint again when it opens, so this map only spares the page an empty first paint.
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/media")
      .then((response) => (response.ok ? (response.json() as Promise<{items: AdminMediaAsset[]}>) : null))
      .then((data) => {
        if (data && !cancelled) setAssets(Object.fromEntries(data.items.map((item) => [item.id, item])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const renderMediaSlot = (field: MediaField): React.ReactElement => (
    <MediaSlot
      label={mediaSlots[field].label}
      frame={mediaSlots[field].frame}
      value={form[field]}
      asset={form[field] ? assets[form[field]] ?? null : null}
      alt={form[mediaSlots[field].alt]}
      onOpen={() => setPickerField(field)}
      onRemove={() => update(field, null)}
    />
  );

  const update = <K extends keyof SiteSettingsDraft>(field: K, value: SiteSettingsDraft[K]): void => {
    setForm((current) => ({...current, [field]: value}));
    setDirty((current) => markDirty(current, field));
    setErrors((current) => fieldErrorsCleared(current, field));
  };

  const toggleFeatured = (id: string, checked: boolean): void => {
    setForm((current) => ({
      ...current,
      featuredAlbumIds: checked
        ? [...current.featuredAlbumIds, id]
        : current.featuredAlbumIds.filter((albumId) => albumId !== id),
    }));
    setDirty((current) => markDirty(current, "featuredAlbumIds"));
  };

  const save = async (scope: SettingsScope): Promise<void> => {
    if (savingScope) return;
    setSavingScope(scope);
    const outcome = await saveSettingsScopeDraft({scope, draft: form});
    setSavingScope(null);
    if (outcome.ok) {
      setForm(outcome.saved);
      setDirty((current) => clearDirty(current, scope));
      setErrors((current) => scopeErrorsCleared(current, scope));
      toast.success(`${scopeLabels[scope]} settings saved.`);
      return;
    }
    setErrors((current) => ({...scopeErrorsCleared(current, scope), ...outcome.errors}));
    toast.error(outcome.message);
  };

  return (
    <form
      className="admin-form flex flex-1 flex-col space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save(activeScope);
      }}
    >
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--charcoal)] m-0">
          Website settings
        </h1>
      </header>

      <Tabs
        className="w-full space-y-4"
        value={activeScope}
        onValueChange={(value) => setActiveScope(value as SettingsScope)}
      >
        <TabsList variant="line" className="flex h-auto w-full flex-wrap justify-start gap-1">
          {settingsScopes.map((scope) => {
            const scopeErrors = scopeErrorCount(errors, scope);
            return (
              <TabsTrigger
                key={scope}
                value={scope}
                className="min-h-13 px-3 cursor-pointer"
                aria-invalid={scopeErrors > 0 ? "true" : undefined}
              >
                <span>{scopeLabels[scope]}</span>
                {dirty.has(scope) ? (
                  <>
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-600 ml-1" />
                    <span className="sr-only">unsaved changes</span>
                  </>
                ) : null}
                {scopeErrors > 0 ? (
                  <>
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-destructive ml-1" />
                    <span className="sr-only">
                      {scopeErrors === 1 ? "1 field needs attention" : `${scopeErrors} fields need attention`}
                    </span>
                  </>
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* 1. BRAND TAB */}
        <TabsContent value="brand" data-scope="brand" className="space-y-5 outline-none flex-1">
          <div className="grid gap-5 md:grid-cols-12 md:items-start">
            <div className="md:col-span-3">
              {renderMediaSlot("logoMediaId")}
            </div>
            <div className="md:col-span-9 space-y-5">
              <div className="grid gap-1">
                <div className="contact-field w-full">
                  <Input
                    id="settings-brand-name"
                    placeholder=" "
                    value={form.brandName}
                    onChange={(event) => update("brandName", event.currentTarget.value)}
                    maxLength={160}
                    required
                    aria-invalid={errors.brandName ? "true" : undefined}
                    aria-describedby={errors.brandName ? "settings-brand-name-error" : undefined}
                  />
                  <Label className="contact-field__label" htmlFor="settings-brand-name">Brand name</Label>
                </div>
                <FormErrorMessage id="settings-brand-name-error" message={errors.brandName} />
              </div>
              <BilingualFields
                id="settings-logo-alt"
                label="Logo alternate text"
                value={form.logoAlt}
                onChange={(logoAlt) => update("logoAlt", logoAlt)}
                maxLength={200}
                required={form.logoMediaId !== null}
                errorEn={errors["logoAlt.en"]}
                errorId={errors["logoAlt.id"]}
              />
            </div>
          </div>
        </TabsContent>

        {/* 2. HOME TAB */}
        <TabsContent value="home" data-scope="home" className="space-y-5 outline-none flex-1">
          <div className="grid gap-5 md:grid-cols-12 md:items-start">
            <div className="md:col-span-3">
              {renderMediaSlot("heroMediaId")}
            </div>
            <div className="md:col-span-9 space-y-5">
              <BilingualFields
                id="settings-hero-alt"
                label="Hero photo alternate text"
                value={form.heroAlt}
                onChange={(heroAlt) => update("heroAlt", heroAlt)}
                maxLength={200}
                required={form.heroMediaId !== null}
                errorEn={errors["heroAlt.en"]}
                errorId={errors["heroAlt.id"]}
              />
              <BilingualFields
                id="settings-home-headline"
                label="Home headline"
                value={form.homeHeadline}
                onChange={(homeHeadline) => update("homeHeadline", homeHeadline)}
                maxLength={5000}
                errorEn={errors["homeHeadline.en"]}
                errorId={errors["homeHeadline.id"]}
              />
              <BilingualFields
                id="settings-home-description"
                label="Home description"
                value={form.homeDescription}
                onChange={(homeDescription) => update("homeDescription", homeDescription)}
                maxLength={5000}
                multiline
                errorEn={errors["homeDescription.en"]}
                errorId={errors["homeDescription.id"]}
              />
              <BilingualFields
                id="settings-introduction"
                label="Personal introduction"
                value={form.personalIntroduction}
                onChange={(personalIntroduction) => update("personalIntroduction", personalIntroduction)}
                maxLength={5000}
                multiline
                errorEn={errors["personalIntroduction.en"]}
                errorId={errors["personalIntroduction.id"]}
              />
            </div>
          </div>
        </TabsContent>

        {/* 3. ABOUT TAB */}
        <TabsContent value="about" data-scope="about" className="space-y-5 outline-none flex-1">
          <div className="grid gap-5 md:grid-cols-12 md:items-start">
            <div className="md:col-span-3">
              {renderMediaSlot("aboutMediaId")}
            </div>
            <div className="md:col-span-9 space-y-5">
              <BilingualFields
                id="settings-about-alt"
                label="About photo alternate text"
                value={form.aboutAlt}
                onChange={(aboutAlt) => update("aboutAlt", aboutAlt)}
                maxLength={200}
                required={form.aboutMediaId !== null}
                errorEn={errors["aboutAlt.en"]}
                errorId={errors["aboutAlt.id"]}
              />
              <BilingualFields
                id="settings-about-story"
                label="About story"
                value={form.aboutStory}
                onChange={(aboutStory) => update("aboutStory", aboutStory)}
                maxLength={5000}
                multiline
                errorEn={errors["aboutStory.en"]}
                errorId={errors["aboutStory.id"]}
              />
            </div>
          </div>
        </TabsContent>

        {/* 4. SERVICES TAB */}
        <TabsContent value="services" data-scope="services" className="space-y-5 outline-none flex-1">
          <ServiceFields
            name="Wedding"
            fieldKey="wedding"
            value={form.services.wedding}
            onChange={(wedding) => update("services", {...form.services, wedding})}
            errors={errors}
          />
          <ServiceFields
            name="Events"
            fieldKey="events"
            value={form.services.events}
            onChange={(events) => update("services", {...form.services, events})}
            errors={errors}
          />
          <ServiceFields
            name="Other photography"
            fieldKey="other"
            value={form.services.other}
            onChange={(other) => update("services", {...form.services, other})}
            errors={errors}
          />
        </TabsContent>

        {/* 5. CONTACT TAB */}
        <TabsContent value="contact" data-scope="contact" className="space-y-5 outline-none flex-1">
          <BilingualFields
            id="settings-location"
            label="Location"
            value={form.location}
            onChange={(location) => update("location", location)}
            maxLength={5000}
            errorEn={errors["location.en"]}
            errorId={errors["location.id"]}
          />
          <BilingualFields
            id="settings-service-area"
            label="Service area"
            value={form.serviceArea}
            onChange={(serviceArea) => update("serviceArea", serviceArea)}
            maxLength={5000}
            errorEn={errors["serviceArea.en"]}
            errorId={errors["serviceArea.id"]}
          />
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <div className="grid gap-1">
              <div className="contact-field max-w-xl">
                <Input
                  id="settings-instagram"
                  type="url"
                  value={form.instagramUrl ?? ""}
                  onChange={(event) => update("instagramUrl", event.currentTarget.value || null)}
                  placeholder="https://instagram.com/your-profile"
                  aria-invalid={errors.instagramUrl ? "true" : undefined}
                  aria-describedby={errors.instagramUrl ? "settings-instagram-error" : undefined}
                />
                <Label className="contact-field__label" htmlFor="settings-instagram">Instagram URL</Label>
              </div>
              <FormErrorMessage id="settings-instagram-error" message={errors.instagramUrl} />
            </div>
            <div className="grid gap-1">
              <div className="contact-field max-w-xl">
                <Input
                  id="settings-whatsapp"
                  type="tel"
                  value={form.whatsappNumber ?? ""}
                  onChange={(event) => update("whatsappNumber", event.currentTarget.value || null)}
                  placeholder="Your WhatsApp number"
                  maxLength={32}
                  aria-invalid={errors.whatsappNumber ? "true" : undefined}
                  aria-describedby={errors.whatsappNumber ? "settings-whatsapp-error" : undefined}
                />
                <Label className="contact-field__label" htmlFor="settings-whatsapp">WhatsApp number</Label>
              </div>
              <FormErrorMessage id="settings-whatsapp-error" message={errors.whatsappNumber} />
            </div>
          </div>
        </TabsContent>

        {/* 6. FEATURED TAB */}
        <TabsContent value="featured" data-scope="featured" className="space-y-5 outline-none flex-1">
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-foreground m-0">Selected Stories</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Only published albums can appear in Selected Stories.
              </p>
            </div>
            {featuredAlbums.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs bg-muted/20 rounded-lg border border-dashed border-border">
                No albums are available yet. Create and publish an album first.
              </div>
            ) : (
              <FeaturedAlbumsTable
                albums={featuredAlbums}
                selectedIds={form.featuredAlbumIds}
                onToggle={toggleFeatured}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Flexible spacer: on a short panel it absorbs the leftover height so the footer lands on the
          panel floor; on a tall panel it collapses to zero and the footer follows the content. */}
      <div aria-hidden="true" className="flex-1" />

      <footer className="-mx-4 sm:-mx-5 border-t border-border px-4 py-1.5 sm:py-2 sm:px-5 bg-background rounded-b-xl flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {dirty.has(activeScope) ? (
            <span className="inline-flex items-center gap-1.5 text-amber-800 font-medium">
              <span className="size-1.5 rounded-full bg-amber-600" />
              Unsaved changes in {scopeLabels[activeScope]}
            </span>
          ) : (
            <span className="text-muted-foreground/80">All changes saved</span>
          )}
        </div>
        <Button
          size="sm"
          type="submit"
          disabled={savingScope !== null || !dirty.has(activeScope)}
          className={cn("cursor-pointer bg-[var(--charcoal)] text-[var(--ivory)] hover:bg-[var(--charcoal)]/90 shadow-2xs", TAP_TARGET)}
        >
          {savingScope === activeScope ? "Saving" : `Save ${scopeLabels[activeScope]}`}
        </Button>
      </footer>

      <MediaPickerDialog
        open={pickerField !== null}
        onOpenChange={(open) => {
          if (!open) setPickerField(null);
        }}
        title={pickerField ? `Select ${mediaSlots[pickerField].label}` : "Select media"}
        description={
          pickerField
            ? `Choose the ${mediaSlots[pickerField].label} from your media library or upload a new one.`
            : undefined
        }
        selectedId={pickerField ? form[pickerField] : null}
        onSelect={(mediaId, asset) => {
          if (!pickerField) return;
          update(pickerField, mediaId);
          if (asset) setAssets((current) => ({...current, [asset.id]: asset}));
        }}
      />
    </form>
  );
}
