import {Pool, type PoolClient} from "pg";

import {getServerEnv} from "@/lib/env-core";

let runtimePool: Pool | undefined;

export function getPool(): Pool {
  runtimePool ??= new Pool({connectionString: getServerEnv().DATABASE_URL});
  return runtimePool;
}

export type QueryRow = Record<string, unknown>;

export interface SqlExecutor {
  query<T extends QueryRow>(text: string, values?: readonly unknown[]): Promise<{rows: T[]}>;
}

export function getDb(): SqlExecutor {
  return {
    async query<T extends QueryRow>(text: string, values?: readonly unknown[]) {
      const result = await getPool().query<T>(text, values ? [...values] : undefined);
      return {rows: result.rows};
    },
  };
}

export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
  connect: () => Promise<PoolClient> = () => getPool().connect(),
): Promise<T> {
  const client = await connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function withRepeatableRead<T>(
  work: (client: PoolClient) => Promise<T>,
  connect: () => Promise<PoolClient> = () => getPool().connect(),
): Promise<T> {
  const client = await connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
