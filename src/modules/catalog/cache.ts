import crypto from "node:crypto";
import { getRedis } from "@/lib/redis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const CACHE_TTL_SECONDS = 300; // 5 minutes
export const CACHE_CONTROL_CDN = "public, max-age=60, s-maxage=300, stale-while-revalidate=60";

// In-memory fallback for test environment or when Redis is offline
const memCache = new Map<string, { value: string; expiresAt: number }>();

export function clearMemoryCatalogCacheForTesting(): void {
  memCache.clear();
}

export function hashQueryKey(query: Record<string, unknown>): string {
  const sorted = Object.keys(query)
    .sort()
    .filter((k) => query[k] !== undefined && query[k] !== null)
    .map((k) => `${k}=${String(query[k])}`)
    .join("&");
  return crypto.createHash("sha256").update(sorted).digest("hex").slice(0, 16);
}

function shouldUseMemoryOnly(): boolean {
  return Boolean(env.MOCK_EXTERNAL_SERVICES || process.env.NODE_ENV === "test");
}

export const catalogCache = {
  async get<T>(key: string): Promise<T | null> {
    if (!shouldUseMemoryOnly()) {
      try {
        const redis = getRedis();
        const raw = await redis.get(key);
        if (raw) {
          return JSON.parse(raw) as T;
        }
      } catch {
        // Redis unavailable or disconnected, check memory cache
      }
    }

    const mem = memCache.get(key);
    if (mem) {
      if (Date.now() > mem.expiresAt) {
        memCache.delete(key);
        return null;
      }
      return JSON.parse(mem.value) as T;
    }

    return null;
  },

  async set<T>(key: string, value: T, ttlSec = CACHE_TTL_SECONDS): Promise<void> {
    const serialized = JSON.stringify(value);

    if (!shouldUseMemoryOnly()) {
      try {
        const redis = getRedis();
        await redis.set(key, serialized, "EX", ttlSec);
      } catch {
        // Fallback to memory
      }
    }

    memCache.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSec * 1000,
    });
  },

  async invalidateProduct(slug?: string): Promise<void> {
    if (!shouldUseMemoryOnly()) {
      try {
        const redis = getRedis();
        if (slug) {
          await redis.del(`catalog:product:${slug}`);
        }
        // Scan and delete list queries & tree
        const keys = await redis.keys("catalog:list:*");
        if (keys.length > 0) {
          await redis.del(...keys);
        }
        await redis.del("catalog:categories:tree");
      } catch {
        // Memory fallback invalidation
      }
    }

    if (slug) {
      memCache.delete(`catalog:product:${slug}`);
    }
    for (const key of memCache.keys()) {
      if (key.startsWith("catalog:list:") || key === "catalog:categories:tree") {
        memCache.delete(key);
      }
    }

    logger.debug({ slug }, "Catalog cache invalidated for product/lists");
  },

  async invalidateAll(): Promise<void> {
    if (!shouldUseMemoryOnly()) {
      try {
        const redis = getRedis();
        const keys = await redis.keys("catalog:*");
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } catch {
        // Memory fallback
      }
    }
    memCache.clear();
  },
};
