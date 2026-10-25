import {assertSameOrigin, requireAdmin} from "@/lib/authz";
import {readJsonBody} from "@/lib/body";
import {HttpError} from "@/lib/errors";
import type {SettingsScope} from "@/lib/settings-scopes";
import {getAdminSettings, parseSettingsScopeInput, parseSiteSettingsInput, saveSettingsScope, saveSiteSettings} from "@/server/admin-settings";

export const runtime = "nodejs";

function errorResponse(error: unknown, fallback: string): Response {
  if (error instanceof HttpError) return Response.json({code: error.code}, {status: error.status});
  console.error(JSON.stringify({code: fallback, error: error instanceof Error ? error.message : String(error)}));
  return Response.json({code: fallback}, {status: 500});
}

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    return Response.json(await getAdminSettings(actor));
  } catch (error) {
    return errorResponse(error, "SETTINGS_GET_FAILED");
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    assertSameOrigin(request);
    const body = await readJsonBody(request, 128 * 1024);
    if (body !== null && typeof body === "object" && "scope" in body) {
      const {scope, values} = body as {scope: SettingsScope; values: unknown};
      return Response.json(await saveSettingsScope(actor, scope, parseSettingsScopeInput(scope, values)));
    }
    return Response.json(await saveSiteSettings(actor, parseSiteSettingsInput(body)));
  } catch (error) {
    return errorResponse(error, "SETTINGS_SAVE_FAILED");
  }
}
