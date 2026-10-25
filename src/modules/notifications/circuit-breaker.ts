import { getRedisClient } from "@/lib/redis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

function isRedisEnabled(): boolean {
  if (env.MOCK_EXTERNAL_SERVICES || process.env.NODE_ENV === "test") {
    return false;
  }
  return true;
}

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  windowMs: number; // 5 minutes = 300,000 ms
  minSends: number; // 20 sends minimum before evaluating failure rate
  failureRateThreshold: number; // 0.10 = 10%
  openDurationMs: number; // 10 minutes = 600,000 ms
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  windowMs: 5 * 60 * 1000,
  minSends: 20,
  failureRateThreshold: 0.1,
  openDurationMs: 10 * 60 * 1000,
};

// In-Memory Fallback Store for offline environments & unit tests
interface MemCallRecord {
  timestamp: number;
  success: boolean;
}

class InMemoryCircuitBreakerStore {
  public calls: MemCallRecord[] = [];
  public state: CircuitBreakerState = "CLOSED";
  public openUntil: number = 0;
  public halfOpenTrialInProgress: boolean = false;

  clear(): void {
    this.calls = [];
    this.state = "CLOSED";
    this.openUntil = 0;
    this.halfOpenTrialInProgress = false;
  }
}

const memStore = new InMemoryCircuitBreakerStore();

export class SmsCircuitBreaker {
  private config: CircuitBreakerConfig;
  private redisKeyPrefix: string;

  constructor(
    config: Partial<CircuitBreakerConfig> = {},
    redisKeyPrefix = "cb:sms:primary"
  ) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.redisKeyPrefix = redisKeyPrefix;
  }

  /**
   * Determine current circuit state (CLOSED, OPEN, HALF_OPEN).
   */
  async getState(now = Date.now()): Promise<CircuitBreakerState> {
    if (isRedisEnabled()) {
      try {
        const redis = getRedisClient();
        if (redis) {
        const stateVal = await redis.get(`${this.redisKeyPrefix}:state`);
        if (stateVal === "OPEN") {
          const openUntil = Number(await redis.get(`${this.redisKeyPrefix}:open_until`));
          if (now >= openUntil) {
            await redis.set(`${this.redisKeyPrefix}:state`, "HALF_OPEN");
            return "HALF_OPEN";
          }
          return "OPEN";
        }
        if (stateVal === "HALF_OPEN") {
          return "HALF_OPEN";
        }
        return "CLOSED";
      }
    } catch {
      // Memory fallback
    }
  }

    if (memStore.state === "OPEN") {
      if (now >= memStore.openUntil) {
        memStore.state = "HALF_OPEN";
        memStore.halfOpenTrialInProgress = false;
        return "HALF_OPEN";
      }
      return "OPEN";
    }

    return memStore.state;
  }

  /**
   * Should outgoing requests attempt primary SMS provider?
   */
  async shouldUsePrimary(now = Date.now()): Promise<boolean> {
    const state = await this.getState(now);
    if (state === "CLOSED") {
      return true;
    }
    if (state === "HALF_OPEN") {
      // Allow single trial
      if (!memStore.halfOpenTrialInProgress) {
        memStore.halfOpenTrialInProgress = true;
        return true;
      }
      return false;
    }
    return false; // OPEN
  }

  /**
   * Record outcome of a primary SMS attempt.
   */
  async recordResult(success: boolean, now = Date.now()): Promise<CircuitBreakerState> {
    const currentState = await this.getState(now);

    // Half-Open Trial Handling
    if (currentState === "HALF_OPEN") {
      if (success) {
        // Trial passed -> Reset to CLOSED
        await this.reset();
        logger.info("Primary SMS Circuit Breaker trial PASSED -> CLOSED");
        return "CLOSED";
      } else {
        // Trial failed -> Re-trip to OPEN for 10 minutes
        await this.tripOpen(now);
        logger.warn("Primary SMS Circuit Breaker trial FAILED -> OPEN for 10m");
        return "OPEN";
      }
    }

    // Normal Closed State evaluation
    if (isRedisEnabled()) {
      try {
        const redis = getRedisClient();
        if (redis) {
        const listKey = `${this.redisKeyPrefix}:window`;
        await redis.rpush(listKey, JSON.stringify({ t: now, s: success ? 1 : 0 }));
        // Trim old items
        const windowStart = now - this.config.windowMs;
        const allItems = await redis.lrange(listKey, 0, -1);
        const parsed = allItems.map((item) => JSON.parse(item) as { t: number; s: number });
        const valid = parsed.filter((i) => i.t >= windowStart);

        if (valid.length !== parsed.length) {
          await redis.del(listKey);
          if (valid.length > 0) {
            await redis.rpush(
              listKey,
              ...valid.map((v) => JSON.stringify(v))
            );
          }
        }

        if (valid.length >= this.config.minSends) {
          const failures = valid.filter((v) => v.s === 0).length;
          const failureRate = failures / valid.length;
          if (failureRate > this.config.failureRateThreshold) {
            await this.tripOpen(now);
            return "OPEN";
          }
        }
        return "CLOSED";
      }
    } catch {
      // Memory fallback
    }
  }

  // In-Memory store
    memStore.calls.push({ timestamp: now, success });
    const windowStart = now - this.config.windowMs;
    memStore.calls = memStore.calls.filter((c) => c.timestamp >= windowStart);

    if (memStore.calls.length >= this.config.minSends) {
      const failures = memStore.calls.filter((c) => !c.success).length;
      const failureRate = failures / memStore.calls.length;
      if (failureRate > this.config.failureRateThreshold) {
        await this.tripOpen(now);
        logger.warn(
          { failures, total: memStore.calls.length, failureRate },
          "Primary SMS Circuit Breaker TRIPPED -> OPEN (> 10% failures)"
        );
        return "OPEN";
      }
    }

    return "CLOSED";
  }

  /**
   * Force trip the breaker to OPEN state.
   */
  async tripOpen(now = Date.now(), durationMs?: number): Promise<void> {
    const duration = durationMs ?? this.config.openDurationMs;
    const openUntil = now + duration;

    if (isRedisEnabled()) {
      try {
        const redis = getRedisClient();
        if (redis) {
          await redis.set(`${this.redisKeyPrefix}:state`, "OPEN");
          await redis.set(`${this.redisKeyPrefix}:open_until`, String(openUntil));
        }
      } catch {
        // Memory fallback
      }
    }

    memStore.state = "OPEN";
    memStore.openUntil = openUntil;
    memStore.halfOpenTrialInProgress = false;
  }

  /**
   * Reset the breaker to CLOSED state.
   */
  async reset(): Promise<void> {
    if (isRedisEnabled()) {
      try {
        const redis = getRedisClient();
        if (redis) {
          await redis.del(`${this.redisKeyPrefix}:state`);
          await redis.del(`${this.redisKeyPrefix}:open_until`);
          await redis.del(`${this.redisKeyPrefix}:window`);
        }
      } catch {
        // Memory fallback
      }
    }

    memStore.clear();
  }

  /**
   * Reset in-memory state for testing.
   */
  resetForTesting(): void {
    memStore.clear();
  }
}

export const smsCircuitBreaker = new SmsCircuitBreaker();
