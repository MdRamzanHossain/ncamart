import Redis, { RedisOptions } from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

const globalForRedis = globalThis as unknown as {
  mainRedis?: Redis;
  subscriberRedis?: Redis;
  bullMqRedis?: Redis;
};

const defaultOptions: RedisOptions = {
  maxRetriesPerRequest: 1,
  enableReadyCheck: false,
  lazyConnect: true,
  connectTimeout: 1000,
  commandTimeout: 1500,
  retryStrategy(times) {
    if (times > 2) return null;
    const delay = Math.min(times * 100, 1000);
    return delay;
  },
};

export function createRedisClient(customOptions: RedisOptions = {}): Redis {
  const client = new Redis(env.REDIS_URL, {
    ...defaultOptions,
    ...customOptions,
  });

  client.on("error", (err) => {
    logger.error({ err }, "Redis client error");
  });

  return client;
}

/** Main Redis client singleton for cache, rate limiting, and OTP */
export function getRedis(): Redis {
  if (!globalForRedis.mainRedis) {
    globalForRedis.mainRedis = createRedisClient();
  }
  return globalForRedis.mainRedis;
}

export const getRedisClient = getRedis;

/** Dedicated Redis subscriber connection for Pub/Sub */
export function getSubscriber(): Redis {
  if (!globalForRedis.subscriberRedis) {
    globalForRedis.subscriberRedis = createRedisClient();
  }
  return globalForRedis.subscriberRedis;
}

/** Dedicated Redis connection for BullMQ (maxRetriesPerRequest must be null) */
export function getBullMQConnection(): Redis {
  if (!globalForRedis.bullMqRedis) {
    globalForRedis.bullMqRedis = createRedisClient({
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return globalForRedis.bullMqRedis;
}

export async function closeRedisConnections(): Promise<void> {
  const promises: Promise<string>[] = [];
  if (globalForRedis.mainRedis) promises.push(globalForRedis.mainRedis.quit());
  if (globalForRedis.subscriberRedis) promises.push(globalForRedis.subscriberRedis.quit());
  if (globalForRedis.bullMqRedis) promises.push(globalForRedis.bullMqRedis.quit());
  await Promise.allSettled(promises);
}
