import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import { sourcingRepo } from "../repo";
import { sourcingService } from "../service";
import { Actor } from "@/lib/http/route";
import { getMemoryOutbox, clearMemoryOutboxForTesting } from "@/lib/outbox";
import { ordersRepo, OrderWithDetails } from "@/modules/orders/repo";
import { ordersService } from "@/modules/orders/service";
import { catalogRepo } from "@/modules/catalog/repo";
import { catalogService } from "@/modules/catalog";
import { clearMemoryCountersForTesting } from "@/db/counters";

const sourcingManager: Actor = {
  id: "01920000-0000-7000-8000-000000000001",
  type: "staff",
  roles: ["SOURCING_MANAGER"],
};

const runnerA: Actor = {
  id: "01920000-0000-7000-8000-0000000000aa",
  type: "staff",
  roles: ["FIELD_RUNNER"],
};

const runnerB: Actor = {
  id: "01920000-0000-7000-8000-0000000000bb",
  type: "staff",
  roles: ["FIELD_RUNNER"],
};

const customerA: Actor = {
  id: "01920000-0000-7000-8000-0000000000cc",
  type: "customer",
};

describe("P24 — Runner Tasks & Spot-Price Tolerance", () => {
  beforeEach(() => {
    sourcingService.clearMemoryForTesting();
    ordersService.clearMemoryForTesting();
    catalogService.clearMemoryCatalogForTesting();
    clearMemoryCountersForTesting();
    clearMemoryOutboxForTesting();
  });

  // Helper to create test supplier
  async function createTestSupplier(name: string, stallNo: string) {
    return sourcingRepo.createSupplier({
      name,
      proprietorName: "Stall Owner",
      market: "NAWABPUR_COMPLEX",
      stallNo,
      floor: "2nd Floor",
      phone: "01711000001",
      acceptedPaymentModes: ["CASH"],
      status: "ACTIVE",
    });
  }

  // Helper to create catalog product + SKU
  async function createTestSku(costPaisa: number, pricePaisa: number, vatRateBp: number = 0) {
    const category = await catalogService.createCategory({
      slug: `cat-${crypto.randomUUID().slice(0, 8)}`,
      nameEn: "Industrial Tools",
      nameBn: "শিল্প সরঞ্জাম",
      level: 1,
    });

    const product = await catalogService.createProduct(
      {
        titleEn: "Industrial VFD Inverter 500W",
        titleBn: "শিল্প ভিএফডি ইনভার্টার ৫০০ ওয়াট",
        slug: `inv-${crypto.randomUUID().slice(0, 8)}`,
        categoryId: category.id,
        productTier: "AUTHENTIC",
        fulfillmentType: "DROP_AND_PACK",
        vatRateBp,
      },
      sourcingManager
    );

    const sku = await catalogService.createSku(
      {
        productId: product.id,
        skuCode: `INV-${crypto.randomUUID().slice(0, 6)}`,
        pricePaisa,
        baseCostPaisa: costPaisa,
        weightGrams: 1500,
        warrantyType: "OFFICIAL_DISTRIBUTOR",
        warrantyDays: 365,
      },
      sourcingManager
    );
    catalogService.setProductStatusForTesting(product.id, "PUBLISHED");

    return { product, sku };
  }

  // Helper to create a confirmed order with VIRTUAL items
  async function createTestOrder(items: Array<{ skuId: string; qty: number; unitPricePaisa: number; unitCostPaisa: number }>) {
    const orderNumber = `ORD-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const lineTotalPaisa = items.reduce((sum, i) => sum + i.unitPricePaisa * i.qty, 0);

    return ordersRepo.createOrder(undefined, {
      order: {
        orderNumber,
        customerId: customerA.id,
        channel: "STOREFRONT_WEB",
        orderType: "REGULAR_DROP_PACK",
        fulfillmentChannel: "COURIER",
        deliveryZone: "INSIDE_DHAKA",
        status: "CONFIRMED",
        paymentStatus: "PAID",
        paymentMode: "ONLINE_FULL",
        subtotalPaisa: lineTotalPaisa,
        discountPaisa: 0,
        deliveryFeePaisa: 6000,
        vatTotalPaisa: 0,
        totalPayablePaisa: lineTotalPaisa + 6000,
        storeCreditAppliedPaisa: 0,
        advanceRequiredPaisa: 0,
        advancePaidPaisa: 0,
        codAmountPaisa: 0,
        paidTotalPaisa: lineTotalPaisa + 6000,
        refundedTotalPaisa: 0,
      },
      items: items.map((i) => ({
        skuId: i.skuId,
        productId: crypto.randomUUID(),
        titleEn: "Industrial VFD Inverter",
        titleBn: "শিল্প ভিএফডি ইনভার্টার",
        tier: "AUTHENTIC",
        skuCode: "INV-500W",
        qty: i.qty,
        unitPricePaisa: i.unitPricePaisa,
        allocatedDiscountPaisa: 0,
        lineTotalPaisa: i.unitPricePaisa * i.qty,
        vatRateBp: 0,
        vatPaisa: 0,
        source: "VIRTUAL",
        unitCostPaisa: i.unitCostPaisa,
        status: "ACTIVE",
        units: [],
      })),
    });
  }

  // --------------------------------------------------------------------------
  // 1. Auto-Assignment & Float Shift Checking
  // --------------------------------------------------------------------------
  describe("1. Auto-Assignment & Shift Status", () => {
    it("auto-assigns task to the on-shift runner with the fewest open tasks", async () => {
      const { sku } = await createTestSku(100000, 150000); // ৳1,000 cost, ৳1,500 price
      const primarySupplier = await createTestSupplier("Nawabpur Primary Stall", "Shop 10");
      const backupSupplier = await createTestSupplier("Sundarban Backup Stall", "Shop 22");

      // Set supplier stock priorities
      await sourcingService.updateSupplierStock(
        primarySupplier.id,
        [
          {
            skuId: sku.id,
            status: "AVAILABLE",
            priority: 1,
            lastQuotedCostPaisa: 100000,
          },
        ],
        sourcingManager
      );
      await sourcingService.updateSupplierStock(
        backupSupplier.id,
        [
          {
            skuId: sku.id,
            status: "AVAILABLE",
            priority: 2,
            lastQuotedCostPaisa: 105000,
          },
        ],
        sourcingManager
      );

      // Both runners are on shift (have open float sessions)
      await sourcingService.openFloatSession(runnerA.id, sourcingManager);
      await sourcingService.openFloatSession(runnerB.id, sourcingManager);

      // Pre-assign 1 open task to Runner A
      await sourcingRepo.createRunnerTask({
        taskNumber: "TSK-EXISTING-001",
        taskType: "SOURCING",
        skuId: sku.id,
        qty: 1,
        supplierId: primarySupplier.id,
        maxUnitPricePaisa: 105000,
        runnerId: runnerA.id,
        status: "DISPATCHED",
        dueAt: new Date(Date.now() + 7200000),
      });

      // Runner A now has 1 open task; Runner B has 0 open tasks
      const countA = await sourcingRepo.countOpenTasksForRunner(runnerA.id);
      const countB = await sourcingRepo.countOpenTasksForRunner(runnerB.id);
      expect(countA).toBe(1);
      expect(countB).toBe(0);

      // Order confirmed with virtual line
      const order = await createTestOrder([
        { skuId: sku.id, qty: 2, unitPricePaisa: 150000, unitCostPaisa: 100000 },
      ]);

      // Trigger task creation
      const { tasks } = await sourcingService.createTasksForOrder(order.id, sourcingManager);

      expect(tasks.length).toBe(1);
      const task = tasks[0]!;
      expect(task.status).toBe("DISPATCHED");
      // Must be auto-assigned to Runner B (fewest open tasks: 0 vs 1)
      expect(task.runnerId).toBe(runnerB.id);
      expect(task.supplierId).toBe(primarySupplier.id);
      expect(task.backupSupplierId).toBe(backupSupplier.id);
      // max_unit_price = base_cost * (1 + 5% spot buffer) = 100,000 * 1.05 = 105,000 paisa (৳1,050)
      expect(task.maxUnitPricePaisa).toBe(105000);

      // Check task assigned outbox event
      const outbox = getMemoryOutbox();
      const assignEvent = outbox.find((e) => e.type === "sourcing.task_assigned");
      expect(assignEvent).toBeDefined();
      expect(assignEvent?.payload).toMatchObject({
        taskId: task.id,
        runnerId: runnerB.id,
      });
    });

    it("creates task as PENDING_ASSIGNMENT and emits SSE alert when no runners are on shift", async () => {
      const { sku } = await createTestSku(100000, 150000);
      const primarySupplier = await createTestSupplier("Nawabpur Primary Stall", "Shop 10");

      await sourcingService.updateSupplierStock(
        primarySupplier.id,
        [
          {
            skuId: sku.id,
            status: "AVAILABLE",
            priority: 1,
            lastQuotedCostPaisa: 100000,
          },
        ],
        sourcingManager
      );

      // No open float sessions! (No runner on shift)
      const order = await createTestOrder([
        { skuId: sku.id, qty: 1, unitPricePaisa: 150000, unitCostPaisa: 100000 },
      ]);

      const { tasks } = await sourcingService.createTasksForOrder(order.id, sourcingManager);

      expect(tasks.length).toBe(1);
      const task = tasks[0]!;
      expect(task.status).toBe("PENDING_ASSIGNMENT");
      expect(task.runnerId).toBeNull();

      // Check unassigned SSE alert emitted to Sourcing Managers
      const outbox = getMemoryOutbox();
      const alert = outbox.find((e) => e.type === "sourcing.unassigned_task_alert");
      expect(alert).toBeDefined();
      expect(alert?.notificationClass).toBe("A");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Spot-Price Tolerance & Margin Rule
  // --------------------------------------------------------------------------
  describe("2. Spot-Price Tolerance & Margin Rule", () => {
    it("automatically allows override without manager approval when within 5% buffer AND margin >= 15%", async () => {
      // List Price = ৳2,000 (200,000 paisa)
      // Base Cost = ৳1,000 (100,000 paisa)
      // Max Price (5% buffer) = ৳1,050 (105,000 paisa)
      // Margin at ৳1,040 = (2,000 - 1,040) / 2,000 = 48% (>= 15%)
      const { sku } = await createTestSku(100000, 200000);
      const supplier = await createTestSupplier("Nawabpur Stall", "Shop 5");

      const task = await sourcingRepo.createRunnerTask({
        taskNumber: "RUN-2026-0001",
        taskType: "SOURCING",
        skuId: sku.id,
        qty: 1,
        supplierId: supplier.id,
        maxUnitPricePaisa: 105000, // ৳1,050
        runnerId: runnerA.id,
        status: "DISPATCHED",
        dueAt: new Date(Date.now() + 7200000),
      });

      // Runner requests ৳1,040 (104,000 paisa) - within ৳1,050 buffer and margin = 48%
      const res = await sourcingService.requestOverride(
        task.id,
        { quoted_cost_paisa: 104000, reason: "Stall owner demanded ৳1,040" },
        runnerA
      );

      expect(res.allowed).toBe(true);
      expect(res.quoted_cost_paisa).toBe(104000);

      // Task remains in progress; no PRICE_EXCEEDED_PENDING
      const taskAfter = await sourcingRepo.getRunnerTaskById(task.id);
      expect(taskAfter?.status).toBe("DISPATCHED");
    });

    it("rejects and marks PRICE_EXCEEDED_PENDING when quoted price exceeds 5% spot buffer", async () => {
      // Base Cost = ৳1,000, Max = ৳1,050 (105,000 paisa)
      // Runner quoted ৳1,100 (110,000 paisa) -> exceeds 5% buffer!
      const { sku } = await createTestSku(100000, 200000);
      const supplier = await createTestSupplier("Nawabpur Stall", "Shop 5");

      const task = await sourcingRepo.createRunnerTask({
        taskNumber: "RUN-2026-0002",
        taskType: "SOURCING",
        skuId: sku.id,
        qty: 1,
        supplierId: supplier.id,
        maxUnitPricePaisa: 105000,
        runnerId: runnerA.id,
        status: "DISPATCHED",
        dueAt: new Date(Date.now() + 7200000),
      });

      const res = await sourcingService.requestOverride(
        task.id,
        { quoted_cost_paisa: 110000, reason: "Vendor increased price to ৳1,100" },
        runnerA
      );

      expect(res.allowed).toBe(false);
      expect(res.status).toBe("PRICE_EXCEEDED_PENDING");

      const taskAfter = await sourcingRepo.getRunnerTaskById(task.id);
      expect(taskAfter?.status).toBe("PRICE_EXCEEDED_PENDING");
      expect(taskAfter?.quotedUnitPricePaisa).toBe(110000);

      // Verify outbox event 'sourcing.override_requested' emitted
      const outbox = getMemoryOutbox();
      const overrideEvt = outbox.find((e) => e.type === "sourcing.override_requested");
      expect(overrideEvt).toBeDefined();
      expect(overrideEvt?.payload).toMatchObject({
        taskId: task.id,
        quotedUnitPricePaisa: 110000,
      });
    });

    it("rejects and marks PRICE_EXCEEDED_PENDING when margin drops below 15%", async () => {
      // List Price = ৳1,100, Base Cost = ৳1,000, Max = ৳1,050
      // Runner quotes ৳1,020 (within ৳1,050 buffer)
      // BUT Margin = (1,100 - 1,020) / 1,100 = 7.27% (< 15% threshold!)
      const { sku } = await createTestSku(100000, 110000);
      const supplier = await createTestSupplier("Nawabpur Stall", "Shop 5");

      const task = await sourcingRepo.createRunnerTask({
        taskNumber: "RUN-2026-0003",
        taskType: "SOURCING",
        skuId: sku.id,
        qty: 1,
        supplierId: supplier.id,
        maxUnitPricePaisa: 105000,
        runnerId: runnerA.id,
        status: "DISPATCHED",
        dueAt: new Date(Date.now() + 7200000),
      });

      const res = await sourcingService.requestOverride(
        task.id,
        { quoted_cost_paisa: 102000, reason: "Price is ৳1,020" },
        runnerA
      );

      expect(res.allowed).toBe(false);
      expect(res.status).toBe("PRICE_EXCEEDED_PENDING");
      expect(res.reason).toContain("margin drops below 15%");
    });
  });

  // --------------------------------------------------------------------------
  // 3. 5-Minute Escalation Background Worker
  // --------------------------------------------------------------------------
  describe("3. 5-Minute Escalation Job", () => {
    it("fires escalation at 5 min only when unacknowledged", async () => {
      const { sku } = await createTestSku(100000, 200000);
      const supplier = await createTestSupplier("Nawabpur Stall", "Shop 5");

      // Task in PRICE_EXCEEDED_PENDING created 6 minutes ago
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      const task = await sourcingRepo.createRunnerTask({
        taskNumber: "RUN-2026-0004",
        taskType: "SOURCING",
        skuId: sku.id,
        qty: 1,
        supplierId: supplier.id,
        maxUnitPricePaisa: 105000,
        runnerId: runnerA.id,
        status: "PRICE_EXCEEDED_PENDING",
        quotedUnitPricePaisa: 110000,
        dueAt: new Date(Date.now() + 7200000),
        createdAt: sixMinutesAgo,
      });

      // Run escalation job
      const { escalatedCount } = await sourcingService.runOverrideEscalationJob();
      expect(escalatedCount).toBe(1);

      const taskAfter = await sourcingRepo.getRunnerTaskById(task.id);
      expect(taskAfter?.escalatedAt).toBeDefined();

      // Check Class A escalation alert emitted for WhatsApp/SMS dispatch
      const outbox = getMemoryOutbox();
      const escEvt = outbox.find((e) => e.type === "sourcing.override_escalated");
      expect(escEvt).toBeDefined();
      expect(escEvt?.notificationClass).toBe("A");
    });

    it("does not fire escalation if manager acknowledged the task before 5 min", async () => {
      const { sku } = await createTestSku(100000, 200000);
      const supplier = await createTestSupplier("Nawabpur Stall", "Shop 5");

      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      const task = await sourcingRepo.createRunnerTask({
        taskNumber: "RUN-2026-0005",
        taskType: "SOURCING",
        skuId: sku.id,
        qty: 1,
        supplierId: supplier.id,
        maxUnitPricePaisa: 105000,
        runnerId: runnerA.id,
        status: "PRICE_EXCEEDED_PENDING",
        quotedUnitPricePaisa: 110000,
        dueAt: new Date(Date.now() + 7200000),
        createdAt: sixMinutesAgo,
      });

      // Sourcing Manager acknowledges the task
      await sourcingService.acknowledgeTask(task.id, sourcingManager);

      const taskAcked = await sourcingRepo.getRunnerTaskById(task.id);
      expect(taskAcked?.acknowledgedAt).toBeDefined();

      // Run escalation job
      const { escalatedCount } = await sourcingService.runOverrideEscalationJob();
      expect(escalatedCount).toBe(0); // Acknowledged task is NOT escalated!
    });
  });

  // --------------------------------------------------------------------------
  // 4. Runner PII Masking Verification (PRD §3.9, api-spec §10.1)
  // --------------------------------------------------------------------------
  describe("4. Runner PII Masking Verification", () => {
    it("ensures runner task public DTO contains NO customer PII", async () => {
      const { sku } = await createTestSku(100000, 200000);
      const supplier = await createTestSupplier("Nawabpur Stall", "Shop 5");

      const order = await createTestOrder([
        { skuId: sku.id, qty: 1, unitPricePaisa: 200000, unitCostPaisa: 100000 },
      ]);

      const task = await sourcingRepo.createRunnerTask({
        taskNumber: "RUN-2026-0006",
        taskType: "SOURCING",
        orderId: order.id,
        skuId: sku.id,
        qty: 1,
        supplierId: supplier.id,
        maxUnitPricePaisa: 105000,
        runnerId: runnerA.id,
        status: "DISPATCHED",
        dueAt: new Date(Date.now() + 7200000),
      });

      // Field runner queries tasks
      const res = await sourcingService.listRunnerTasks({}, runnerA);
      expect(res.items.length).toBe(1);

      const runnerTask = res.items[0]!;

      // 1. Must contain orderNumber, SKU, title, stall, max price
      expect(runnerTask.order_number).toBe(order.orderNumber);
      expect(runnerTask.sku_id).toBe(sku.id);
      expect(runnerTask.stall.name).toBe("Nawabpur Stall");
      expect(runnerTask.stall.stall_no).toBe("Shop 5");
      expect(runnerTask.max_unit_price_paisa).toBe(105000);

      // 2. Strictly MUST NOT contain customer PII!
      const raw = runnerTask as unknown as Record<string, unknown>;
      expect(raw["customer"]).toBeUndefined();
      expect(raw["customerId"]).toBeUndefined();
      expect(raw["customer_id"]).toBeUndefined();
      expect(raw["customerName"]).toBeUndefined();
      expect(raw["customer_name"]).toBeUndefined();
      expect(raw["customerPhone"]).toBeUndefined();
      expect(raw["customer_phone"]).toBeUndefined();
      expect(raw["consignee"]).toBeUndefined();
      expect(raw["address"]).toBeUndefined();
      expect(raw["addressSnapshot"]).toBeUndefined();
      expect(raw["address_snapshot"]).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 5. Sourcing Manager Override Decision & Rerouting
  // --------------------------------------------------------------------------
  describe("5. Manager Override Decision & Rerouting", () => {
    it("APPROVE allows runner to buy at the quoted price and records approval", async () => {
      const { sku } = await createTestSku(100000, 200000);
      const supplier = await createTestSupplier("Nawabpur Stall", "Shop 5");

      const task = await sourcingRepo.createRunnerTask({
        taskNumber: "RUN-2026-0007",
        taskType: "SOURCING",
        skuId: sku.id,
        qty: 1,
        supplierId: supplier.id,
        maxUnitPricePaisa: 105000,
        quotedUnitPricePaisa: 110000,
        runnerId: runnerA.id,
        status: "PRICE_EXCEEDED_PENDING",
        dueAt: new Date(Date.now() + 7200000),
      });

      const res = await sourcingService.decideOverride(
        task.id,
        { decision: "APPROVED" },
        sourcingManager
      );

      expect(res.decision).toBe("APPROVED");
      expect(res.task.status).toBe("STALL_CONTACTED");
      expect(res.task.overrideDecision).toBe("APPROVED");
      expect(res.task.overrideDecidedBy).toBe(sourcingManager.id);
      expect(res.task.maxUnitPricePaisa).toBe(110000); // Updated to approved quoted price
    });

    it("REROUTE marks current task REROUTED and creates a new task for the backup stall", async () => {
      const { sku } = await createTestSku(100000, 200000);
      const primarySupplier = await createTestSupplier("Nawabpur Primary", "Shop 1");
      const backupSupplier = await createTestSupplier("Sundarban Backup", "Shop 99");

      const task = await sourcingRepo.createRunnerTask({
        taskNumber: "RUN-2026-0008",
        taskType: "SOURCING",
        skuId: sku.id,
        qty: 1,
        supplierId: primarySupplier.id,
        backupSupplierId: backupSupplier.id,
        maxUnitPricePaisa: 105000,
        quotedUnitPricePaisa: 115000,
        runnerId: runnerA.id,
        status: "PRICE_EXCEEDED_PENDING",
        dueAt: new Date(Date.now() + 7200000),
      });

      const res = await sourcingService.decideOverride(
        task.id,
        { decision: "REROUTE" },
        sourcingManager
      );

      expect(res.decision).toBe("REROUTED");
      expect(res.task.status).toBe("REROUTED");

      // Verify new task created for backup supplier
      expect(res.newTask).toBeDefined();
      expect(res.newTask?.supplierId).toBe(backupSupplier.id);
      expect(res.newTask?.runnerId).toBe(runnerA.id);
      expect(res.newTask?.status).toBe("DISPATCHED");
    });
  });

  // --------------------------------------------------------------------------
  // 6. Stockout Handling & Partial Stockout (EC-05)
  // --------------------------------------------------------------------------
  describe("6. Stockout Handling & Partial Stockout (EC-05)", () => {
    it("emits order.line_unfulfillable when no supplier is available during task creation", async () => {
      const { sku } = await createTestSku(100000, 150000);
      // No supplier stock registered for this SKU!

      const order = await createTestOrder([
        { skuId: sku.id, qty: 1, unitPricePaisa: 150000, unitCostPaisa: 100000 },
      ]);

      const res = await sourcingService.createTasksForOrder(order.id, sourcingManager);
      expect(res.unfulfillableItemsCount).toBe(1);

      const outbox = getMemoryOutbox();
      const unfulfillable = outbox.find((e) => e.type === "order.line_unfulfillable");
      expect(unfulfillable).toBeDefined();
      expect(unfulfillable?.payload).toMatchObject({
        orderId: order.id,
        options: ["REFUND", "ALTERNATE", "BACKORDER"],
      });
    });

    it("handles customer REFUND choice with partial stockout: cancels line, requests refund, and continues order without re-charging delivery fee (EC-05)", async () => {
      const { sku: sku1 } = await createTestSku(100000, 150000);
      const { sku: sku2 } = await createTestSku(200000, 300000);

      // Order with 2 lines
      const order = await createTestOrder([
        { skuId: sku1.id, qty: 1, unitPricePaisa: 150000, unitCostPaisa: 100000 },
        { skuId: sku2.id, qty: 1, unitPricePaisa: 300000, unitCostPaisa: 200000 },
      ]);

      const lineToCancel = order.items[0]!;

      // Customer chooses REFUND on line 1
      const res = await sourcingService.handleStockoutChoice(
        order.orderNumber,
        lineToCancel.id,
        { choice: "REFUND" },
        customerA
      );

      expect(res.choice).toBe("REFUND");
      expect(res.status).toBe("REFUND_REQUESTED");
      expect(res.refund_amount_paisa).toBe(150000); // ৳1,500 refund for line 1

      // Verify refund outbox event
      const outbox = getMemoryOutbox();
      const refundEvt = outbox.find((e) => e.type === "refund.requested");
      expect(refundEvt).toBeDefined();
      expect(refundEvt?.payload).toMatchObject({
        orderId: order.id,
        amountPaisa: 150000,
        reason: "STOCKOUT_LINE_REFUND",
      });

      // Verify EC-05: partial stockout continued event emitted, order not cancelled
      const continuedEvt = outbox.find((e) => e.type === "order.partial_stockout_continued");
      expect(continuedEvt).toBeDefined();

      const orderAfter = await ordersRepo.getOrderById(undefined, order.id);
      expect(orderAfter?.status).toBe("CONFIRMED"); // Remains confirmed for line 2
    });

    it("handles customer ALTERNATE choice: creates new sourcing task for alternate SKU", async () => {
      const { sku: altSku } = await createTestSku(120000, 160000);
      const altSupplier = await createTestSupplier("Alternate Stall", "Shop 77");

      await sourcingService.updateSupplierStock(
        altSupplier.id,
        [
          {
            skuId: altSku.id,
            status: "AVAILABLE",
            priority: 1,
          },
        ],
        sourcingManager
      );

      const { sku: originalSku } = await createTestSku(100000, 150000);
      const order = await createTestOrder([
        { skuId: originalSku.id, qty: 1, unitPricePaisa: 150000, unitCostPaisa: 100000 },
      ]);

      const lineId = order.items[0]!.id;

      const res = await sourcingService.handleStockoutChoice(
        order.orderNumber,
        lineId,
        { choice: "ALTERNATE", alternate_sku_id: altSku.id },
        customerA
      );

      expect(res.choice).toBe("ALTERNATE");
      expect(res.status).toBe("SOURCING_ALTERNATE");

      // Verify new task created for alternate SKU
      const { items: tasks } = await sourcingRepo.listRunnerTasks({ skuId: altSku.id });
      expect(tasks.length).toBe(1);
      expect(tasks[0]?.skuId).toBe(altSku.id);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Order State Transition on Godown Receipt
  // --------------------------------------------------------------------------
  describe("7. Order State Transition on Godown Receipt", () => {
    it("transitions order from SOURCING to AT_GODOWN_QC when all sourcing lines are received at godown", async () => {
      const { sku } = await createTestSku(100000, 150000);
      const supplier = await createTestSupplier("Nawabpur Stall", "Shop 1");

      const order = await createTestOrder([
        { skuId: sku.id, qty: 1, unitPricePaisa: 150000, unitCostPaisa: 100000 },
      ]);

      // Move order to SOURCING
      await ordersService.transitionOrder(
        undefined as any,
        order.id,
        "SOURCING",
        sourcingManager,
        "Moving order to sourcing"
      );

      const task = await sourcingRepo.createRunnerTask({
        taskNumber: "RUN-2026-0009",
        taskType: "SOURCING",
        orderId: order.id,
        skuId: sku.id,
        qty: 1,
        supplierId: supplier.id,
        maxUnitPricePaisa: 105000,
        runnerId: runnerA.id,
        status: "PURCHASED",
        dueAt: new Date(Date.now() + 7200000),
      });

      // Runner brings items to godown (marked RECEIVED_AT_GODOWN)
      await sourcingService.markTaskReceivedAtGodown(task.id, runnerA);

      // Verify order auto-transitioned to AT_GODOWN_QC!
      const orderAfter = await ordersRepo.getOrderById(undefined, order.id);
      expect(orderAfter?.status).toBe("AT_GODOWN_QC");
    });
  });
});
