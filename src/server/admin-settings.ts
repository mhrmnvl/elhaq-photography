import {z} from "zod";
import type {PoolClient} from "pg";

import type {AdminSession} from "@/lib/authz";
import {getDb, withTransaction, type SqlExecutor} from "@/lib/db";
import type {SiteSettingsDraft} from "@/lib/domain";
import {DomainError, HttpError} from "@/lib/errors";
import {invalidatePublicPaths} from "@/lib/public-revalidation";
import {lockMediaForAttach} from "@/server/admin-media";

const requiredBilingual = z.object({
  en: z.string().trim().min(1).max(5000),
  id: z.string().trim().min(1).max(5000),
}).strict();

const optionalAlt = z.object({
  en: z.string().trim().max(200),
  id: z.string().trim().max(200),
}).strict();

const serviceSchema = z.object({title: requiredBilingual, description: requiredBilingual}).strict();

const nullableUrl = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().url().nullable().optional(),
).transform((value) => value ?? null);

const nullableWhatsapp = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(32).regex(/^\+?[0-9][0-9 ()-]{5,31}$/).transform((value) => value.replace(/[ ()-]/g, "")).nullable().optional(),
).transform((value) => value ?? null);

const settingsSchema = z.object({
  brandName: z.string().trim().min(1).max(160),
  logoMediaId: z.string().uuid().nullable(),
  logoAlt: optionalAlt,
  heroMediaId: z.string().uuid().nullable(),
  heroAlt: optionalAlt,
  personalIntroduction: requiredBilingual,
  aboutMediaId: z.string().uuid().nullable(),
  aboutAlt: optionalAlt,
  aboutStory: requiredBilingual,
  homeHeadline: requiredBilingual,
  homeDescription: requiredBilingual,
  services: z.object({wedding: serviceSchema, events: serviceSchema, other: serviceSchema}).strict(),
  location: requiredBilingual,
  serviceArea: requiredBilingual,
  instagramUrl: nullableUrl,
  whatsappNumber: nullableWhatsapp,
  featuredAlbumIds: z.array(z.string().uuid()).max(50),
}).strict().superRefine((value, context) => {
  for (const [mediaKey, altKey] of [["logoMediaId", "logoAlt"], ["heroMediaId", "heroAlt"], ["aboutMediaId", "aboutAlt"]] as const) {
    const alt = value[altKey];
    if (value[mediaKey] && (!alt.en || !alt.id)) {
      context.addIssue({code: "custom", path: [altKey], message: "Both media alt texts are required"});
    }
  }
  if (value.instagramUrl) {
    const url = new URL(value.instagramUrl);
    const host = url.hostname.toLowerCase();
    if (host !== "instagram.com" && host !== "www.instagram.com") {
      context.addIssue({code: "custom", path: ["instagramUrl"], message: "Instagram URL host is not allowed"});
    }
    if (url.protocol !== "https:") {
      context.addIssue({code: "custom", path: ["instagramUrl"], message: "Instagram URL must use HTTPS"});
    }
  }
});

export type AdminSettingsDependencies = {
  db?: SqlExecutor;
  transaction?: <T>(work: (client: PoolClient) => Promise<T>) => Promise<T>;
  invalidate?: () => void;
};

type ConfiguredDependencies = {
  db: SqlExecutor;
  transaction: <T>(work: (client: PoolClient) => Promise<T>) => Promise<T>;
  invalidate: () => void;
};

type SiteSettingsRow = {
  brand_name: string;
  logo_media_id: string | null;
  logo_alt_en: string;
  logo_alt_id: string;
  hero_media_id: string | null;
  hero_alt_en: string;
  hero_alt_id: string;
  personal_introduction_en: string;
  personal_introduction_id: string;
  about_media_id: string | null;
  about_alt_en: string;
  about_alt_id: string;
  about_story_en: string;
  about_story_id: string;
  home_headline_en: string;
  home_headline_id: string;
  home_description_en: string;
  home_description_id: string;
  service_wedding_title_en: string;
  service_wedding_title_id: string;
  service_wedding_description_en: string;
  service_wedding_description_id: string;
  service_events_title_en: string;
  service_events_title_id: string;
  service_events_description_en: string;
  service_events_description_id: string;
  service_other_title_en: string;
  service_other_title_id: string;
  service_other_description_en: string;
  service_other_description_id: string;
  location_en: string;
  location_id: string;
  service_area_en: string;
  service_area_id: string;
  instagram_url: string | null;
  whatsapp_number: string | null;
  featured_album_ids: readonly string[];
};

