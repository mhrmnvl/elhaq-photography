import {requireAdmin} from "@/lib/authz";
import {HttpError} from "@/lib/errors";
import {searchAdminContent} from "@/server/admin-search";

export const runtime = "nodejs";

function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({code: error.code}, {status: error.status, headers: {"Cache-Control": "no-store"}});
  }
  console.error(JSON.stringify({code: "ADMIN_SEARCH_FAILED", error: error instanceof Error ? error.message : String(error)}));
  return Response.json({code: "ADMIN_SEARCH_FAILED"}, {status: 500, headers: {"Cache-Control": "no-store"}});
}

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    const query = new URL(request.url).searchParams.get("q") ?? "";
    if (query.length > 100) throw new HttpError(400, "SEARCH_QUERY_TOO_LONG", "Search queries cannot exceed 100 characters");

    return Response.json(await searchAdminContent(actor, query), {headers: {"Cache-Control": "no-store"}});
  } catch (error) {
    return errorResponse(error);
  }
}
