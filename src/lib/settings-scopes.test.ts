import {expect, test} from "bun:test";

import type {SiteSettingsDraft} from "@/lib/domain";
import {
  emptySiteSettings,
  settingsScopeFields,
  settingsScopeSchemas,
  settingsScopes,
  type SettingsScope,
} from "@/lib/settings-scopes";

const draft: SiteSettingsDraft = {
  brandName: "Elhaq Photography",
  logoMediaId: "00000000-0000-4000-8000-000000000001",
  logoAlt: {en: "Elhaq Photography logo", id: "Logo Elhaq Photography"},
  heroMediaId: "00000000-0000-4000-8000-000000000002",
  heroAlt: {en: "Wedding photograph", id: "Foto pernikahan"},
  personalIntroduction: {en: "I photograph weddings and events.", id: "Saya memotret pernikahan dan acara."},
  aboutMediaId: "00000000-0000-4000-8000-000000000003",
  aboutAlt: {en: "Photographer portrait", id: "Potret fotografer"},
  aboutStory: {en: "I work with a calm, attentive approach.", id: "Saya bekerja dengan pendekatan yang tenang."},
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
  featuredAlbumIds: ["00000000-0000-4000-8000-000000000004"],
};

function pick(scope: SettingsScope): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of settingsScopeFields[scope]) payload[field] = draft[field];
  return payload;
}

test("every settings field belongs to exactly one scope", () => {
  const declared = settingsScopes.flatMap((scope) => settingsScopeFields[scope].map(String)).sort();

  expect(declared).toEqual(Object.keys(draft).sort());
  expect(new Set(declared).size).toBe(declared.length);
});

test("each scope accepts only its own slice", () => {
  for (const scope of settingsScopes) {
    expect(settingsScopeSchemas[scope].safeParse(pick(scope)).success).toBe(true);
  }

  for (const scope of settingsScopes) {
    const other = settingsScopes.find((candidate) => candidate !== scope);
    if (!other) throw new Error("SCOPE_FIXTURE_MISSING");
    const foreignField = settingsScopeFields[other][0];
    const result = settingsScopeSchemas[scope].safeParse({...pick(scope), [foreignField]: draft[foreignField]});
    expect(result.success).toBe(false);
  }
});

test("a scope requires both alt texts only when its media is chosen", () => {
  const pairs = [
    ["brand", "logoMediaId", "logoAlt"],
    ["home", "heroMediaId", "heroAlt"],
    ["about", "aboutMediaId", "aboutAlt"],
  ] as const;

  for (const [scope, mediaField, altField] of pairs) {
    const withMedia = settingsScopeSchemas[scope].safeParse({...pick(scope), [mediaField]: draft[mediaField], [altField]: {en: "", id: ""}});
    const withoutMedia = settingsScopeSchemas[scope].safeParse({...pick(scope), [mediaField]: null, [altField]: {en: "", id: ""}});

    expect(withMedia.success).toBe(false);
    expect(withoutMedia.success).toBe(true);
  }
});

test("the contact scope normalizes optional links and rejects invalid ones", () => {
  const parsed = settingsScopeSchemas.contact.parse({...pick("contact"), instagramUrl: "   ", whatsappNumber: " +62 812-3456-789 "});

  expect(parsed.instagramUrl).toBeNull();
  expect(parsed.whatsappNumber).toBe("+628123456789");
  expect(settingsScopeSchemas.contact.safeParse({...pick("contact"), instagramUrl: "https://example.com/profile"}).success).toBe(false);
  expect(settingsScopeSchemas.contact.safeParse({...pick("contact"), location: {en: "", id: "Kabupaten Bandung"}}).success).toBe(false);
});

test("the featured scope accepts only uuid album ids and caps the list", () => {
  expect(settingsScopeSchemas.featured.safeParse({featuredAlbumIds: []}).success).toBe(true);
  expect(settingsScopeSchemas.featured.safeParse({featuredAlbumIds: ["not-a-uuid"]}).success).toBe(false);

  const tooMany = Array.from({length: 51}, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`);
  expect(settingsScopeSchemas.featured.safeParse({featuredAlbumIds: tooMany}).success).toBe(false);
});

test("the empty draft covers every settings field", () => {
  expect(Object.keys(emptySiteSettings).sort()).toEqual(Object.keys(draft).sort());
});
