import { getSubscriber } from "@/lib/redis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/errors";
import { staffAuthService } from "@/modules/identity/staffAuth";
import { realtimeBroker } from "./broker";
import { ActiveStreamConnection, StaffEvent } from "./types";

function isRedisEnabled(): boolean {
  if (env.MOCK_EXTERNAL_SERVICES || process.env.NODE_ENV === "test") {
    return false;
  }
  return true;
}

export const MAX_CONCURRENT_STREAMS_PER_STAFF = 3;
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 25000; // 25 seconds
export const DEFAULT_REVOCATION_CHECK_INTERVAL_MS = 60000; // 60 seconds

export class RealtimeReplica {
  public readonly replicaId: string;
  private activeStreams = new Map<string, ActiveStreamConnection>();
  private unsubscribeBroker?: () => void;
  private redisSubscribed = false;
  private isDestroyed = false;

  constructor(replicaId = "web-replica-1") {
    this.replicaId = replicaId;
    this.initSubscriber();
  }

  /**
   * Initialize shared subscriber (one per process).
   * Subscribes to Redis Pub/Sub pattern staff_events:* and in-memory broker.
   */
  private initSubscriber(): void {
    // 1. Subscribe to local broker for fast in-memory fan-out & multi-replica testing
    this.unsubscribeBroker = realtimeBroker.subscribeReplica((channel, event) => {
      this.handleIncomingEvent(channel, event);
    });

    // 2. Subscribe to shared Redis Pub/Sub if enabled
    if (isRedisEnabled()) {
      try {
        const subscriber = getSubscriber();
        if (!this.redisSubscribed) {
          subscriber.psubscribe("staff_events:*").catch((err) => {
            logger.debug({ err, replicaId: this.replicaId }, "Redis psubscribe unavailable (mock/offline mode)");
          });

          subscriber.on("pmessage", (_pattern, fullChannel, message) => {
            try {
              const channel = fullChannel.startsWith("staff_events:")
                ? fullChannel.slice("staff_events:".length)
                : fullChannel;
              const event = JSON.parse(message) as StaffEvent;
              this.handleIncomingEvent(channel, event);
            } catch (err) {
              logger.error({ err, fullChannel }, "Failed to parse Redis staff event message");
            }
          });
          this.redisSubscribed = true;
        }
      } catch {
        // Offline mode
      }
    }
  }

  /**
   * Fan-out incoming event to all active streams on this replica that subscribe to the channel.
   */
  public handleIncomingEvent(channel: string, event: StaffEvent): void {
    if (this.isDestroyed) return;

    for (const stream of this.activeStreams.values()) {
      if (stream.channels.includes(channel)) {
        try {
          const payload = `id: ${event.id}\nevent: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
          stream.send(payload);
        } catch (err) {
          logger.debug({ err, connectionId: stream.connectionId }, "Failed to write event to SSE stream");
        }
      }
    }
  }

  /**
   * Count how many active streams this staff member has on this replica.
   */
  public getActiveStreamCount(staffId: string): number {
    let count = 0;
    for (const stream of this.activeStreams.values()) {
      if (stream.staffId === staffId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Register a new staff SSE connection, enforcing max 3 concurrent streams limit.
   */
  public registerStream(conn: ActiveStreamConnection): void {
    const currentCount = this.getActiveStreamCount(conn.staffId);
    if (currentCount >= MAX_CONCURRENT_STREAMS_PER_STAFF) {
      throw new AppError(
        "ERR_STREAM_LIMIT_EXCEEDED",
        "Maximum 3 concurrent event streams allowed per staff member",
        {
          max_concurrent: MAX_CONCURRENT_STREAMS_PER_STAFF,
          active_streams: currentCount,
        },
        429
      );
    }
    this.activeStreams.set(conn.connectionId, conn);
    logger.debug({ connectionId: conn.connectionId, staffId: conn.staffId, replicaId: this.replicaId }, "Staff SSE stream registered");
  }

  /**
   * Unregister an active SSE stream.
   */
  public unregisterStream(connectionId: string): void {
    this.activeStreams.delete(connectionId);
    logger.debug({ connectionId, replicaId: this.replicaId }, "Staff SSE stream unregistered");
  }

  /**
   * Check if a specific connection's session is revoked, and close stream if revoked.
   */
  public async checkSessionRevocation(connectionId: string): Promise<boolean> {
    const stream = this.activeStreams.get(connectionId);
    if (!stream) return false;

    const isActive = await staffAuthService.isStaffSessionActive(stream.sessionId);
    if (!isActive) {
      logger.info({ connectionId, staffId: stream.staffId, sessionId: stream.sessionId }, "Staff session revoked: closing SSE stream");
      try {
        stream.send(`event: session_revoked\ndata: ${JSON.stringify({ message: "Staff session has been revoked" })}\n\n`);
      } catch {
        // Stream may already be broken
      }
      try {
        stream.close();
      } catch {
        // Ignored
      }
      this.unregisterStream(connectionId);
      return true;
    }
    return false;
  }

  /**
   * Check all active streams on this replica for session revocation.
   */
  public async checkAllSessionRevocations(): Promise<number> {
    let closedCount = 0;
    const connectionIds = Array.from(this.activeStreams.keys());
    for (const connId of connectionIds) {
      const closed = await this.checkSessionRevocation(connId);
      if (closed) closedCount++;
    }
    return closedCount;
  }

  /**
   * Send heartbeat comment (: keep-alive\n\n) to all active streams.
   */
  public sendHeartbeats(): void {
    for (const stream of this.activeStreams.values()) {
      try {
        stream.send(": keep-alive\n\n");
      } catch {
        // Stream may have closed
      }
    }
  }

  /**
   * Get all active streams count on this replica.
   */
  public get totalActiveStreams(): number {
    return this.activeStreams.size;
  }

  /**
   * Clean up all active streams and listeners on replica shutdown / test teardown.
   */
  public destroy(): void {
    this.isDestroyed = true;
    if (this.unsubscribeBroker) {
      this.unsubscribeBroker();
    }
    for (const stream of this.activeStreams.values()) {
      try {
        stream.close();
      } catch {
        // Ignored
      }
    }
    this.activeStreams.clear();
  }
}

export const defaultReplica = new RealtimeReplica("web-replica-default");
