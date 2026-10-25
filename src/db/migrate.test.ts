import {expect, test} from "bun:test";
import {readFile} from "node:fs/promises";

import {assertRequiredMigrations} from "@/db/migrate";

test("rejects migration setup when the generated Better Auth migration is missing", async () => {
  await expect(assertRequiredMigrations(["0000_meta.sql"])).rejects.toThrow("0001_better_auth.sql");
});

test("defines a nullable unique album creation key before live migration", async () => {
  const sql = await readFile(new URL("./migrations/0002_app.sql", import.meta.url), "utf8");
  expect(sql).toContain("creation_key text UNIQUE");
});
