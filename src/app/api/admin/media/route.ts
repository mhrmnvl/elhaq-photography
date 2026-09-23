import {assertSameOrigin, requireAdmin} from "@/lib/authz";
import {readJsonBody} from "@/lib/body";
import {parseUploadDeclaration} from "@/lib/cloudinary";
import {HttpError} from "@/lib/errors";
import {createUploadIntent, listAdminMedia} from "@/server/admin-media";

export const runtime = "nodejs";

function errorResponse(error: unknown, fallback: string): Response {
  if (error instanceof HttpError) return Response.json({code: error.code}, {status: error.status});
  console.error(JSON.stringify({code: fallback, error: error instanceof Error ? error.message : String(error)}));
  return Response.json({code: fallback}, {status: 500});
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    assertSameOrigin(request);
    const declaration = parseUploadDeclaration(await readJsonBody(request, 8 * 1024));
    return Response.json(await createUploadIntent(actor, declaration), {status: 201});
  } catch (error) {
    return errorResponse(error, "MEDIA_INTENT_FAILED");
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    return Response.json({items: await listAdminMedia(actor)});
  } catch (error) {
    return errorResponse(error, "MEDIA_LIST_FAILED");
  }
}
