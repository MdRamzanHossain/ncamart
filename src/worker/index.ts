import { logger } from "@/lib/logger";
import { recurringSchedules } from "./schedules";
import { processOutboxBatch } from "./jobs/outboxRelay";

let isShuttingDown = false;
let relayInterval: NodeJS.Timeout | null = null;
let scheduleInterval: NodeJS.Timeout | null = null;

async function runRelayTick() {
  if (isShuttingDown) return;
  try {
    await processOutboxBatch();
  } catch (err) {
    logger.error({ err }, "Error processing outbox batch in worker loop");
  }
}

async function main() {
  logger.info({ schedulesCount: recurringSchedules.length }, "Initializing NCAMart background worker process...");

  // 1. Start outbox relay polling loop (polls every 1s)
  relayInterval = setInterval(() => {
    void runRelayTick();
  }, 1000);

  // 2. Schedule runner loop (checks minute ticks)
  scheduleInterval = setInterval(async () => {
    if (isShuttingDown) return;
    const now = new Date();
    // Run outbox health check every minute
    const healthTask = recurringSchedules.find((s) => s.name === "outbox-health");
    if (healthTask) {
      try {
        await healthTask.handler();
      } catch (err) {
        logger.error({ err }, "Error running outbox-health scheduled task");
      }
    }

    // Run 04:30 daily cleanup
    if (now.getHours() === 4 && now.getMinutes() === 30) {
      const cleanupTask = recurringSchedules.find((s) => s.name === "idempotency-cleanup");
      if (cleanupTask) {
        try {
          await cleanupTask.handler();
        } catch (err) {
          logger.error({ err }, "Error running idempotency-cleanup scheduled task");
        }
      }
    }
  }, 60000);

  logger.info("worker ready");

  // 3. Graceful shutdown handler
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, "Worker received termination signal. Gracefully draining and shutting down...");

    if (relayInterval) clearInterval(relayInterval);
    if (scheduleInterval) clearInterval(scheduleInterval);

    try {
      // Final drain attempt before exit
      await processOutboxBatch();
    } catch {
      // Ignored during shutdown
    }

    logger.info("Worker shutdown complete. Exiting.");
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main().catch((err) => {
  logger.fatal({ err }, "Fatal error starting worker");
  process.exit(1);
});
