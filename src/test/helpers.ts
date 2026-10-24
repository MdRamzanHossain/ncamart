import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";

export interface IntegrationTestContext {
  pgContainer?: StartedPostgreSqlContainer;
  redisContainer?: StartedRedisContainer;
  pool: Pool;
  db: ReturnType<typeof drizzle<typeof schema>>;
  redisUrl: string;
  cleanup: () => Promise<void>;
}

export async function setupIntegrationTest(): Promise<IntegrationTestContext> {
  const isDockerAvailable = process.env.TESTCONTAINERS_ENABLED === "true";

  if (isDockerAvailable) {
    try {
      const pgContainer = await new PostgreSqlContainer("postgres:16-alpine")
        .withDatabase("ncamart_test")
        .withUsername("ncamart")
        .withPassword("ncamart_test_pwd")
        .start();

      const redisContainer = await new RedisContainer("redis:7-alpine").start();

      const pool = new Pool({
        connectionString: pgContainer.getConnectionUri(),
      });
      const db = drizzle(pool, { schema });

      return {
        pgContainer,
        redisContainer,
        pool,
        db,
        redisUrl: redisContainer.getConnectionUrl(),
        cleanup: async () => {
          await pool.end();
          await pgContainer.stop();
          await redisContainer.stop();
        },
      };
    } catch {
      // Fallback to local or mocked DB if Docker is not currently running
    }
  }

  // Fallback for environments where Docker Desktop is not active
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      "postgres://ncamart:ncamart_dev_pwd@localhost:5432/ncamart_dev",
  });
  const db = drizzle(pool, { schema });

  return {
    pool,
    db,
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    cleanup: async () => {
      await pool.end();
    },
  };
}

/**
 * Asserts that a staff mutation function executes and produces an immutable audit row.
 */
export async function assertStaffMutationProducesAudit(
  fn: () => Promise<unknown>,
  expectedAction?: string
): Promise<void> {
  const { getRecentMemoryAuditEntries } = await import("@/modules/audit");
  const beforeCount = getRecentMemoryAuditEntries().length;
  await fn();
  const afterEntries = getRecentMemoryAuditEntries();
  const afterCount = afterEntries.length;

  if (afterCount <= beforeCount) {
    throw new Error(
      `Expected staff mutation to produce an audit row, but count remained ${beforeCount}`
    );
  }

  if (expectedAction) {
    const latest = afterEntries[afterEntries.length - 1];
    if (!latest || latest.action !== expectedAction) {
      throw new Error(
        `Expected audit action "${expectedAction}", but got "${latest?.action}"`
      );
    }
  }
}
