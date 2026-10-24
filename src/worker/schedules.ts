import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sourcingService } from "@/modules/sourcing";
import { inventoryService } from "@/modules/inventory";
import { promotionsService } from "@/modules/promotions";
import { ordersService } from "@/modules/orders";
import { paymentsService } from "@/modules/payments";
import { preorderService } from "@/modules/preorder";
import { trustService } from "@/modules/trust";
import { logisticsService } from "@/modules/logistics";
import { posService } from "@/modules/pos";

export interface ScheduledTask {
  name: string;
  cron: string;
  description: string;
  handler: () => Promise<void>;
}

// In-memory heartbeat tracker
const memHeartbeats = new Map<string, string>();

/**
 * Record job execution heartbeat. Pings Better Stack URL if configured in env,
 * and records last_run_at in Redis.
 */
export async function heartbeat(jobName: string): Promise<void> {
  const nowIso = new Date().toISOString();
  memHeartbeats.set(jobName, nowIso);

  if (!env.MOCK_EXTERNAL_SERVICES) {
    try {
      const redis = getRedis();
      await redis.set(`heartbeat:${jobName}`, nowIso, "EX", 86400 * 7);
    } catch {
      // Ignored
    }
  }

  // Ping Better Stack monitoring URL if configured
  const envKey = `HEARTBEAT_${jobName.toUpperCase().replace(/-/g, "_")}`;
  const pingUrl = process.env[envKey] || process.env.BETTER_STACK_HEARTBEAT_URL;

  if (pingUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      await fetch(pingUrl, { signal: controller.signal });
      clearTimeout(timeout);
    } catch (err) {
      logger.warn({ err, jobName, pingUrl }, "Failed to send external heartbeat ping");
    }
  }
}

/**
 * Outbox Health Check Job (Runs every 1 min):
 * Alerts if the oldest unpublished event is > 5 minutes old.
 */
export async function checkOutboxHealth(): Promise<void> {
  try {
    const result = await db.execute<{ oldest: string | null }>(
      sql`SELECT min(available_at) as oldest FROM outbox WHERE published_at IS NULL;`
    );

    const oldestStr = result.rows[0]?.oldest;
    if (oldestStr) {
      const oldestDate = new Date(oldestStr);
      const lagMs = Date.now() - oldestDate.getTime();
      const fiveMinutesMs = 5 * 60 * 1000;

      if (lagMs > fiveMinutesMs) {
        logger.error(
          { oldestDate: oldestStr, lagSeconds: Math.round(lagMs / 1000) },
          "ALERT: Outbox relay lag exceeds 5 minutes!"
        );
      }
    }

    await heartbeat("outbox-health");
  } catch (err) {
    logger.error({ err }, "Error checking outbox health");
  }
}

/**
 * Idempotency Key Cleanup Job (Runs daily 04:30 Dhaka time):
 * Prunes expired idempotency records (older than 24h).
 */
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  try {
    const result = await db.execute<{ count: string | number }>(
      sql`
        WITH deleted AS (
          DELETE FROM idempotency_keys
          WHERE expires_at < now()
          RETURNING key
        )
        SELECT count(*) FROM deleted;
      `
    );

    const deletedCount = Number(result.rows[0]?.count || 0);
    logger.info({ deletedCount }, "Pruned expired idempotency keys");

    await heartbeat("idempotency-cleanup");
    return deletedCount;
  } catch (err) {
    logger.error({ err }, "Error pruning expired idempotency keys");
    return 0;
  }
}

/**
 * Master registry of scheduled background jobs.
 * Timezone: Asia/Dhaka (UTC+6).
 */
