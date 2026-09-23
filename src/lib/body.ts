import {HttpError} from "@/lib/errors";

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  const parseJson = (text: string): unknown => {
    try {
      return JSON.parse(text);
    } catch {
      throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON");
    }
  };

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new HttpError(413, "BODY_TOO_LARGE", "Request body is too large");

  const reader = request.body?.getReader();
  if (!reader) {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new HttpError(413, "BODY_TOO_LARGE", "Request body is too large");
    }
    return parseJson(text);
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    total += part.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "BODY_TOO_LARGE", "Request body is too large");
    }
    chunks.push(part.value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return parseJson(new TextDecoder().decode(bytes));
}
