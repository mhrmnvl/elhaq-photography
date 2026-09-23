import {assertSameOrigin, requireAdmin} from "@/lib/authz";
import {readJsonBody} from "@/lib/body";
import {HttpError} from "@/lib/errors";
import {parsePublishInput, publishAlbum, unpublishAlbum} from "@/server/admin-albums";

export const runtime = "nodejs";

type RouteContext = {params: Promise<{id: string}>};

function errorResponse(error: unknown, fallback: string): Response {
  if (error instanceof HttpError) return Response.json({code: error.code}, {status: error.status});
  console.error(JSON.stringify({code: fallback, error: error instanceof Error ? error.message : String(error)}));
  return Response.json({code: fallback}, {status: 500});
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    assertSameOrigin(request);
    const body = parsePublishInput(await readJsonBody(request, 64 * 1024));
    const id = (await context.params).id;
    const overrides = {expectedUpdatedAt: request.headers.get("if-unmodified-since") ?? undefined};
    return Response.json(body.published ? await publishAlbum(actor, id, overrides) : await unpublishAlbum(actor, id, overrides));
  } catch (error) {
    return errorResponse(error, "ALBUM_PUBLISH_FAILED");
  }
}
