import {getDb, withRepeatableRead, type SqlExecutor} from "@/lib/db";
import type {
  AlbumCategory,
  AlbumPhoto,
  BilingualText,
  PublicAlbum,
  PublicAlbumPhoto,
  PublicAlbumSummary,
  PublicMediaAsset,
  PublicSiteSettings,
} from "@/lib/domain";

type AlbumSummaryRow = {
  id: string;
  slug: string;
  category: AlbumCategory;
  title_en: string;
  title_id: string;
  location_en: string;
  location_id: string;
  cover_id: string | null;
  cover_cloud_name: string | null;
  cover_public_id: string | null;
  cover_secure_url: string | null;
  cover_width: number | null;
  cover_height: number | null;
  cover_alt_en: string | null;
  cover_alt_id: string | null;
};

type PublishedAlbumRow = AlbumSummaryRow & {
  story_en: string;
  story_id: string;
};

type AlbumPhotoRow = {
  position: number;
  alt_en: string;
  alt_id: string;
  media_id: string;
  cloud_name: string;
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
};

type SiteSettingsRow = {
  singleton: boolean;
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
  updated_at: string;
  logo_id: string | null;
  logo_cloud_name: string | null;
  logo_public_id: string | null;
  logo_secure_url: string | null;
  logo_width: number | null;
  logo_height: number | null;
  hero_id: string | null;
  hero_cloud_name: string | null;
  hero_public_id: string | null;
  hero_secure_url: string | null;
  hero_width: number | null;
  hero_height: number | null;
  about_id: string | null;
  about_cloud_name: string | null;
  about_public_id: string | null;
  about_secure_url: string | null;
  about_width: number | null;
  about_height: number | null;
};

export function mapPublicAlbumSummary(row: AlbumSummaryRow): PublicAlbumSummary {
  if (row.cover_id === null) {
    return {
      id: row.id,
      slug: row.slug,
      category: row.category,
      title: {en: row.title_en, id: row.title_id},
      location: {en: row.location_en, id: row.location_id},
      cover: null,
    };
  }

  if (row.cover_cloud_name === null || row.cover_public_id === null || row.cover_secure_url === null || row.cover_width === null || row.cover_height === null) {
    throw new Error("INCOMPLETE_MEDIA_ROW");
  }

  const cover: PublicMediaAsset = {
    id: row.cover_id,
    cloudName: row.cover_cloud_name,
    publicId: row.cover_public_id,
    secureUrl: row.cover_secure_url,
    width: row.cover_width,
    height: row.cover_height,
    alt: {en: row.cover_alt_en ?? "", id: row.cover_alt_id ?? ""},
  };

  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    title: {en: row.title_en, id: row.title_id},
    location: {en: row.location_en, id: row.location_id},
    cover,
  };
}

const albumSummarySql = `
  SELECT a.id, a.slug, a.category, a.title_en, a.title_id, a.location_en, a.location_id,
         cover.id AS cover_id, cover.cloud_name AS cover_cloud_name,
         cover.public_id AS cover_public_id, cover.secure_url AS cover_secure_url,
         cover.width AS cover_width, cover.height AS cover_height,
         coalesce(cover_photo.alt_en, '') AS cover_alt_en, coalesce(cover_photo.alt_id, '') AS cover_alt_id
    FROM albums a
    LEFT JOIN media_assets cover ON cover.id = a.cover_media_id
    LEFT JOIN album_photos cover_photo ON cover_photo.album_id = a.id AND cover_photo.media_id = a.cover_media_id
   WHERE a.status = 'published'
`;

export async function listPublishedAlbums(category?: AlbumCategory, executor: SqlExecutor = getDb()): Promise<readonly PublicAlbumSummary[]> {
  const filter = category ? " AND a.category = $1" : "";
  const result = await executor.query<AlbumSummaryRow>(
    `${albumSummarySql}${filter} ORDER BY a.sort_order, a.created_at, a.id`,
    category ? [category] : [],
  );
  return result.rows.map(mapPublicAlbumSummary);
}

type AlbumPhotoWallRow = {
  album_id: string;
  album_slug: string;
  category: AlbumCategory;
  title_en: string;
  title_id: string;
  location_en: string;
  location_id: string;
  position: number;
  media_id: string;
  cloud_name: string;
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  alt_en: string;
  alt_id: string;
};

