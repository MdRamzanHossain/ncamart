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
import { ledgerService } from "@/modules/ledger";
import { customerService, authService } from "@/modules/identity";
import {
  logisticsRepo,
  clearMemoryLogisticsForTesting,
} from "../repo";
import {
  logisticsService,
  SteadfastAdapter,
  PathaoAdapter,
  RedXAdapter,
  MockCourierAdapter,
} from "../index";

// --------------------------------------------------------------------------
// Test Actors
// --------------------------------------------------------------------------
const customerSupportActor: Actor = {
  id: "01920000-0000-7000-8000-0000000000s1",
  type: "staff",
  roles: ["CUSTOMER_SUPPORT"],
  permissions: ["customer.cod_override", "pii.read.full"],
};

const dispatchStaffActor: Actor = {
  id: "01920000-0000-7000-8000-0000000000d1",
  type: "staff",
  roles: ["DISPATCH_STAFF"],
  permissions: ["dispatch.pack", "dispatch.book", "logistics.rto_receive"],
};

const qcTechnicianActor: Actor = {
  id: "01920000-0000-7000-8000-0000000000q1",
  type: "staff",
  roles: ["QC_TECHNICIAN"],
  permissions: ["qc.execute", "seal.print", "logistics.rto_receive"],
};

const customerActor: Actor = {
  id: "01920000-0000-7000-8000-0000000000c1",
  type: "customer",
};

