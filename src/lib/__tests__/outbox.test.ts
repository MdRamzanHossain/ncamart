import { describe, it, expect, beforeEach } from "vitest";
import {
  emitOutbox,
  drainOutbox,
  registerEventHandler,
  clearMemoryOutboxForTesting,
  getMemoryOutbox,
} from "../outbox";
import {
  clearMockQueuesForTesting,
  getMockQueuedJobs,
  listDeadLetterJobs,
  retryDeadLetterJob,
  moveToDeadLetter,
} from "../queues";
import { heartbeat, getLastHeartbeat } from "@/worker/schedules";

describe("outbox relay & queues unit tests", () => {
  beforeEach(() => {
    clearMemoryOutboxForTesting();
    clearMockQueuesForTesting();
  });

  it("emits events to the outbox with generated uuidv7 and pending published_at", async () => {
    const event = await emitOutbox(null, {
      type: "order.created",
      aggregateType: "ORDER",
      aggregateId: "ORD-2026-00001",
      payload: { totalPaisa: 150000 },
      notificationClass: "A",
    });

    expect(event.id).toBeDefined();
    expect(event.type).toBe("order.created");
    expect(event.publishedAt).toBeNull();
    expect(getMemoryOutbox()).toHaveLength(1);
  });

  it("drains and publishes outbox events, routing them to target queues with deduplication by jobId", async () => {
    const receivedEvents: string[] = [];
    registerEventHandler("order.status_changed", async (ev) => {
      receivedEvents.push(ev.id);
    });

    const event = await emitOutbox(null, {
      type: "order.status_changed",
      aggregateType: "ORDER",
      aggregateId: "ORD-2026-00001",
      payload: { from: "PENDING", to: "CONFIRMED" },
    });

    // Run first drain
    const count1 = await drainOutbox();
    expect(count1).toBe(1);
    expect(receivedEvents).toContain(event.id);

    // Verify target queue received job with jobId matching outbox id
    const queuedNotifications = getMockQueuedJobs("notifications");
    expect(queuedNotifications).toHaveLength(1);
    expect(queuedNotifications[0]?.id).toBe(event.id);

    // Run second concurrent/subsequent drain: should be published exactly once (count = 0)
    const count2 = await drainOutbox();
    expect(count2).toBe(0);
    // Notification queue still has only 1 job due to deduplication
    expect(getMockQueuedJobs("notifications")).toHaveLength(1);
  });

  it("handles dead-letter queue operations and retries", async () => {
    const mockJob = {
      id: "failed-job-999",
      name: "process-invoice",
      data: { invoiceId: "INV-123" },
      queue: "finance" as const,
      timestamp: Date.now(),
    };

    await moveToDeadLetter("finance", mockJob, "Gateway connection timeout");

    const deadList = await listDeadLetterJobs();
    expect(deadList.length).toBeGreaterThanOrEqual(1);

    const deadEntry = deadList.find((j) => j.name === "failed-process-invoice");
    expect(deadEntry).toBeDefined();
    const deadPayload = deadEntry?.data as { failureReason: string };
    expect(deadPayload.failureReason).toBe("Gateway connection timeout");

    // Retry dead-letter job
    const retried = await retryDeadLetterJob(deadEntry!.id);
    expect(retried).toBe(true);

    const financeJobs = getMockQueuedJobs("finance");
    expect(financeJobs.length).toBeGreaterThanOrEqual(1);
  });

  it("records heartbeat timestamps for scheduled tasks", async () => {
    await heartbeat("outbox-health");
    const lastRun = getLastHeartbeat("outbox-health");
    expect(lastRun).toBeDefined();
    expect(new Date(lastRun!).getTime()).toBeLessThanOrEqual(Date.now());
  });
});