export function mapAlbumPhotoWallRow(row: AlbumPhotoWallRow): PublicAlbumPhoto {
  return {
    albumId: row.album_id,
    albumSlug: row.album_slug,
    category: row.category,
    title: {en: row.title_en, id: row.title_id},
    location: {en: row.location_en, id: row.location_id},
    media: {
      id: row.media_id,
      cloudName: row.cloud_name,
      publicId: row.public_id,
      secureUrl: row.secure_url,
      width: row.width,
      height: row.height,
      alt: {en: row.alt_en, id: row.alt_id},
    },
  };
}

/**
 * Semua foto dari semua album published, untuk dinding foto di beranda.
 *
 * ponytail: satu query mengirim seluruh foto. Cukup untuk puluhan foto seperti sekarang;
 * kalau album bertambah sampai ratusan, ganti dengan endpoint paging per batch.
 */
export async function listPublishedPhotos(executor: SqlExecutor = getDb()): Promise<readonly PublicAlbumPhoto[]> {
  const result = await executor.query<AlbumPhotoWallRow>(`
    SELECT a.id AS album_id, a.slug AS album_slug, a.category,
           a.title_en, a.title_id, a.location_en, a.location_id,
           ap.position, coalesce(ap.alt_en, '') AS alt_en, coalesce(ap.alt_id, '') AS alt_id,
           m.id AS media_id, m.cloud_name, m.public_id, m.secure_url, m.width, m.height
      FROM albums a
      JOIN album_photos ap ON ap.album_id = a.id
      JOIN media_assets m ON m.id = ap.media_id
     WHERE a.status = 'published'
     ORDER BY a.sort_order, a.created_at, a.id, ap.position
  `);
  return result.rows.map(mapAlbumPhotoWallRow);
}

export function mapPublishedAlbum(album: PublishedAlbumRow, photos: readonly AlbumPhotoRow[]): PublicAlbum {
  const summary = mapPublicAlbumSummary(album);
  const mappedPhotos: readonly AlbumPhoto[] = photos.map((photo) => ({
    position: photo.position,
    media: {
      id: photo.media_id,
      cloudName: photo.cloud_name,
      publicId: photo.public_id,
      secureUrl: photo.secure_url,
      width: photo.width,
      height: photo.height,
      alt: {en: photo.alt_en, id: photo.alt_id},
    },
  }));

  return {
    ...summary,
    story: {en: album.story_en, id: album.story_id},
    photos: mappedPhotos,
  };
}

export async function getPublishedAlbumBySlug(slug: string, executor?: SqlExecutor): Promise<PublicAlbum | null> {
  if (!executor) return withRepeatableRead((client) => getPublishedAlbumBySlug(slug, client));

  const album = await executor.query<PublishedAlbumRow>(`
    SELECT a.id, a.slug, a.category, a.title_en, a.title_id, a.story_en, a.story_id, a.location_en, a.location_id,
           cover.id AS cover_id, cover.cloud_name AS cover_cloud_name, cover.public_id AS cover_public_id,
           cover.secure_url AS cover_secure_url, cover.width AS cover_width, cover.height AS cover_height,
           coalesce(cover_photo.alt_en, '') AS cover_alt_en, coalesce(cover_photo.alt_id, '') AS cover_alt_id
      FROM albums a
      LEFT JOIN media_assets cover ON cover.id = a.cover_media_id
      LEFT JOIN album_photos cover_photo ON cover_photo.album_id = a.id AND cover_photo.media_id = a.cover_media_id
     WHERE a.slug = $1 AND a.status = 'published'
  `, [slug]);
  if (album.rows.length === 0) return null;

  const photoRows = await executor.query<AlbumPhotoRow>(`
    SELECT ap.position, ap.alt_en, ap.alt_id, m.id AS media_id, m.cloud_name, m.public_id,
           m.secure_url, m.width, m.height
      FROM album_photos ap
      JOIN albums a ON a.id = ap.album_id AND a.status = 'published'
      JOIN media_assets m ON m.id = ap.media_id
     WHERE ap.album_id = $1
     ORDER BY ap.position
  `, [album.rows[0].id]);

  return mapPublishedAlbum(album.rows[0], photoRows.rows);
}

function mapMedia(
  id: string | null,
  cloudName: string | null,
  publicId: string | null,
  secureUrl: string | null,
  width: number | null,
  height: number | null,
  alt: BilingualText,
): PublicMediaAsset | null {
  if (id === null) return null;
  if (cloudName === null || publicId === null || secureUrl === null || width === null || height === null) {
    throw new Error("INCOMPLETE_MEDIA_ROW");
  }
  return {id, cloudName, publicId, secureUrl, width, height, alt};
}