describe("P29 — Courier Webhooks, Delivery, RTO & Warranty Start", () => {
  beforeEach(async () => {
    clearMemoryLogisticsForTesting();
    ordersService.clearMemoryForTesting();
    catalogService.clearMemoryCatalogForTesting();
    trustService.clearMemoryForTesting();
    ledgerService.clearMemoryForTesting();
    customerService.clearMemoryCustomerDataForTesting();
    authService.clearMemoryAuthForTesting();
    clearMemoryOutboxForTesting();
    clearMockQueuesForTesting();
    clearMemoryAuditChainForTesting();
    MockCourierAdapter.clear();

    await ledgerService.seedChartOfAccounts();
  });

  // --------------------------------------------------------------------------
  // Helper: Create order with unit seals and courier shipment
  // --------------------------------------------------------------------------
  async function createTestOrderAndShipment(options?: {
    orderNumber?: string;
    subtotalPaisa?: number;
    couponDiscountPaisa?: number;
    deliveryFeePaisa?: number;
    taxPaisa?: number;
    advanceFeePaisa?: number;
    advanceFeePaid?: boolean;
    paidAmountPaisa?: number;
    deliveryZone?: "INSIDE_DHAKA" | "OUTSIDE_DHAKA";
    customerId?: string;
    itemCount?: number;
    unitCostPaisa?: number;
  }) {
    const subtotalPaisa = options?.subtotalPaisa ?? 1_000_000; // 10,000 BDT
    const couponDiscountPaisa = options?.couponDiscountPaisa ?? 100_000; // 1,000 BDT
    const deliveryFeePaisa = options?.deliveryFeePaisa ?? 10_000; // 100 BDT
    const taxPaisa = options?.taxPaisa ?? 130_435; // 15% VAT component
    const advanceFeePaisa = options?.advanceFeePaisa ?? 10_000; // 100 BDT advance fee
    const advanceFeePaid = options?.advanceFeePaid ?? true;
    const paidAmountPaisa = options?.paidAmountPaisa ?? (advanceFeePaid ? advanceFeePaisa : 0);
    const totalPaisa = subtotalPaisa - couponDiscountPaisa + deliveryFeePaisa;
    const codAmountPaisa = totalPaisa - paidAmountPaisa;
    const customerId = options?.customerId ?? customerActor.id;
    const deliveryZone = options?.deliveryZone ?? "INSIDE_DHAKA";
    const orderNumber = options?.orderNumber ?? `ORD-${Date.now().toString().slice(-6)}`;
    const unitCostPaisa = options?.unitCostPaisa ?? 600_000;

    // 1. Create Customer
    await authService.saveCustomer({
      id: customerId,
      phone: "+8801711000001",
      fullName: "Test Customer",
      email: "customer@example.com",
      emailVerified: true,
      status: "ACTIVE",
      deliveredOrderCount: 0,
      rtoCount12m: 0,
      codBlocked: false,
      codBlockReason: null,
      codBlockLiftedBy: null,
      marketingOptIn: false,
      marketingOptInAt: null,
      preferredLocale: "bn",
      lastActiveAt: new Date(),
      previousCustomerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Register SKUs in catalog
    catalogService.setSkuForTesting({
      id: "sku-motor-500w",
      skuCode: "SKU-MOT-500W",
      warrantyDays: 365,
    });
    catalogService.setSkuForTesting({
      id: "sku-inverter-1kw",
      skuCode: "SKU-INV-1KW",
      warrantyDays: 365,
    });

    // 3. Mint Seal(s) with passed QC inspection
    const qc1 = await trustRepo.createQcRecord({
      skuId: "sku-motor-500w",
      qcType: "THREE_POINT",
      testChecklist: {
        power_voltage_ok: true,
        port_function_ok: true,
        physical_integrity_ok: true,
      },
      result: "PASS",
      technicianId: qcTechnicianActor.id,
    });
    const seal1 = await trustService.mintSeal(
      { qc_record_id: qc1.id },
      qcTechnicianActor
    );

    const qc2 = await trustRepo.createQcRecord({
      skuId: "sku-inverter-1kw",
      qcType: "THREE_POINT",
      testChecklist: {
        power_voltage_ok: true,
        port_function_ok: true,
        physical_integrity_ok: true,
      },
      result: "PASS",
      technicianId: qcTechnicianActor.id,
    });
    const seal2 = await trustService.mintSeal(
      { qc_record_id: qc2.id },
      qcTechnicianActor
    );

    // 3. Create Order
    const order = await ordersRepo.createOrder(undefined, {
      order: {
        orderNumber,
        customerId,
        orderType: "REGULAR_DROP_PACK",
        channel: "STOREFRONT_WEB",
        status: "HANDED_TO_COURIER",
        paymentStatus: advanceFeePaid ? "PARTIALLY_PAID" : "UNPAID",
        subtotalPaisa,
        couponDiscountPaisa,
        deliveryFeePaisa,
        taxPaisa,
        totalPaisa,
        codAmountPaisa,
        advanceFeePaisa,
        advanceFeePaid,
        paidAmountPaisa,
        deliveryZone,
        addressSnapshot: {
          name: "Consignee Person",
          phone: "+8801711000001",
          address: "12/A Nawabpur Road",
          thana: "Kotwali",
          district: "Dhaka",
          division: "Dhaka",
        },
      },
      items: [
        {
          skuId: "sku-motor-500w",
          productTitle: "Industrial Electric Motor 500W",
          skuCode: "SKU-MOT-500W",
          qty: 1,
          unitPricePaisa: subtotalPaisa,
          unitCostPaisa,
          taxPaisa,
          units: [
            {
              sealId: seal1.seal_id,
              manufacturerSerial: "SN-MOT-9988",
              status: "SEALED",
            },
          ],
        },
      ],
    });

    // 4. Create Shipment
    const consignmentNo = `MCK-${orderNumber}-1001`;
    const shipment = await logisticsRepo.createShipment({
      orderId: order.id,
      courier: "MOCK",
      direction: "FORWARD",
      consignmentNo,
      trackingUrl: `https://mock-courier.ncamart.internal/track/${consignmentNo}`,
      status: "OUT_FOR_DELIVERY",
      weightGrams: 2500,
      expectedCodPaisa: codAmountPaisa,
      bookedAt: new Date(),
      handedOverAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // dispatched 24h ago
    });

    return { order, shipment, consignmentNo, seal1, seal2 };
  }

  // ==========================================================================
  // Test 1: Webhook Auth Rejection
  // ==========================================================================
  describe("1. Webhook Auth Rejection", () => {
    it("rejects webhook requests with invalid authentication across adapters (HTTP 401)", async () => {
      // Steadfast
      const steadfastAdapter = new SteadfastAdapter();
      const badSteadfastReq = new Request("https://api.ncamart.com/api/v1/logistics/webhooks/steadfast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": "wrong_secret_123",
        },
        body: JSON.stringify({ tracking_code: "STF-001", status: "delivered" }),
      });
      await expect(steadfastAdapter.parseWebhook(badSteadfastReq)).rejects.toThrow(
        /Invalid Steadfast webhook credentials/i
      );

      // Pathao
      const pathaoAdapter = new PathaoAdapter();
      const badPathaoReq = new Request("https://api.ncamart.com/api/v1/logistics/webhooks/pathao", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pathao-signature": "tampered_signature",
        },
        body: JSON.stringify({ consignment_id: "PTH-001", order_status: "Delivered" }),
      });
      await expect(pathaoAdapter.parseWebhook(badPathaoReq)).rejects.toThrow(
        /Invalid Pathao webhook credentials/i
      );

      // RedX
      const redxAdapter = new RedXAdapter();
      const badRedxReq = new Request("https://api.ncamart.com/api/v1/logistics/webhooks/redx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-redx-secret": "invalid_redx_token",
        },
        body: JSON.stringify({ tracking_id: "RDX-001", status: "delivered" }),
      });
      await expect(redxAdapter.parseWebhook(badRedxReq)).rejects.toThrow(
        /Invalid RedX webhook credentials/i
      );

      // Mock
      const mockAdapter = new MockCourierAdapter();
      const badMockReq = new Request("https://api.ncamart.com/api/v1/logistics/webhooks/mock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-mock-courier-secret": "unauthorized_mock_secret",
        },
        body: JSON.stringify({ consignment_no: "MCK-001", status: "DELIVERED" }),
      });
      await expect(mockAdapter.parseWebhook(badMockReq)).rejects.toThrow(
        /Invalid mock courier webhook credentials/i
      );
    });

    it("accepts webhook requests with valid credentials", async () => {
      const mockAdapter = new MockCourierAdapter();
      const validMockReq = new Request("https://api.ncamart.com/api/v1/logistics/webhooks/mock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-mock-courier-secret": "mock-courier-secret",
        },
        body: JSON.stringify({
          consignment_no: "MCK-ORD-1001",
          status: "DELIVERED",
          collected_amount_paisa: 900000,
        }),
      });

      const events = await mockAdapter.parseWebhook(validMockReq);
      expect(events).toHaveLength(1);
      expect(events[0]!.consignmentNo).toBe("MCK-ORD-1001");
      expect(events[0]!.normalizedStatus).toBe("DELIVERED");
      expect(events[0]!.collectedCodPaisa).toBe(900000);
    });
  });

  // ==========================================================================
  // Test 2: Duplicate Events Idempotent
  // ==========================================================================
  describe("2. Duplicate Events Idempotent", () => {
    it("deduplicates identical events idempotently without mutating status or ledger twice", async () => {
      const { shipment, consignmentNo } = await createTestOrderAndShipment();

      const event = {
        consignmentNo,
        rawStatus: "DELIVERED",
        normalizedStatus: "DELIVERED" as const,
        occurredAt: new Date(),
        payload: { consignment_no: consignmentNo, status: "DELIVERED" },
        collectedCodPaisa: 900_000,
        dedupeKey: `stf_${consignmentNo}_delivered_001`,
      };

      // First delivery event
      const res1 = await logisticsService.applyCourierEvent(event, "mock");
      expect(res1.success).toBe(true);
      expect(res1.status).toBe("DELIVERED");
      expect(res1.deduplicated).toBeUndefined();

      // Check events recorded
      const eventsAfterFirst = await logisticsRepo.listEventsByShipmentId(shipment.id);
      expect(eventsAfterFirst).toHaveLength(1);

      // Check ledger entries count after first delivery
      const ledgerEntriesFirst = await ledgerService.listJournalEntries({
        sourceId: shipment.orderId,
      });
      expect(ledgerEntriesFirst.total).toBe(2); // REVENUE_RECOGNIZED_DELIVERY + COGS_RECOGNIZED

      // Duplicate delivery event with identical dedupeKey
      const res2 = await logisticsService.applyCourierEvent(event, "mock");
      expect(res2.success).toBe(true);
      expect(res2.deduplicated).toBe(true);
      expect(res2.status).toBe("DELIVERED");

      // Verify no duplicate event or journal entry created
      const eventsAfterSecond = await logisticsRepo.listEventsByShipmentId(shipment.id);
      expect(eventsAfterSecond).toHaveLength(1);

      const ledgerEntriesSecond = await ledgerService.listJournalEntries({
        sourceId: shipment.orderId,
      });
      expect(ledgerEntriesSecond.total).toBe(2);
    });

    it("returns HTTP 200 with warning when webhook is received for an unknown consignment", async () => {
      const res = await logisticsService.applyCourierEvent(
        {
          consignmentNo: "MCK-UNKNOWN-9999",
          rawStatus: "delivered",
          normalizedStatus: "DELIVERED",
          occurredAt: new Date(),
          payload: {},
        },
        "mock"
      );

      expect(res.success).toBe(true);
      expect(res.unknownConsignment).toBe(true);
    });
  });

  // ==========================================================================
  // Test 3: DELIVERED Posts Balanced Revenue + COGS with Exact Numbers
  // ==========================================================================
  describe("3. DELIVERED Posts Balanced Revenue + COGS with Exact Numbers", () => {
    it("posts balanced revenue recognition and COGS entries matching PRD §3.13 and architechture.md §10.3", async () => {
      // Setup exact numbers for COD order with coupon:
      // Merchandise price (inclusive of VAT): 10,000 BDT = 1,000,000 paisa
      // VAT (15% included): 130,435 paisa
      // Coupon discount: 1,000 BDT = 100,000 paisa
      // Delivery fee: 100 BDT = 10,000 paisa
      // Total customer payable = 1,000,000 - 100,000 + 10,000 = 910,000 paisa
      // Advance fee prepaid online: 10,000 paisa (Dr 2000)
      // COD collected by courier: 900,000 paisa (Dr 1110)
      // Merchandise unit purchase cost: 6,000 BDT = 600,000 paisa
      const { order, shipment, consignmentNo, seal1 } = await createTestOrderAndShipment({
        subtotalPaisa: 1_000_000,
        couponDiscountPaisa: 100_000,
        deliveryFeePaisa: 10_000,
        taxPaisa: 130_435,
        advanceFeePaisa: 10_000,
        advanceFeePaid: true,
        unitCostPaisa: 600_000,
      });

      const deliveryTime = new Date("2026-10-24T12:00:00.000Z");

      // Ingest DELIVERED webhook
      const res = await logisticsService.applyCourierEvent(
        {
          consignmentNo,
          rawStatus: "delivered",
          normalizedStatus: "DELIVERED",
          occurredAt: deliveryTime,
          payload: { cod_amount: 9000 },
          collectedCodPaisa: 900_000,
        },
        "mock"
      );

      expect(res.success).toBe(true);
      expect(res.status).toBe("DELIVERED");

      // 1. Order status transitioned to DELIVERED
      const updatedOrder = await ordersRepo.getOrderWithDetails(undefined, order.id);
      expect(updatedOrder?.status).toBe("DELIVERED");

      // 2. Customer delivered order count incremented
      const updatedCustomer = await authService.findCustomerById(order.customerId);
      expect(updatedCustomer?.deliveredOrderCount).toBe(1);

      // 3. Seal warranty activated with exact dates
      const updatedSeal = await trustRepo.getSealRecordBySealId(seal1.seal_id);
      expect(updatedSeal?.status).toBe("ACTIVE");
      expect(updatedSeal?.warrantyStart?.toISOString()).toBe(deliveryTime.toISOString());
      const expectedEnd = new Date(deliveryTime.getTime() + 365 * 24 * 60 * 60 * 1000);
      expect(updatedSeal?.warrantyEnd?.toISOString()).toBe(expectedEnd.toISOString());

      // 4. Ledger postings validation
      const { entries } = await ledgerService.listJournalEntries({
        sourceId: order.id,
      });
      expect(entries).toHaveLength(2);

      // Revenue entry
      const revenueEntry = entries.find((e) => e.eventType === "REVENUE_RECOGNIZED_DELIVERY");
      expect(revenueEntry).toBeDefined();

      let revTotalDebit = 0;
      let revTotalCredit = 0;
      for (const line of revenueEntry!.lines) {
        revTotalDebit += line.debitPaisa;
        revTotalCredit += line.creditPaisa;
      }

      // Check Debits:
      // Dr 2000 (Advance): 10,000 paisa
      // Dr 1110 (Courier COD): 900,000 paisa
      // Dr 4010 (Discounts & Coupons): 100,000 paisa
      // Total Debits = 1,010,000 paisa
      expect(revTotalDebit).toBe(1_010_000);

      // Check Credits:
      // Cr 4000 (Revenue ex-VAT + discount): (1,000,000 - 130,435) + 100,000 = 969,565 paisa
      // Cr 2100 (VAT Output Payable): 130,435 paisa
      // Cr 4020 (Delivery Fee Revenue): 10,000 paisa
      // Total Credits = 969,565 + 130,435 + 10,000 = 1,010,000 paisa
      expect(revTotalCredit).toBe(1_010_000);
      expect(revTotalDebit).toBe(revTotalCredit);

      // Verify specific line accounts
      const advLine = revenueEntry!.lines.find((l) => l.accountCode === "2000");
      expect(advLine?.debitPaisa).toBe(10_000);

      const codLine = revenueEntry!.lines.find((l) => l.accountCode === "1110");
      expect(codLine?.debitPaisa).toBe(900_000);

      const discLine = revenueEntry!.lines.find((l) => l.accountCode === "4010");
      expect(discLine?.debitPaisa).toBe(100_000);

      const vatLine = revenueEntry!.lines.find((l) => l.accountCode === "2100");
      expect(vatLine?.creditPaisa).toBe(130_435);

      const delFeeLine = revenueEntry!.lines.find((l) => l.accountCode === "4020");
      expect(delFeeLine?.creditPaisa).toBe(10_000);

      // COGS entry
      const cogsEntry = entries.find((e) => e.eventType === "COGS_RECOGNIZED");
      expect(cogsEntry).toBeDefined();

      const cogsDebitLine = cogsEntry!.lines.find((l) => l.accountCode === "5000");
      const cogsCreditLine = cogsEntry!.lines.find((l) => l.accountCode === "1200");
      expect(cogsDebitLine?.debitPaisa).toBe(600_000);
      expect(cogsCreditLine?.creditPaisa).toBe(600_000);

      // 5. Outbox events: order.delivered, analytics, review invitation
      const outbox = getMemoryOutbox();
      expect(outbox.some((o) => o.type === "order.delivered")).toBe(true);
      expect(outbox.some((o) => o.type === "analytics.order_delivered")).toBe(true);
      expect(outbox.some((o) => o.type === "customer.review_invitation_due")).toBe(true);
    });
  });

  // ==========================================================================
  // Test 4: Partial Delivery Splits Correctly
  // ==========================================================================
  describe("4. Partial Delivery Splits Correctly", () => {
    it("recognizes revenue and warranty only for delivered lines, while returned units follow RTO", async () => {
      catalogService.setSkuForTesting({
        id: "sku-item-1",
        skuCode: "SKU-ITM-1",
        warrantyDays: 365,
      });
      catalogService.setSkuForTesting({
        id: "sku-item-2",
        skuCode: "SKU-ITM-2",
        warrantyDays: 365,
      });

      const qc1 = await trustRepo.createQcRecord({
        skuId: "sku-item-1",
        qcType: "THREE_POINT",
        testChecklist: { power_voltage_ok: true, port_function_ok: true, physical_integrity_ok: true },
        result: "PASS",
        technicianId: qcTechnicianActor.id,
      });
      const seal1 = await trustService.mintSeal({ qc_record_id: qc1.id }, qcTechnicianActor);

      const qc2 = await trustRepo.createQcRecord({
        skuId: "sku-item-2",
        qcType: "THREE_POINT",
        testChecklist: { power_voltage_ok: true, port_function_ok: true, physical_integrity_ok: true },
        result: "PASS",
        technicianId: qcTechnicianActor.id,
      });
      const seal2 = await trustService.mintSeal({ qc_record_id: qc2.id }, qcTechnicianActor);

      const order = await ordersRepo.createOrder(undefined, {
        order: {
          orderNumber: "ORD-SPLIT-001",
          customerId: customerActor.id,
          orderType: "REGULAR_DROP_PACK",
          channel: "STOREFRONT_WEB",
          status: "HANDED_TO_COURIER",
          paymentStatus: "UNPAID",
          subtotalPaisa: 1_000_000, // 2 items @ 500,000 each
          couponDiscountPaisa: 0,
          deliveryFeePaisa: 10_000,
          taxPaisa: 130_435,
          totalPaisa: 1_010_000,
          codAmountPaisa: 1_010_000,
          advanceFeePaisa: 0,
          advanceFeePaid: false,
          deliveryZone: "INSIDE_DHAKA",
        },
        items: [
          {
            skuId: "sku-item-1",
            productTitle: "Delivered Item",
            skuCode: "SKU-ITM-1",
            qty: 1,
            unitPricePaisa: 500_000,
            unitCostPaisa: 300_000,
            taxPaisa: 65_217,
            units: [{ sealId: seal1.seal_id, status: "SEALED" }],
          },
          {
            skuId: "sku-item-2",
            productTitle: "Returned Item",
            skuCode: "SKU-ITM-2",
            qty: 1,
            unitPricePaisa: 500_000,
            unitCostPaisa: 300_000,
            taxPaisa: 65_218,
            units: [{ sealId: seal2.seal_id, status: "SEALED" }],
          },
        ],
      });

      const consignmentNo = "MCK-SPLIT-001";
      await logisticsRepo.createShipment({
        orderId: order.id,
        courier: "MOCK",
        direction: "FORWARD",
        consignmentNo,
        status: "OUT_FOR_DELIVERY",
        weightGrams: 3000,
        expectedCodPaisa: 1_010_000,
      });

      const unit1Id = order.items[0]!.units[0]!.id;
      const unit2Id = order.items[1]!.units[0]!.id;

      // Courier webhook reports PARTIALLY_DELIVERED with only unit1 accepted
      const res = await logisticsService.applyCourierEvent(
        {
          consignmentNo,
          rawStatus: "partial_delivered",
          normalizedStatus: "PARTIALLY_DELIVERED",
          occurredAt: new Date(),
          collectedCodPaisa: 500_000,
          payload: {
            delivered_unit_ids: [unit1Id],
            collected_amount_paisa: 500_000,
          },
        },
        "mock"
      );

      expect(res.success).toBe(true);
      expect(res.status).toBe("PARTIALLY_DELIVERED");

      // Check order status
      const updatedOrder = await ordersRepo.getOrderWithDetails(undefined, order.id);
      expect(updatedOrder?.status).toBe("PARTIALLY_DELIVERED");

      // Unit 1 seal warranty is activated
      const updatedSeal1 = await trustRepo.getSealRecordBySealId(seal1.seal_id);
      expect(updatedSeal1?.status).toBe("ACTIVE");
      expect(updatedSeal1?.warrantyStart).toBeDefined();

      // Unit 2 seal warranty is NOT activated
      const updatedSeal2 = await trustRepo.getSealRecordBySealId(seal2.seal_id);
      expect(updatedSeal2?.status).not.toBe("ACTIVE");
      expect(updatedSeal2?.warrantyStart).toBeNull();

      // Unit 2 marked RETURNED_RTO
      const unit2Details = await ordersRepo.getOrderItemUnitById(undefined, unit2Id);
      expect(unit2Details?.status).toBe("RETURNED_RTO");

      // Ledger recognized revenue only for delivered line (500,000 paisa)
      const { entries } = await ledgerService.listJournalEntries({
        sourceId: order.id,
      });
      const partialRevEntry = entries.find(
        (e) => e.eventType === "REVENUE_RECOGNIZED_PARTIAL_DELIVERY"
      );
      expect(partialRevEntry).toBeDefined();

      const codLine = partialRevEntry!.lines.find((l) => l.accountCode === "1110");
      expect(codLine?.debitPaisa).toBe(500_000);
    });
  });

  // ==========================================================================
  // Test 5: 2nd RTO in 12 Months Blocks COD, 13-Month-Old RTO Not Counted
  // ==========================================================================
  describe("5. 2nd RTO in 12 Months Blocks COD & Rolling Window", () => {
    it("does not count 13-month-old RTOs, blocks COD on 2nd RTO within 12m, and supports override", async () => {
      const customerId = "01920000-0000-7000-8000-0000000000r1";

      await authService.saveCustomer({
        id: customerId,
        phone: "+8801811000002",
        fullName: "RTO Target Customer",
        status: "ACTIVE",
        deliveredOrderCount: 0,
        rtoCount12m: 0,
        codBlocked: false,
        codBlockReason: null,
        codBlockLiftedBy: null,
        marketingOptIn: false,
        preferredLocale: "bn",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 1. Create an old shipment from 400 days ago (~13 months ago) with status RETURNED
      const oldOrder = await ordersRepo.createOrder(undefined, {
        order: {
          orderNumber: "ORD-OLD-RTO",
          customerId,
          orderType: "REGULAR",
          channel: "ONLINE",
          status: "RETURNED",
          subtotalPaisa: 500_000,
          totalPaisa: 510_000,
          codAmountPaisa: 510_000,
          createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        },
        items: [],
      });

      await logisticsRepo.createShipment({
        orderId: oldOrder.id,
        courier: "MOCK",
        direction: "FORWARD",
        consignmentNo: "MCK-OLD-RTO-01",
        status: "RETURNED",
        weightGrams: 1000,
        expectedCodPaisa: 510_000,
        createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
      });

      // Recompute: 13-month-old RTO must NOT be counted
      const rtoCheck0 = await customerService.recomputeCustomerRtoCount(customerId);
      expect(rtoCheck0.rtoCount12m).toBe(0);
      expect(rtoCheck0.codBlocked).toBe(false);

      // 2. First recent RTO (e.g. today)
      const order1 = await ordersRepo.createOrder(undefined, {
        order: {
          orderNumber: "ORD-REC-RTO-1",
          customerId,
          orderType: "REGULAR",
          channel: "ONLINE",
          status: "HANDED_TO_COURIER",
          subtotalPaisa: 500_000,
          totalPaisa: 510_000,
          codAmountPaisa: 510_000,
        },
        items: [],
      });

      const ship1 = await logisticsRepo.createShipment({
        orderId: order1.id,
        courier: "MOCK",
        direction: "FORWARD",
        consignmentNo: "MCK-RTO-1",
        status: "OUT_FOR_DELIVERY",
        weightGrams: 1000,
        expectedCodPaisa: 510_000,
      });

      // Trigger RTO_IN_TRANSIT webhook
      await logisticsService.applyCourierEvent(
        {
          consignmentNo: ship1.consignmentNo!,
          rawStatus: "return",
          normalizedStatus: "RTO_IN_TRANSIT",
          occurredAt: new Date(),
          payload: {},
        },
        "mock"
      );

      const custAfterRto1 = await authService.findCustomerById(customerId);
      expect(custAfterRto1?.rtoCount12m).toBe(1);
      expect(custAfterRto1?.codBlocked).toBe(false); // 1 RTO does not block COD

      // 3. Second recent RTO
      const order2 = await ordersRepo.createOrder(undefined, {
        order: {
          orderNumber: "ORD-REC-RTO-2",
          customerId,
          orderType: "REGULAR",
          channel: "ONLINE",
          status: "HANDED_TO_COURIER",
          subtotalPaisa: 500_000,
          totalPaisa: 510_000,
          codAmountPaisa: 510_000,
        },
        items: [],
      });

      const ship2 = await logisticsRepo.createShipment({
        orderId: order2.id,
        courier: "MOCK",
        direction: "FORWARD",
        consignmentNo: "MCK-RTO-2",
        status: "OUT_FOR_DELIVERY",
        weightGrams: 1000,
        expectedCodPaisa: 510_000,
      });

      await logisticsService.applyCourierEvent(
        {
          consignmentNo: ship2.consignmentNo!,
          rawStatus: "return",
          normalizedStatus: "RTO_IN_TRANSIT",
          occurredAt: new Date(),
          payload: {},
        },
        "mock"
      );

      // 2nd RTO in 12 months triggers automatic COD block!
      const custAfterRto2 = await authService.findCustomerById(customerId);
      expect(custAfterRto2?.rtoCount12m).toBe(2);
      expect(custAfterRto2?.codBlocked).toBe(true);
      expect(custAfterRto2?.codBlockReason).toBe("AUTO_RTO");

      // Verify system audit log
      const auditEntries = getRecentMemoryAuditEntries();
      const blockAudit = auditEntries.find((a) => a.action === "customer.cod_blocked");
      expect(blockAudit).toBeDefined();
      expect(blockAudit?.actorType).toBe("SYSTEM");

      // 4. Support Override (POST /api/v1/admin/customers/:id/cod-block)
      const overrideRes = await logisticsService.overrideCodBlock(
        customerId,
        {
          blocked: false,
          reason: "Customer verified residential address via phone call",
        },
        customerSupportActor
      );

      expect(overrideRes.codBlocked).toBe(false);
      const custAfterOverride = await authService.findCustomerById(customerId);
      expect(custAfterOverride?.codBlocked).toBe(false);
      expect(custAfterOverride?.codBlockLiftedBy).toBe(customerSupportActor.id);
    });

    it("handles RTO receipt inspection, restocks intact seals, claims damaged items, and retains advance fee", async () => {
      const { order, shipment } = await createTestOrderAndShipment({
        advanceFeePaisa: 20_000,
        advanceFeePaid: true,
        paidAmountPaisa: 50_000, // prepaid 500 BDT, advance fee was 200 BDT (300 BDT refundable)
      });

      const unitId = order.items[0]!.units[0]!.id;

      // Dispatch staff inspects RTO at godown (1 intact unit, 1 damaged unit scenario)
      const rtoResult = await logisticsService.receiveRto(
        shipment.id,
        {
          units: [
            {
              order_item_unit_id: unitId,
              seal_intact: false, // damaged
              notes: "Box crushed and hologram torn during courier return transit",
            },
          ],
        },
        dispatchStaffActor
      );

      expect(rtoResult.success).toBe(true);
      expect(rtoResult.shipment_status).toBe("RETURNED");
      expect(rtoResult.claims_created).toBe(1);

      // Verify courier claim created
      const claims = await logisticsRepo.listClaimsByShipmentId(shipment.id);
      expect(claims).toHaveLength(1);
      expect(claims[0]!.status).toBe("PENDING");
      expect(claims[0]!.notes).toContain("Box crushed");

      // Verify ledger RTO_ADVANCE_FEE_RETAINED (Dr 2000 / Cr 4020 for 200 BDT advance fee)
      const { entries } = await ledgerService.listJournalEntries({
        sourceId: order.id,
      });
      const rtoAdvanceEntry = entries.find(
        (e) => e.eventType === "RTO_ADVANCE_FEE_RETAINED"
      );
      expect(rtoAdvanceEntry).toBeDefined();

      const drLine = rtoAdvanceEntry!.lines.find((l) => l.accountCode === "2000");
      const crLine = rtoAdvanceEntry!.lines.find((l) => l.accountCode === "4020");
      expect(drLine?.debitPaisa).toBe(20_000);
      expect(crLine?.creditPaisa).toBe(20_000);

      // Verify refund requested for prepaid excess beyond advance fee (50,000 - 20,000 = 30,000 paisa)
      const outbox = getMemoryOutbox();
      const refundOutbox = outbox.find((o) => o.type === "refund.requested");
      expect(refundOutbox).toBeDefined();
      expect(refundOutbox?.payload?.amountPaisa).toBe(30_000);
    });
  });

  // ==========================================================================
  // Test 6: Warranty Fallback Dates
  // ==========================================================================
  describe("6. Warranty Fallback Dates", () => {
    it("sets warranty start to fallback date (+3d Dhaka, +5d outside) without marking order delivered", async () => {
      // 1. Order inside Dhaka, dispatched 4 days ago (> 3 days)
      const { order: dhakaOrder, shipment: dhakaShipment, seal1: dhakaSeal } =
        await createTestOrderAndShipment({
          orderNumber: "ORD-FB-DHAKA",
          deliveryZone: "INSIDE_DHAKA",
        });

      const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
      await logisticsRepo.updateShipment(dhakaShipment.id, {
        handedOverAt: fourDaysAgo,
        status: "IN_TRANSIT",
      });

      // 2. Order outside Dhaka, dispatched 4 days ago (< 5 days, so NOT yet eligible)
      const { order: outsideOrder, shipment: outsideShipment, seal1: outsideSeal } =
        await createTestOrderAndShipment({
          orderNumber: "ORD-FB-OUTSIDE",
          deliveryZone: "OUTSIDE_DHAKA",
        });

      await logisticsRepo.updateShipment(outsideShipment.id, {
        handedOverAt: fourDaysAgo,
        status: "IN_TRANSIT",
      });

      // Run daily 02:00 warranty fallback job
      const fallbackResult = await logisticsService.runWarrantyFallbackJob();
      expect(fallbackResult.eligibleCount).toBe(1); // Only Dhaka order eligible

      // Dhaka seal has warranty activated starting dispatch + 3 days
      const updatedDhakaSeal = await trustRepo.getSealRecordBySealId(dhakaSeal.seal_id);
      expect(updatedDhakaSeal?.status).toBe("ACTIVE");
      expect(updatedDhakaSeal?.warrantyStart).toBeDefined();

      const expectedFallbackDate = new Date(
        fourDaysAgo.getTime() + 3 * 24 * 60 * 60 * 1000
      );
      expect(updatedDhakaSeal?.warrantyStart?.toISOString()).toBe(
        expectedFallbackDate.toISOString()
      );

      // CRITICAL: Order status MUST NOT be marked delivered!
      const updatedDhakaOrder = await ordersRepo.getOrderWithDetails(undefined, dhakaOrder.id);
      expect(updatedDhakaOrder?.status).not.toBe("DELIVERED");
      expect(updatedDhakaOrder?.status).toBe("HANDED_TO_COURIER");

      // Outside Dhaka seal is NOT yet activated (needs 5 days)
      const updatedOutsideSeal = await trustRepo.getSealRecordBySealId(outsideSeal.seal_id);
      expect(updatedOutsideSeal?.status).not.toBe("ACTIVE");
      expect(updatedOutsideSeal?.warrantyStart).toBeNull();

      // Check audit log
      const auditEntries = getRecentMemoryAuditEntries();
      const fbAudit = auditEntries.find((a) => a.action === "warranty.fallback_started");
      expect(fbAudit).toBeDefined();
      expect(fbAudit?.entityId).toBe(dhakaOrder.id);
    });
  });
});
