import {assertSameOrigin, requireAdmin} from "@/lib/authz";
import {readJsonBody} from "@/lib/body";
import {HttpError} from "@/lib/errors";
import {getAdminSettings, parseSiteSettingsInput, saveSiteSettings} from "@/server/admin-settings";

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
    const input = parseSiteSettingsInput(await readJsonBody(request, 128 * 1024));
    return Response.json(await saveSiteSettings(actor, input));
  } catch (error) {
    return errorResponse(error, "SETTINGS_SAVE_FAILED");
  }
}
