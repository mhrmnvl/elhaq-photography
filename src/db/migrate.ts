import {readdir, readFile} from "node:fs/promises";
import {basename, join} from "node:path";
import {fileURLToPath} from "node:url";

import {Client} from "pg";

import {getServerEnv} from "@/lib/env-core";

const migrationsDir = fileURLToPath(new URL("./migrations/", import.meta.url));
const requiredMigrationFiles = ["0000_meta.sql", "0001_better_auth.sql"] as const;

async function sortedSqlFiles(): Promise<string[]> {
  return (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
}

async function readMigration(file: string): Promise<string> {
  return readFile(join(migrationsDir, basename(file)), "utf8");
}

export async function assertRequiredMigrations(files?: readonly string[]): Promise<void> {
  const available = new Set(files ?? await sortedSqlFiles());
  const missing = requiredMigrationFiles.filter((file) => !available.has(file));
  if (missing.length > 0) {
    throw new Error(`Required migration files missing: ${missing.join(", ")}`);
  }
}

export async function migrate(): Promise<void> {
  await assertRequiredMigrations();
  const client = new Client({connectionString: getServerEnv().MIGRATION_DATABASE_URL});
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["elhaq-photography:migrations"]);
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");

    const applied = new Set((await client.query<{version: string}>("SELECT version FROM schema_migrations")).rows.map((row) => row.version));
    for (const file of await sortedSqlFiles()) {
      if (applied.has(file)) continue;
      await client.query(await readMigration(file));
      await client.query("INSERT INTO schema_migrations(version) VALUES ($1)", [file]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

if (import.meta.main) await migrate();
