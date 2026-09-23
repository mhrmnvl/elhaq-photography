import {requireAdmin} from "@/lib/authz";
import {HttpError} from "@/lib/errors";
import {listContactMessages} from "@/server/admin-messages";

export const runtime = "nodejs";

function errorResponse(error: unknown, fallback: string): Response {
  if (error instanceof HttpError) return Response.json({code: error.code}, {status: error.status});
  console.error(JSON.stringify({code: fallback, error: error instanceof Error ? error.message : String(error)}));
  return Response.json({code: fallback}, {status: 500});
}

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    return Response.json({items: await listContactMessages(actor)});
  } catch (error) {
    return errorResponse(error, "MESSAGE_LIST_FAILED");
  }
}
