import {afterAll, describe, expect, test} from "bun:test";
import {randomUUID} from "node:crypto";

import {Pool} from "pg";

import {
  getFeaturedPublishedAlbums,
  getPublishedAlbumBySlug,
  listPublishedAlbums,
  mapPublicAlbumSummary,
  mapPublicSiteSettings,
  mapPublishedAlbum,
} from "@/server/public-content";

test("maps a missing cover to a null public asset", () => {
  expect(mapPublicAlbumSummary({
    id: "a1",
    slug: "story",
    category: "wedding",
    title_en: "Story",
    title_id: "Cerita",
    cover_id: null,
    cover_cloud_name: null,
    cover_public_id: null,
    cover_secure_url: null,
    cover_width: null,
    cover_height: null,
    cover_alt_en: null,
    cover_alt_id: null,
  })).toEqual({
    id: "a1",
    slug: "story",
    category: "wedding",
    title: {en: "Story", id: "Cerita"},
    cover: null,
  });
});

test("maps a published album into safe public media fields", () => {
  expect(mapPublishedAlbum({
    id: "a1",
    slug: "story",
    category: "wedding",
    title_en: "Story",
    title_id: "Cerita",
    story_en: "A story",
    story_id: "Sebuah cerita",
    cover_id: "m1",
    cover_cloud_name: "demo",
    cover_public_id: "albums/story",
    cover_secure_url: "https://res.cloudinary.com/demo/image/upload/albums/story",
    cover_width: 1200,
    cover_height: 800,
    cover_alt_en: "Couple",
    cover_alt_id: "Pasangan",
  }, [{
    position: 0,
    alt_en: "Couple",
    alt_id: "Pasangan",
    media_id: "m1",
    cloud_name: "demo",
    public_id: "albums/story",
    secure_url: "https://res.cloudinary.com/demo/image/upload/albums/story",
    width: 1200,
    height: 800,
  }])).toEqual({
    id: "a1",
    slug: "story",
    category: "wedding",
    title: {en: "Story", id: "Cerita"},
    story: {en: "A story", id: "Sebuah cerita"},
    cover: {
      id: "m1",
      cloudName: "demo",
      publicId: "albums/story",
      secureUrl: "https://res.cloudinary.com/demo/image/upload/albums/story",
      width: 1200,
      height: 800,
      alt: {en: "Couple", id: "Pasangan"},
    },
    photos: [{
      position: 0,
      media: {
        id: "m1",
        cloudName: "demo",
        publicId: "albums/story",
        secureUrl: "https://res.cloudinary.com/demo/image/upload/albums/story",
        width: 1200,
        height: 800,
        alt: {en: "Couple", id: "Pasangan"},
      },
    }],
  });
});

test("resolves settings media and omits admin-only identifiers", () => {
  const settings = mapPublicSiteSettings({
    singleton: true,
    brand_name: "Elhaq Photography",
    logo_media_id: "logo-admin-id",
    logo_alt_en: "Logo",
    logo_alt_id: "Logo",
    hero_media_id: "hero-admin-id",
    hero_alt_en: "Hero",
    hero_alt_id: "Hero",
    personal_introduction_en: "I photograph real moments.",
    personal_introduction_id: "Saya memotret momen nyata.",
    about_media_id: null,
    about_alt_en: "About",
    about_alt_id: "Tentang",
    about_story_en: "About story",
    about_story_id: "Cerita tentang saya",
    home_headline_en: "Stories with feeling",
    home_headline_id: "Cerita yang terasa",
    home_description_en: "Description",
    home_description_id: "Deskripsi",
    service_wedding_title_en: "Weddings",
    service_wedding_title_id: "Pernikahan",
    service_wedding_description_en: "Wedding photography",
    service_wedding_description_id: "Fotografi pernikahan",
    service_events_title_en: "Events",
    service_events_title_id: "Acara",
    service_events_description_en: "Event photography",
    service_events_description_id: "Fotografi acara",
    service_other_title_en: "Other",
    service_other_title_id: "Lainnya",
    service_other_description_en: "Other photography",
    service_other_description_id: "Fotografi lainnya",
    location_en: "Bandung",
    location_id: "Bandung",
    service_area_en: "Bandung and surroundings",
    service_area_id: "Bandung dan sekitarnya",
    instagram_url: "https://instagram.com/example",
    whatsapp_number: "+6200000000",
    featured_album_ids: ["private-album-id"],
    updated_at: "2026-09-21T00:00:00.000Z",
    logo_id: "logo-admin-id",
    logo_cloud_name: "demo",
    logo_public_id: "brand/logo",
    logo_secure_url: "https://res.cloudinary.com/demo/image/upload/brand/logo",
    logo_width: 500,
    logo_height: 500,
    hero_id: "hero-admin-id",
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
  });

  expect(settings).toEqual({
    brandName: "Elhaq Photography",
    logo: {
      id: "logo-admin-id",
      cloudName: "demo",
      publicId: "brand/logo",
      secureUrl: "https://res.cloudinary.com/demo/image/upload/brand/logo",
      width: 500,
      height: 500,
      alt: {en: "Logo", id: "Logo"},
    },
    hero: {
      id: "hero-admin-id",
      cloudName: "demo",
      publicId: "brand/hero",
      secureUrl: "https://res.cloudinary.com/demo/image/upload/brand/hero",
      width: 1600,
      height: 1000,
      alt: {en: "Hero", id: "Hero"},
    },
    about: null,
    logoAlt: {en: "Logo", id: "Logo"},
    heroAlt: {en: "Hero", id: "Hero"},
    aboutAlt: {en: "About", id: "Tentang"},
    personalIntroduction: {en: "I photograph real moments.", id: "Saya memotret momen nyata."},
    aboutStory: {en: "About story", id: "Cerita tentang saya"},
    homeHeadline: {en: "Stories with feeling", id: "Cerita yang terasa"},
    homeDescription: {en: "Description", id: "Deskripsi"},
    services: {
      wedding: {title: {en: "Weddings", id: "Pernikahan"}, description: {en: "Wedding photography", id: "Fotografi pernikahan"}},
      events: {title: {en: "Events", id: "Acara"}, description: {en: "Event photography", id: "Fotografi acara"}},
      other: {title: {en: "Other", id: "Lainnya"}, description: {en: "Other photography", id: "Fotografi lainnya"}},
    },
    location: {en: "Bandung", id: "Bandung"},
    serviceArea: {en: "Bandung and surroundings", id: "Bandung dan sekitarnya"},
    instagramUrl: "https://instagram.com/example",
    whatsappNumber: "+6200000000",
  });
  expect("logo_media_id" in settings).toBe(false);
  expect("featured_album_ids" in settings).toBe(false);
});

