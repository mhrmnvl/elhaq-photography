import {assertSameOrigin, requireAdmin} from "@/lib/authz";
import {HttpError} from "@/lib/errors";
import {retryCleanup} from "@/server/admin-media";

export const runtime = "nodejs";

type RouteContext = {params: Promise<{id: string}>};

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    assertSameOrigin(request);
    return Response.json(await retryCleanup(actor, (await context.params).id));
  } catch (error) {
    if (error instanceof HttpError) return Response.json({code: error.code}, {status: error.status});
    console.error(JSON.stringify({code: "CLEANUP_RETRY_FAILED", error: error instanceof Error ? error.message : String(error)}));
    return Response.json({code: "CLEANUP_RETRY_FAILED"}, {status: 500});
  }
}
