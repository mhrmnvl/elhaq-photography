import {expect, test} from "bun:test";

import {mapContactResponse} from "@/components/contact-form";
import {dateFromInputValue, dateToInputValue} from "@/components/ui/date-picker";

const messages = {
  saved: "Your message has been saved. I will reply through the contact details you shared.",
  rateLimited: "Please wait before sending another message.",
  validation: "Check the highlighted fields.",
  requiredChannel: "Add an email or WhatsApp number.",
  conflict: "This form was submitted with different details. Review the fields and try again.",
  newEnquiry: "Start a new enquiry",
  retry: "Try again",
};

test("maps validation field errors to localized field messages", () => {
  expect(mapContactResponse(400, {
    ok: false,
    code: "VALIDATION_FAILED",
    fieldErrors: {
      email: ["Email or WhatsApp is required"],
      message: ["Too long"],
    },
  }, messages)).toEqual({
    fieldErrors: {
      email: [messages.requiredChannel],
      message: [messages.validation],
    },
    status: {kind: "error", message: messages.validation},
  });
});

test("maps an idempotency conflict to a non-field action", () => {
  expect(mapContactResponse(409, {ok: false, code: "IDEMPOTENCY_PAYLOAD_MISMATCH"}, messages)).toEqual({
    fieldErrors: {},
    status: {kind: "conflict", message: messages.conflict, actionLabel: messages.newEnquiry},
  });
});

test("maps rate limiting to wait text", () => {
  expect(mapContactResponse(429, {ok: false, code: "RATE_LIMITED", retryAfterSeconds: 60}, messages)).toEqual({
    fieldErrors: {},
    status: {kind: "error", message: messages.rateLimited},
  });
});

test("maps storage failure to retry text", () => {
  expect(mapContactResponse(500, {ok: false, code: "MESSAGE_NOT_SAVED"}, messages)).toEqual({
    fieldErrors: {},
    status: {kind: "error", message: messages.retry},
  });
});

test("maps a saved response without claiming email delivery", () => {
  const mapped = mapContactResponse(201, {ok: true, confirmation: "saved", duplicate: false}, messages);

  expect(mapped).toEqual({fieldErrors: {}, status: {kind: "saved", message: messages.saved}});
  expect(mapped.status.message.toLowerCase()).not.toContain("email sent");
});

test("round-trips date-only values without timezone shifts", () => {
  const date = dateFromInputValue("2024-02-29");

  expect(date).toBeInstanceOf(Date);
  expect(dateToInputValue(date)).toBe("2024-02-29");
});

test("rejects invalid date-only values", () => {
  expect(dateFromInputValue("2024-02-30")).toBeUndefined();
});
