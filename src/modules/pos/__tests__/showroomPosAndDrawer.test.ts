import { describe, it, expect, beforeEach } from "vitest";
import { Actor } from "@/lib/http/route";
import { clearMemoryOutboxForTesting, getMemoryOutbox } from "@/lib/outbox";
import { clearMockQueuesForTesting } from "@/lib/queues";
import { clearMemoryAuditChainForTesting, getRecentMemoryAuditEntries } from "@/modules/audit";
import { ordersService } from "@/modules/orders";
import { ordersRepo } from "@/modules/orders/repo";
import { catalogService } from "@/modules/catalog";
import { trustService } from "@/modules/trust";
import { trustRepo } from "@/modules/trust/repo";
import { inventoryRepo } from "@/modules/inventory/repo";
import { ledgerService } from "@/modules/ledger";
import { customerService, authService } from "@/modules/identity";
import { posRepo } from "../repo";
import { posService, hashPickupPin } from "../service";

// --------------------------------------------------------------------------
// Test Actors
// --------------------------------------------------------------------------
const posStaffActor: Actor = {
  id: "01920000-0000-7000-8000-0000000000p1",
  type: "staff",
  roles: ["SHOWROOM_POS_STAFF"],
  permissions: ["pos.operate", "drawer.count", "pii.read.counter"],
};

const secondPosStaffActor: Actor = {
  id: "01920000-0000-7000-8000-0000000000p2",
  type: "staff",
  roles: ["SHOWROOM_POS_STAFF"],
  permissions: ["pos.operate", "drawer.count", "pii.read.counter"],
};

const financeOfficerActor: Actor = {
  id: "01920000-0000-7000-8000-0000000000f1",
  type: "staff",
  roles: ["FINANCE_OFFICER"],
  permissions: ["drawer.reconcile", "ledger.read"],
};

const customerSupportActor: Actor = {
  id: "01920000-0000-7000-8000-0000000000s1",
  type: "staff",
  roles: ["CUSTOMER_SUPPORT"],
  permissions: ["customer.cod_override", "pii.read.full"],
};

const qcTechnicianActor: Actor = {
  id: "01920000-0000-7000-8000-0000000000q1",
  type: "staff",
  roles: ["QC_TECHNICIAN"],
  permissions: ["qc.execute", "seal.print"],
};

