import {expect, test} from "bun:test";

import {readJsonBody} from "@/lib/body";
import {HttpError} from "@/lib/errors";
import {parseContactInput} from "@/lib/contact-validation";

const submissionKey = "00000000-0000-4000-8000-000000000001";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    submissionKey,
    name: "Ari",
    email: "ari@example.com",
    whatsapp: null,
    eventType: "wedding",
    eventDate: "2028-02-29",
    eventLocation: "Bandung",
    message: "Please share availability.",
    ...overrides,
  };
}

function fieldErrors(raw: unknown) {
  const result = parseContactInput(raw);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected validation failure");
  return result.fieldErrors;
}

function parsedValue(raw: unknown) {
  const result = parseContactInput(raw);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected valid contact input");
  return result.value;
}

test("normalizes email and local WhatsApp numbers while accepting leap day", () => {
  const result = parsedValue(validInput({
    email: " Ari@Example.COM ",
    whatsapp: "0812 (345) 678",
  }));

  expect(result.email).toBe("ari@example.com");
  expect(result.whatsapp).toBe("62812345678");
  expect(result.eventDate).toBe("2028-02-29");
});

test("requires the contact fields and required message fields", () => {
  const errors = fieldErrors({submissionKey});

  expect(errors).toHaveProperty("name");
  expect(errors).toHaveProperty("eventType");
  expect(errors).toHaveProperty("message");
});

test("requires either email or WhatsApp", () => {
  expect(fieldErrors(validInput({email: null, whatsapp: null}))).toHaveProperty("email");
});

test("rejects invalid and overlong email values", () => {
  expect(fieldErrors(validInput({email: "not-an-email"}))).toHaveProperty("email");
  expect(fieldErrors(validInput({email: `${"a".repeat(250)}@example.com`}))).toHaveProperty("email");
});

test("rejects WhatsApp values outside the actual digit boundary", () => {
  expect(fieldErrors(validInput({email: null, whatsapp: "+123456"}))).toHaveProperty("whatsapp");
  expect(fieldErrors(validInput({email: null, whatsapp: "+1234567890123456"}))).toHaveProperty("whatsapp");
  expect(fieldErrors(validInput({email: null, whatsapp: "+12345678901234567890123456789012"}))).toHaveProperty("whatsapp");
  expect(fieldErrors(validInput({email: null, whatsapp: "123/4567890"}))).toHaveProperty("whatsapp");
});

test("rejects malformed calendar dates and invalid event types", () => {
  expect(fieldErrors(validInput({eventDate: "2027-02-29"}))).toHaveProperty("eventDate");
  expect(fieldErrors(validInput({eventDate: "2028-13-01"}))).toHaveProperty("eventDate");
  expect(fieldErrors(validInput({eventType: "portrait"}))).toHaveProperty("eventType");
});

test("enforces message and location limits and UUID submission keys", () => {
  expect(fieldErrors(validInput({message: "x".repeat(5001)}))).toHaveProperty("message");
  expect(fieldErrors(validInput({eventLocation: "x".repeat(201)}))).toHaveProperty("eventLocation");
  expect(fieldErrors(validInput({submissionKey: "not-a-uuid"}))).toHaveProperty("submissionKey");
});

test("keeps script-looking input as plain string data", () => {
  const message = "<script>alert(1)</script>";
  const result = parsedValue(validInput({message}));

  expect(result.message).toBe(message);
});

test("maps malformed JSON to INVALID_JSON", async () => {
  const request = new Request("http://localhost/api/contact", {
    method: "POST",
    body: "{",
    headers: {"content-type": "application/json"},
  });

  await expect(readJsonBody(request, 32 * 1024)).rejects.toMatchObject({
    status: 400,
    code: "INVALID_JSON",
  } satisfies Partial<HttpError>);
});

test("rejects a declared body larger than the cap before reading it", async () => {
  const request = new Request("http://localhost/api/contact", {
    method: "POST",
    body: "{}",
    headers: {"content-length": String(32 * 1024 + 1)},
  });

  await expect(readJsonBody(request, 32 * 1024)).rejects.toMatchObject({
    status: 413,
    code: "BODY_TOO_LARGE",
  });
});

test("caps chunked request bodies while accumulating bytes", async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("x".repeat(20)));
      controller.enqueue(new TextEncoder().encode("x".repeat(20)));
      controller.close();
    },
  });
  const request = new Request("http://localhost/api/contact", {
    method: "POST",
    body,
    headers: {"content-type": "application/json"},
  });

  await expect(readJsonBody(request, 32)).rejects.toMatchObject({
    status: 413,
    code: "BODY_TOO_LARGE",
  });
});
