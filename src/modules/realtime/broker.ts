import { getRedis } from "@/lib/redis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { StaffEvent, StaffEventInput, StaffEventAck } from "./types";

function isRedisEnabled(): boolean {
  if (env.MOCK_EXTERNAL_SERVICES || process.env.NODE_ENV === "test") {
    return false;
  }
  return true;
}

const MAX_STREAM_ENTRIES_PER_CHANNEL = 1000;
const STREAM_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Sensitive PII keys to strip from broadcast event data
const SENSITIVE_PII_KEYS = new Set([
  "phone",
  "customerPhone",
  "customer_phone",
  "recipientPhone",
  "recipient_phone",
  "email",
  "customerEmail",
  "customer_email",
  "address",
  "customerAddress",
  "customer_address",
  "shippingAddress",
  "shipping_address",
  "billingAddress",
  "billing_address",
]);

/**
 * Strips PII fields from broadcast event data, ensuring links by ID and safe payloads.
 */
export function sanitizeEventData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_PII_KEYS.has(key)) {
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeEventData(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function parseStreamId(id: string): { ms: number; seq: number } | null {
  const match = /^(\d+)-(\d+)$/.exec(id);
  if (match) {
    return { ms: Number(match[1]), seq: Number(match[2]) };
  }
  const num = Number(id);
  if (!Number.isNaN(num)) {
    return { ms: num, seq: 0 };
  }
  return null;
}

export function compareStreamIds(a: string, b: string): number {
  const parsedA = parseStreamId(a);
  const parsedB = parseStreamId(b);
  if (parsedA && parsedB) {
    if (parsedA.ms !== parsedB.ms) {
      return parsedA.ms - parsedB.ms;
    }
    return parsedA.seq - parsedB.seq;
  }
  return a.localeCompare(b);
}

export class RealtimeBroker {
  private memStreamStore = new Map<string, StaffEvent[]>();
  private memAcks = new Map<string, StaffEventAck>();
  private replicaListeners = new Set<(channel: string, event: StaffEvent) => void>();
  private streamSeq = 0;
  private lastTimestamp = 0;

  private generateStreamId(): string {
    const now = Date.now();
    if (now === this.lastTimestamp) {
      this.streamSeq++;
    } else {
      this.lastTimestamp = now;
      this.streamSeq = 0;
    }
    return `${now}-${this.streamSeq}`;
  }

  /**
   * Subscribe a local web replica listener to the in-memory bus.
   */
  subscribeReplica(listener: (channel: string, event: StaffEvent) => void): () => void {
    this.replicaListeners.add(listener);
    return () => {
      this.replicaListeners.delete(listener);
    };
  }

  /**
   * Publish a staff alert event to a channel (worker -> Redis -> any web replica).
   */
  async publish(channel: string, input: StaffEventInput): Promise<StaffEvent> {
    const id = input.id || this.generateStreamId();
    const createdAt = input.createdAt
      ? typeof input.createdAt === "string"
        ? input.createdAt
        : input.createdAt.toISOString()
      : new Date().toISOString();

    const sanitizedData = sanitizeEventData(input.data || {});

    const event: StaffEvent = {
      id,
      event: input.event,
      data: sanitizedData,
      channel,
      createdAt,
    };

    // 1. Store in in-memory stream buffer (capped at 1000 per channel, 24h retention)
    const now = Date.now();
    const existing = this.memStreamStore.get(channel) || [];
    const filtered = existing.filter((e) => {
      const parsed = parseStreamId(e.id);
      return parsed ? now - parsed.ms < STREAM_RETENTION_MS : true;
    });
    filtered.push(event);
    if (filtered.length > MAX_STREAM_ENTRIES_PER_CHANNEL) {
      filtered.splice(0, filtered.length - MAX_STREAM_ENTRIES_PER_CHANNEL);
    }
    this.memStreamStore.set(channel, filtered);

    // 2. Persist to Redis Stream and publish to Redis pub/sub if available
    if (isRedisEnabled()) {
      try {
        const redis = getRedis();
        const streamKey = `stream:staff_events:${channel}`;
        // XADD stream:staff_events:${channel} MAXLEN ~ 1000 * id <id> event <event> data <json> channel <channel> createdAt <createdAt>
        await redis.xadd(
          streamKey,
          "MAXLEN",
          "~",
          String(MAX_STREAM_ENTRIES_PER_CHANNEL),
          "*",
          "id",
          event.id,
          "event",
          event.event,
          "data",
          JSON.stringify(event.data),
          "channel",
          event.channel,
          "createdAt",
          event.createdAt
        );
        await redis.expire(streamKey, 86400); // 24h retention

        // Publish over Redis Pub/Sub for cross-process fanout
        await redis.publish(`staff_events:${channel}`, JSON.stringify(event));
      } catch (err) {
        // Redis might be unreachable in offline test mode; in-memory fanout handles local deliveries
        logger.debug({ err, channel }, "Redis publish/stream fallback to in-memory broker");
      }
    }

    // 3. Dispatch to all connected local simulated replicas
    for (const listener of this.replicaListeners) {
      try {
        listener(channel, event);
      } catch (err) {
        logger.error({ err, channel }, "Error in replica listener");
      }
    }

    return event;
  }

  /**
   * Replay missed events from Redis Stream or in-memory history strictly newer than lastEventId.
   */
  async replay(channels: string[], lastEventId: string): Promise<StaffEvent[]> {
    const eventsById = new Map<string, StaffEvent>();

    // 1. Try reading from Redis Stream for each channel if enabled
    let redisSuccess = false;
    if (isRedisEnabled()) {
      try {
        const redis = getRedis();
        for (const channel of channels) {
          const streamKey = `stream:staff_events:${channel}`;
          // In Redis streams, (lastEventId means strictly greater than lastEventId
          const entries = await redis.xrange(streamKey, `(${lastEventId}`, "+");
          if (Array.isArray(entries)) {
            for (const [entryStreamId, fields] of entries) {
              const fieldMap: Record<string, string> = {};
              for (let i = 0; i < fields.length; i += 2) {
                fieldMap[fields[i]] = fields[i + 1];
              }
              const evtId = fieldMap.id || entryStreamId;
              let data: Record<string, unknown> = {};
              try {
                data = JSON.parse(fieldMap.data || "{}");
              } catch {
                data = {};
              }
              eventsById.set(evtId, {
                id: evtId,
                event: fieldMap.event || "unknown",
                data,
                channel: fieldMap.channel || channel,
                createdAt: fieldMap.createdAt || new Date().toISOString(),
              });
            }
            redisSuccess = true;
          }
        }
      } catch {
        redisSuccess = false;
      }
    }

    // 2. Fallback / supplement with in-memory stream buffer
    if (!redisSuccess || eventsById.size === 0) {
      for (const channel of channels) {
        const channelEvents = this.memStreamStore.get(channel) || [];
        for (const evt of channelEvents) {
          if (compareStreamIds(evt.id, lastEventId) > 0) {
            eventsById.set(evt.id, evt);
          }
        }
      }
    }

    // 3. Sort chronologically by event ID
    const sorted = Array.from(eventsById.values());
    sorted.sort((a, b) => compareStreamIds(a.id, b.id));
    return sorted;
  }

  /**
   * Acknowledge an event (used by the 5-minute sourcing escalation).
   */
  async acknowledge(eventId: string, staffId: string): Promise<StaffEventAck> {
    const ack: StaffEventAck = {
      eventId,
      staffId,
      acknowledgedAt: new Date().toISOString(),
    };

    // Store in-memory
    this.memAcks.set(eventId, ack);

    // Persist to Redis with 7-day TTL if enabled
    if (isRedisEnabled()) {
      try {
        const redis = getRedis();
        await redis.set(`staff_events:ack:${eventId}`, JSON.stringify(ack), "EX", 7 * 86400);
      } catch {
        // Offline fallback
      }
    }

    return ack;
  }

  /**
   * Check whether an event has been acknowledged.
   */
  async isAcknowledged(eventId: string): Promise<boolean> {
    if (this.memAcks.has(eventId)) {
      return true;
    }
    if (isRedisEnabled()) {
      try {
        const redis = getRedis();
        const stored = await redis.get(`staff_events:ack:${eventId}`);
        if (stored) {
          const parsed = JSON.parse(stored) as StaffEventAck;
          this.memAcks.set(eventId, parsed);
          return true;
        }
      } catch {
        // Ignored
      }
    }
    return false;
  }

  /**
   * Get acknowledgement record if exists.
   */
  async getAck(eventId: string): Promise<StaffEventAck | null> {
    const mem = this.memAcks.get(eventId);
    if (mem) return mem;

    if (isRedisEnabled()) {
      try {
        const redis = getRedis();
        const stored = await redis.get(`staff_events:ack:${eventId}`);
        if (stored) {
          const parsed = JSON.parse(stored) as StaffEventAck;
          this.memAcks.set(eventId, parsed);
          return parsed;
        }
      } catch {
        // Ignored
      }
    }
    return null;
  }

  /**
   * Clear state for unit tests.
   */
  clearForTesting(): void {
    this.memStreamStore.clear();
    this.memAcks.clear();
    this.streamSeq = 0;
    this.lastTimestamp = 0;
  }
}

export const realtimeBroker = new RealtimeBroker();