describe("P30 — Showroom Pickup PIN, Walk-In Sales & Cash Drawer", () => {
  beforeEach(async () => {
    posRepo.clearMemoryForTesting();
    ordersService.clearMemoryForTesting();
    catalogService.clearMemoryCatalogForTesting();
    trustService.clearMemoryForTesting();
    ledgerService.clearMemoryForTesting();
    customerService.clearMemoryCustomerDataForTesting();
    authService.clearMemoryAuthForTesting();
    inventoryRepo.clearMemoryForTesting();
    clearMemoryOutboxForTesting();
    clearMockQueuesForTesting();
    clearMemoryAuditChainForTesting();

    await ledgerService.seedChartOfAccounts();
    await inventoryRepo.seedLocations();
  });

  // --------------------------------------------------------------------------
  // Helper: Setup SKU and seal in Showroom Counter Stock
  // --------------------------------------------------------------------------
  async function setupShowroomSkuAndSeal(options?: {
    skuId?: string;
    skuCode?: string;
    pricePaisa?: number;
    costPaisa?: number;
    stockQty?: number;
    warrantyDays?: number;
  }) {
    const skuId = options?.skuId ?? "01920000-0000-7000-8000-000000000001";
    const skuCode = options?.skuCode ?? "SKU-PRO-65W";
    const pricePaisa = options?.pricePaisa ?? 250_000; // 2,500 BDT
    const costPaisa = options?.costPaisa ?? 150_000; // 1,500 BDT
    const stockQty = options?.stockQty ?? 5;
    const warrantyDays = options?.warrantyDays ?? 365;

    // 1. Catalog SKU
    catalogService.setSkuForTesting({
      id: skuId,
      skuCode,
      pricePaisa,
      baseCostPaisa: costPaisa,
      warrantyDays,
    });

    // 2. Physical Inventory in SHOWROOM_COUNTER
    const showroomLoc = await inventoryRepo.getLocationByCode("SHOWROOM_COUNTER");
    if (showroomLoc) {
      await inventoryRepo.upsertBalance({
        skuId,
        locationId: showroomLoc.id,
        onHand: stockQty,
        reserved: 0,
      });
    }

    // 3. Mint ACTIVE Seal
    const qc = await trustRepo.createQcRecord({
      skuId,
      qcType: "THREE_POINT",
      testChecklist: { power_voltage_ok: true, port_function_ok: true, physical_integrity_ok: true },
      result: "PASS",
      technicianId: qcTechnicianActor.id,
    });
    const seal = await trustService.mintSeal({ qc_record_id: qc.id }, qcTechnicianActor);

    // Set seal to ACTIVE
    const sealRecord = await trustRepo.getSealRecordBySealId(seal.seal_id);
    if (sealRecord) {
      await trustRepo.updateSealRecord(sealRecord.id, {
        status: "ACTIVE",
      });
    }

    return { skuId, skuCode, pricePaisa, costPaisa, seal, showroomLoc };
  }

  // ==========================================================================
  // Test 1: Cash Drawer Sessions & Expected Cash Math
  // ==========================================================================
  describe("1. Cash Drawer Sessions & Expected Cash Math", () => {
    it("opens drawer, computes expected cash, records counted variance, and reconciles via Finance", async () => {
      // 1. Open drawer session with ৳100 float (10,000 paisa)
      const session = await posService.openDrawer(
        posStaffActor.id,
        { opening_float_paisa: 10_000, notes: "Morning shift opening" },
        posStaffActor
      );

      expect(session.status).toBe("OPEN");
      expect(session.openingFloatPaisa).toBe(10_000);
      expect(session.expectedCashPaisa).toBe(10_000);
      expect(session.cashSalesPaisa).toBe(0);

      // 2. Attempting to open a second drawer while first is open throws 409
      await expect(
        posService.openDrawer(
          posStaffActor.id,
          { opening_float_paisa: 5_000 },
          posStaffActor
        )
      ).rejects.toThrow(/already has an active open cash drawer session/i);

      // 3. Close drawer with shortage of ৳5 (500 paisa): counted 9,500 vs expected 10,000
      const closedSession = await posService.closeDrawer(
        posStaffActor.id,
        { counted_cash_paisa: 9_500, notes: "Counted at shift change" },
        posStaffActor
      );

      expect(closedSession.status).toBe("VARIANCE_REVIEW");
      expect(closedSession.countedCashPaisa).toBe(9_500);
      expect(closedSession.variancePaisa).toBe(-500); // 9500 - 10000 = -500 shortage

      // 4. Finance Officer reconciles session with cash shortage ledger posting
      const reconciled = await posService.reconcileDrawer(
        closedSession.id,
        { notes: "Variance verified by FO" },
        financeOfficerActor
      );

      expect(reconciled.status).toBe("CLOSED");
      expect(reconciled.reconciledBy).toBe(financeOfficerActor.id);

      // Verify ledger posting: CASH_SHORTAGE (Dr 5310 Cash Variance / Cr 1010 Showroom Drawer)
      const { entries } = await ledgerService.listJournalEntries({
        sourceId: closedSession.id,
      });
      expect(entries).toHaveLength(1);
      expect(entries[0]!.eventType).toBe("CASH_SHORTAGE");

      const dr5310 = entries[0]!.lines.find((l) => l.accountCode === "5310");
      const cr1010 = entries[0]!.lines.find((l) => l.accountCode === "1010");
      expect(dr5310?.debitPaisa).toBe(500);
      expect(cr1010?.creditPaisa).toBe(500);

      // Verify re-reconciliation throws 409
      await expect(
        posService.reconcileDrawer(closedSession.id, {}, financeOfficerActor)
      ).rejects.toThrow(/already been reconciled and closed/i);
    });

    it("reconciles cash overage correctly (Dr 1010 / Cr 5310)", async () => {
      // Open drawer with ৳50 float
      await posService.openDrawer(
        secondPosStaffActor.id,
        { opening_float_paisa: 5_000 },
        secondPosStaffActor
      );

      // Close drawer with ৳10 overage: counted 6,000 vs expected 5,000
      const closed = await posService.closeDrawer(
        secondPosStaffActor.id,
        { counted_cash_paisa: 6_000 },
        secondPosStaffActor
      );

      expect(closed.variancePaisa).toBe(1_000); // +1000 overage

      // Finance reconciles overage
      await posService.reconcileDrawer(closed.id, {}, financeOfficerActor);

      const { entries } = await ledgerService.listJournalEntries({
        sourceId: closed.id,
      });
      expect(entries).toHaveLength(1);
      expect(entries[0]!.eventType).toBe("CASH_OVERAGE");

      const dr1010 = entries[0]!.lines.find((l) => l.accountCode === "1010");
      const cr5310 = entries[0]!.lines.find((l) => l.accountCode === "5310");
      expect(dr1010?.debitPaisa).toBe(1_000);
      expect(cr5310?.creditPaisa).toBe(1_000);
    });
  });

  // ==========================================================================
  // Test 2: Cash Requirement for POS Operations
  // ==========================================================================
  describe("2. Cash Requirement for POS Operations", () => {
    it("rejects walk-in sale or cash handover when staff has no open cash drawer", async () => {
      const { skuId, seal } = await setupShowroomSkuAndSeal();

      // No open drawer for posStaffActor
      await expect(
        posService.executeWalkInSale(
          {
            customer_phone: "+8801711223344",
            items: [{ sku_id: skuId, seal_id: seal.seal_id, quantity: 1 }],
            payment_mode: "CASH",
            paid_amount_paisa: 250_000,
          },
          posStaffActor
        )
      ).rejects.toThrow(/Cash payment requires an active open cash drawer session/i);
    });
  });

  // ==========================================================================
  // Test 3: Pickup PIN Verification & Lockout after 5 Failed Attempts
  // ==========================================================================
  describe("3. Pickup PIN Verification & Lockout after 5 Attempts", () => {
    it("locks PIN after 5 consecutive incorrect attempts and unlocks upon Support reset", async () => {
      const { skuId, seal } = await setupShowroomSkuAndSeal();

      // Create an order ready for counter pickup
      const order = await ordersRepo.createOrder(undefined, {
        order: {
          orderNumber: "ORD-PCK-001",
          customerId: "01920000-0000-7000-8000-0000000000c1",
          orderType: "REGULAR_DROP_PACK",
          channel: "STOREFRONT_WEB",
          fulfillmentChannel: "PICKUP",
          status: "READY_FOR_PICKUP",
          paymentStatus: "PAID",
          subtotalPaisa: 250_000,
          couponDiscountPaisa: 0,
          deliveryFeePaisa: 0,
          taxPaisa: 32_609,
          totalPaisa: 250_000,
          codAmountPaisa: 0,
          paidAmountPaisa: 250_000,
          deliveryZone: "INSIDE_DHAKA",
          addressSnapshot: {
            name: "Rahim Ahmed",
            phone: "+8801712345678",
            address: "Showroom Counter Locker #4",
            thana: "Kotwali",
            district: "Dhaka",
            division: "Dhaka",
          },
        },
        items: [
          {
            skuId,
            productTitle: "UGREEN 65W GaN Charger",
            skuCode: "SKU-PRO-65W",
            qty: 1,
            unitPricePaisa: 250_000,
            unitCostPaisa: 150_000,
            taxPaisa: 32_609,
            units: [{ sealId: seal.seal_id, status: "SEALED" }],
          },
        ],
      });

      // Generate pickup PIN
      const { pin } = await posService.generatePickupPin(order.id);
      expect(pin).toMatch(/^\d{6}$/);

      // Check Outbox SMS notification emitted
      const outbox = getMemoryOutbox();
      expect(outbox.some((o) => o.type === "notification.sms" && o.payload.pin === pin)).toBe(true);

      // Attempt 1: Wrong PIN
      await expect(
        posService.verifyPickupPin(
          { order_number: order.orderNumber, pickup_pin: "000000" },
          posStaffActor
        )
      ).rejects.toThrow(/Incorrect PIN. 4 attempts remaining/i);

      // Attempts 2, 3, 4: Wrong PINs
      await expect(
        posService.verifyPickupPin({ order_number: order.orderNumber, pickup_pin: "000000" }, posStaffActor)
      ).rejects.toThrow(/3 attempts remaining/i);
      await expect(
        posService.verifyPickupPin({ order_number: order.orderNumber, pickup_pin: "000000" }, posStaffActor)
      ).rejects.toThrow(/2 attempts remaining/i);
      await expect(
        posService.verifyPickupPin({ order_number: order.orderNumber, pickup_pin: "000000" }, posStaffActor)
      ).rejects.toThrow(/1 attempt remaining/i);

      // Attempt 5: 5th wrong attempt locks the PIN
      await expect(
        posService.verifyPickupPin({ order_number: order.orderNumber, pickup_pin: "000000" }, posStaffActor)
      ).rejects.toThrow(/PIN locked due to 5 consecutive failed attempts/i);

      // Subsequent attempt with even the CORRECT PIN is rejected while locked
      await expect(
        posService.verifyPickupPin({ order_number: order.orderNumber, pickup_pin: pin }, posStaffActor)
      ).rejects.toThrow(/PIN locked due to 5 consecutive failed attempts/i);

      // Customer Support resets the PIN
      const resetRes = await posService.resetPickupPin(
        order.id,
        { reason: "Customer called support after lockout" },
        customerSupportActor
      );
      expect(resetRes.success).toBe(true);

      // Fetch new PIN from outbox
      const latestOutbox = getMemoryOutbox();
      const newSms = latestOutbox.filter(
        (o) => o.type === "notification.sms" && o.aggregateId === order.id
      ).pop();
      const newPin = newSms?.payload?.pin;
      expect(newPin).toBeDefined();

      // Verification with the newly generated PIN succeeds!
      const verifySuccess = await posService.verifyPickupPin(
        { order_number: order.orderNumber, pickup_pin: newPin },
        posStaffActor
      );

      expect(verifySuccess.valid).toBe(true);
      expect(verifySuccess.order.customer_name).toBe("Rahim Ahmed");
      expect(verifySuccess.order.phone_masked).toBe("017****5678"); // Masked PII
      expect(verifySuccess.order.amount_due_at_counter_paisa).toBe(0);
      expect(verifySuccess.order.items[0]!.seal_id).toBe(seal.seal_id);
    });
  });

  // ==========================================================================
  // Test 4: Pickup PIN Expiration
  // ==========================================================================
  describe("4. Pickup PIN Expiration", () => {
    it("rejects verification when pickup PIN has passed 7-day expiration", async () => {
      const { skuId, seal } = await setupShowroomSkuAndSeal();

      const order = await ordersRepo.createOrder(undefined, {
        order: {
          orderNumber: "ORD-EXP-001",
          customerId: "01920000-0000-7000-8000-0000000000c1",
          orderType: "REGULAR_DROP_PACK",
          channel: "STOREFRONT_WEB",
          fulfillmentChannel: "PICKUP",
          status: "READY_FOR_PICKUP",
          paymentStatus: "PAID",
          subtotalPaisa: 250_000,
          couponDiscountPaisa: 0,
          deliveryFeePaisa: 0,
          taxPaisa: 32_609,
          totalPaisa: 250_000,
          codAmountPaisa: 0,
          paidAmountPaisa: 250_000,
          deliveryZone: "INSIDE_DHAKA",
          pickupPinHash: hashPickupPin("temp-id", "123456"),
          // Expired 1 hour ago
          pickupPinExpiresAt: new Date(Date.now() - 3600 * 1000),
          pickupPinAttempts: 0,
          pickupPinLocked: false,
        },
        items: [
          {
            skuId,
            productTitle: "Fast Charger",
            skuCode: "SKU-PRO-65W",
            qty: 1,
            unitPricePaisa: 250_000,
            unitCostPaisa: 150_000,
            taxPaisa: 32_609,
            units: [{ sealId: seal.seal_id, status: "SEALED" }],
          },
        ],
      });

      // Update PIN hash with actual order ID
      const pin = "123456";
      await ordersRepo.updateOrder(undefined, order.id, {
        pickupPinHash: hashPickupPin(order.id, pin),
      });

      await expect(
        posService.verifyPickupPin(
          { order_number: order.orderNumber, pickup_pin: pin },
          posStaffActor
        )
      ).rejects.toThrow(/Pickup PIN has expired/i);
    });
  });

  // ==========================================================================
  // Test 5: Pickup Handover Requires Full Payment If Due & Recognizes Revenue
  // ==========================================================================
  describe("5. Complete Pickup Handover", () => {
    it("enforces full balance payment, adds cash to drawer, advances to DELIVERED_COUNTER, activates warranty & returns receipt", async () => {
      const { skuId, seal } = await setupShowroomSkuAndSeal();

      // Open cash drawer for staff
      await posService.openDrawer(
        posStaffActor.id,
        { opening_float_paisa: 10_000 },
        posStaffActor
      );

      // Order with advance fee paid (100 BDT) and 2,400 BDT balance due at counter
      const order = await ordersRepo.createOrder(undefined, {
        order: {
          orderNumber: "ORD-HAND-001",
          customerId: "01920000-0000-7000-8000-0000000000c1",
          orderType: "REGULAR_DROP_PACK",
          channel: "STOREFRONT_WEB",
          fulfillmentChannel: "PICKUP",
          status: "READY_FOR_PICKUP",
          paymentStatus: "PARTIALLY_PAID",
          subtotalPaisa: 250_000, // 2,500 BDT
          couponDiscountPaisa: 0,
          deliveryFeePaisa: 0,
          taxPaisa: 32_609,
          totalPaisa: 250_000,
          codAmountPaisa: 240_000, // 2,400 BDT balance due
          advanceFeePaisa: 10_000, // 100 BDT paid online
          advanceFeePaid: true,
          paidAmountPaisa: 10_000,
          deliveryZone: "INSIDE_DHAKA",
          addressSnapshot: {
            name: "Karim Ullah",
            phone: "+8801719876543",
            address: "Pickup Locker #1",
            thana: "Kotwali",
            district: "Dhaka",
            division: "Dhaka",
          },
        },
        items: [
          {
            skuId,
            productTitle: "UGREEN 65W GaN Charger",
            skuCode: "SKU-PRO-65W",
            qty: 1,
            unitPricePaisa: 250_000,
            unitCostPaisa: 150_000,
            taxPaisa: 32_609,
            units: [{ sealId: seal.seal_id, status: "SEALED" }],
          },
        ],
      });

      // 1. Attempting handover without payment when balance is due fails
      await expect(
        posService.handoverPickup(
          {
            order_id: order.id,
            customer_inspected_on_bench: true,
            signed_handover_slip: true,
          },
          posStaffActor
        )
      ).rejects.toThrow(/Payment required at counter/i);

      // 2. Handover with exact cash balance payment (240,000 paisa)
      const handoverResult = await posService.handoverPickup(
        {
          order_id: order.id,
          customer_inspected_on_bench: true,
          signed_handover_slip: true,
          payment: {
            method: "CASH",
            amount_paisa: 240_000,
            reference: "CASH-CTR-01",
          },
        },
        posStaffActor
      );

      expect(handoverResult.success).toBe(true);
      expect(handoverResult.status).toBe("DELIVERED_COUNTER");

      // Verify order status
      const updatedOrder = await ordersRepo.getOrderById(undefined, order.id);
      expect(updatedOrder?.status).toBe("DELIVERED_COUNTER");
      expect(updatedOrder?.paymentStatus).toBe("PAID");
      expect(updatedOrder?.paidAmountPaisa).toBe(250_000);

      // Verify cash accumulated in drawer (10,000 float + 240,000 sale = 250,000 expected)
      const drawer = await posRepo.findOpenDrawerByStaffId(posStaffActor.id);
      expect(drawer?.cashSalesPaisa).toBe(240_000);
      expect(drawer?.expectedCashPaisa).toBe(250_000);

      // Verify double-entry ledger revenue recognition (Dr 1010 240k, Dr 2000 10k / Cr 4000 net, Cr 2100 vat)
      const { entries } = await ledgerService.listJournalEntries({
        sourceId: order.id,
      });
      const revEntry = entries.find((e) => e.eventType === "REVENUE_RECOGNIZED_DELIVERY");
      expect(revEntry).toBeDefined();

      const dr1010 = revEntry!.lines.find((l) => l.accountCode === "1010");
      const dr2000 = revEntry!.lines.find((l) => l.accountCode === "2000");
      const cr4000 = revEntry!.lines.find((l) => l.accountCode === "4000");
      const cr2100 = revEntry!.lines.find((l) => l.accountCode === "2100");

      expect(dr1010?.debitPaisa).toBe(240_000);
      expect(dr2000?.debitPaisa).toBe(10_000);
      expect(cr4000?.creditPaisa).toBe(217_391); // 250,000 - 32,609
      expect(cr2100?.creditPaisa).toBe(32_609);

      // Verify COGS recognition (Dr 5000 / Cr 1200 for 150,000 paisa)
      const cogsEntry = entries.find((e) => e.eventType === "COGS_RECOGNIZED");
      expect(cogsEntry).toBeDefined();
      expect(cogsEntry!.lines.find((l) => l.accountCode === "5000")?.debitPaisa).toBe(150_000);

      // Verify seal warranty started
      const updatedSeal = await trustRepo.getSealRecordBySealId(seal.seal_id);
      expect(updatedSeal?.status).toBe("ACTIVE");
      expect(updatedSeal?.warrantyStart).toBeDefined();

      // Verify receipt payload
      expect(handoverResult.receipt).toBeDefined();
      expect(handoverResult.receipt.order.order_number).toBe(order.orderNumber);
      expect(handoverResult.receipt.items[0]!.seal_id).toBe(seal.seal_id);
      expect(handoverResult.receipt.escpos_text).toContain("NAWABPUR COMPLEX ACCESSORIES");
      expect(handoverResult.receipt.escpos_text).toContain(seal.seal_id);
    });
  });

  // ==========================================================================
  // Test 6: Walk-In POS Sale
  // ==========================================================================
  describe("6. Walk-In POS Sale", () => {
    it("validates seal & showroom stock, creates order, decrements stock, records ledger & returns 201 receipt", async () => {
      const { skuId, seal, showroomLoc } = await setupShowroomSkuAndSeal({
        stockQty: 3,
        pricePaisa: 300_000,
        costPaisa: 200_000,
      });

      // Open drawer session
      await posService.openDrawer(
        posStaffActor.id,
        { opening_float_paisa: 20_000 },
        posStaffActor
      );

      // Execute Walk-In Sale
      const saleResult = await posService.executeWalkInSale(
        {
          customer_phone: "+8801811223344",
          customer_name: "Walk-In Buyer",
          items: [{ sku_id: skuId, seal_id: seal.seal_id, quantity: 1 }],
          payment_mode: "CASH",
          paid_amount_paisa: 300_000,
        },
        posStaffActor
      );

      expect(saleResult.success).toBe(true);
      expect(saleResult.order.status).toBe("DELIVERED_COUNTER");
      expect(saleResult.order.total_paisa).toBe(300_000);

      // Verify physical showroom stock decremented: 3 - 1 = 2
      const updatedBalance = await inventoryRepo.getBalance(skuId, showroomLoc!.id);
      expect(updatedBalance?.onHand).toBe(2);

      // Verify seal linked and warranty activated
      const updatedSeal = await trustRepo.getSealRecordBySealId(seal.seal_id);
      expect(updatedSeal?.orderItemUnitId).toBeDefined();
      expect(updatedSeal?.warrantyStart).toBeDefined();

      // Verify double-entry ledger POS_WALKIN_SALE (Dr 1010, Cr 4000, Cr 2100, Dr 5000, Cr 1200)
      const { entries } = await ledgerService.listJournalEntries({
        sourceId: saleResult.order.id,
      });
      const posEntry = entries.find((e) => e.eventType === "POS_WALKIN_SALE");
      expect(posEntry).toBeDefined();

      const drCash = posEntry!.lines.find((l) => l.accountCode === "1010");
      const drCogs = posEntry!.lines.find((l) => l.accountCode === "5000");
      const crInventory = posEntry!.lines.find((l) => l.accountCode === "1200");
      expect(drCash?.debitPaisa).toBe(300_000);
      expect(drCogs?.debitPaisa).toBe(200_000);
      expect(crInventory?.creditPaisa).toBe(200_000);

      // Verify thermal receipt formatted
      expect(saleResult.receipt.items[0]!.seal_id).toBe(seal.seal_id);
      expect(saleResult.receipt.escpos_text).toContain("Walk-In Buyer");
      expect(saleResult.receipt.escpos_text).toMatch(/NET TOTAL PAYABLE:\s+৳3000\.00/);

      // Verify attempting to sell the same seal again is rejected (already linked)
      await expect(
        posService.executeWalkInSale(
          {
            customer_phone: "+8801811223344",
            items: [{ sku_id: skuId, seal_id: seal.seal_id, quantity: 1 }],
            payment_mode: "CASH",
            paid_amount_paisa: 300_000,
          },
          posStaffActor
        )
      ).rejects.toThrow(/already linked to another order/i);
    });

    it("rejects walk-in sale when seal is not in sellable ACTIVE status", async () => {
      const { skuId, seal } = await setupShowroomSkuAndSeal();

      // Void the seal
      const sealRecord = await trustRepo.getSealRecordBySealId(seal.seal_id);
      if (sealRecord) {
        await trustRepo.updateSealRecord(sealRecord.id, {
          status: "VOID_PRINT_ERROR",
        });
      }

      await posService.openDrawer(posStaffActor.id, { opening_float_paisa: 10_000 }, posStaffActor);

      await expect(
        posService.executeWalkInSale(
          {
            customer_phone: "+8801811223344",
            items: [{ sku_id: skuId, seal_id: seal.seal_id, quantity: 1 }],
            payment_mode: "CASH",
            paid_amount_paisa: 250_000,
          },
          posStaffActor
        )
      ).rejects.toThrow(/cannot be sold/i);
    });
  });

  // ==========================================================================
  // Test 7: Unclaimed Pickups Scheduled Job (Day 3, 6 Reminders & Day 8 Expiry)
  // ==========================================================================
  describe("7. Unclaimed Pickups Scheduled Job", () => {
    it("sends Day 3 & 6 reminders, and expires unpaid Day 8 pickups with inventory restock", async () => {
      const { skuId, seal, showroomLoc } = await setupShowroomSkuAndSeal({ stockQty: 0 });

      // 1. Order placed 3.5 days ago (Day 3 reminder due)
      const day3Order = await ordersRepo.createOrder(undefined, {
        order: {
          orderNumber: "ORD-DAY-3",
          customerId: "01920000-0000-7000-8000-0000000000c1",
          orderType: "REGULAR_DROP_PACK",
          channel: "STOREFRONT_WEB",
          fulfillmentChannel: "PICKUP",
          status: "READY_FOR_PICKUP",
          paymentStatus: "UNPAID",
          subtotalPaisa: 100_000,
          deliveryFeePaisa: 0,
          taxPaisa: 13_043,
          totalPaisa: 100_000,
          placedAt: new Date(Date.now() - 3.5 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 3.5 * 24 * 60 * 60 * 1000),
          addressSnapshot: { phone: "+8801700000003", name: "Day 3 Customer" },
        },
        items: [],
      });

      // 2. Order placed 6.5 days ago (Day 6 urgent reminder due)
      const day6Order = await ordersRepo.createOrder(undefined, {
        order: {
          orderNumber: "ORD-DAY-6",
          customerId: "01920000-0000-7000-8000-0000000000c1",
          orderType: "REGULAR_DROP_PACK",
          channel: "STOREFRONT_WEB",
          fulfillmentChannel: "PICKUP",
          status: "READY_FOR_PICKUP",
          paymentStatus: "UNPAID",
          subtotalPaisa: 100_000,
          deliveryFeePaisa: 0,
          taxPaisa: 13_043,
          totalPaisa: 100_000,
          placedAt: new Date(Date.now() - 6.5 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 6.5 * 24 * 60 * 60 * 1000),
          addressSnapshot: { phone: "+8801700000006", name: "Day 6 Customer" },
        },
        items: [],
      });

      // 3. Unpaid order placed 8 days ago (Day 8 expiry due) with 10 BDT advance fee paid
      const day8Order = await ordersRepo.createOrder(undefined, {
        order: {
          orderNumber: "ORD-DAY-8",
          customerId: "01920000-0000-7000-8000-0000000000c1",
          orderType: "REGULAR_DROP_PACK",
          channel: "STOREFRONT_WEB",
          fulfillmentChannel: "PICKUP",
          status: "READY_FOR_PICKUP",
          paymentStatus: "PARTIALLY_PAID",
          subtotalPaisa: 100_000,
          deliveryFeePaisa: 0,
          taxPaisa: 13_043,
          totalPaisa: 100_000,
          advanceFeePaisa: 1_000,
          advanceFeePaid: true,
          paidAmountPaisa: 1_000,
          placedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
          addressSnapshot: { phone: "+8801700000008", name: "Day 8 Customer" },
        },
        items: [
          {
            skuId,
            productTitle: "Unclaimed Item",
            skuCode: "SKU-PRO-65W",
            qty: 1,
            unitPricePaisa: 100_000,
            unitCostPaisa: 60_000,
            taxPaisa: 13_043,
            units: [{ sealId: seal.seal_id, status: "SEALED" }],
          },
        ],
      });

      // 4. Prepaid order placed 15 days ago (Day 14 support escalation due)
      const day14Order = await ordersRepo.createOrder(undefined, {
        order: {
          orderNumber: "ORD-DAY-14",
          customerId: "01920000-0000-7000-8000-0000000000c1",
          orderType: "REGULAR_DROP_PACK",
          channel: "STOREFRONT_WEB",
          fulfillmentChannel: "PICKUP",
          status: "READY_FOR_PICKUP",
          paymentStatus: "PAID",
          subtotalPaisa: 100_000,
          deliveryFeePaisa: 0,
          taxPaisa: 13_043,
          totalPaisa: 100_000,
          paidAmountPaisa: 100_000,
          placedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          addressSnapshot: { phone: "+8801700000014", name: "Day 14 Prepaid Customer" },
        },
        items: [],
      });

      // Run Job
      const jobResult = await posService.runUnclaimedPickupsJob();

      expect(jobResult.remindersDay3).toBe(1);
      expect(jobResult.remindersDay6).toBe(1);
      expect(jobResult.expiredDay8).toBe(1);
      expect(jobResult.prepaidDay14Tasks).toBe(1);

      // Verify Day 8 order status transitioned to PICKUP_EXPIRED
      const updatedDay8 = await ordersRepo.getOrderById(undefined, day8Order.id);
      expect(updatedDay8?.status).toBe("PICKUP_EXPIRED");

      // Verify showroom inventory restocked: from 0 to 1
      const restockedBal = await inventoryRepo.getBalance(skuId, showroomLoc!.id);
      expect(restockedBal?.onHand).toBe(1);

      // Verify refund requested for advance fee
      const outbox = getMemoryOutbox();
      const refundOutbox = outbox.find(
        (o) => o.type === "refund.requested" && o.aggregateId === day8Order.id
      );
      expect(refundOutbox).toBeDefined();
      expect(refundOutbox?.payload.amountPaisa).toBe(1_000);

      // Verify Day 14 prepaid support task outbox
      const supportOutbox = outbox.find(
        (o) => o.type === "support.unclaimed_prepaid_pickup" && o.aggregateId === day14Order.id
      );
      expect(supportOutbox).toBeDefined();
    });
  });

  // ==========================================================================
  // Test 8: Showroom Stock View
  // ==========================================================================
  describe("8. Showroom Stock View", () => {
    it("lists sellable showroom items with seal IDs and catalog specs", async () => {
      const { skuCode, seal } = await setupShowroomSkuAndSeal({
        skuCode: "SKU-VIEW-01",
        pricePaisa: 180_000,
      });

      const stockView = await posService.getShowroomStock("SKU-VIEW");
      expect(stockView.items).toHaveLength(1);
      expect(stockView.items[0]!.sku_code).toBe("SKU-VIEW-01");
      expect(stockView.items[0]!.seal_id).toBe(seal.seal_id);
      expect(stockView.items[0]!.price_paisa).toBe(180_000);
      expect(stockView.items[0]!.status).toBe("ACTIVE");
    });
  });
});
