import {expect, test} from "bun:test";

import {searchAdminContent} from "@/server/admin-search";

const actor = {userId: "admin-1", email: "admin@example.com", name: null};

test("skips broad searches shorter than two characters", async () => {
  let calls = 0;
  const results = await searchAdminContent(actor, " a ", {db: {query: async <T extends Record<string, unknown>>() => {
    calls += 1;
    return {rows: [] as T[]};
  }}});

  expect(results).toEqual({albums: [], messages: []});
  expect(calls).toBe(0);
});

test("searches album and contact fields with literal escaped terms and returns compact matches", async () => {
  const calls: {text: string; values?: readonly unknown[]}[] = [];
  const results = await searchAdminContent(actor, " %_! ", {db: {query: async <T extends Record<string, unknown>>(text: string, values?: readonly unknown[]) => {
    calls.push({text, values});
    const rows = calls.length === 1
      ? [{id: "album-1", slug: "bali-wedding", title_en: "Bali wedding", title_id: "Pernikahan Bali"}]
      : [{id: "message-1", name: "Rani", email: "rani@example.com", event_type: "wedding", message: "private visitor request"}];
    return {rows: rows as unknown as T[]};
  }}});

  expect(results).toEqual({
    albums: [{id: "album-1", slug: "bali-wedding", title: "Bali wedding"}],
    messages: [{id: "message-1", name: "Rani", email: "rani@example.com", eventType: "wedding"}],
  });
  expect(calls).toHaveLength(2);
  expect(calls.map(({values}) => values)).toEqual([["%!%!_!!%"], ["%!%!_!!%"]]);
  expect(calls[0]?.text).toContain("title_en ILIKE $1 ESCAPE '!'");
  expect(calls[1]?.text).toContain("message ILIKE $1 ESCAPE '!'");
  expect(calls.every(({text}) => text.includes("LIMIT 5"))).toBe(true);
  expect(JSON.stringify(results)).not.toContain("private visitor request");
});
