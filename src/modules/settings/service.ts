import { eq } from "drizzle-orm";
import { getRedis } from "@/lib/redis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { Tx, db as defaultDb } from "@/lib/db";
import { settings } from "./schema";
import {
  SettingKey,
  SettingValue,
  SETTINGS_SCHEMAS,
  DEFAULT_SETTINGS,
} from "./dto";

const CACHE_TTL_SECONDS = 60;
const REDIS_KEY_PREFIX = "settings:";

// In-memory fallback cache when Redis is unavailable or mock mode is enabled
interface CacheEntry {
  value: unknown;
  expiresAt: number;
}
const memSettingsCache = new Map<string, CacheEntry>();
let redisDisabledUntil = 0;

export const settingsService = {
  /**
   * Get a typed configuration setting.
   * Checks 60s cache first, queries DB on miss, falls back to default and caches.
   */
  async get<K extends SettingKey>(key: K, tx?: Tx): Promise<SettingValue<K>> {
    const cacheKey = `${REDIS_KEY_PREFIX}${key}`;
    const now = Date.now();

    // 1. Check in-memory cache
    const memCached = memSettingsCache.get(cacheKey);
    if (memCached && memCached.expiresAt > now) {
      return memCached.value as SettingValue<K>;
    }

    // 2. Check Redis cache if not in mock mode and circuit breaker open
    if (!env.MOCK_EXTERNAL_SERVICES && process.env.NODE_ENV !== "test" && now >= redisDisabledUntil) {
      try {
        const redis = getRedis();
        const cachedRaw = await redis.get(cacheKey);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          const validated = SETTINGS_SCHEMAS[key].parse(parsed);
          memSettingsCache.set(cacheKey, { value: validated, expiresAt: now + CACHE_TTL_SECONDS * 1000 });
          return validated as SettingValue<K>;
        }
      } catch (err) {
        redisDisabledUntil = now + 60000; // Trip circuit breaker for 60s on failure
        logger.warn({ err, key }, "Redis settings cache lookup failed, falling back to DB");
      }
    }

    // 3. Query Database
    const client = tx ?? defaultDb;
    let dbValue: unknown = undefined;

    try {
      const rows = await client
        .select()
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1);

      if (rows[0]) {
        dbValue = rows[0].value;
      }
    } catch (err) {
      logger.warn({ err, key }, "Database settings lookup failed, using default");
    }

    // 4. Fallback to default if not present in DB
    const finalValue = dbValue !== undefined ? dbValue : DEFAULT_SETTINGS[key];

    // 5. Validate against Zod schema
    const schema = SETTINGS_SCHEMAS[key];
    const validated = schema.parse(finalValue) as SettingValue<K>;

    // 6. Populate caches (in-memory and Redis)
    memSettingsCache.set(cacheKey, {
      value: validated,
      expiresAt: now + CACHE_TTL_SECONDS * 1000,
    });

    if (!env.MOCK_EXTERNAL_SERVICES && process.env.NODE_ENV !== "test" && now >= redisDisabledUntil) {
      try {
        const redis = getRedis();
        await redis.set(cacheKey, JSON.stringify(validated), "EX", CACHE_TTL_SECONDS);
      } catch {
        redisDisabledUntil = now + 60000;
      }
    }

    return validated;
  },

  /**
   * Set and validate a configuration setting in DB and invalidate/update cache.
   */
  async set<K extends SettingKey>(
    key: K,
    value: SettingValue<K>,
    updatedBy?: string,
    tx?: Tx
  ): Promise<void> {
    const schema = SETTINGS_SCHEMAS[key];
    const validated = schema.parse(value);

    const client = tx ?? defaultDb;

    try {
      await client
        .insert(settings)
        .values({
          key,
          value: validated as unknown,
          updatedBy,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: validated as unknown,
            updatedBy,
            updatedAt: new Date(),
          },
        });
    } catch (err) {
      logger.error({ err, key }, "Failed to write setting to database");
      if (!env.MOCK_EXTERNAL_SERVICES) throw err;
    }

    // Update in-memory cache
    const cacheKey = `${REDIS_KEY_PREFIX}${key}`;
    memSettingsCache.set(cacheKey, {
      value: validated,
      expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
    });

    // Update Redis cache
    if (!env.MOCK_EXTERNAL_SERVICES && process.env.NODE_ENV !== "test" && now >= redisDisabledUntil) {
      try {
        const redis = getRedis();
        await redis.set(cacheKey, JSON.stringify(validated), "EX", CACHE_TTL_SECONDS);
      } catch {
        redisDisabledUntil = now + 60000;
      }
    }
  },

  /**
   * Seed all default settings into the database if missing.
   */
  async seedDefaults(tx?: Tx): Promise<void> {
    const client = tx ?? defaultDb;
    for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
      try {
        await client
          .insert(settings)
          .values({
            key,
            value: val as unknown,
            updatedBy: "system:seed",
            updatedAt: new Date(),
          })
          .onConflictDoNothing();
      } catch {
        // Ignore conflicts or DB offline
      }
    }
  },

  /** Clear in-memory settings cache for test isolation */
  clearMemoryCacheForTesting(): void {
    memSettingsCache.clear();
  },
};
