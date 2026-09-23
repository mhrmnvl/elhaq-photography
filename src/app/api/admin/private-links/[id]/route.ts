import {z} from "zod";

import {assertSameOrigin, requireAdmin} from "@/lib/authz";
import {readJsonBody} from "@/lib/body";
import {HttpError} from "@/lib/errors";
import {
  deletePrivateClientLink,
  getPrivateClientLink,
  parsePrivateClientLinkInput,
  updatePrivateClientLink,
} from "@/server/admin-private-links";

export const runtime = "nodejs";

type RouteContext = {params: Promise<{id: string}>};

function readId(id: string): string {
  if (!z.string().uuid().safeParse(id).success) throw new HttpError(400, "INVALID_ID", "Private link ID is invalid");
  return id;
}

function errorResponse(error: unknown, fallback: string): Response {
  if (error instanceof HttpError) return Response.json({code: error.code}, {status: error.status});
  console.error(JSON.stringify({code: fallback, error: error instanceof Error ? error.message : String(error)}));
  return Response.json({code: fallback}, {status: 500});
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    const link = await getPrivateClientLink(actor, readId((await context.params).id));
    if (!link) return Response.json({code: "PRIVATE_LINK_NOT_FOUND"}, {status: 404});
    return Response.json(link);
  } catch (error) {
    return errorResponse(error, "PRIVATE_LINK_GET_FAILED");
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    assertSameOrigin(request);
    const id = readId((await context.params).id);
    const input = parsePrivateClientLinkInput(await readJsonBody(request, 32 * 1024));
    return Response.json(await updatePrivateClientLink(actor, id, input));
  } catch (error) {
    return errorResponse(error, "PRIVATE_LINK_UPDATE_FAILED");
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    assertSameOrigin(request);
    const id = readId((await context.params).id);
    await deletePrivateClientLink(actor, id);
    return Response.json({ok: true});
  } catch (error) {
    return errorResponse(error, "PRIVATE_LINK_DELETE_FAILED");
  }
}
