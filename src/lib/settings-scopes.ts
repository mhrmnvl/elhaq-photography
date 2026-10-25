import {z} from "zod";

import type {SiteSettingsDraft} from "@/lib/domain";

export const settingsScopes = ["brand", "home", "about", "services", "contact", "featured"] as const;

export type SettingsScope = (typeof settingsScopes)[number];

export const settingsScopeFields = {
  brand: ["brandName", "logoMediaId", "logoAlt"],
  home: ["heroMediaId", "heroAlt", "homeHeadline", "homeDescription", "personalIntroduction"],
  about: ["aboutMediaId", "aboutAlt", "aboutStory"],
  services: ["services"],
  contact: ["location", "serviceArea", "instagramUrl", "whatsappNumber"],
  featured: ["featuredAlbumIds"],
} as const satisfies Record<SettingsScope, readonly (keyof SiteSettingsDraft)[]>;

export type SettingsScopePayload<S extends SettingsScope> = Pick<SiteSettingsDraft, (typeof settingsScopeFields)[S][number]>;

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

export const settingsMediaAltRules = [
  {media: "logoMediaId", alt: "logoAlt"},
  {media: "heroMediaId", alt: "heroAlt"},
  {media: "aboutMediaId", alt: "aboutAlt"},
] as const;

const bilingual = (label: string, max = 5000) => z.object({
  en: z.string().trim().min(1, `English ${label} is required`).max(max, `English ${label} must be ${max} characters or fewer`),
  id: z.string().trim().min(1, `Indonesian ${label} is required`).max(max, `Indonesian ${label} must be ${max} characters or fewer`),
}).strict();

const optionalAlt = z.object({
  en: z.string().trim().max(200, "Alternate text must be 200 characters or fewer"),
  id: z.string().trim().max(200, "Alternate text must be 200 characters or fewer"),
}).strict();

const mediaId = z.string().uuid("Choose a valid media item").nullable();

const serviceSchema = z.object({
  title: bilingual("service title", 5000),
  description: bilingual("service description", 5000),
}).strict();

const instagramUrl = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().url("Enter a valid Instagram URL (https://instagram.com/...)").nullable().optional(),
).transform((value) => value ?? null).refine((value) => {
  if (value === null) return true;
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  return url.protocol === "https:" && (host === "instagram.com" || host === "www.instagram.com");
}, "Enter a valid Instagram URL (https://instagram.com/...)");

const whatsappNumber = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(32, "WhatsApp number must be 32 characters or fewer").regex(/^\+?[0-9][0-9 ()-]{5,31}$/, "Enter a valid WhatsApp number").nullable().optional(),
).transform((value) => value === null || value === undefined ? null : value.replace(/[ ()-]/g, ""));

const settingsScopeShapes = {
  brand: {
    brandName: z.string().trim().min(1, "Brand name is required").max(160, "Brand name must be 160 characters or fewer"),
    logoMediaId: mediaId,
    logoAlt: optionalAlt,
  },
  home: {
    heroMediaId: mediaId,
    heroAlt: optionalAlt,
    homeHeadline: bilingual("headline"),
    homeDescription: bilingual("description"),
    personalIntroduction: bilingual("introduction"),
  },
  about: {
    aboutMediaId: mediaId,
    aboutAlt: optionalAlt,
    aboutStory: bilingual("story"),
  },
  services: {
    services: z.object({wedding: serviceSchema, events: serviceSchema, other: serviceSchema}).strict(),
  },
  contact: {
    location: bilingual("location"),
    serviceArea: bilingual("service area"),
    instagramUrl,
    whatsappNumber,
  },
  featured: {
    featuredAlbumIds: z.array(z.string().uuid("Choose a valid album")).max(50, "A maximum of 50 albums can be featured"),
  },
} as const satisfies Record<SettingsScope, z.ZodRawShape>;

export function withMediaAltRules<T extends z.ZodType>(schema: T): T {
  return schema.superRefine((value, context) => {
    const record = value as Record<string, unknown>;
    for (const {media, alt} of settingsMediaAltRules) {
      const altValue = record[alt] as {en?: string; id?: string} | undefined;
      if (record[media] && (!altValue?.en || !altValue?.id)) {
        context.addIssue({code: "custom", path: [alt], message: "Both alternate texts are required"});
      }
    }
  }) as T;
}

export const settingsScopeSchemas: {[S in SettingsScope]: z.ZodType<SettingsScopePayload<S>>} = {
  brand: withMediaAltRules(z.object(settingsScopeShapes.brand).strict()),
  home: withMediaAltRules(z.object(settingsScopeShapes.home).strict()),
  about: withMediaAltRules(z.object(settingsScopeShapes.about).strict()),
  services: z.object(settingsScopeShapes.services).strict(),
  contact: z.object(settingsScopeShapes.contact).strict(),
  featured: z.object(settingsScopeShapes.featured).strict(),
};

export const siteSettingsShape = {
  ...settingsScopeShapes.brand,
  ...settingsScopeShapes.home,
  ...settingsScopeShapes.about,
  ...settingsScopeShapes.services,
  ...settingsScopeShapes.contact,
  ...settingsScopeShapes.featured,
};
