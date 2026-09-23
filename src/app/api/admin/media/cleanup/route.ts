import {requireAdmin} from "@/lib/authz";
import {HttpError} from "@/lib/errors";
import {listCleanupJournals} from "@/server/admin-media";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    return Response.json({items: await listCleanupJournals(actor)});
  } catch (error) {
    if (error instanceof HttpError) return Response.json({code: error.code}, {status: error.status});
    console.error(JSON.stringify({code: "CLEANUP_LIST_FAILED", error: error instanceof Error ? error.message : String(error)}));
    return Response.json({code: "CLEANUP_LIST_FAILED"}, {status: 500});
  }
}