function dependencies(overrides: AdminSettingsDependencies): ConfiguredDependencies {
  return {
    db: overrides.db ?? getDb(),
    transaction: overrides.transaction ?? ((work) => withTransaction(work)),
    invalidate: overrides.invalidate ?? (() => invalidatePublicPaths()),
  };
}

export function parseSiteSettingsInput(raw: unknown): SiteSettingsDraft {
  const result = settingsSchema.safeParse(raw);
  if (!result.success) throw new HttpError(422, "VALIDATION_FAILED", "Site settings are invalid");
  return result.data;
}

function mapDraft(row: SiteSettingsRow): SiteSettingsDraft {
  return {
    brandName: row.brand_name,
    logoMediaId: row.logo_media_id,
    logoAlt: {en: row.logo_alt_en, id: row.logo_alt_id},
    heroMediaId: row.hero_media_id,
    heroAlt: {en: row.hero_alt_en, id: row.hero_alt_id},
    personalIntroduction: {en: row.personal_introduction_en, id: row.personal_introduction_id},
    aboutMediaId: row.about_media_id,
    aboutAlt: {en: row.about_alt_en, id: row.about_alt_id},
    aboutStory: {en: row.about_story_en, id: row.about_story_id},
    homeHeadline: {en: row.home_headline_en, id: row.home_headline_id},
    homeDescription: {en: row.home_description_en, id: row.home_description_id},
    services: {
      wedding: {
        title: {en: row.service_wedding_title_en, id: row.service_wedding_title_id},
        description: {en: row.service_wedding_description_en, id: row.service_wedding_description_id},
      },
      events: {
        title: {en: row.service_events_title_en, id: row.service_events_title_id},
        description: {en: row.service_events_description_en, id: row.service_events_description_id},
      },
      other: {
        title: {en: row.service_other_title_en, id: row.service_other_title_id},
        description: {en: row.service_other_description_en, id: row.service_other_description_id},
      },
    },
    location: {en: row.location_en, id: row.location_id},
    serviceArea: {en: row.service_area_en, id: row.service_area_id},
    instagramUrl: row.instagram_url,
    whatsappNumber: row.whatsapp_number,
    featuredAlbumIds: [...row.featured_album_ids],
  };
}

const settingsColumns = `
  brand_name, logo_media_id, logo_alt_en, logo_alt_id, hero_media_id, hero_alt_en, hero_alt_id,
  personal_introduction_en, personal_introduction_id, about_media_id, about_alt_en, about_alt_id,
  about_story_en, about_story_id, home_headline_en, home_headline_id, home_description_en, home_description_id,
  service_wedding_title_en, service_wedding_title_id, service_wedding_description_en, service_wedding_description_id,
  service_events_title_en, service_events_title_id, service_events_description_en, service_events_description_id,
  service_other_title_en, service_other_title_id, service_other_description_en, service_other_description_id,
  location_en, location_id, service_area_en, service_area_id, instagram_url, whatsapp_number, featured_album_ids`;

export async function getAdminSettings(actor: AdminSession, overrides: AdminSettingsDependencies = {}): Promise<SiteSettingsDraft | null> {
  void actor;
  const result = await dependencies(overrides).db.query<SiteSettingsRow>(`SELECT ${settingsColumns} FROM site_settings WHERE singleton = true`);
  return result.rows[0] ? mapDraft(result.rows[0]) : null;
}

