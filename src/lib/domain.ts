export type Locale = "en" | "id";

export type AlbumCategory = "wedding" | "events" | "other";
export type AlbumStatus = "draft" | "published";
export type BilingualText = {en: string; id: string};
export type ServiceContent = {title: BilingualText; description: BilingualText};

export type AdminMediaAsset = {
  id: string;
  cloudName: string;
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  referenceCount: number;
};

export type CleanupJournalEntry = {
  id: string;
  operation: "upload_compensation" | "remote_delete";
  status: "pending" | "resolved";
  mediaId: string | null;
  cloudName: string;
  publicId: string;
  reason: string;
  attempts: number;
  lastAttemptAt: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type PublicMediaAsset = {
  id: string;
  cloudName: string;
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  alt: BilingualText;
};

export type AlbumPhoto = {media: PublicMediaAsset; position: number};

export type AdminAlbum = {
  id: string;
  slug: string;
  category: AlbumCategory;
  title: BilingualText;
  story: BilingualText;
  status: AlbumStatus;
  coverMediaId: string | null;
  sortOrder: number;
  updatedAt: string;
  photos: readonly AlbumPhoto[];
};

export type NotificationStatus = "disabled" | "pending" | "sent" | "failed";

export type PrivateClientLink = {
  id: string;
  albumName: string;
  driveUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminContactMessageSummary = {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  eventType: AlbumCategory;
  notificationStatus: NotificationStatus;
  createdAt: string;
};

export type AdminContactMessage = AdminContactMessageSummary & {
  eventDate: string | null;
  eventLocation: string | null;
  message: string;
};

export type PublicAlbumSummary = {
  id: string;
  slug: string;
  category: AlbumCategory;
  title: BilingualText;
  cover: PublicMediaAsset | null;
};

export type PublicAlbum = PublicAlbumSummary & {
  story: BilingualText;
  photos: readonly AlbumPhoto[];
};

export type SiteSettingsDraft = {
  brandName: string;
  logoMediaId: string | null;
  heroMediaId: string | null;
  logoAlt: BilingualText;
  heroAlt: BilingualText;
  personalIntroduction: BilingualText;
  aboutMediaId: string | null;
  aboutAlt: BilingualText;
  aboutStory: BilingualText;
  homeHeadline: BilingualText;
  homeDescription: BilingualText;
  services: {wedding: ServiceContent; events: ServiceContent; other: ServiceContent};
  location: BilingualText;
  serviceArea: BilingualText;
  instagramUrl: string | null;
  whatsappNumber: string | null;
  featuredAlbumIds: readonly string[];
};

export type PublicSiteSettings = Omit<SiteSettingsDraft, "logoMediaId" | "heroMediaId" | "aboutMediaId" | "featuredAlbumIds"> & {
  logo: PublicMediaAsset | null;
  hero: PublicMediaAsset | null;
  about: PublicMediaAsset | null;
};
