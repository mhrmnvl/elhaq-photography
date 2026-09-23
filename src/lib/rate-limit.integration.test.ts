import {expect, test} from "bun:test";
import {randomUUID} from "node:crypto";
import {Pool} from "pg";

import {consumeContactRateLimit, extractTrustedClientIp, makeRateLimitFingerprint} from "@/lib/rate-limit";
import type {QueryRow, SqlExecutor} from "@/lib/db";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) console.warn("SKIP rate-limit integration: TEST_DATABASE_URL unavailable");

function restoreNodeEnv(value: string | undefined) {
  if (value === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
  else Object.assign(process.env, {NODE_ENV: value});
}

test("uses only a valid Vercel forwarded IP in production", () => {
  const originalNodeEnv = process.env["NODE_ENV"];
  Object.assign(process.env, {NODE_ENV: "production"});
  try {
    expect(extractTrustedClientIp(new Request("https://example.com", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.7, 10.0.0.1",
        "x-forwarded-for": "198.51.100.4",
        "user-agent": "different-client",
      },
    }))).toBe("203.0.113.7");
    expect(extractTrustedClientIp(new Request("https://example.com", {
      headers: {"x-forwarded-for": "198.51.100.4", "user-agent": "client"},
    }))).toBe("unknown");
  } finally {
    restoreNodeEnv(originalNodeEnv);
  }
});

test("uses one localhost bucket outside production and HMACs only the IP", () => {
  const originalNodeEnv = process.env["NODE_ENV"];
  Object.assign(process.env, {NODE_ENV: "development"});
  try {
    expect(extractTrustedClientIp(new Request("http://localhost:3000/api/contact"))).toBe("127.0.0.1");
    const first = makeRateLimitFingerprint("127.0.0.1", "secret");
    const second = makeRateLimitFingerprint("127.0.0.1", "secret");
    const otherIp = makeRateLimitFingerprint("127.0.0.2", "secret");
    expect(first).toBe(second);
    expect(first).not.toBe(otherIp);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  } finally {
    restoreNodeEnv(originalNodeEnv);
  }
});

test.skipIf(!testDatabaseUrl)("allows five of six concurrent requests for one fingerprint", async () => {
  const pool = new Pool({connectionString: testDatabaseUrl, max: 6});
  const executor: SqlExecutor = {
    async query<T extends QueryRow>(text: string, values?: readonly unknown[]) {
      const result = await pool.query<T>(text, values ? [...values] : undefined);
      return {rows: result.rows};
    },
  };
  const fingerprint = `test-${randomUUID()}`;
  const now = new Date();

  try {
    const results = await Promise.all(
      Array.from({length: 6}, () => consumeContactRateLimit(executor, fingerprint, now, 5, 3_600_000)),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(1);
    expect(results.find((result) => !result.allowed)?.retryAfterSeconds).toBeGreaterThan(0);
  } finally {
    await pool.query("DELETE FROM contact_rate_limits WHERE fingerprint = $1", [fingerprint]);
    await pool.end();
  }
});
