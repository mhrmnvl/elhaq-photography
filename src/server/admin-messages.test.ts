import {expect, test} from "bun:test";

import {getContactMessage, listContactMessages} from "@/server/admin-messages";

const actor = {userId: "admin-1", email: "admin@example.com", name: null};
const messageId = "00000000-0000-4000-8000-000000000020";

test("lists contact summaries without selecting message bodies", async () => {
  const queries: string[] = [];
  const items = await listContactMessages(actor, {db: {query: async <T extends Record<string, unknown>>(text: string) => {
    queries.push(text);
    return {rows: [{
      id: messageId,
      name: "A visitor",
      email: "visitor@example.com",
      whatsapp: null,
      event_type: "wedding",
      notification_status: "disabled",
      created_at: "2026-09-22T00:00:00.000Z",
    } as unknown as T]};
  }}});

  expect(items).toEqual([{
    id: messageId,
    name: "A visitor",
    email: "visitor@example.com",
    whatsapp: null,
    eventType: "wedding",
    notificationStatus: "disabled",
    createdAt: "2026-09-22T00:00:00.000Z",
  }]);
  expect(queries[0]).not.toContain(", message,");
});

test("gets a contact detail with text content and keeps disabled notification status visible", async () => {
  const detail = await getContactMessage(actor, messageId, {db: {query: async <T extends Record<string, unknown>>() => ({rows: [{
    id: messageId,
    name: "A visitor",
    email: null,
    whatsapp: "+628123456789",
    event_type: "events",
    notification_status: "failed",
    created_at: "2026-09-22T00:00:00.000Z",
    event_date: "2026-10-10",
    event_location: "Bandung",
    message: "Please share availability.",
  } as unknown as T]})}});

  expect(detail).toMatchObject({
    id: messageId,
    eventType: "events",
    notificationStatus: "failed",
    eventDate: "2026-10-10",
    message: "Please share availability.",
  });
});

test("returns null for a missing contact detail", async () => {
  await expect(getContactMessage(actor, messageId, {db: {query: async <T extends Record<string, unknown>>() => ({rows: [] as T[]})}})).resolves.toBeNull();
});