export function mapPublicSiteSettings(row: SiteSettingsRow): PublicSiteSettings {
  return {
    brandName: row.brand_name,
    logo: mapMedia(row.logo_id, row.logo_cloud_name, row.logo_public_id, row.logo_secure_url, row.logo_width, row.logo_height, {en: row.logo_alt_en, id: row.logo_alt_id}),
    hero: mapMedia(row.hero_id, row.hero_cloud_name, row.hero_public_id, row.hero_secure_url, row.hero_width, row.hero_height, {en: row.hero_alt_en, id: row.hero_alt_id}),
    about: mapMedia(row.about_id, row.about_cloud_name, row.about_public_id, row.about_secure_url, row.about_width, row.about_height, {en: row.about_alt_en, id: row.about_alt_id}),
    logoAlt: {en: row.logo_alt_en, id: row.logo_alt_id},
    heroAlt: {en: row.hero_alt_en, id: row.hero_alt_id},
    aboutAlt: {en: row.about_alt_en, id: row.about_alt_id},
    personalIntroduction: {en: row.personal_introduction_en, id: row.personal_introduction_id},
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
  };
}

export async function getPublicSiteSettings(executor: SqlExecutor = getDb()): Promise<PublicSiteSettings | null> {
  const result = await executor.query<SiteSettingsRow>(`
    SELECT s.singleton, s.brand_name, s.logo_media_id, s.logo_alt_en, s.logo_alt_id,
           s.hero_media_id, s.hero_alt_en, s.hero_alt_id,
           s.personal_introduction_en, s.personal_introduction_id,
           s.about_media_id, s.about_alt_en, s.about_alt_id, s.about_story_en, s.about_story_id,
           s.home_headline_en, s.home_headline_id, s.home_description_en, s.home_description_id,
           s.service_wedding_title_en, s.service_wedding_title_id, s.service_wedding_description_en, s.service_wedding_description_id,
           s.service_events_title_en, s.service_events_title_id, s.service_events_description_en, s.service_events_description_id,
           s.service_other_title_en, s.service_other_title_id, s.service_other_description_en, s.service_other_description_id,
           s.location_en, s.location_id, s.service_area_en, s.service_area_id,
           s.instagram_url, s.whatsapp_number, s.featured_album_ids, s.updated_at,
           logo.id AS logo_id, logo.cloud_name AS logo_cloud_name, logo.public_id AS logo_public_id,
           logo.secure_url AS logo_secure_url, logo.width AS logo_width, logo.height AS logo_height,
           hero.id AS hero_id, hero.cloud_name AS hero_cloud_name, hero.public_id AS hero_public_id,
           hero.secure_url AS hero_secure_url, hero.width AS hero_width, hero.height AS hero_height,
           about.id AS about_id, about.cloud_name AS about_cloud_name, about.public_id AS about_public_id,
           about.secure_url AS about_secure_url, about.width AS about_width, about.height AS about_height
      FROM site_settings s
      LEFT JOIN media_assets logo ON logo.id = s.logo_media_id
      LEFT JOIN media_assets hero ON hero.id = s.hero_media_id
      LEFT JOIN media_assets about ON about.id = s.about_media_id
     WHERE s.singleton = true
  `);
  return result.rows[0] ? mapPublicSiteSettings(result.rows[0]) : null;
}

export async function getFeaturedPublishedAlbums(executor: SqlExecutor = getDb()): Promise<readonly PublicAlbumSummary[]> {
  const result = await executor.query<AlbumSummaryRow>(`
    SELECT a.id, a.slug, a.category, a.title_en, a.title_id, a.location_en, a.location_id,
           cover.id AS cover_id, cover.cloud_name AS cover_cloud_name,
           cover.public_id AS cover_public_id, cover.secure_url AS cover_secure_url,
           cover.width AS cover_width, cover.height AS cover_height,
           coalesce(cover_photo.alt_en, '') AS cover_alt_en, coalesce(cover_photo.alt_id, '') AS cover_alt_id
      FROM site_settings s
     CROSS JOIN LATERAL unnest(s.featured_album_ids) WITH ORDINALITY AS featured(album_id, featured_position)
      JOIN albums a ON a.id = featured.album_id AND a.status = 'published'
      LEFT JOIN media_assets cover ON cover.id = a.cover_media_id
      LEFT JOIN album_photos cover_photo ON cover_photo.album_id = a.id AND cover_photo.media_id = a.cover_media_id
     WHERE s.singleton = true
     ORDER BY featured.featured_position
  `);
  return result.rows.map(mapPublicAlbumSummary);
}
