import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  conn: Pool | undefined;
};

const pool =
  globalForDb.conn ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      "postgres://ncamart:ncamart_dev_pwd@localhost:5432/ncamart_dev",
    max: Number(process.env.DATABASE_POOL_MAX || 10),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.conn = pool;
}

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });
export { pool };
export type Database = typeof db;
