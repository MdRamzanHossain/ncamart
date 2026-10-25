// @ts-check
const Redis = require("ioredis");

/**
 * Multi-Replica Redis Cache Handler for Next.js 15
 * Synchronizes Incremental Static Regeneration (ISR) and Data Cache across all web replicas.
 * 
 * Supports:
 * - get(key): fetches parsed cache payload with lastModified timestamp
 * - set(key, data, ctx): stores cache entry with TTL and tag associations
 * - revalidateTag(tags): invalidates cached entries associated with the specified tags
 * - Fallback to in-memory map if Redis is unavailable or during build
 */
class RedisCacheHandler {
  /**
   * @param {any} options
   */
  constructor(options) {
    this.options = options;
    this.keyPrefix = "next:cache:";
    this.tagPrefix = "next:tag:";
    this.defaultTtl = 86400 * 7; // 7 days fallback TTL

    // In-memory fallback cache
    /** @type {Map<string, { value: any, lastModified: number, tags: string[], expiresAt: number }>} */
    this.memoryCache = new Map();
    /** @type {Map<string, Set<string>>} */
    this.memoryTags = new Map();

    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    const isMock = process.env.MOCK_EXTERNAL_SERVICES === "true";

    if (!isMock && process.env.NODE_ENV === "production") {
      try {
        this.redis = new Redis(redisUrl, {
          connectTimeout: 2000,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          retryStrategy: (times) => (times > 3 ? null : Math.min(times * 100, 1000)),
        });

        this.redis.on("error", (err) => {
          // Swallow connection errors to allow fallback to memory without crashing server
          if (process.env.DEBUG_CACHE) {
            console.warn("[RedisCacheHandler] Redis error:", err.message);
          }
        });
      } catch (err) {
        this.redis = null;
      }
    } else {
      this.redis = null;
    }
  }

  /**
   * @param {string} key
   * @returns {Promise<{ value: any, lastModified: number, tags?: string[] } | null>}
   */
  async get(key) {
    const fullKey = this.keyPrefix + key;

    if (this.redis) {
      try {
        const raw = await this.redis.get(fullKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            value: parsed.value,
            lastModified: parsed.lastModified || Date.now(),
            tags: parsed.tags || [],
          };
        }
      } catch {
        // Fall back to memory
      }
    }

    const mem = this.memoryCache.get(key);
    if (mem) {
      if (mem.expiresAt && Date.now() > mem.expiresAt) {
        this.memoryCache.delete(key);
        return null;
      }
      return {
        value: mem.value,
        lastModified: mem.lastModified,
        tags: mem.tags,
      };
    }

    return null;
  }

  /**
   * @param {string} key
   * @param {any} data
   * @param {{ tags?: string[], revalidate?: number | false }} [ctx]
   * @returns {Promise<void>}
   */
  async set(key, data, ctx = {}) {
    const fullKey = this.keyPrefix + key;
    const tags = Array.isArray(ctx.tags) ? ctx.tags : [];
    const revalidate = typeof ctx.revalidate === "number" && ctx.revalidate > 0 ? ctx.revalidate : this.defaultTtl;
    const now = Date.now();

    const entry = {
      value: data,
      lastModified: now,
      tags,
    };

    if (this.redis) {
      try {
        const payload = JSON.stringify(entry);
        await this.redis.set(fullKey, payload, "EX", revalidate);

        // Associate tags with key for revalidation
        if (tags.length > 0) {
          const pipeline = this.redis.pipeline();
          for (const tag of tags) {
            const tagKey = this.tagPrefix + tag;
            pipeline.sadd(tagKey, key);
            pipeline.expire(tagKey, revalidate * 2);
          }
          await pipeline.exec();
        }
        return;
      } catch {
        // Fall back to memory
      }
    }

    // Memory cache fallback
    this.memoryCache.set(key, {
      value: data,
      lastModified: now,
      tags,
      expiresAt: now + revalidate * 1000,
    });

    for (const tag of tags) {
      if (!this.memoryTags.has(tag)) {
        this.memoryTags.set(tag, new Set());
      }
      this.memoryTags.get(tag).add(key);
    }
  }

  /**
   * @param {string | string[]} tags
   * @returns {Promise<void>}
   */
  async revalidateTag(tags) {
    const tagList = Array.isArray(tags) ? tags : [tags];
    if (tagList.length === 0) return;

    if (this.redis) {
      try {
        for (const tag of tagList) {
          const tagKey = this.tagPrefix + tag;
          const keys = await this.redis.smembers(tagKey);
          if (keys && keys.length > 0) {
            const pipeline = this.redis.pipeline();
            for (const k of keys) {
              pipeline.del(this.keyPrefix + k);
            }
            pipeline.del(tagKey);
            await pipeline.exec();
          }
        }
        return;
      } catch {
        // Fall back to memory
      }
    }

    // In-memory revalidation
    for (const tag of tagList) {
      const keys = this.memoryTags.get(tag);
      if (keys) {
        for (const k of keys) {
          this.memoryCache.delete(k);
        }
        this.memoryTags.delete(tag);
      }
    }
  }

  /**
   * Reset request-scoped cache
   */
  resetRequestCache() {
    // No-op for distributed Redis cache
  }
}

module.exports = RedisCacheHandler;
