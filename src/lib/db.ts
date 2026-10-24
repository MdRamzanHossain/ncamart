import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, PoolClient } from "pg";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { env } from "./env";
import { logger } from "./logger";

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    min: env.DATABASE_POOL_MIN,
    max: env.DATABASE_POOL_MAX,
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS || 1000),
  });

if (env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });
export type Database = typeof db;

// Extract transaction type from drizzle
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface TransactionOptions {
  isolationLevel?: "read committed" | "serializable" | "repeatable read";
  maxRetries?: number;
}

/**
 * Execute work inside a database transaction.
 * Defaults to READ COMMITTED.
 * If SERIALIZABLE is specified, automatically retries on serialization_failure (Postgres error 40001)
 * with exponential backoff and jitter up to maxRetries (default 3).
 */
export async function withTx<T>(
  fn: (tx: Tx) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const isolationLevel = options.isolationLevel ?? "read committed";
  const maxRetries = options.maxRetries ?? (isolationLevel === "serializable" ? 3 : 0);

  let attempt = 0;
  while (true) {
    attempt++;
    try {
      return await db.transaction(
        async (tx) => {
          if (isolationLevel !== "read committed") {
            await tx.execute(sql.raw(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel.toUpperCase()}`));
          }
          return await fn(tx);
        },
        {
          isolationLevel: isolationLevel === "serializable" ? "serializable" : "read committed",
        }
      );
    } catch (err: unknown) {
      const isSerializationFailure =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "40001";

      if (isSerializationFailure && attempt <= maxRetries) {
        const jitter = Math.random() * 50;
        const delayMs = Math.min(100 * Math.pow(2, attempt - 1) + jitter, 1000);
        logger.warn(
          { attempt, maxRetries, delayMs },
          "Serializable transaction failure (40001). Retrying with backoff..."
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Helper to acquire raw client with transaction lock
 */
export async function withAdvisoryLock<T>(
  lockId: number,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [lockId]);
    return await fn(client);
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [lockId]);
    } finally {
      client.release();
    }
  }
}
