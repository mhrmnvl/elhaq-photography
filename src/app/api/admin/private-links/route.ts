import {assertSameOrigin, requireAdmin} from "@/lib/authz";
import {readJsonBody} from "@/lib/body";
import {HttpError} from "@/lib/errors";
import {
  createPrivateClientLink,
  listPrivateClientLinks,
  parsePrivateClientLinkInput,
} from "@/server/admin-private-links";

export const runtime = "nodejs";

function errorResponse(error: unknown, fallback: string): Response {
  if (error instanceof HttpError) return Response.json({code: error.code}, {status: error.status});
  console.error(JSON.stringify({code: fallback, error: error instanceof Error ? error.message : String(error)}));
  return Response.json({code: fallback}, {status: 500});
}

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    return Response.json({items: await listPrivateClientLinks(actor)});
  } catch (error) {
    return errorResponse(error, "PRIVATE_LINK_LIST_FAILED");
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    assertSameOrigin(request);
    const input = parsePrivateClientLinkInput(await readJsonBody(request, 32 * 1024));
    return Response.json(await createPrivateClientLink(actor, input), {status: 201});
  } catch (error) {
    return errorResponse(error, "PRIVATE_LINK_CREATE_FAILED");
  }
}
