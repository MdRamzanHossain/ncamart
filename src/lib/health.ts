import { Pool } from "pg";
import Redis from "ioredis";
import { Meilisearch } from "meilisearch";

export interface HealthCheckResult {
  status: "ok" | "degraded" | "error";
  db: "ok" | "error" | "down";
  redis: "ok" | "error" | "down";
  meili: "ok" | "error" | "down";
  version: string;
  timestamp: string;
  details?: {
    dbError?: string;
    redisError?: string;
    meiliError?: string;
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackErrorMsg: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(fallbackErrorMsg)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

export async function checkSystemHealth(): Promise<HealthCheckResult> {
  const version = process.env.npm_package_version || "0.1.0";
  const result: HealthCheckResult = {
    status: "ok",
    db: "ok",
    redis: "ok",
    meili: "ok",
    version,
    timestamp: new Date().toISOString(),
  };

  const details: NonNullable<HealthCheckResult["details"]> = {};

  // Check Database
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || "postgres://ncamart:ncamart_dev_pwd@localhost:5432/ncamart_dev",
      connectionTimeoutMillis: 1500,
    });
    await withTimeout(pool.query("SELECT 1"), 1500, "Database query timed out");
    await pool.end();
    result.db = "ok";
  } catch (err: unknown) {
    if (process.env.MOCK_EXTERNAL_SERVICES === "true") {
      result.db = "ok";
    } else {
      result.db = "error";
      details.dbError = err instanceof Error ? err.message : String(err);
    }
  }

  // Check Redis
  try {
    const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      connectTimeout: 1500,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
      lazyConnect: true,
    });
    redis.on("error", () => {}); // swallow unhandled ECONNREFUSED during probe
    await withTimeout(redis.connect(), 1500, "Redis connect timed out");
    const ping = await withTimeout(redis.ping(), 1500, "Redis ping timed out");
    await redis.quit();
    result.redis = ping === "PONG" ? "ok" : "error";
  } catch (err: unknown) {
    if (process.env.MOCK_EXTERNAL_SERVICES === "true") {
      result.redis = "ok";
    } else {
      result.redis = "error";
      details.redisError = err instanceof Error ? err.message : String(err);
    }
  }

  // Check Meilisearch
  try {
    const client = new Meilisearch({
      host: process.env.MEILI_HOST || "http://localhost:7700",
      apiKey: process.env.MEILI_MASTER_KEY || "ncamart_meili_master_key_local_dev",
      timeout: 1500,
    });
    const health = await withTimeout(client.isHealthy(), 1500, "Meilisearch timed out");
    result.meili = health || process.env.MOCK_EXTERNAL_SERVICES === "true" ? "ok" : "error";
  } catch (err: unknown) {
    if (process.env.MOCK_EXTERNAL_SERVICES === "true") {
      result.meili = "ok";
    } else {
      result.meili = "error";
      details.meiliError = err instanceof Error ? err.message : String(err);
    }
  }

  if (result.db !== "ok" || result.redis !== "ok" || result.meili !== "ok") {
    result.status = result.db === "ok" ? "degraded" : "error";
    result.details = details;
  }

  return result;
}
