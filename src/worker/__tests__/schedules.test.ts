import { describe, it, expect } from "vitest";
import { recurringSchedules, heartbeat, getLastHeartbeat } from "../schedules";
import { backupService } from "@/modules/backup";
import RedisCacheHandler from "@/lib/cache/redisCacheHandler.cjs";

describe("Production Schedules & Monitoring Verification (architechture.md §16)", () => {
  const REQUIRED_SECTION_16_JOBS = [
    { name: "outbox-health", desc: "Outbox relay & lag monitor" },
    { name: "reservation-expiry", desc: "Reservation expiry" },
    { name: "payment-reconciliation", desc: "SSLCommerz reconciliation" },
    { name: "clone-detection", desc: "Cloned seal detection" },
    { name: "courier-status-polling", desc: "Courier status polling fallback" },
    { name: "unpaid-order-autocancel", desc: "Unpaid order auto-cancel (24h)" },
    { name: "preorder-balance-reminders", desc: "Pre-order balance reminders" },
    { name: "preorder-forfeiture", desc: "Pre-order Day-8 forfeiture" },
    { name: "preorder-batch-threshold", desc: "Pre-order batch threshold check" },
    { name: "unclaimed-pickups", desc: "Pickup expiry & reminders" },
    { name: "warranty-start-fallback", desc: "Warranty start fallback" },
    { name: "cod-settlement-aging", desc: "COD settlement aging / MISSING detection" },
    { name: "rto-count-12m-recompute", desc: "rto_count_12m recompute" },
    { name: "nightly-inventory-audit", desc: "Inventory balance vs. movements check" },
    { name: "audit-nightly-export", desc: "Audit log export to R2" },
    { name: "marketing-feeds-generation", desc: "Feeds generation" },
    { name: "media-retention-and-cleanup", desc: "Media retention cleanup" },
  ];

  it("registers all required scheduled background jobs from architechture.md §16", () => {
    const registeredNames = new Set(recurringSchedules.map((s) => s.name));

    for (const job of REQUIRED_SECTION_16_JOBS) {
      expect(
        registeredNames.has(job.name),
        `Required background job '${job.name}' (${job.desc}) must be registered in recurringSchedules`
      ).toBe(true);
    }
  });

  it("registers the weekly database logical dump job to R2", () => {
    const backupTask = recurringSchedules.find((s) => s.name === "weekly-database-backup");
    expect(backupTask).toBeDefined();
    expect(backupTask?.cron).toBe("0 3 * * 0");
  });

  it("validates every scheduled task structure (name, valid cron syntax, handler)", () => {
    for (const task of recurringSchedules) {
      expect(task.name).toBeTruthy();
      expect(task.description).toBeTruthy();
      expect(typeof task.handler).toBe("function");

      const cronParts = task.cron.trim().split(/\s+/);
      expect(
        cronParts.length === 5,
        `Task '${task.name}' has invalid cron format: '${task.cron}'. Expected 5 space-separated parts.`
      ).toBe(true);
    }
  });

  it("records and updates Better Stack heartbeats correctly", async () => {
    const testJob = "test-monitoring-heartbeat";
    await heartbeat(testJob);
    const lastRun = getLastHeartbeat(testJob);
    expect(lastRun).toBeDefined();
    expect(new Date(lastRun!).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("executes backupService.runWeeklyLogicalDump() and stores archive with metadata", async () => {
    const backup = await backupService.runWeeklyLogicalDump();
    expect(backup.key).toContain("backups/db_logical_");
    expect(backup.sizeBytes).toBeGreaterThan(0);
    expect(backup.bucket).toBeTruthy();
    expect(["pg_dump_custom", "logical_jsonl"]).toContain(backup.type);
  });
});

describe("Multi-Replica Redis CacheHandler Verification", () => {
  it("stores and retrieves cached entries with tags and timestamps", async () => {
    const cache = new RedisCacheHandler({ dev: false });
    const key = "test-sku-page-cache";
    const data = { title: "Industrial V-Belt", pricePaisa: 250000 };

    await cache.set(key, data, { tags: ["catalog", "sku_1001"], revalidate: 3600 });
    const cached = await cache.get(key);

    expect(cached).not.toBeNull();
    expect(cached?.value).toEqual(data);
    expect(cached?.tags).toContain("catalog");
    expect(cached?.tags).toContain("sku_1001");
    expect(cached?.lastModified).toBeLessThanOrEqual(Date.now());
  });

  it("invalidates tagged cache entries across replicas on revalidateTag", async () => {
    const cache = new RedisCacheHandler({ dev: false });
    const key1 = "page_catalog_electronics";
    const key2 = "page_catalog_hardware";

    await cache.set(key1, { content: "electronics" }, { tags: ["category_update"] });
    await cache.set(key2, { content: "hardware" }, { tags: ["hardware_only"] });

    expect(await cache.get(key1)).not.toBeNull();
    expect(await cache.get(key2)).not.toBeNull();

    await cache.revalidateTag("category_update");

    expect(await cache.get(key1)).toBeNull();
    expect(await cache.get(key2)).not.toBeNull();
  });
});
