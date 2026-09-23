import {expect, test} from "bun:test";
import type {PoolClient} from "pg";

import {withRepeatableRead, withTransaction} from "@/lib/db";

function fakeClient() {
  const commands: string[] = [];
  const client = {
    query: async (text: string) => {
      commands.push(text);
      return {rows: []};
    },
    release: () => {
      commands.push("RELEASE");
    },
  } as unknown as PoolClient;

  return {client, commands};
}

test("commits an injected transaction client", async () => {
  const {client, commands} = fakeClient();

  await withTransaction(async (tx) => {
    await tx.query("SELECT 1");
  }, async () => client);

  expect(commands).toEqual(["BEGIN", "SELECT 1", "COMMIT", "RELEASE"]);
});

test("rolls back an injected transaction client", async () => {
  const {client, commands} = fakeClient();

  await expect(withTransaction(async () => {
    throw new Error("expected");
  }, async () => client)).rejects.toThrow("expected");

  expect(commands).toEqual(["BEGIN", "ROLLBACK", "RELEASE"]);
});

test("starts a repeatable-read transaction", async () => {
  const {client, commands} = fakeClient();

  await withRepeatableRead(async () => undefined, async () => client);

  expect(commands).toEqual(["BEGIN ISOLATION LEVEL REPEATABLE READ", "COMMIT", "RELEASE"]);
});