export const recurringSchedules: ScheduledTask[] = [
  {
    name: "outbox-health",
    cron: "* * * * *", // every 1 min
    description: "Monitors outbox lag and alerts if oldest event is older than 5 minutes",
    handler: checkOutboxHealth,
  },
  {
    name: "idempotency-cleanup",
    cron: "30 4 * * *", // daily at 04:30 Asia/Dhaka
    description: "Cleans up expired 24h idempotency keys",
    handler: async () => {
      await cleanupExpiredIdempotencyKeys();
    },
  },
  {
    name: "stale-supplier-stock",
    cron: "0 8 * * *", // daily at 08:00 Asia/Dhaka
    description: "Marks supplier stock older than 24h as stale (treated as LIMITED) and alerts sourcing manager",
    handler: async () => {
      await sourcingService.markStaleSupplierStock();
      await heartbeat("stale-supplier-stock");
    },
  },
  {
    name: "reservation-expiry",
    cron: "* * * * *", // every 1 min
    description: "Expires 10-minute active reservations and releases locked stock via CTE",
    handler: async () => {
      await inventoryService.expireReservations();
      await heartbeat("reservation-expiry");
    },
  },
  {
    name: "nightly-inventory-audit",
    cron: "30 3 * * *", // daily at 03:30 Asia/Dhaka
    description: "Verifies on_hand == sum(movements in) - sum(movements out) per (sku, location) and emits Class A alert on mismatch",
    handler: async () => {
      await inventoryService.runNightlyInventoryAudit();
      await heartbeat("nightly-inventory-audit");
    },
  },
  {
    name: "daily-store-credit-expiry",
    cron: "15 0 * * *", // daily at 00:15 Asia/Dhaka
    description: "Expires store credit lots past their validity window and posts goodwill reversal",
    handler: async () => {
      await promotionsService.expireCreditLotsJob();
      await heartbeat("daily-store-credit-expiry");
    },
  },
  {
    name: "payment-reconciliation",
    cron: "*/5 * * * *", // every 5 min
    description: "Queries SSLCommerz Transaction Query API for PENDING transactions older than 10m and newer than 24h",
    handler: async () => {
      await paymentsService.reconcilePendingPaymentsJob();
      await heartbeat("payment-reconciliation");
    },
  },
  {
    name: "unpaid-order-autocancel",
    cron: "*/15 * * * *", // every 15 min
    description: "Cancels PENDING_PAYMENT / DEPOSIT_PENDING orders older than UNPAID_ORDER_CANCEL_HOURS (24h) and releases stock/coupon/store credit",
    handler: async () => {
      await ordersService.autoCancelUnpaidOrdersJob();
      await heartbeat("unpaid-order-autocancel");
    },
  },
  {
    name: "preorder-forfeiture",
    cron: "5 0 * * *", // daily at 00:05 Asia/Dhaka
    description: "Day-8 forfeiture: moves units from QC_HOLD to GODOWN_NAWABPUR, posts ledger Dr 2010 / Cr 4030, creates flash deal",
    handler: async () => {
      await preorderService.runForfeitureJob();
      await heartbeat("preorder-forfeiture");
    },
  },
  {
    name: "preorder-batch-threshold",
    cron: "0 1 * * *", // daily at 01:00 Asia/Dhaka
    description: "Checks 30-day pre-order batches with count < threshold, cancels and refunds customers",
    handler: async () => {
      await preorderService.runBatchThresholdJob();
      await heartbeat("preorder-batch-threshold");
    },
  },
  {
    name: "preorder-delay",
    cron: "0 9 * * *", // daily at 09:00 Asia/Dhaka
    description: "Finds pre-orders not arrived by eta_date + 7 days, sets delay_option OFFERED with 24h choice",
    handler: async () => {
      await preorderService.runDelayJob();
      await heartbeat("preorder-delay");
    },
  },
  {
    name: "preorder-balance-reminders",
    cron: "0 10 * * *", // daily at 10:00 Asia/Dhaka
    description: "Sends Day 1, 4, 7 balance payment reminders; Day 7 creates support call task",
    handler: async () => {
      await preorderService.runBalanceReminderJob();
      await heartbeat("preorder-balance-reminders");
    },
  },
  {
    name: "preorder-repricing-timeout",
    cron: "0 * * * *", // every hour
    description: "Cancels and refunds pre-orders where spot repricing 48h deadline expired",
    handler: async () => {
      await preorderService.runRepricingTimeoutJob();
      await heartbeat("preorder-repricing-timeout");
    },
  },
  {
    name: "runner-override-escalation",
    cron: "* * * * *", // every minute
    description: "Escalates unacknowledged runner spot price override requests older than 5 minutes via SMS/WhatsApp",
    handler: async () => {
      await sourcingService.runOverrideEscalationJob();
      await heartbeat("runner-override-escalation");
    },
  },
  {
    name: "qc-audit-escalation",
    cron: "*/5 * * * *", // every 5 minutes
    description: "Escalates sampled QC records past audit_due_at without supervisor check to SUPER_ADMIN once (Class A)",
    handler: async () => {
      await trustService.runQcAuditEscalationJob();
      await heartbeat("qc-audit-escalation");
    },
  },
  {
    name: "clone-detection",
    cron: "*/5 * * * *", // every 5 minutes
    description: "Detects cloned seals (>=5 devices and >=2 districts in 24h) and alerts SUPER_ADMIN",
    handler: async () => {
      await trustService.runCloneDetectionJob();
      await heartbeat("clone-detection");
    },
  },
  {
    name: "warranty-expiry",
    cron: "30 2 * * *", // daily at 02:30 Asia/Dhaka
    description: "Transitions ACTIVE seals with warranty_end < now to EXPIRED status",
    handler: async () => {
      await trustService.runWarrantyExpiryJob();
      await heartbeat("warranty-expiry");
    },
  },
  {
    name: "partition-maintenance",
    cron: "0 3 25 * *", // monthly on the 25th at 03:00
    description: "Creates next month seal_verifications partition and drops partitions older than 12 months",
    handler: async () => {
      await trustService.runPartitionMaintenanceJob();
      await heartbeat("partition-maintenance");
    },
  },
  {
    name: "courier-status-polling",
    cron: "*/30 * * * *", // every 30 minutes
    description: "Polls courier status for non-terminal shipments with no event in 24h",
    handler: async () => {
      await logisticsService.runCourierPollingJob();
      await heartbeat("courier-status-polling");
    },
  },
  {
    name: "warranty-start-fallback",
    cron: "0 2 * * *", // daily at 02:00 Asia/Dhaka
    description: "Applies warranty start fallback date (+3d Dhaka / +5d outside) for handed-over shipments without delivery event",
    handler: async () => {
      await logisticsService.runWarrantyFallbackJob();
      await heartbeat("warranty-start-fallback");
    },
  },
  {
    name: "rto-count-12m-recompute",
    cron: "0 3 * * *", // daily at 03:00 Asia/Dhaka
    description: "Recomputes rolling 12m RTO count and auto-unblocks COD if dropped below 2 (AUTO_RTO)",
    handler: async () => {
      await logisticsService.runRtoRecomputeJob();
      await heartbeat("rto-count-12m-recompute");
    },
  },
  {
    name: "unclaimed-pickups",
    cron: "30 9 * * *", // daily at 09:30 Asia/Dhaka
    description: "Sends Day 3/6 pickup reminders, expires unpaid Day 8 pickups with restock, and flags prepaid Day 14 pickups",
    handler: async () => {
      await posService.runUnclaimedPickupsJob();
      await heartbeat("unclaimed-pickups");
    },
  },
];

export function getLastHeartbeat(jobName: string): string | undefined {
  return memHeartbeats.get(jobName);
}
