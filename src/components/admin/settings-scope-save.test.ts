import {expect, test} from "bun:test";

import type {SiteSettingsDraft} from "@/lib/domain";
import {emptySiteSettings, settingsScopeFields, settingsScopes, type SettingsScope} from "@/lib/settings-scopes";
import {
  clearDirty,
  draftScopePayload,
  fieldErrorsCleared,
  fieldScope,
  markDirty,
  saveSettingsScopeDraft,
  scopeErrorCount,
  scopeErrorsCleared,
} from "@/components/admin/settings-scope-save";

const draft: SiteSettingsDraft = {
  ...emptySiteSettings,
  brandName: "Elhaq Photography",
  logoMediaId: "00000000-0000-4000-8000-000000000001",
  logoAlt: {en: "Logo", id: "Logo"},
  heroMediaId: "00000000-0000-4000-8000-000000000002",
  heroAlt: {en: "Hero", id: "Hero"},
  personalIntroduction: {en: "Introduction", id: "Perkenalan"},
  aboutMediaId: null,
  aboutAlt: {en: "", id: ""},
  aboutStory: {en: "Story", id: "Cerita"},
  homeHeadline: {en: "Headline", id: "Judul"},
  homeDescription: {en: "Description", id: "Deskripsi"},
  services: {
    wedding: {title: {en: "Weddings", id: "Pernikahan"}, description: {en: "Wedding work.", id: "Kerja pernikahan."}},
    events: {title: {en: "Events", id: "Acara"}, description: {en: "Event work.", id: "Kerja acara."}},
    other: {title: {en: "Other", id: "Lainnya"}, description: {en: "Other work.", id: "Kerja lainnya."}},
  },
  location: {en: "Bandung", id: "Bandung"},
  serviceArea: {en: "West Java", id: "Jawa Barat"},
  instagramUrl: "https://instagram.com/elhaq",
  whatsappNumber: "+628123456789",
  featuredAlbumIds: [],
};

function recordingRequest(handler: (init?: RequestInit) => Response | Promise<Response>): {
  calls: Array<{url: string; init?: RequestInit}>;
  request: (url: string, init?: RequestInit) => Promise<Response>;
} {
  const calls: Array<{url: string; init?: RequestInit}> = [];
  return {
    calls,
    request: async (url, init) => {
      calls.push({url, init});
      return handler(init);
    },
  };
}

test("marks and clears dirty state per scope", () => {
  const initial = new Set<SettingsScope>();
  const withBrand = markDirty(initial, "brandName");
  const withBoth = markDirty(withBrand, "location");

  expect([...withBoth].sort()).toEqual(["brand", "contact"]);
  expect([...clearDirty(withBoth, "brand")]).toEqual(["contact"]);
});

test("every field maps back to its own scope", () => {
  for (const scope of settingsScopes) {
    for (const field of settingsScopeFields[scope]) expect(fieldScope(field)).toBe(scope);
  }
});

test("clearing one scope's errors keeps the errors of the others", () => {
  const errors = {brandName: "Brand name is required", logoAlt: "Both alternate texts are required", "homeHeadline.en": "English headline is required"};

  expect(scopeErrorsCleared(errors, "brand")).toEqual({"homeHeadline.en": "English headline is required"});
  expect(scopeErrorCount(errors, "brand")).toBe(2);
  expect(scopeErrorCount(errors, "home")).toBe(1);
});

test("editing a field clears only that field's messages", () => {
  const errors = {brandName: "Brand name is required", "logoAlt.en": "English alt is required", "logoAlt.id": "Indonesian alt is required", "homeHeadline.en": "English headline is required"};

  expect(fieldErrorsCleared(errors, "logoAlt")).toEqual({brandName: "Brand name is required", "homeHeadline.en": "English headline is required"});
  expect(fieldErrorsCleared(errors, "brandName")).toEqual({"logoAlt.en": "English alt is required", "logoAlt.id": "Indonesian alt is required", "homeHeadline.en": "English headline is required"});
});

test("a scope save validates and posts only that scope", async () => {
  const {calls, request} = recordingRequest(() => Response.json(draft));

  const outcome = await saveSettingsScopeDraft({scope: "brand", draft, request});

  if (!outcome.ok) throw new Error("EXPECTED_SCOPE_SAVE_SUCCESS");
  expect(outcome.saved).toEqual(draft);
  expect(calls).toHaveLength(1);
  expect(calls[0]?.url).toBe("/api/admin/settings");
  expect(calls[0]?.init?.method).toBe("PATCH");

  const body = JSON.parse(String(calls[0]?.init?.body)) as {scope: string; values: Record<string, unknown>};
  expect(body.scope).toBe("brand");
  expect(body.values).toEqual({
    brandName: "Elhaq Photography",
    logoMediaId: "00000000-0000-4000-8000-000000000001",
    logoAlt: {en: "Logo", id: "Logo"},
  });
});

test("validation errors are trapped locally without issuing a request", async () => {
  const {calls, request} = recordingRequest(() => Response.json(draft));

  const outcome = await saveSettingsScopeDraft({
    scope: "brand",
    draft: {...draft, brandName: "   "},
    request,
  });

  expect(outcome.ok).toBe(false);
  if (outcome.ok) return;
  expect(outcome.errors.brandName).toBe("Brand name is required");
  expect(calls).toHaveLength(0);
});

test("failed response maps to a localized user message", async () => {
  const {request} = recordingRequest(() => new Response(JSON.stringify({code: "FOREIGN_MEDIA_ID"}), {status: 409}));

  const outcome = await saveSettingsScopeDraft({scope: "brand", draft, request});

  expect(outcome.ok).toBe(false);
  if (outcome.ok) return;
  expect(outcome.message).toContain("no longer available");
});
