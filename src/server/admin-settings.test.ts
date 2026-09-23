import {expect, test} from "bun:test";
import type {PoolClient} from "pg";

import type {SiteSettingsDraft} from "@/lib/domain";
import {getPublicSiteSettings} from "@/server/public-content";
import {
  getAdminSettings,
  parseSiteSettingsInput,
  saveSiteSettings,
} from "@/server/admin-settings";

const actor = {userId: "admin-1", email: "admin@example.com", name: null};
const logoId = "00000000-0000-4000-8000-000000000001";
const heroId = "00000000-0000-4000-8000-000000000002";
const aboutId = "00000000-0000-4000-8000-000000000003";
const featuredId = "00000000-0000-4000-8000-000000000004";

const input: SiteSettingsDraft = {
  brandName: "Elhaq Photography",
  logoMediaId: logoId,
  logoAlt: {en: "Elhaq Photography logo", id: "Logo Elhaq Photography"},
  heroMediaId: heroId,
  heroAlt: {en: "Wedding photograph", id: "Foto pernikahan"},
  personalIntroduction: {en: "I photograph weddings and events.", id: "Saya memotret pernikahan dan acara."},
  aboutMediaId: aboutId,
  aboutAlt: {en: "Photographer portrait", id: "Potret fotografer"},
  aboutStory: {en: "I work with a calm, attentive approach.", id: "Saya bekerja dengan pendekatan yang tenang dan penuh perhatian."},
  homeHeadline: {en: "Photographs with feeling", id: "Foto dengan rasa"},
  homeDescription: {en: "Photography for weddings, events, and other stories.", id: "Fotografi untuk pernikahan, acara, dan cerita lainnya."},
  services: {
    wedding: {title: {en: "Weddings", id: "Pernikahan"}, description: {en: "Wedding photography.", id: "Fotografi pernikahan."}},
    events: {title: {en: "Events", id: "Acara"}, description: {en: "Event photography.", id: "Fotografi acara."}},
    other: {title: {en: "Other photography", id: "Fotografi lainnya"}, description: {en: "Other photography work.", id: "Pekerjaan fotografi lainnya."}},
  },
  location: {en: "Bandung Regency", id: "Kabupaten Bandung"},
  serviceArea: {en: "Bandung and surroundings", id: "Bandung dan sekitarnya"},
  instagramUrl: "https://instagram.com/elhaq",
  whatsappNumber: "+628123456789",
  featuredAlbumIds: [featuredId],
};

function rowFromInput(value: SiteSettingsDraft): Record<string, unknown> {
  return {
    singleton: true,
    brand_name: value.brandName,
    logo_media_id: value.logoMediaId,
    logo_alt_en: value.logoAlt.en,
    logo_alt_id: value.logoAlt.id,
    hero_media_id: value.heroMediaId,
    hero_alt_en: value.heroAlt.en,
    hero_alt_id: value.heroAlt.id,
    personal_introduction_en: value.personalIntroduction.en,
    personal_introduction_id: value.personalIntroduction.id,
    about_media_id: value.aboutMediaId,
    about_alt_en: value.aboutAlt.en,
    about_alt_id: value.aboutAlt.id,
    about_story_en: value.aboutStory.en,
    about_story_id: value.aboutStory.id,
    home_headline_en: value.homeHeadline.en,
    home_headline_id: value.homeHeadline.id,
    home_description_en: value.homeDescription.en,
    home_description_id: value.homeDescription.id,
    service_wedding_title_en: value.services.wedding.title.en,
    service_wedding_title_id: value.services.wedding.title.id,
    service_wedding_description_en: value.services.wedding.description.en,
    service_wedding_description_id: value.services.wedding.description.id,
    service_events_title_en: value.services.events.title.en,
    service_events_title_id: value.services.events.title.id,
    service_events_description_en: value.services.events.description.en,
    service_events_description_id: value.services.events.description.id,
    service_other_title_en: value.services.other.title.en,
    service_other_title_id: value.services.other.title.id,
    service_other_description_en: value.services.other.description.en,
    service_other_description_id: value.services.other.description.id,
    location_en: value.location.en,
    location_id: value.location.id,
    service_area_en: value.serviceArea.en,
    service_area_id: value.serviceArea.id,
    instagram_url: value.instagramUrl,
    whatsapp_number: value.whatsappNumber,
    featured_album_ids: value.featuredAlbumIds,
  };
}

function clientFor({mediaIds = [logoId, heroId, aboutId], publishedIds = [featuredId]}: {mediaIds?: string[]; publishedIds?: string[]} = {}): {client: PoolClient; queries: Array<{text: string; values: readonly unknown[]}>} {
  const queries: Array<{text: string; values: readonly unknown[]}> = [];
  const client = {
    async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []): Promise<{rows: T[]}> {
      queries.push({text, values});
      if (text.includes("FROM media_assets")) return {rows: mediaIds.map((id) => ({id} as unknown as T))};
      if (text.includes("FROM albums")) return {rows: publishedIds.map((id) => ({id} as unknown as T))};
      return {rows: []};
    },
  } as unknown as PoolClient;
  return {client, queries};
}

