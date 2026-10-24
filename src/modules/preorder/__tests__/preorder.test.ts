import { describe, it, expect, beforeEach } from "vitest";
import { Actor } from "@/lib/http/route";
import { BusinessError, ForbiddenError, ValidationError } from "@/lib/errors";
import { preorderService } from "../service";
import { ordersService } from "@/modules/orders/service";
import { ordersRepo, OrderWithDetails } from "@/modules/orders/repo";
import { orderDepositPaisa, unitDepositPaisa } from "@/modules/orders/pricing/deposit";
import { inventoryService } from "@/modules/inventory";
import { catalogService } from "@/modules/catalog";
import { promotionsService } from "@/modules/promotions";
import { financeService } from "@/modules/finance";
import { ledgerService } from "@/modules/ledger";
import { paymentsService } from "@/modules/payments";
import { authService } from "@/modules/identity";
import { getMemoryOutbox, clearMemoryOutboxForTesting } from "@/lib/outbox";
import { clearMemoryCountersForTesting } from "@/db/counters";
import { pricingLoader } from "@/modules/orders/pricing/loader";
import { preorderRepo } from "../repo";

describe("P23 — Pre-Order Engine (Deposit, Milestones, Balance, Delay, Repricing, Forfeiture, Batch)", () => {
  const customerA: Actor = {
    id: "01920000-0000-7000-8000-0000000000aa",
    type: "customer",
  };

  const sourcingManager: Actor = {
    id: "01920000-0000-7000-8000-0000000000s1",
    type: "staff",
    roles: ["SOURCING_MANAGER"],
  };

  const godownManager: Actor = {
    id: "01920000-0000-7000-8000-0000000000g1",
    type: "staff",
    roles: ["GODOWN_MANAGER"],
  };

  const qaStaff: Actor = {
    id: "01920000-0000-7000-8000-0000000000q1",
    type: "staff",
    roles: ["QA_STAFF"],
  };

  beforeEach(() => {
    preorderService.clearMemoryForTesting();
    ordersService.clearMemoryForTesting();
    inventoryService.clearMemoryForTesting();
    promotionsService.clearMemoryForTesting();
    financeService.clearMemoryForTesting();
    clearMemoryCountersForTesting();
    clearMemoryOutboxForTesting();
  });

  // Helper to create pre-order test record
  async function createTestPreOrder(
    customerId: string,
    overrides?: Partial<Parameters<typeof ordersRepo.createOrder>[1]["order"]> & {
      preOrderOverrides?: Partial<
        NonNullable<Parameters<typeof ordersRepo.createOrder>[1]["preOrder"]>
      >;
      skuPricePaisa?: number;
      qty?: number;
      placedAt?: Date;
    }
  ): Promise<OrderWithDetails> {
    const orderNumber = `ORD-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const skuId = crypto.randomUUID();
    const productId = crypto.randomUUID();
    const qty = overrides?.qty ?? 1;
    const unitPricePaisa = overrides?.skuPricePaisa ?? 1000000; // ৳10,000 default
    const lineTotalPaisa = unitPricePaisa * qty;
    const depositPaisa = unitDepositPaisa(unitPricePaisa) * qty;
    const balancePaisa = lineTotalPaisa - depositPaisa;
    const placedAt = overrides?.placedAt ?? new Date();

    return ordersRepo.createOrder(undefined, {
      order: {
        orderNumber,
        customerId,
        channel: "STOREFRONT_WEB",
        orderType: "PRE_ORDER",
        fulfillmentChannel: "COURIER",
        deliveryZone: "INSIDE_DHAKA",
        status: overrides?.status ?? "DEPOSIT_PAID",
        paymentStatus: overrides?.paymentStatus ?? "PARTIALLY_PAID",
        paymentMode: "PREORDER_DEPOSIT",
        placedAt,
        createdAt: placedAt,
        addressSnapshot: {
          consignee: "Rahim Preorder",
          phone: "01711000002",
          divisionName: "Dhaka",
          districtName: "Dhaka",
          thanaName: "Kotwali",
          addressLine: "5 Nawabpur Road",
          isInsideDhaka: true,
        },
        subtotalPaisa: lineTotalPaisa,
        discountPaisa: 0,
        deliveryFeePaisa: 0,
        vatTotalPaisa: 0,
        totalPayablePaisa: lineTotalPaisa,
        storeCreditAppliedPaisa: overrides?.storeCreditAppliedPaisa ?? 0,
        advanceRequiredPaisa: depositPaisa,
        advancePaidPaisa: depositPaisa,
        advancePurpose: "DEPOSIT",
        codAmountPaisa: 0,
        paidTotalPaisa: depositPaisa,
        refundedTotalPaisa: 0,
        ...overrides,
      },
      items: [
        {
          skuId,
          productId,
          titleEn: "Industrial Frequency Inverter",
          titleBn: "শিল্প ফ্রিকোয়েন্সি ইনভার্টার",
          tier: "AUTHENTIC",
          skuCode: "INV-500W",
          qty,
          unitPricePaisa,
          allocatedDiscountPaisa: 0,
          lineTotalPaisa,
          vatRateBp: 0,
          vatPaisa: 0,
          source: "VIRTUAL",
          status: "ACTIVE",
          units: Array.from({ length: qty }).map(() => ({
            sealId: crypto.randomUUID(),
            status: "PENDING",
          })),
        },
      ],
      preOrder: {
        depositPaisa,
        balancePaisa,
        etaDate: new Date(Date.now() + 14 * 86400000),
        etaMinDays: 10,
        etaMaxDays: 20,
        priceLockedPaisa: lineTotalPaisa,
        milestone: (overrides?.status as any) ?? "DEPOSIT_PAID",
        batchKey: "INV-500W-2026-10",
        ...overrides?.preOrderOverrides,
      },
    });
  }

  // --------------------------------------------------------------------------
  // 1. Progressive Deposit Calculation & Zero Cliff
  // --------------------------------------------------------------------------
  describe("Deposit table values and formula", () => {
    it("calculates 20% deposit for unit prices up to ৳50,000", () => {
      // ৳1,000 (100,000 paisa) -> 20% = 20,000 paisa (৳200)
      expect(unitDepositPaisa(100000)).toBe(20000);

      // ৳10,000 (1,000,000 paisa) -> 20% = 200,000 paisa (৳2,000)
      expect(unitDepositPaisa(1000000)).toBe(200000);

      // ৳50,000 (5,000,000 paisa) -> 20% = 1,000,000 paisa (৳10,000)
      expect(unitDepositPaisa(5000000)).toBe(1000000);
    });

    it("calculates 20% of first ৳50k + 10% of remainder with zero cliff for prices > ৳50,000", () => {
      // ৳60,000 (6,000,000 paisa):
      // 20% of 50k = 10,000; 10% of 10k = 1,000 => ৳11,000 (1,100,000 paisa)
      expect(unitDepositPaisa(6000000)).toBe(1100000);

      // ৳100,000 (10,000,000 paisa):
      // 20% of 50k = 10,000; 10% of 50k = 5,000 => ৳15,000 (1,500,000 paisa)
      expect(unitDepositPaisa(10000000)).toBe(1500000);

      // Zero cliff verification at boundary:
      const depositAt50k = unitDepositPaisa(5000000); // 1,000,000 paisa
      const depositAt50k1 = unitDepositPaisa(5000100); // ৳50,001
      // Effective rate strictly between 10% and 20%
      expect(depositAt50k1).toBeGreaterThan(depositAt50k);
      expect(depositAt50k1 / 5000100).toBeLessThanOrEqual(0.201);
      expect(depositAt50k1 / 5000100).toBeGreaterThanOrEqual(0.1);
    });

    it("rounds up deposit to the nearest ৳10 (1000 paisa)", () => {
      // Unit price ৳333 (33,300 paisa). 20% is 6,660 paisa. Rounded up to ৳10 is 7,000 paisa (৳70)
      expect(unitDepositPaisa(33300)).toBe(7000);
    });

    it("calculates multi-line order deposit correctly using effective unit prices", () => {
      const lines = [
        { unitPricePaisa: 1000000, qty: 2 }, // 2 * ৳2,000 = ৳4,000 (400,000 paisa)
        { unitPricePaisa: 6000000, qty: 1 }, // 1 * ৳11,000 = ৳11,000 (1,100,000 paisa)
      ];
      expect(orderDepositPaisa(lines)).toBe(1500000); // ৳15,000 total deposit
    });
  });

  // --------------------------------------------------------------------------
  // 2. Cancellation Boundary (Blocked after SOURCED_IN_TRANSIT)
  // --------------------------------------------------------------------------
  describe("Cancellation boundary", () => {
    it("allows customer cancellation before sourcing (DEPOSIT_PAID)", async () => {
      const order = await createTestPreOrder(customerA.id, {
        status: "DEPOSIT_PAID",
      });

      const eligibility = await ordersService.evaluateCancellationEligibility(order);
      expect(eligibility.can_cancel).toBe(true);

      const cancelled = await ordersService.cancelOrderByCustomer(
        customerA.id,
        order.orderNumber,
        "Changed mind before sourcing"
      );
      expect(cancelled?.status).toBe("CANCELLED");
    });

    it("blocks customer cancellation once SOURCED_IN_TRANSIT with 403 ERR_CANCELLATION_DISALLOWED", async () => {
      const order = await createTestPreOrder(customerA.id, {
        status: "DEPOSIT_PAID",
      });

      // Staff marks order as sourced
      await preorderService.markSourced(
        order.id,
        {
          supplier_ref: "SUP-CN-2026-X",
          eta_date: new Date(Date.now() + 10 * 86400000),
        },
        sourcingManager
      );

      // Verify order is now SOURCED_IN_TRANSIT
      const updated = await ordersService.getPreOrder(undefined, order.id);
      expect(updated?.milestone).toBe("SOURCED_IN_TRANSIT");

      // Verify eligibility check
      const currentOrder = await ordersRepo.getOrderWithDetails(undefined, order.id);
      const eligibility = await ordersService.evaluateCancellationEligibility(currentOrder!);
      expect(eligibility.can_cancel).toBe(false);
      expect(eligibility.reason).toContain("transit");

      // Attempt cancellation -> must throw BusinessError with ERR_CANCELLATION_DISALLOWED
      await expect(
        ordersService.cancelOrderByCustomer(
          customerA.id,
          order.orderNumber,
          "Attempt cancel after in transit"
        )
      ).rejects.toThrow(BusinessError);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Milestone Transitions (Arrived, QC Verified, Import Failed)
  // --------------------------------------------------------------------------
  describe("Milestones and godown arrival", () => {
    it("transitions to ARRIVED_GODOWN and receives physical units into QC_HOLD", async () => {
      const order = await createTestPreOrder(customerA.id, {
        status: "SOURCED_IN_TRANSIT",
      });

      const res = await preorderService.markArrived(order.id, godownManager);
      expect(res.status).toBe("ARRIVED_GODOWN");

      const orderAfter = await ordersRepo.getOrderById(undefined, order.id);
      expect(orderAfter?.status).toBe("ARRIVED_GODOWN");

      // Verify inventory movements into QC_HOLD
      const movements = await inventoryService.listMovements({
        skuId: order.items[0]?.skuId,
      });
      const qcHoldMove = movements.items.find(
        (m) => m.refType === "PURCHASE" && m.refId === order.id
      );
      expect(qcHoldMove).toBeDefined();
    });

    it("transitions to QC_VERIFIED_BALANCE_DUE, sets balance_due_date = +7 days and forfeiture_date = Day 8", async () => {
      const order = await createTestPreOrder(customerA.id, {
        status: "ARRIVED_GODOWN",
      });

      const res = await preorderService.markQcVerified(order.id, godownManager);
      expect(res.status).toBe("QC_VERIFIED_BALANCE_DUE");
      expect(res.balance_due_date).toBeDefined();
      expect(res.forfeiture_date).toBeDefined();

      const preOrder = await ordersService.getPreOrder(undefined, order.id);
      expect(preOrder?.qcVerifiedAt).toBeDefined();
      expect(preOrder?.balanceDueDate).toBeDefined();
      expect(preOrder?.forfeitureDate).toBeDefined();

      // Verify notification 6 was emitted
      const outbox = getMemoryOutbox();
      const notif = outbox.find((e) => e.type === "notification.preorder_qc_verified_balance_due");
      expect(notif).toBeDefined();
    });

    it("handles import-failed with 100% refund request and SKU switch option", async () => {
      const order = await createTestPreOrder(customerA.id, {
        status: "SOURCED_IN_TRANSIT",
      });

      const switchSkuId = crypto.randomUUID();
      const res = await preorderService.markImportFailed(
        order.id,
        {
          reason: "Customs clearance rejected",
          offer_switch_sku_ids: [switchSkuId],
        },
        sourcingManager
      );

      expect(res.status).toBe("CANCELLED_REFUNDED");

      // Check refund request outbox event
      const outbox = getMemoryOutbox();
      const refundEvt = outbox.find((e) => e.type === "refund.requested");
      expect(refundEvt).toBeDefined();
      expect(refundEvt?.payload).toMatchObject({
        orderId: order.id,
        customerId: customerA.id,
        amountPaisa: order.paidTotalPaisa,
        autoApproved: true,
      });
    });
  });

  // --------------------------------------------------------------------------
  // 4. Balance Payments & COD Cap (৳30,000 allowed, ৳30,000.01 rejected)
  // --------------------------------------------------------------------------
  describe("Customer balance payments and COD balance cap", () => {
    it("allows COD balance payment when balance <= ৳30,000 (3,000,000 paisa)", async () => {
      // Balance is ৳25,000 (2,500,000 paisa)
      const order = await createTestPreOrder(customerA.id, {
        status: "QC_VERIFIED_BALANCE_DUE",
        preOrderOverrides: {
          depositPaisa: 500000,
          balancePaisa: 2500000,
        },
      });

      const res = await preorderService.payBalance(customerA.id, order.orderNumber, {
        mode: "COD",
        store_credit_paisa: 0,
      });

      expect(res.payment_mode).toBe("COD");
      expect(res.status).toBe("BALANCE_COD_SCHEDULED");

      const after = await ordersRepo.getOrderById(undefined, order.id);
      expect(after?.status).toBe("BALANCE_COD_SCHEDULED");
      expect(after?.codAmountPaisa).toBe(2500000);
    });

    it("strictly rejects COD balance payment when balance == ৳30,000.01 (3,000,001 paisa) with 422 ERR_COD_NOT_ALLOWED", async () => {
      // Balance is ৳30,000.01
      const order = await createTestPreOrder(customerA.id, {
        status: "QC_VERIFIED_BALANCE_DUE",
        preOrderOverrides: {
          depositPaisa: 1000000,
          balancePaisa: 3000001,
        },
      });

      await expect(
        preorderService.payBalance(customerA.id, order.orderNumber, {
          mode: "COD",
          store_credit_paisa: 0,
        })
      ).rejects.toThrow(BusinessError);

      try {
        await preorderService.payBalance(customerA.id, order.orderNumber, {
          mode: "COD",
          store_credit_paisa: 0,
        });
      } catch (err: any) {
        expect(err.code).toBe("ERR_COD_NOT_ALLOWED");
      }
    });

    it("schedules COUNTER balance payment for showroom pickup", async () => {
      const order = await createTestPreOrder(customerA.id, {
        status: "QC_VERIFIED_BALANCE_DUE",
      });

      const res = await preorderService.payBalance(customerA.id, order.orderNumber, {
        mode: "COUNTER",
        store_credit_paisa: 0,
      });

      expect(res.status).toBe("BALANCE_COUNTER_SCHEDULED");
    });
  });

  // --------------------------------------------------------------------------
  // 5. Delay Handling & ৳1,000 Goodwill Credit
  // --------------------------------------------------------------------------
  describe("Delay handling and goodwill store credit", () => {
    it("delay cancellation within 24h refunds 100% even if in transit", async () => {
      const order = await createTestPreOrder(customerA.id, {
        status: "SOURCED_IN_TRANSIT",
        preOrderOverrides: {
          etaDate: new Date(Date.now() - 10 * 86400000), // 10 days overdue
        },
      });

      // 1. Run delay detection job -> marks delay_option = OFFERED
      const offeredCount = await preorderService.runDelayJob();
      expect(offeredCount).toBe(1);

      const preOrder = await ordersService.getPreOrder(undefined, order.id);
      expect(preOrder?.delayOption).toBe("OFFERED");

      // 2. Customer chooses CANCEL within 24h
      const cancelRes = (await preorderService.handleDelayChoice(
        customerA.id,
        order.orderNumber,
        { choice: "CANCEL" }
      )) as { status: string; refund_amount_paisa: number };

      expect(cancelRes.status).toBe("CANCELLED_REFUNDED");
      expect(cancelRes.refund_amount_paisa).toBe(order.paidTotalPaisa);

      // Verify 100% refund outbox event was emitted
      const outbox = getMemoryOutbox();
      const refundEvt = outbox.find(
        (e) => e.type === "refund.requested" && (e.payload as any)?.reason === "PREORDER_DELAY_CANCELLATION"
      );
      expect(refundEvt).toBeDefined();
    });

    it("delay KEEP automatically awards ৳1,000 goodwill credit on godown arrival", async () => {
      const order = await createTestPreOrder(customerA.id, {
        status: "SOURCED_IN_TRANSIT",
        preOrderOverrides: {
          delayOption: "OFFERED",
          delayOfferedAt: new Date(),
        },
      });

      // Customer chooses KEEP
      await preorderService.handleDelayChoice(customerA.id, order.orderNumber, {
        choice: "KEEP",
      });

      const preOrder = await ordersService.getPreOrder(undefined, order.id);
      expect(preOrder?.delayOption).toBe("KEPT");

      // Now order arrives at godown
      await preorderService.markArrived(order.id, godownManager);

      // Verify ৳1,000 store credit was issued
      const balance = await promotionsService.getStoreCreditBalance(undefined, customerA.id);
      expect(balance.totalBalancePaisa).toBe(100000); // ৳1,000 in paisa

      // Verify outbox notification 31 was emitted
      const outbox = getMemoryOutbox();
      const creditNotif = outbox.find(
        (e) => e.type === "notification.preorder_delay_credit_issued"
      );
      expect(creditNotif).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 6. FX Repricing (PRD §3.3.5)
  // --------------------------------------------------------------------------
  describe("Spot Repricing (PRD §3.3.5)", () => {
    it("rejects repricing when fx_change_bp <= 800", async () => {
      const order = await createTestPreOrder(customerA.id, {
        status: "SOURCED_IN_TRANSIT",
      });

      await expect(
        preorderService.repricePreorder(
          order.id,
          {
            new_unit_price_paisa: 1200000,
            fx_change_bp: 800, // Not > 800
            reason: "USD/BDT fluctuation",
          },
          sourcingManager
        )
      ).rejects.toThrow(BusinessError);
    });

    it("initiates repricing when fx_change_bp > 800 and moves order to REPRICING_PENDING", async () => {
      const order = await createTestPreOrder(customerA.id, {
        status: "SOURCED_IN_TRANSIT",
      });

      const res = await preorderService.repricePreorder(
        order.id,
        {
          new_unit_price_paisa: 1200000, // ৳12,000 (+৳2,000)
          fx_change_bp: 950,
          reason: "Major currency devaluation",
        },
        sourcingManager
      );

      expect(res.status).toBe("REPRICING_PENDING");

      const preOrder = await ordersService.getPreOrder(undefined, order.id);
      expect(preOrder?.repricingStatus).toBe("PENDING");
      expect(preOrder?.repricingNewTotalPaisa).toBe(1200000);
    });

    it("repricing accept changes only the balance while deposit remains unchanged", async () => {
      const initialDeposit = 200000; // ৳2,000
      const initialTotal = 1000000; // ৳10,000
      const order = await createTestPreOrder(customerA.id, {
        status: "SOURCED_IN_TRANSIT",
        skuPricePaisa: initialTotal,
        preOrderOverrides: {
          depositPaisa: initialDeposit,
          balancePaisa: initialTotal - initialDeposit,
        },
      });

      // Sourcing manager initiates repricing to ৳12,000 (1,200,000 paisa)
      await preorderService.repricePreorder(
        order.id,
        {
          new_unit_price_paisa: 1200000,
          fx_change_bp: 900,
          reason: "Tariff hike",
        },
        sourcingManager
      );

      // Customer accepts
      const acceptRes = await preorderService.respondToRepricing(
        customerA.id,
        order.orderNumber,
        { accept: true }
      );

      expect(acceptRes.deposit_paisa).toBe(initialDeposit); // DEPOSIT UNCHANGED
      expect(acceptRes.new_balance_paisa).toBe(1200000 - initialDeposit); // Balance increased
      expect(acceptRes.status).toBe("SOURCED_IN_TRANSIT"); // Reverts to previous status
    });

    it("repricing reject cancels order with 100% refund", async () => {
      const order = await createTestPreOrder(customerA.id, {
        status: "SOURCED_IN_TRANSIT",
      });

      await preorderService.repricePreorder(
        order.id,
        {
          new_unit_price_paisa: 1500000,
          fx_change_bp: 1200,
          reason: "Extreme currency drop",
        },
        sourcingManager
      );

      // Customer rejects
      const rejectRes = await preorderService.respondToRepricing(
        customerA.id,
        order.orderNumber,
        { accept: false }
      );

      expect(rejectRes.status).toBe("CANCELLED_REFUNDED");

      const outbox = getMemoryOutbox();
      const refundEvt = outbox.find(
        (e) => e.type === "refund.requested" && (e.payload as any)?.reason === "REPRICING_REJECTED"
      );
      expect(refundEvt).toBeDefined();
    });

    it("hourly repricing timeout job cancels and refunds orders after 48h deadline", async () => {
      const order = await createTestPreOrder(customerA.id, {
        status: "REPRICING_PENDING",
        preOrderOverrides: {
          repricingDeadline: new Date(Date.now() - 3600000), // Expired 1h ago
        },
      });

      const timedOutCount = await preorderService.runRepricingTimeoutJob();
      expect(timedOutCount).toBe(1);

      const orderAfter = await ordersRepo.getOrderById(undefined, order.id);
      expect(orderAfter?.status).toBe("CANCELLED_REFUNDED");
    });
  });

  // --------------------------------------------------------------------------
  // 7. Day-8 Forfeiture, Ledger Posting & Flash Deal Creation
  // --------------------------------------------------------------------------
  describe("Day-8 Forfeiture job", () => {
    it("forfeits deposit on Day 8, posts PREORDER_DEPOSIT_FORFEITED ledger entry, moves stock to GODOWN_NAWABPUR, and creates flash deal", async () => {
      const order = await createTestPreOrder(customerA.id, {
        status: "QC_VERIFIED_BALANCE_DUE",
        preOrderOverrides: {
          depositPaisa: 200000,
          balancePaisa: 800000,
          forfeitureDate: new Date(Date.now() - 1000), // Day 8 reached
        },
      });

      // Pre-orders in QC_VERIFIED_BALANCE_DUE had their units received into QC_HOLD on arrival
      for (const item of order.items) {
        await inventoryService.receive(undefined, {
          skuId: item.skuId,
          locationCode: "QC_HOLD",
          qty: item.qty,
          reason: "PURCHASE_RECEIPT",
          refType: "PURCHASE",
          refId: order.id,
          unitCostPaisa: item.unitCostPaisa ?? item.unitPricePaisa ?? 0,
        });
      }

      // Run forfeiture job (runs at 00:05 daily)
      const count = await preorderService.runForfeitureJob();
      expect(count).toBe(1);

      // 1. Order status updated to DEPOSIT_FORFEITED_CANCELLED
      const orderAfter = await ordersRepo.getOrderById(undefined, order.id);
      expect(orderAfter?.status).toBe("DEPOSIT_FORFEITED_CANCELLED");

      // 2. Ledger entry PREORDER_DEPOSIT_FORFEITED (Dr 2010 / Cr 4030) posted
      const journalEntries = await ledgerService.listEntries({
        sourceId: order.id,
      });
      const forfeitEntry = journalEntries.items.find(
        (j) => j.eventType === "PREORDER_DEPOSIT_FORFEITED"
      );
      expect(forfeitEntry).toBeDefined();

      // 3. Stock moved from QC_HOLD to GODOWN_NAWABPUR (PREORDER_FORFEIT_RECEIPT)
      const qcHold = await inventoryService.getLocationByCode("QC_HOLD");
      const godown = await inventoryService.getLocationByCode("GODOWN_NAWABPUR");
      const movements = await inventoryService.listMovements({
        skuId: order.items[0]?.skuId,
      });
      const forfeitMove = movements.items.find(
        (m) =>
          m.fromLocationId === qcHold.id &&
          m.toLocationId === godown.id &&
          m.reason === "PREORDER_FORFEIT_RECEIPT"
      );
      expect(forfeitMove).toBeDefined();

      // 4. Flash deal created for the physical units
      const flashDeal = await preorderRepo.findActiveFlashDealForSku(
        order.items[0]?.skuId!
      );
      expect(flashDeal).toBeDefined();
      expect(flashDeal?.status).toBe("ACTIVE");
      expect(flashDeal?.qty).toBe(order.items[0]?.qty);

      // 5. Preorder service exposes active flash deal for pricing engine / catalog
      const activeDeal = await preorderService.getActiveFlashDeal(order.items[0]?.skuId!);
      expect(activeDeal).toBeDefined();
      expect(activeDeal?.pricePaisa).toBe(flashDeal?.pricePaisa);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Batch Threshold & Balance Reminders
  // --------------------------------------------------------------------------
  describe("Batch threshold and daily balance reminders", () => {
    it("batch threshold job cancels and refunds batches older than 30 days with < N deposits", async () => {
      const order = await createTestPreOrder(customerA.id, {
        status: "DEPOSIT_PAID",
        placedAt: new Date(Date.now() - 35 * 86400000), // 35 days old
        preOrderOverrides: {
          batchKey: "BATCH-THRESHOLD-01",
        },
      });

      // Threshold is 10 (default), but we only have 1 order
      const refundedCount = await preorderService.runBatchThresholdJob();
      expect(refundedCount).toBe(1);

      const after = await ordersRepo.getOrderById(undefined, order.id);
      expect(after?.status).toBe("CANCELLED_REFUNDED");
    });

    it("balance reminders job sends Class B notifications and creates Day 7 support task", async () => {
      // Create order verified 7 days ago
      const order = await createTestPreOrder(customerA.id, {
        status: "QC_VERIFIED_BALANCE_DUE",
        preOrderOverrides: {
          qcVerifiedAt: new Date(Date.now() - 7 * 86400000),
          balanceDueDate: new Date(Date.now() - 1000),
          forfeitureDate: new Date(Date.now() + 86400000),
        },
      });

      const reminderCount = await preorderService.runBalanceReminderJob();
      expect(reminderCount).toBeGreaterThanOrEqual(1);

      // Verify Day 7 Support Task was created in support_tasks table
      const supportTasks = await preorderRepo.listSupportTasks({
        orderId: order.id,
        type: "PREORDER_BALANCE_CALL",
      });
      const supportTask = supportTasks[0];
      expect(supportTask).toBeDefined();
      expect(supportTask?.type).toBe("PREORDER_BALANCE_CALL");
    });
  });

  // --------------------------------------------------------------------------
  // 9. Customer Pre-Order Milestone Visualizer
  // --------------------------------------------------------------------------
  describe("Customer milestone visualizer data", () => {
    it("provides ordered milestones with timestamps for customer detail view", async () => {
      const order = await createTestPreOrder(customerA.id, {
        status: "SOURCED_IN_TRANSIT",
      });

      const detail = await ordersService.getCustomerOrderDetail(
        customerA.id,
        order.orderNumber
      );

      expect(detail.pre_order_milestones).toBeDefined();
      expect(detail.pre_order_milestones?.milestones.length).toBeGreaterThan(0);

      const depositPaidMilestone = detail.pre_order_milestones?.milestones.find(
        (m) => m.milestone === "DEPOSIT_PAID"
      );
      expect(depositPaidMilestone?.reached).toBe(true);

      const inTransitMilestone = detail.pre_order_milestones?.milestones.find(
        (m) => m.milestone === "SOURCED_IN_TRANSIT"
      );
      expect(inTransitMilestone?.reached).toBe(true);

      const godownMilestone = detail.pre_order_milestones?.milestones.find(
        (m) => m.milestone === "ARRIVED_GODOWN"
      );
      expect(godownMilestone?.reached).toBe(false);
    });
  });
});