test("rejects a media row that is missing required public fields", () => {
  expect(() => mapPublicAlbumSummary({
    id: "a1",
    slug: "story",
    category: "wedding",
    title_en: "Story",
    title_id: "Cerita",
    cover_id: "m1",
    cover_cloud_name: "demo",
    cover_public_id: "albums/story",
    cover_secure_url: null,
    cover_width: 1200,
    cover_height: 800,
    cover_alt_en: "Couple",
    cover_alt_id: "Pasangan",
  })).toThrow("INCOMPLETE_MEDIA_ROW");
});

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const runDatabaseTests = testDatabaseUrl ? describe : describe.skip;

if (!testDatabaseUrl) console.warn("SKIP public-content integration: TEST_DATABASE_URL is unavailable");

runDatabaseTests("public publication behavior", () => {
  const pool = new Pool({connectionString: testDatabaseUrl});

  afterAll(() => pool.end());

  test("excludes drafts from direct, list, and featured reads", async () => {
    const client = await pool.connect();
    const publishedId = randomUUID();
    const draftId = randomUUID();
    const mediaId = randomUUID();
    const publishedSlug = `published-${publishedId}`;
    const draftSlug = `draft-${draftId}`;
    const publicId = `test/${mediaId}`;
    const secureUrl = `https://res.cloudinary.com/test/image/upload/${publicId}`;

    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO media_assets(id, cloud_name, public_id, secure_url, width, height, format, bytes, created_by) VALUES ($1,'test',$2,$3,1200,800,'jpg',100,'test')",
        [mediaId, publicId, secureUrl],
      );
      await client.query(
        "INSERT INTO albums(id, slug, category, title_en, title_id, story_en, story_id, status, cover_media_id) VALUES ($1,$2,'wedding','Published','Terbit','Story','Cerita','published',$5),($3,$4,'wedding','Draft','Draf','Story','Cerita','draft',NULL)",
        [publishedId, publishedSlug, draftId, draftSlug, mediaId],
      );
      await client.query(
        "INSERT INTO album_photos(album_id, media_id, position, alt_en, alt_id) VALUES ($1,$2,0,'Photo','Foto')",
        [publishedId, mediaId],
      );
      await client.query(`
        INSERT INTO site_settings (
          brand_name, logo_alt_en, logo_alt_id, hero_alt_en, hero_alt_id,
          personal_introduction_en, personal_introduction_id, about_alt_en, about_alt_id,
          about_story_en, about_story_id, home_headline_en, home_headline_id,
          home_description_en, home_description_id, service_wedding_title_en, service_wedding_title_id,
          service_wedding_description_en, service_wedding_description_id, service_events_title_en,
          service_events_title_id, service_events_description_en, service_events_description_id,
          service_other_title_en, service_other_title_id, service_other_description_en,
          service_other_description_id, location_en, location_id, service_area_en, service_area_id,
          instagram_url, featured_album_ids
        ) VALUES (
          'Fixture', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
          ARRAY[$1::uuid, $2::uuid]
        )
      `, [publishedId, draftId]);

      const executor = {
        query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
          return client.query<T>(text, [...values]).then(({rows}) => ({rows}));
        },
      };

      await expect(getPublishedAlbumBySlug(draftSlug, executor)).resolves.toBeNull();
      await expect(listPublishedAlbums(undefined, executor)).resolves.toEqual(expect.arrayContaining([
        expect.objectContaining({slug: publishedSlug}),
      ]));
      await expect(listPublishedAlbums(undefined, executor)).resolves.not.toEqual(expect.arrayContaining([
        expect.objectContaining({slug: draftSlug}),
      ]));
      await expect(getFeaturedPublishedAlbums(executor)).resolves.toEqual([
        expect.objectContaining({slug: publishedSlug}),
      ]);
      await expect(getFeaturedPublishedAlbums(executor)).resolves.not.toEqual(expect.arrayContaining([
        expect.objectContaining({slug: draftSlug}),
      ]));
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});
