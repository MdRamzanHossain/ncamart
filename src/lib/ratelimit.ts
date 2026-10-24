import { getRedis } from "./redis";
import { env } from "./env";
import { logger } from "./logger";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

// In-memory fallback when Redis is unreachable or in mock mode
const memLimiter = new Map<string, number[]>();
const memBlocked = new Map<string, number>();

function checkMemoryRateLimit(
  key: string,
  limit: number,
  windowSec: number,
  now: number
): RateLimitResult {
  const windowMs = windowSec * 1000;
  const timestamps = (memLimiter.get(key) || []).filter((t) => t > now - windowMs);

  if (timestamps.length >= limit) {
    const oldest = timestamps[0] ?? now - windowMs;
    const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000) || 1;
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  timestamps.push(now);
  memLimiter.set(key, timestamps);
  return {
    allowed: true,
    remaining: Math.max(0, limit - timestamps.length),
    retryAfterSec: 0,
  };
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSec * 1000;

  if (env.MOCK_EXTERNAL_SERVICES) {
    return checkMemoryRateLimit(key, limit, windowSec, now);
  }

  const redisKey = `rl:${key}`;
  try {
    const redis = getRedis();
    const clearBefore = now - windowMs;

    const multi = redis.multi();
    multi.zremrangebyscore(redisKey, "-inf", clearBefore);
    multi.zcard(redisKey);
    multi.zrange(redisKey, 0, 0, "WITHSCORES");
    const results = await multi.exec();

    const zcardRes = results?.[1];
    if (!results || !zcardRes || zcardRes[0]) {
      throw new Error("Redis rate-limit multi failed");
    }

    const currentCount = Number(zcardRes[1] || 0);

    if (currentCount >= limit) {
      const zrangeRes = results[2];
      const oldestEntry = zrangeRes?.[1] as string[] | undefined;
      const oldestTimestamp = oldestEntry && oldestEntry[1] ? Number(oldestEntry[1]) : now - windowMs;
      const retryAfterMs = Math.max(0, oldestTimestamp + windowMs - now);
      const retryAfterSec = Math.ceil(retryAfterMs / 1000) || 1;

      return {
        allowed: false,
        remaining: 0,
        retryAfterSec,
      };
    }

    // Allow and record hit
    const addMulti = redis.multi();
    addMulti.zadd(redisKey, now, `${now}-${Math.random()}`);
    addMulti.expire(redisKey, windowSec);
    await addMulti.exec();

    return {
      allowed: true,
      remaining: Math.max(0, limit - currentCount - 1),
      retryAfterSec: 0,
    };
  } catch (err) {
    logger.warn({ err, key }, "Redis rate limiter failure, falling back to memory");
    return checkMemoryRateLimit(key, limit, windowSec, now);
  }
}

export async function blockKey(key: string, ttlSec: number): Promise<void> {
  if (env.MOCK_EXTERNAL_SERVICES) {
    memBlocked.set(key, Date.now() + ttlSec * 1000);
    return;
  }

  const redisKey = `rl:blocked:${key}`;
  try {
    const redis = getRedis();
    await redis.set(redisKey, "1", "EX", ttlSec);
  } catch {
    memBlocked.set(key, Date.now() + ttlSec * 1000);
  }
}

export async function isBlocked(key: string): Promise<boolean> {
  if (env.MOCK_EXTERNAL_SERVICES) {
    const expiresAt = memBlocked.get(key);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      memBlocked.delete(key);
      return false;
    }
    return true;
  }

  const redisKey = `rl:blocked:${key}`;
  try {
    const redis = getRedis();
    const res = await redis.exists(redisKey);
    return res === 1;
  } catch {
    const expiresAt = memBlocked.get(key);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      memBlocked.delete(key);
      return false;
    }
    return true;
  }
}

export async function resetRateLimit(key: string): Promise<void> {
  memLimiter.delete(key);
  memBlocked.delete(key);

  if (!env.MOCK_EXTERNAL_SERVICES) {
    try {
      const redis = getRedis();
      await redis.del(`rl:${key}`, `rl:blocked:${key}`);
    } catch {
      // Ignored
    }
  }
}

export function clearMemoryRateLimitsForTesting(): void {
  memLimiter.clear();
  memBlocked.clear();
}
