import {assertSameOrigin, requireAdmin} from "@/lib/authz";
import {readJsonBody} from "@/lib/body";
import {HttpError} from "@/lib/errors";
import {createAlbum, listAdminAlbums, parseAlbumInput} from "@/server/admin-albums";

export const runtime = "nodejs";

const idempotencyKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function readIdempotencyKey(request: Request): string {
  const key = request.headers.get("idempotency-key");
  if (!key) throw new HttpError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required");
  if (!idempotencyKeyPattern.test(key)) throw new HttpError(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key header is invalid");
  return key;
}

function errorResponse(error: unknown, fallback: string): Response {
  if (error instanceof HttpError) return Response.json({code: error.code}, {status: error.status});
  console.error(JSON.stringify({code: fallback, error: error instanceof Error ? error.message : String(error)}));
  return Response.json({code: fallback}, {status: 500});
}

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    return Response.json({items: await listAdminAlbums(actor)});
  } catch (error) {
    return errorResponse(error, "ALBUM_LIST_FAILED");
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireAdmin(request.headers);
    assertSameOrigin(request);
    const idempotencyKey = readIdempotencyKey(request);
    const body = await readJsonBody(request, 64 * 1024);
    return Response.json(await createAlbum(actor, parseAlbumInput(body), {idempotencyKey}), {status: 201});
  } catch (error) {
    return errorResponse(error, "ALBUM_CREATE_FAILED");
  }
}
