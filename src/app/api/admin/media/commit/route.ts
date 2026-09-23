import {assertSameOrigin, requireAdmin} from "@/lib/authz";
import {readJsonBody} from "@/lib/body";
import {parseClientUploadResult} from "@/lib/cloudinary";
import {HttpError} from "@/lib/errors";
import {commitUploadedMedia} from "@/server/admin-media";

export const runtime = "nodejs";

function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return Response.json({code: error.code}, {status: error.status});
  console.error(JSON.stringify({code: "MEDIA_COMMIT_FAILED", error: error instanceof Error ? error.message : String(error)}));
  return Response.json({code: "MEDIA_COMMIT_FAILED"}, {status: 500});
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    assertSameOrigin(request);
    const result = await commitUploadedMedia(actor, parseClientUploadResult(await readJsonBody(request, 8 * 1024)));
    return Response.json(result, {status: result.status === "created" ? 201 : 200});
  } catch (error) {
    return errorResponse(error);
  }
}