const upsertSettingsSql = `
INSERT INTO site_settings (
  singleton, brand_name, logo_media_id, logo_alt_en, logo_alt_id, hero_media_id, hero_alt_en, hero_alt_id,
  personal_introduction_en, personal_introduction_id, about_media_id, about_alt_en, about_alt_id, about_story_en, about_story_id,
  home_headline_en, home_headline_id, home_description_en, home_description_id,
  service_wedding_title_en, service_wedding_title_id, service_wedding_description_en, service_wedding_description_id,
  service_events_title_en, service_events_title_id, service_events_description_en, service_events_description_id,
  service_other_title_en, service_other_title_id, service_other_description_en, service_other_description_id,
  location_en, location_id, service_area_en, service_area_id, instagram_url, whatsapp_number, featured_album_ids
) VALUES (true, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37)
ON CONFLICT (singleton) DO UPDATE SET
  brand_name = EXCLUDED.brand_name, logo_media_id = EXCLUDED.logo_media_id, logo_alt_en = EXCLUDED.logo_alt_en, logo_alt_id = EXCLUDED.logo_alt_id,
  hero_media_id = EXCLUDED.hero_media_id, hero_alt_en = EXCLUDED.hero_alt_en, hero_alt_id = EXCLUDED.hero_alt_id,
  personal_introduction_en = EXCLUDED.personal_introduction_en, personal_introduction_id = EXCLUDED.personal_introduction_id,
  about_media_id = EXCLUDED.about_media_id, about_alt_en = EXCLUDED.about_alt_en, about_alt_id = EXCLUDED.about_alt_id,
  about_story_en = EXCLUDED.about_story_en, about_story_id = EXCLUDED.about_story_id,
  home_headline_en = EXCLUDED.home_headline_en, home_headline_id = EXCLUDED.home_headline_id,
  home_description_en = EXCLUDED.home_description_en, home_description_id = EXCLUDED.home_description_id,
  service_wedding_title_en = EXCLUDED.service_wedding_title_en, service_wedding_title_id = EXCLUDED.service_wedding_title_id,
  service_wedding_description_en = EXCLUDED.service_wedding_description_en, service_wedding_description_id = EXCLUDED.service_wedding_description_id,
  service_events_title_en = EXCLUDED.service_events_title_en, service_events_title_id = EXCLUDED.service_events_title_id,
  service_events_description_en = EXCLUDED.service_events_description_en, service_events_description_id = EXCLUDED.service_events_description_id,
  service_other_title_en = EXCLUDED.service_other_title_en, service_other_title_id = EXCLUDED.service_other_title_id,
  service_other_description_en = EXCLUDED.service_other_description_en, service_other_description_id = EXCLUDED.service_other_description_id,
  location_en = EXCLUDED.location_en, location_id = EXCLUDED.location_id, service_area_en = EXCLUDED.service_area_en, service_area_id = EXCLUDED.service_area_id,
  instagram_url = EXCLUDED.instagram_url, whatsapp_number = EXCLUDED.whatsapp_number, featured_album_ids = EXCLUDED.featured_album_ids,
  updated_at = now()`;

function valuesFor(input: SiteSettingsDraft): unknown[] {
  return [
    input.brandName,
    input.logoMediaId,
    input.logoAlt.en,
    input.logoAlt.id,
    input.heroMediaId,
    input.heroAlt.en,
    input.heroAlt.id,
    input.personalIntroduction.en,
    input.personalIntroduction.id,
    input.aboutMediaId,
    input.aboutAlt.en,
    input.aboutAlt.id,
    input.aboutStory.en,
    input.aboutStory.id,
    input.homeHeadline.en,
    input.homeHeadline.id,
    input.homeDescription.en,
    input.homeDescription.id,
    input.services.wedding.title.en,
    input.services.wedding.title.id,
    input.services.wedding.description.en,
    input.services.wedding.description.id,
    input.services.events.title.en,
    input.services.events.title.id,
    input.services.events.description.en,
    input.services.events.description.id,
    input.services.other.title.en,
    input.services.other.title.id,
    input.services.other.description.en,
    input.services.other.description.id,
    input.location.en,
    input.location.id,
    input.serviceArea.en,
    input.serviceArea.id,
    input.instagramUrl,
    input.whatsappNumber,
    input.featuredAlbumIds,
  ];
}

async function assertPublishedFeaturedAlbums(tx: PoolClient, ids: readonly string[]): Promise<void> {
  const requested = new Set(ids);
  if (requested.size === 0) return;
  const result = await tx.query<{id: string}>(
    "SELECT id FROM albums WHERE id = ANY($1::uuid[]) AND status = 'published' FOR SHARE",
    [[...requested]],
  );
  const returned = new Set(result.rows.map((row) => row.id));
  if (returned.size !== requested.size || [...requested].some((id) => !returned.has(id))) {
    throw new DomainError(409, "FEATURED_ALBUM_NOT_PUBLISHED", "Every featured album must be published");
  }
}

function invalidateAfterCommit(configured: ConfiguredDependencies): void {
  try {
    configured.invalidate();
  } catch (error) {
    console.error(JSON.stringify({code: "PUBLIC_PATH_INVALIDATION_FAILED", error: error instanceof Error ? error.message : String(error)}));
  }
}

export async function saveSiteSettings(actor: AdminSession, input: SiteSettingsDraft, overrides: AdminSettingsDependencies = {}): Promise<SiteSettingsDraft> {
  void actor;
  const configured = dependencies(overrides);
  const saved = await configured.transaction(async (tx) => {
    await lockMediaForAttach(tx, [input.logoMediaId, input.heroMediaId, input.aboutMediaId].filter((id): id is string => id !== null));
    await assertPublishedFeaturedAlbums(tx, input.featuredAlbumIds);
    await tx.query(upsertSettingsSql, valuesFor(input));
    return {...input, featuredAlbumIds: [...input.featuredAlbumIds]};
  });
  invalidateAfterCommit(configured);
  return saved;
}
