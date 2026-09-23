import {expect, test} from "bun:test";
import {readFile} from "node:fs/promises";

import {assertRequiredMigrations} from "@/db/migrate";

test("accepts the generated Better Auth migration", async () => {
  await expect(assertRequiredMigrations()).resolves.toBeUndefined();
});

test("defines a nullable unique album creation key before live migration", async () => {
  const sql = await readFile(new URL("./migrations/0002_app.sql", import.meta.url), "utf8");
  expect(sql).toContain("creation_key text UNIQUE");
});
