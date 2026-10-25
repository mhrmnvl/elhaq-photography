import type {ZodType} from "zod";

import {ApiFailure, readResponse} from "@/components/admin/album-save";
import type {SiteSettingsDraft} from "@/lib/domain";
import {validateWithZod} from "@/lib/form-validation";
import {settingsScopeFields, settingsScopeSchemas, type SettingsScope} from "@/lib/settings-scopes";

export type SettingsScopeRequest = (url: string, init?: RequestInit) => Promise<Response>;

export type ScopeSaveOutcome =
  | {ok: true; scope: SettingsScope; saved: SiteSettingsDraft}
  | {ok: false; scope: SettingsScope; errors: Record<string, string>; message: string};

const scopeByField = new Map<string, SettingsScope>(
  (Object.keys(settingsScopeFields) as SettingsScope[]).flatMap((scope) => settingsScopeFields[scope].map((field) => [field, scope] as const)),
);

export function draftScopePayload(scope: SettingsScope, draft: SiteSettingsDraft): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of settingsScopeFields[scope]) payload[field] = draft[field];
  return payload;
}

export function fieldScope(field: keyof SiteSettingsDraft): SettingsScope | undefined {
  return scopeByField.get(field);
}

export function markDirty(dirty: ReadonlySet<SettingsScope>, field: keyof SiteSettingsDraft): Set<SettingsScope> {
  const scope = fieldScope(field);
  if (!scope || dirty.has(scope)) return new Set(dirty);
  return new Set([...dirty, scope]);
}

export function clearDirty(dirty: ReadonlySet<SettingsScope>, scope: SettingsScope): Set<SettingsScope> {
  return new Set([...dirty].filter((candidate) => candidate !== scope));
}

function belongsToScope(key: string, scope: SettingsScope): boolean {
  return settingsScopeFields[scope].some((field) => key === field || key.startsWith(`${field}.`));
}

export function scopeErrorsCleared(errors: Record<string, string>, scope: SettingsScope): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) {
    if (!belongsToScope(key, scope)) next[key] = message;
  }
  return next;
}

export function fieldErrorsCleared(errors: Record<string, string>, field: string): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) {
    if (key !== field && !key.startsWith(`${field}.`)) next[key] = message;
  }
  return next;
}

export function scopeErrorCount(errors: Record<string, string>, scope: SettingsScope): number {
  return Object.keys(errors).length - Object.keys(scopeErrorsCleared(errors, scope)).length;
}

function messageFor(error: unknown): string {
  if (!(error instanceof ApiFailure)) return "The settings could not be saved. Try again.";
  if (error.code === "VALIDATION_FAILED") return "Check every required English and Indonesian field, plus the contact links.";
  if (error.code === "FOREIGN_MEDIA_ID") return "One selected media item is no longer available. Choose it again.";
  if (error.code === "FEATURED_ALBUM_NOT_PUBLISHED") return "Only published albums can be featured.";
  return "The settings could not be saved. Try again.";
}

export async function saveSettingsScopeDraft({
  scope,
  draft,
  request = fetch,
}: {
  scope: SettingsScope;
  draft: SiteSettingsDraft;
  request?: SettingsScopeRequest;
}): Promise<ScopeSaveOutcome> {
  const validation = validateWithZod(settingsScopeSchemas[scope] as ZodType<unknown>, draftScopePayload(scope, draft));
  if (!validation.ok) {
    return {ok: false, scope, errors: validation.errors, message: "Please check the highlighted fields below."};
  }

  try {
    const response = await request("/api/admin/settings", {
      method: "PATCH",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({scope, values: validation.data}),
    });
    return {ok: true, scope, saved: await readResponse<SiteSettingsDraft>(response)};
  } catch (error) {
    return {ok: false, scope, errors: {}, message: messageFor(error)};
  }
}
