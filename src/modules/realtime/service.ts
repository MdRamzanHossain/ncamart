import { NextRequest } from "next/server";
import { uuidv7 } from "@/lib/ids";
import { Actor } from "@/lib/http/route";
import { ForbiddenError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { realtimeBroker } from "./broker";
import { defaultReplica, RealtimeReplica, DEFAULT_HEARTBEAT_INTERVAL_MS, DEFAULT_REVOCATION_CHECK_INTERVAL_MS } from "./replica";
import { StaffEvent, StaffEventInput, StaffEventAck, ActiveStreamConnection, StreamOptions } from "./types";

/**
 * Compute authorized Redis/pubsub channels for a staff actor.
 * Channels include: all-staff, staff:{id}, and role:{role} for each assigned role.
 */
export function computeStaffChannels(actor: { id: string; roles: string[] }): string[] {
  const channels = new Set<string>();
  channels.add("all-staff");
  channels.add(`staff:${actor.id}`);
  for (const role of actor.roles) {
    if (role && role.trim()) {
      channels.add(`role:${role.trim()}`);
    }
  }
  return Array.from(channels);
}

/**
 * Publish an alert event to a channel (worker -> Redis -> any web replica).
 * Returns the generated or assigned event ID.
 */
export async function publishStaffEvent(channel: string, event: StaffEventInput): Promise<string> {
  const published = await realtimeBroker.publish(channel, event);
  return published.id;
}

/**
 * Acknowledge a staff alert event (used by the 5-minute sourcing escalation).
 */
export async function acknowledgeStaffEvent(eventId: string, staffId: string): Promise<StaffEventAck> {
  return await realtimeBroker.acknowledge(eventId, staffId);
}

/**
 * Check whether a staff alert event has been acknowledged.
 */
export async function isStaffEventAcknowledged(eventId: string): Promise<boolean> {
  return await realtimeBroker.isAcknowledged(eventId);
}

/**
 * Get staff alert acknowledgement details if acknowledged.
 */
export async function getStaffEventAck(eventId: string): Promise<StaffEventAck | null> {
  return await realtimeBroker.getAck(eventId);
}

/**
 * Replay missed events from Redis Stream or memory buffer since lastEventId.
 */
export async function replayEventsSince(channels: string[], lastEventId: string): Promise<StaffEvent[]> {
  return await realtimeBroker.replay(channels, lastEventId);
}

/**
 * Handle GET /api/v1/events/stream SSE connection for staff sessions.
 */
export async function handleStaffEventStream(
  req: NextRequest,
  actor: Actor,
  options?: StreamOptions
): Promise<Response> {
  if (!actor || actor.type !== "staff") {
    throw new ForbiddenError("Staff access required for realtime event stream");
  }

  const replica = options?.replica || defaultReplica;
  const heartbeatMs = options?.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  const revocationMs = options?.revocationCheckIntervalMs ?? DEFAULT_REVOCATION_CHECK_INTERVAL_MS;

  const channels = computeStaffChannels({
    id: actor.id,
    roles: actor.roles || [],
  });

  const lastEventId =
    req.headers.get("last-event-id") ||
    req.nextUrl.searchParams.get("lastEventId") ||
    req.nextUrl.searchParams.get("last_event_id");

  const connectionId = uuidv7();
  const sessionId = actor.sessionId || "";
  const sessionToken = req.cookies.get("nca_sid")?.value;

  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  let isClosed = false;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let revocationTimer: NodeJS.Timeout | null = null;

  function sendChunk(chunk: string) {
    if (isClosed || !streamController) return;
    try {
      streamController.enqueue(encoder.encode(chunk));
    } catch {
      cleanup();
    }
  }

  function cleanup() {
    if (isClosed) return;
    isClosed = true;

    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (revocationTimer) {
      clearInterval(revocationTimer);
      revocationTimer = null;
    }

    replica.unregisterStream(connectionId);

    try {
      streamController?.close();
    } catch {
      // Ignored
    }
  }

  const connection: ActiveStreamConnection = {
    connectionId,
    staffId: actor.id,
    sessionId,
    sessionToken,
    channels,
    send: sendChunk,
    close: cleanup,
    createdAt: Date.now(),
  };

  // Register with replica (enforces max 3 concurrent streams per staff)
  replica.registerStream(connection);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      streamController = controller;

      // 1. Send initial keep-alive comment
      sendChunk(": keep-alive\n\n");

      // 2. Replay missed events if lastEventId is provided
      if (lastEventId) {
        try {
          const missed = await replayEventsSince(channels, lastEventId);
          for (const evt of missed) {
            sendChunk(`id: ${evt.id}\nevent: ${evt.event}\ndata: ${JSON.stringify(evt.data)}\n\n`);
          }
        } catch (err) {
          logger.error({ err, staffId: actor.id, lastEventId }, "Failed to replay missed events");
        }
      }

      // 3. Heartbeat comment every 25s
      heartbeatTimer = setInterval(() => {
        sendChunk(": keep-alive\n\n");
      }, heartbeatMs);

      // 4. Session revocation check every 60s
      revocationTimer = setInterval(async () => {
        await replica.checkSessionRevocation(connectionId);
      }, revocationMs);
    },
    cancel() {
      cleanup();
    },
  });

  if (req.signal) {
    req.signal.addEventListener("abort", () => {
      cleanup();
    });
  }

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
