import {assertSameOrigin} from "@/lib/authz";
import {readJsonBody} from "@/lib/body";
import {HttpError} from "@/lib/errors";
import {extractTrustedClientIp} from "@/lib/rate-limit";
import {getContactMailer} from "@/lib/resend";
import {submitContact} from "@/server/contact";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const raw = await readJsonBody(request, 32 * 1024);
    const result = await submitContact(raw, {ip: extractTrustedClientIp(request)}, {mailer: getContactMailer()});
    if (result.ok) {
      return Response.json({ok: true, confirmation: "saved", duplicate: !result.created}, {status: result.created ? 201 : 200});
    }
    if (result.kind === "validation") {
      return Response.json({ok: false, code: "VALIDATION_FAILED", fieldErrors: result.fieldErrors}, {status: 400});
    }
    if (result.kind === "idempotency_conflict") {
      return Response.json({ok: false, code: "IDEMPOTENCY_PAYLOAD_MISMATCH"}, {status: 409});
    }
    if (result.kind === "rate_limited") {
      return Response.json(
        {ok: false, code: "RATE_LIMITED", retryAfterSeconds: result.retryAfterSeconds},
        {status: 429, headers: {"Retry-After": String(result.retryAfterSeconds)}},
      );
    }
    return Response.json({ok: false, code: "MESSAGE_NOT_SAVED"}, {status: 500});
  } catch (error) {
    if (error instanceof HttpError) return Response.json({ok: false, code: error.code}, {status: error.status});
    console.error(JSON.stringify({code: "CONTACT_ROUTE_FAILED", error: error instanceof Error ? error.message : String(error)}));
    return Response.json({ok: false, code: "MESSAGE_NOT_SAVED"}, {status: 500});
  }
}
