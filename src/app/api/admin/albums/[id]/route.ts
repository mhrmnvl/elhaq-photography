import {assertSameOrigin, requireAdmin} from "@/lib/authz";
import {readJsonBody} from "@/lib/body";
import {HttpError} from "@/lib/errors";
import {deleteAlbum, getAdminAlbum, parseAlbumInput, updateAlbum} from "@/server/admin-albums";

export const runtime = "nodejs";

type RouteContext = {params: Promise<{id: string}>};

function errorResponse(error: unknown, fallback: string): Response {
  if (error instanceof HttpError) return Response.json({code: error.code}, {status: error.status});
  console.error(JSON.stringify({code: fallback, error: error instanceof Error ? error.message : String(error)}));
  return Response.json({code: fallback}, {status: 500});
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    const album = await getAdminAlbum(actor, (await context.params).id);
    if (!album) return Response.json({code: "ALBUM_NOT_FOUND"}, {status: 404});
    return Response.json(album);
  } catch (error) {
    return errorResponse(error, "ALBUM_GET_FAILED");
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    assertSameOrigin(request);
    const body = await readJsonBody(request, 64 * 1024);
    const {id} = await context.params;
    return Response.json(await updateAlbum(actor, id, parseAlbumInput(body), {expectedUpdatedAt: request.headers.get("if-unmodified-since") ?? undefined}));
  } catch (error) {
    return errorResponse(error, "ALBUM_UPDATE_FAILED");
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    assertSameOrigin(request);
    await deleteAlbum(actor, (await context.params).id, {expectedUpdatedAt: request.headers.get("if-unmodified-since") ?? undefined});
    return Response.json({ok: true});
  } catch (error) {
    return errorResponse(error, "ALBUM_DELETE_FAILED");
  }
}