test("parses the exact bilingual settings shape and normalizes optional contact fields", () => {
  const parsed = parseSiteSettingsInput({
    ...input,
    brandName: "  Elhaq Photography ",
    logoMediaId: null,
    logoAlt: {en: "", id: ""},
    instagramUrl: "",
    whatsappNumber: " +62 812-3456-789 ",
    featuredAlbumIds: [],
  });

  expect(parsed.brandName).toBe("Elhaq Photography");
  expect(parsed.logoAlt).toEqual({en: "", id: ""});
  expect(parsed.instagramUrl).toBeNull();
  expect(parsed.whatsappNumber).toBe("+628123456789");
  expect(parsed.featuredAlbumIds).toEqual([]);
});

test("rejects unknown fields, incomplete selected media alt text, and non-Instagram URLs", () => {
  expect(() => parseSiteSettingsInput({...input, unexpected: true})).toThrow("VALIDATION_FAILED");
  expect(() => parseSiteSettingsInput({...input, logoAlt: {en: "Logo", id: ""}})).toThrow("VALIDATION_FAILED");
  expect(() => parseSiteSettingsInput({...input, instagramUrl: "https://example.com/profile"})).toThrow("VALIDATION_FAILED");
});

test("persists all three service title and description pairs and featured albums in one transaction", async () => {
  const {client, queries} = clientFor();
  let invalidated = false;

  const saved = await saveSiteSettings(actor, input, {
    transaction: async (work) => work(client),
    invalidate: () => { invalidated = true; },
  });

  const upsert = queries.find((query) => query.text.trimStart().startsWith("INSERT INTO site_settings"));
  expect(upsert).toBeDefined();
  expect(upsert?.values).toContain("Weddings");
  expect(upsert?.values).toContain("Pekerjaan fotografi lainnya.");
  expect(upsert?.values).toContainEqual([featuredId]);
  expect(saved).toEqual(input);
  expect(invalidated).toBe(true);
});

test("rejects a selected media ID that is not owned by the application", async () => {
  const {client} = clientFor({mediaIds: [heroId, aboutId]});

  await expect(saveSiteSettings(actor, input, {transaction: async (work) => work(client)})).rejects.toMatchObject({code: "FOREIGN_MEDIA_ID"});
});

test("rejects featured albums that are not published", async () => {
  const {client} = clientFor({publishedIds: []});

  await expect(saveSiteSettings(actor, input, {transaction: async (work) => work(client)})).rejects.toMatchObject({code: "FEATURED_ALBUM_NOT_PUBLISHED"});
});

test("a committed save stays successful when public invalidation throws", async () => {
  const {client} = clientFor();
  await expect(saveSiteSettings(actor, input, {
    transaction: async (work) => work(client),
    invalidate: () => { throw new Error("revalidation unavailable"); },
  })).resolves.toEqual(input);
});

test("reads an admin draft with media IDs and all bilingual service fields", async () => {
  const row = rowFromInput(input);
  const draft = await getAdminSettings(actor, {db: {query: async <T extends Record<string, unknown>>() => ({rows: [row as T]})}});

  expect(draft).toEqual(input);
});

test("public settings resolves media through its explicit public joins without exposing draft IDs", async () => {
  const row = {
    ...rowFromInput(input),
    logo_id: logoId,
    logo_cloud_name: "demo",
    logo_public_id: "brand/logo",
    logo_secure_url: "https://res.cloudinary.com/demo/image/upload/brand/logo",
    logo_width: 500,
    logo_height: 500,
    hero_id: heroId,
    hero_cloud_name: "demo",
    hero_public_id: "brand/hero",
    hero_secure_url: "https://res.cloudinary.com/demo/image/upload/brand/hero",
    hero_width: 1600,
    hero_height: 1000,
    about_id: null,
    about_cloud_name: null,
    about_public_id: null,
    about_secure_url: null,
    about_width: null,
    about_height: null,
    updated_at: "2026-09-22T00:00:00.000Z",
  };
  const queries: string[] = [];
  const settings = await getPublicSiteSettings({query: async <T extends Record<string, unknown>>(text: string) => {
    queries.push(text);
    return {rows: [row as unknown as T]};
  }});

  expect(settings?.logo?.id).toBe(logoId);
  expect(settings).not.toHaveProperty("logoMediaId");
  expect(settings).not.toHaveProperty("featuredAlbumIds");
  expect(queries[0]).not.toContain("private_client_links");
});
