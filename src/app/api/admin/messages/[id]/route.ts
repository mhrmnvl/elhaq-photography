import {z} from "zod";

import {requireAdmin} from "@/lib/authz";
import {HttpError} from "@/lib/errors";
import {getContactMessage} from "@/server/admin-messages";

export const runtime = "nodejs";

type RouteContext = {params: Promise<{id: string}>};

function readId(id: string): string {
  if (!z.string().uuid().safeParse(id).success) throw new HttpError(400, "INVALID_ID", "Message ID is invalid");
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
    const message = await getContactMessage(actor, readId((await context.params).id));
    if (!message) return Response.json({code: "MESSAGE_NOT_FOUND"}, {status: 404});
    return Response.json(message);
  } catch (error) {
    return errorResponse(error, "MESSAGE_GET_FAILED");
  }
}
