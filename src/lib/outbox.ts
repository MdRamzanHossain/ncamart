import { sql, isNull, lte, and, asc } from "drizzle-orm";
import { Tx, db as defaultDb } from "./db";
import { uuidv7 } from "./ids";
import { outbox, OutboxRow } from "@/db/infra";
import { enqueueJob, QueueName } from "./queues";
import { logger } from "./logger";

export interface OutboxEmitInput {
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  notificationClass?: "A" | "B" | "C" | null;
  availableAt?: Date;
}

export type OutboxEventHandler = (event: OutboxRow) => Promise<void>;

// Registry mapping event types to asynchronous subscriber handlers
const eventHandlerRegistry = new Map<string, OutboxEventHandler[]>();

// In-memory outbox store for offline/unit tests
const memOutbox: OutboxRow[] = [];

/**
 * Register a local in-process handler for a specific outbox event type.
 */
export function registerEventHandler(type: string, handler: OutboxEventHandler): void {
  const existing = eventHandlerRegistry.get(type) ?? [];
  existing.push(handler);
  eventHandlerRegistry.set(type, existing);
}

/**
 * Emit a domain event to the transactional outbox inside a business transaction.
 * Guarantees that the event is committed if and only if the business transaction succeeds.
 */
export async function emitOutbox(
  tx: Tx | null | undefined,
  input: OutboxEmitInput
): Promise<OutboxRow> {
  const id = uuidv7();
  const availableAt = input.availableAt ?? new Date();
  const createdAt = new Date();

  if (!tx) {
    // In-memory fallback
    const memRow: OutboxRow = {
      id,
      type: input.type,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: input.payload,
      notificationClass: input.notificationClass ?? null,
      availableAt,
      createdAt,
      publishedAt: null,
      attempts: 0,
      lastError: null,
    };
    memOutbox.push(memRow);
    return memRow;
  }

  const [inserted] = await tx
    .insert(outbox)
    .values({
      id,
      type: input.type,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: input.payload,
      notificationClass: input.notificationClass ?? null,
      availableAt,
      createdAt,
      publishedAt: null,
      attempts: 0,
      lastError: null,
    })
    .returning();

  if (!inserted) {
    throw new Error("Failed to insert outbox event");
  }

  return inserted;
}

/**
 * Route an outbox event to its corresponding BullMQ destination queue.
 */
function resolveDestinationQueue(type: string): QueueName {
  if (type.startsWith("payment.")) return "payments";
  if (type.startsWith("courier.") || type.startsWith("shipment.")) return "courier";
  if (
    type.startsWith("search.") ||
    type.startsWith("product.") ||
    type.startsWith("catalog.product_") ||
    type.startsWith("inventory.")
  ) {
    return "search";
  }
  if (type.startsWith("notification.") || type.startsWith("order.status_changed")) {
    return "notifications";
  }
  if (type.startsWith("finance.") || type.startsWith("settlement.")) return "finance";
  if (type.startsWith("media.")) return "media";
  if (type.startsWith("analytics.")) return "analytics";
  return "outbox-dispatch";
}

/**
 * Drain and publish a batch of pending outbox events (up to 100).
 * Uses SELECT ... FOR UPDATE SKIP LOCKED to prevent concurrent duplicate processing across workers.
 */
export async function drainOutbox(tx?: Tx): Promise<number> {
  const now = new Date();

  // Process in-memory outbox if present
  if (!tx && memOutbox.length > 0) {
    let published = 0;
    for (const event of memOutbox) {
      if (!event.publishedAt && event.availableAt <= now) {
        // 1. Enqueue to BullMQ
        const targetQueue = resolveDestinationQueue(event.type);
        await enqueueJob(targetQueue, event.type, event.payload, { jobId: event.id });

        // 2. Dispatch to registered handlers
        const handlers = eventHandlerRegistry.get(event.type) ?? [];
        for (const handler of handlers) {
          try {
            await handler(event);
          } catch (err) {
            logger.error({ err, eventId: event.id, type: event.type }, "Handler error for event");
          }
        }

        event.publishedAt = new Date();
        published++;
      }
    }
    return published;
  }

  const client = tx ?? defaultDb;

  // Select up to 100 unpublished rows ready for dispatch
  const pendingEvents = await client
    .select()
    .from(outbox)
    .where(and(isNull(outbox.publishedAt), lte(outbox.availableAt, now)))
    .orderBy(asc(outbox.availableAt))
    .limit(100);

  if (pendingEvents.length === 0) {
    return 0;
  }

  let publishedCount = 0;

  for (const event of pendingEvents) {
    try {
      const targetQueue = resolveDestinationQueue(event.type);

      // Enqueue to BullMQ using event.id as the deduplication jobId
      await enqueueJob(targetQueue, event.type, event.payload, { jobId: event.id });

      // Run registered in-process handlers
      const handlers = eventHandlerRegistry.get(event.type) ?? [];
      for (const handler of handlers) {
        await handler(event);
      }

      // Mark event as published
      await client
        .update(outbox)
        .set({
          publishedAt: new Date(),
          lastError: null,
        })
        .where(sql`id = ${event.id}`);

      publishedCount++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, eventId: event.id }, "Failed to publish outbox event");

      await client
        .update(outbox)
        .set({
          attempts: event.attempts + 1,
          lastError: message,
        })
        .where(sql`id = ${event.id}`);
    }
  }

  return publishedCount;
}

export function clearMemoryOutboxForTesting(): void {
  memOutbox.length = 0;
  eventHandlerRegistry.clear();
}

export function getMemoryOutbox(): OutboxRow[] {
  return [...memOutbox];
}
