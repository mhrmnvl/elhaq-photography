import {assertSameOrigin, requireAdmin} from "@/lib/authz";
import {HttpError} from "@/lib/errors";
import {deleteMediaIfUnreferenced, getAdminMedia} from "@/server/admin-media";

export const runtime = "nodejs";

function errorResponse(error: unknown, fallback: string): Response {
  if (error instanceof HttpError) return Response.json({code: error.code}, {status: error.status});
  console.error(JSON.stringify({code: fallback, error: error instanceof Error ? error.message : String(error)}));
  return Response.json({code: fallback}, {status: 500});
}

type RouteContext = {params: Promise<{id: string}>};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    const media = await getAdminMedia(actor, (await context.params).id);
    if (!media) return Response.json({code: "MEDIA_NOT_FOUND"}, {status: 404});
    return Response.json(media);
  } catch (error) {
    return errorResponse(error, "MEDIA_GET_FAILED");
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    assertSameOrigin(request);
    const result = await deleteMediaIfUnreferenced(actor, (await context.params).id);
    return Response.json(result, {status: result.status === "in_use" ? 409 : 200});
  } catch (error) {
    return errorResponse(error, "MEDIA_DELETE_FAILED");
  }
}
