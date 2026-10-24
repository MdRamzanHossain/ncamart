import { describe, it, expect, beforeEach } from "vitest";
import { Actor } from "@/lib/http/route";
import { clearMemoryOutboxForTesting, getMemoryOutbox } from "@/lib/outbox";
import { clearMockQueuesForTesting, getMockQueuedJobs } from "@/lib/queues";
import { clearMemoryAuditChainForTesting, getRecentMemoryAuditEntries } from "@/modules/audit";
import { ordersService } from "@/modules/orders";
import { ordersRepo } from "@/modules/orders/repo";
import { trustService } from "@/modules/trust";
import { trustRepo } from "@/modules/trust/repo";
import { catalogService } from "@/modules/catalog";
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
  COURIER_RETRY_DELAYS_MS,
  getNextCourierRetryDelay,
  CourierAdapter,
  registerCourierAdapter,
} from "../index";

// --------------------------------------------------------------------------
// Test Actors
// --------------------------------------------------------------------------
const dispatchStaff: Actor = {
  id: "01920000-0000-7000-8000-0000000000d1",
  type: "staff",
  roles: ["DISPATCH_STAFF"],
  permissions: ["dispatch.pack", "dispatch.book", "pii.read.shipping"],
};

const godownManager: Actor = {
  id: "01920000-0000-7000-8000-0000000000g1",
  type: "staff",
  roles: ["GODOWN_MANAGER"],
  permissions: ["dispatch.pack", "dispatch.book", "qc.sampling.audit"],
};

const qcTechnician: Actor = {
  id: "01920000-0000-7000-8000-0000000000q1",
  type: "staff",
  roles: ["QC_TECHNICIAN"],
  permissions: ["qc.execute", "seal.print"],
};

const customerA: Actor = {
  id: "01920000-0000-7000-8000-0000000000c1",
  type: "customer",
};

describe("P28 — Packing, Dispatch Queue & Courier Booking", () => {
  beforeEach(() => {
    clearMemoryLogisticsForTesting();
    ordersService.clearMemoryForTesting();
    trustService.clearMemoryForTesting();
    catalogService.clearMemoryCatalogForTesting();
    clearMemoryOutboxForTesting();
    clearMockQueuesForTesting();
    clearMemoryAuditChainForTesting();
    MockCourierAdapter.clear();
  });

  // --------------------------------------------------------------------------
  // Helper: Create Test Order with OrderItemUnit and Minted Seal
  // --------------------------------------------------------------------------
  async function createTestOrder(options: {
    fulfillmentChannel?: "COURIER" | "PICKUP" | "WALK_IN";
    deliveryZone?: "INSIDE_DHAKA" | "OUTSIDE_DHAKA";
    codAmountPaisa?: number;
    sampledForAudit?: boolean;
    supervisorAuditPassed?: boolean;
    sealActive?: boolean;
    district?: string;
    thana?: string;
  } = {}) {
    const fulfillmentChannel = options.fulfillmentChannel ?? "COURIER";
    const deliveryZone = options.deliveryZone ?? "INSIDE_DHAKA";
    const codAmountPaisa = options.codAmountPaisa ?? 235_000;
    const district = options.district ?? "Dhaka";
    const thana = options.thana ?? "Kotwali";

    const category = await catalogService.createCategory({
      slug: `cat-${crypto.randomUUID().slice(0, 8)}`,
      nameEn: "Chargers",
      nameBn: "চার্জার",
      level: 1,
    });

    const product = await catalogService.createProduct(
      {
        titleEn: "Fast GaN Charger 65W",
        titleBn: "ফাস্ট চার্জার",
        slug: `prod-${crypto.randomUUID().slice(0, 8)}`,
        categoryId: category.id,
        productTier: "BUDGET_SMART",
        fulfillmentType: "DROP_AND_PACK",
        vatRateBp: 0,
      },
      dispatchStaff
    );

    const sku = await catalogService.createSku(
      {
        productId: product.id,
        skuCode: `SKU-${crypto.randomUUID().slice(0, 6)}`,
        pricePaisa: 250_000,
        baseCostPaisa: 180_000,
        weightGrams: 350,
        warrantyType: "SELLER_REPLACEMENT",
        warrantyDays: 30,
      },
      dispatchStaff
    );

    catalogService.setProductStatusForTesting(product.id, "PUBLISHED");

    // Create Order
    const orderNumber = "ORD-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    const order = await ordersRepo.createOrder(undefined, {
      order: {
        orderNumber,
        customerId: customerA.id,
        channel: "STOREFRONT_WEB",
        orderType: "REGULAR_DROP_PACK",
        fulfillmentChannel,
        deliveryZone,
        status: "AT_GODOWN_QC",
        paymentStatus: codAmountPaisa === 0 ? "PAID" : "UNPAID",
        paymentMode: codAmountPaisa === 0 ? "ONLINE_FULL" : "COD",
        codAmountPaisa,
        subtotalPaisa: 250_000,
        totalPayablePaisa: 250_000,
        addressSnapshot: {
          name: "Karim Uddin",
          phone: "+8801712345678",
          address: "15 Nawabpur Road",
          thana,
          district,
          division: "Dhaka",
        },
      },
      items: [
        {
          skuId: sku.id,
          productId: product.id,
          titleEn: product.titleEn,
          titleBn: product.titleBn,
          tier: product.productTier,
          skuCode: sku.skuCode,
          qty: 1,
          unitPricePaisa: 250_000,
          lineTotalPaisa: 250_000,
          vatRateBp: 0,
          vatPaisa: 0,
          source: "PHYSICAL",
        },
      ],
    });

    const detailed = await ordersRepo.getOrderWithDetails(undefined, order.id);
    const unit = detailed!.items[0]!.units![0]!;

    // Perform QC inspection
    const qcRecord = await trustRepo.createQcRecord({
      skuId: sku.id,
      orderItemUnitId: unit.id,
      qcType: "THREE_POINT",
      testChecklist: { power_voltage_ok: true, port_function_ok: true, physical_integrity_ok: true },
      result: "PASS",
      technicianId: qcTechnician.id,
      sampledForAudit: options.sampledForAudit ?? false,
      auditDueAt: options.sampledForAudit ? new Date(Date.now() + 120 * 60 * 1000) : null,
      supervisorCheckedAt: options.supervisorAuditPassed ? new Date() : null,
      supervisorId: options.supervisorAuditPassed ? godownManager.id : null,
      supervisorResult: options.supervisorAuditPassed ? "PASS" : null,
    });

    // Mint Seal
    const mint = await trustService.mintSeal({ qc_record_id: qcRecord.id }, qcTechnician);

    // Apply seal to unit if requested
    if (options.sealActive !== false) {
      await trustService.applySeal(mint.seal_id, { order_item_unit_id: unit.id }, qcTechnician);
    }

    const updatedUnit = (await ordersRepo.getOrderItemUnitById(undefined, unit.id))!;
    const refreshedOrder = (await ordersRepo.getOrderWithDetails(undefined, order.id))!;

    return {
      order: refreshedOrder,
      unit: updatedUnit,
      sealId: mint.seal_id,
      qcRecord,
      sku,
    };
  }

  // --------------------------------------------------------------------------
  // 1. Courier Adapter Interface & Normalization (architechture.md §12)
  // --------------------------------------------------------------------------
  describe("1. Courier Adapters Interface & Status Normalization", () => {
    it("Steadfast adapter normalizes statuses according to domain taxonomy", () => {
      const adapter = new SteadfastAdapter();
      expect(adapter.code).toBe("steadfast");
      expect(adapter.normalizeStatus("in_review")).toBe("BOOKED");
      expect(adapter.normalizeStatus("picked")).toBe("PICKED_UP");
      expect(adapter.normalizeStatus("in_transit")).toBe("IN_TRANSIT");
      expect(adapter.normalizeStatus("out_for_delivery")).toBe("OUT_FOR_DELIVERY");
      expect(adapter.normalizeStatus("delivered")).toBe("DELIVERED");
      expect(adapter.normalizeStatus("partial_delivered")).toBe("PARTIALLY_DELIVERED");
      expect(adapter.normalizeStatus("return_in_transit")).toBe("RTO_IN_TRANSIT");
      expect(adapter.normalizeStatus("returned")).toBe("RETURNED");
      expect(adapter.normalizeStatus("cancelled")).toBe("CANCELLED");
    });

    it("Pathao adapter normalizes statuses according to domain taxonomy", () => {
      const adapter = new PathaoAdapter();
      expect(adapter.code).toBe("pathao");
      expect(adapter.normalizeStatus("Pending")).toBe("BOOKED");
      expect(adapter.normalizeStatus("Confirmed")).toBe("BOOKED");
      expect(adapter.normalizeStatus("Picked")).toBe("PICKED_UP");
      expect(adapter.normalizeStatus("In Transit")).toBe("IN_TRANSIT");
      expect(adapter.normalizeStatus("Out for Delivery")).toBe("OUT_FOR_DELIVERY");
      expect(adapter.normalizeStatus("Delivered")).toBe("DELIVERED");
      expect(adapter.normalizeStatus("Partial Delivered")).toBe("PARTIALLY_DELIVERED");
      expect(adapter.normalizeStatus("Return in Transit")).toBe("RTO_IN_TRANSIT");
      expect(adapter.normalizeStatus("Returned")).toBe("RETURNED");
    });

    it("RedX adapter normalizes statuses according to domain taxonomy", () => {
      const adapter = new RedXAdapter();
      expect(adapter.code).toBe("redx");
      expect(adapter.normalizeStatus("ready-for-pickup")).toBe("BOOKED");
      expect(adapter.normalizeStatus("picked-up")).toBe("PICKED_UP");
      expect(adapter.normalizeStatus("in-transit")).toBe("IN_TRANSIT");
      expect(adapter.normalizeStatus("out-for-delivery")).toBe("OUT_FOR_DELIVERY");
      expect(adapter.normalizeStatus("delivered")).toBe("DELIVERED");
      expect(adapter.normalizeStatus("partially-delivered")).toBe("PARTIALLY_DELIVERED");
      expect(adapter.normalizeStatus("return-in-transit")).toBe("RTO_IN_TRANSIT");
      expect(adapter.normalizeStatus("returned")).toBe("RETURNED");
    });

    it("Mock adapter provides deterministic consignment numbers and status progression", async () => {
      const adapter = new MockCourierAdapter();
      expect(adapter.code).toBe("mock");

      const booking = await adapter.createShipment({
        orderId: "ord_1",
        orderNumber: "ORD-20261020-001",
        recipientName: "Rahim",
        recipientPhone: "+8801711000000",
        recipientAddress: "Dhaka",
        expectedCodPaisa: 250000,
        weightGrams: 500,
      });

      expect(booking.consignmentNo).toContain("MCK-ORD20261020001");
      expect(booking.trackingUrl).toContain(booking.consignmentNo);

      // Query status
      const status1 = await adapter.getStatus(booking.consignmentNo);
      expect(status1.normalizedStatus).toBe("BOOKED");

      // Advance via static helper
      const advanced = MockCourierAdapter.advanceStatus(booking.consignmentNo);
      expect(advanced.status).toBe("PICKED_UP");

      const status2 = await adapter.getStatus(booking.consignmentNo);
      expect(status2.normalizedStatus).toBe("PICKED_UP");

      // Advance directly to explicit target status
      const delivered = MockCourierAdapter.advanceStatus(booking.consignmentNo, "DELIVERED");
      expect(delivered.status).toBe("DELIVERED");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Dispatch Queue (GET /api/v1/logistics/dispatch-queue)
  // --------------------------------------------------------------------------
  describe("2. Dispatch Queue & Role-Based Shipping PII Serialization", () => {
    it("returns orders with ACTIVE seals grouped by fulfillment channel and records PII audit", async () => {
      // 1. Order with active seal (eligible)
      const { order: oCourier } = await createTestOrder({
        fulfillmentChannel: "COURIER",
      });

      // 2. Order for showroom pickup with active seal (eligible)
      const { order: oPickup } = await createTestOrder({
        fulfillmentChannel: "PICKUP",
      });

      // 3. Order pending supervisor audit (BLOCKED, should NOT appear)
      await createTestOrder({
        fulfillmentChannel: "COURIER",
        sampledForAudit: true,
        supervisorAuditPassed: false,
      });

      // 4. Order without seal (unsealed, should NOT appear)
      await createTestOrder({
        fulfillmentChannel: "COURIER",
        sealActive: false,
      });

      // Access dispatch queue as DISPATCH_STAFF
      const queue = await logisticsService.getDispatchQueue(dispatchStaff);

      expect(queue.total).toBe(2);
      expect(queue.channels.COURIER).toHaveLength(1);
      expect(queue.channels.COURIER[0]!.order_id).toBe(oCourier.id);
      expect(queue.channels.PICKUP).toHaveLength(1);
      expect(queue.channels.PICKUP[0]!.order_id).toBe(oPickup.id);

      // Verify SHIPPING PII serializer is applied
      const shippingAddress = queue.channels.COURIER[0]!.shipping_address;
      expect(shippingAddress.consigneeName).toBe("Karim Uddin");
      expect(shippingAddress.contactPhone).toBe("+8801712345678");
      expect(shippingAddress.addressLine).toBe("15 Nawabpur Road");

      // Verify immutable audit row recorded with action: 'pii.read.shipping'
      const auditEntries = getRecentMemoryAuditEntries();
      const shippingAudit = auditEntries.filter(
        (a) => a.action === "pii.read.shipping" && a.staffId === dispatchStaff.id
      );
      expect(shippingAudit.length).toBeGreaterThanOrEqual(2);
      expect(shippingAudit.some((a) => a.entityId === oCourier.id)).toBe(true);
      expect(shippingAudit.some((a) => a.entityId === oPickup.id)).toBe(true);
    });

    it("rejects non-staff or unauthorized actors attempting to access dispatch queue", async () => {
      await expect(
        logisticsService.getDispatchQueue(customerA)
      ).rejects.toThrow(/Insufficient permissions/);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Packing & Seal Verification (POST /api/v1/logistics/orders/:orderId/pack)
  // --------------------------------------------------------------------------
  describe("3. Order Packing & Seal Verification", () => {
    it("packing rejects wrong seal ID with ERR_INVALID_SEAL_CONFIRMATION", async () => {
      const { order, unit } = await createTestOrder();

      const wrongSealConfirmation = {
        package_weight_grams: 450,
        unit_seal_confirmations: [
          {
            order_item_unit_id: unit.id,
            seal_id: "NCA-9999-9999", // Wrong seal!
          },
        ],
      };

      await expect(
        logisticsService.packOrder(order.id, wrongSealConfirmation, dispatchStaff)
      ).rejects.toThrow(/Scanned seal.*does not match unit seal ID/);

      // Verify order status remains unchanged
      const refreshed = await ordersRepo.getOrderWithDetails(undefined, order.id);
      expect(refreshed?.status).toBe("AT_GODOWN_QC");
    });

    it("packing blocks order while supervisor sampling audit is pending", async () => {
      const { order, unit, sealId } = await createTestOrder({
        sampledForAudit: true,
        supervisorAuditPassed: false,
      });

      const confirmation = {
        package_weight_grams: 450,
        unit_seal_confirmations: [
          {
            order_item_unit_id: unit.id,
            seal_id: sealId,
          },
        ],
      };

      await expect(
        logisticsService.packOrder(order.id, confirmation, dispatchStaff)
      ).rejects.toThrow(/one or more units are pending supervisor QC audit/);
    });

    it("packing PICKUP order transitions to PACKED then READY_FOR_PICKUP", async () => {
      const { order, unit, sealId } = await createTestOrder({
        fulfillmentChannel: "PICKUP",
      });

      const confirmation = {
        package_weight_grams: 420,
        unit_seal_confirmations: [
          {
            order_item_unit_id: unit.id,
            seal_id: sealId,
          },
        ],
      };

      const result = await logisticsService.packOrder(order.id, confirmation, dispatchStaff);
      expect(result.success).toBe(true);
      expect(result.orderStatus).toBe("READY_FOR_PICKUP");

      const refreshed = await ordersRepo.getOrderWithDetails(undefined, order.id);
      expect(refreshed?.status).toBe("READY_FOR_PICKUP");

      const outbox = getMemoryOutbox();
      expect(outbox.some((e) => e.type === "order.packed")).toBe(true);
    });

    it("packing COURIER order transitions to PACKED, creates shipment with expected_cod_paisa = order.codAmountPaisa, and enqueues booking", async () => {
      const codPaisa = 189_000;
      const { order, unit, sealId } = await createTestOrder({
        fulfillmentChannel: "COURIER",
        codAmountPaisa: codPaisa,
      });

      const confirmation = {
        package_weight_grams: 550,
        unit_seal_confirmations: [
          {
            order_item_unit_id: unit.id,
            seal_id: sealId,
          },
        ],
      };

      const result = await logisticsService.packOrder(order.id, confirmation, dispatchStaff);
      expect(result.success).toBe(true);
      expect(result.orderStatus).toBe("PACKED");

      // Verify shipment creation
      const shipment = await logisticsRepo.getShipmentByOrderId(order.id);
      expect(shipment).toBeDefined();
      expect(shipment?.expectedCodPaisa).toBe(codPaisa);
      expect(shipment?.expectedCodPaisa).toBe(order.codAmountPaisa);
      expect(shipment?.weightGrams).toBe(550);

      // Verify booking job was enqueued into 'courier' queue
      const queuedJobs = getMockQueuedJobs("courier");
      expect(queuedJobs.some((j) => j.name === "book-consignment")).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Booking Retry Schedule & Manual Console Fallback (PRD §3.7)
  // --------------------------------------------------------------------------
  describe("4. Booking Retry Schedule & Fallback to Manual Console", () => {
    it("custom retry delays strictly follow PRD §3.7: 1m, 5m, 15m, 30m, and exhaust after last failure", () => {
      expect(COURIER_RETRY_DELAYS_MS[0]).toBe(60_000); // 1 minute
      expect(COURIER_RETRY_DELAYS_MS[1]).toBe(300_000); // 5 minutes
      expect(COURIER_RETRY_DELAYS_MS[2]).toBe(900_000); // 15 minutes
      expect(COURIER_RETRY_DELAYS_MS[3]).toBe(1_800_000); // 30 minutes

      expect(getNextCourierRetryDelay(1)).toBe(60_000);
      expect(getNextCourierRetryDelay(2)).toBe(300_000);
      expect(getNextCourierRetryDelay(3)).toBe(900_000);
      expect(getNextCourierRetryDelay(4)).toBe(1_800_000);
      expect(getNextCourierRetryDelay(5)).toBeNull(); // Exhausted!
    });

    it("schedules retries on failure and transitions to BOOKING_FAILED on exhaustion", async () => {
      const { order } = await createTestOrder({ fulfillmentChannel: "COURIER" });

      const shipment = await logisticsRepo.createShipment({
        orderId: order.id,
        courier: "STEADFAST",
        direction: "FORWARD",
        status: "PENDING_BOOKING",
        weightGrams: 500,
        expectedCodPaisa: order.codAmountPaisa,
        bookingAttempts: 0,
      });

      // Register a failing mock adapter
      const failingAdapter: CourierAdapter = {
        code: "steadfast",
        createShipment: async () => {
          throw new Error("Steadfast API timeout: Gateway unreachable");
        },
        getStatus: async () => {
          throw new Error("Not implemented");
        },
        parseWebhook: async () => [],
      };
      registerCourierAdapter("steadfast", failingAdapter);

      // Attempt 1: Fails -> Schedules retry at 1m (60,000 ms)
      const res1 = await logisticsService.executeBookingJob(shipment.id, 1);
      expect(res1.success).toBe(false);
      expect(res1.retryScheduled).toBe(true);
      expect(res1.nextDelayMs).toBe(60_000);

      let updated = (await logisticsRepo.getShipmentById(shipment.id))!;
      expect(updated.bookingAttempts).toBe(1);
      expect(updated.lastError).toContain("Steadfast API timeout");

      // Attempt 2: Fails -> Schedules retry at 5m (300,000 ms)
      const res2 = await logisticsService.executeBookingJob(shipment.id, 2);
      expect(res2.nextDelayMs).toBe(300_000);

      // Attempt 3: Fails -> Schedules retry at 15m (900,000 ms)
      const res3 = await logisticsService.executeBookingJob(shipment.id, 3);
      expect(res3.nextDelayMs).toBe(900_000);

      // Attempt 4: Fails -> Schedules retry at 30m (1,800,000 ms)
      const res4 = await logisticsService.executeBookingJob(shipment.id, 4);
      expect(res4.nextDelayMs).toBe(1_800_000);

      // Attempt 5: Exhausted -> Transitions to BOOKING_FAILED and lands in manual console
      const res5 = await logisticsService.executeBookingJob(shipment.id, 5);
      expect(res5.bookingFailed).toBe(true);
      expect(res5.retryScheduled).toBe(false);

      updated = (await logisticsRepo.getShipmentById(shipment.id))!;
      expect(updated.status).toBe("BOOKING_FAILED");

      // Verify it appears in Dispatch Staff manual console
      const consoleData = await logisticsService.getManualConsole(dispatchStaff);
      expect(consoleData.failed_bookings.some((s) => s.shipment_id === shipment.id)).toBe(true);
      expect(consoleData.failed_bookings[0]!.last_error).toContain("Steadfast API timeout");

      // Outbox emitted shipment.booking_failed
      const outbox = getMemoryOutbox();
      expect(outbox.some((e) => e.type === "shipment.booking_failed")).toBe(true);
    });

    it("missing location mapping for Pathao/RedX triggers immediate BOOKING_FAILED and manual console", async () => {
      const { order } = await createTestOrder({
        fulfillmentChannel: "COURIER",
        district: "Cox's Bazar",
        thana: "Teknaf",
      });

      const shipment = await logisticsRepo.createShipment({
        orderId: order.id,
        courier: "PATHAO",
        direction: "FORWARD",
        status: "PENDING_BOOKING",
        weightGrams: 500,
        expectedCodPaisa: order.codAmountPaisa,
        bookingAttempts: 0,
      });

      // No mapping exists for Teknaf, Cox's Bazar
      const res = await logisticsService.executeBookingJob(shipment.id, 1);
      expect(res.success).toBe(false);
      expect(res.bookingFailed).toBe(true);
      expect(res.error).toContain("Missing courier location mapping");

      const updated = (await logisticsRepo.getShipmentById(shipment.id))!;
      expect(updated.status).toBe("BOOKING_FAILED");

      const consoleData = await logisticsService.getManualConsole(dispatchStaff);
      expect(consoleData.failed_bookings.some((s) => s.shipment_id === shipment.id)).toBe(true);
    });

    it("allows staff to re-book or switch courier in one click via book-consignment", async () => {
      const { order } = await createTestOrder({ fulfillmentChannel: "COURIER" });

      // Create a previously failed shipment
      await logisticsRepo.createShipment({
        orderId: order.id,
        courier: "STEADFAST",
        status: "BOOKING_FAILED",
        weightGrams: 400,
        expectedCodPaisa: order.codAmountPaisa,
        lastError: "Connection refused",
      });

      // Staff switches to MOCK courier via book-consignment
      const result = await logisticsService.bookConsignment(
        {
          order_id: order.id,
          courier_partner: "MOCK",
          package_weight_grams: 450,
        },
        dispatchStaff
      );

      expect(result.tracking_code).toContain("MCK-");
      expect(result.expected_cod_paisa).toBe(order.codAmountPaisa);

      const refreshed = (await logisticsRepo.getShipmentById(result.consignment_id))!;
      expect(refreshed.status).toBe("BOOKED");
      expect(refreshed.courier).toBe("MOCK");
      expect(refreshed.lastError).toBeNull();
    });

    it("supports manual booking for couriers without an API", async () => {
      const { order } = await createTestOrder({ fulfillmentChannel: "COURIER" });

      const shipment = await logisticsRepo.createShipment({
        orderId: order.id,
        courier: "MANUAL",
        direction: "FORWARD",
        status: "PENDING_BOOKING",
        weightGrams: 600,
        expectedCodPaisa: order.codAmountPaisa,
      });

      const manualResult = await logisticsService.manualBooking(
        shipment.id,
        {
          consignment_no: "SA-PARCEL-99120",
          tracking_url: "https://saparibahan.com/track/99120",
        },
        dispatchStaff
      );

      expect(manualResult.status).toBe("BOOKED");
      expect(manualResult.consignmentNo).toBe("SA-PARCEL-99120");
      expect(manualResult.trackingUrl).toBe("https://saparibahan.com/track/99120");

      const events = await logisticsRepo.listEventsByShipmentId(shipment.id);
      expect(events.some((e) => e.rawStatus === "MANUAL_BOOKING")).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Courier Handover (POST /api/v1/logistics/shipments/handover)
  // --------------------------------------------------------------------------
  describe("5. Central Godown Courier Handover", () => {
    it("handover transitions orders to HANDED_TO_COURIER and locks advance delivery fee", async () => {
      const { order, unit, sealId } = await createTestOrder({
        fulfillmentChannel: "COURIER",
      });

      // Pack order
      const packRes = await logisticsService.packOrder(
        order.id,
        {
          package_weight_grams: 480,
          unit_seal_confirmations: [{ order_item_unit_id: unit.id, seal_id: sealId }],
        },
        dispatchStaff
      );

      const shipmentId = packRes.shipment!.id;

      // Ensure shipment is BOOKED
      await logisticsRepo.updateShipment(shipmentId, {
        status: "BOOKED",
        consignmentNo: "MCK-TEST-9981",
      });

      // Scan handover at godown pickup
      const handoverRes = await logisticsService.handoverShipments(
        { shipment_ids: [shipmentId] },
        dispatchStaff
      );

      expect(handoverRes.handedOverCount).toBe(1);

      // Verify shipment status and handed_over_at
      const updatedShipment = (await logisticsRepo.getShipmentById(shipmentId))!;
      expect(updatedShipment.status).toBe("PICKED_UP");
      expect(updatedShipment.handedOverAt).toBeInstanceOf(Date);

      // Verify linked order status transitioned to HANDED_TO_COURIER
      const updatedOrder = (await ordersRepo.getOrderWithDetails(undefined, order.id))!;
      expect(updatedOrder.status).toBe("HANDED_TO_COURIER");

      // Verify outbox emitted shipment.handed_over
      const outbox = getMemoryOutbox();
      expect(outbox.some((e) => e.type === "shipment.handed_over")).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Shipping Label Generation (GET /api/v1/logistics/shipments/:id/label)
  // --------------------------------------------------------------------------
  describe("6. Shipping Label Generation", () => {
    it("generates label with order number, barcode, consignee shipping PII, and COD amount", async () => {
      const { order } = await createTestOrder({
        fulfillmentChannel: "COURIER",
        codAmountPaisa: 150_000,
      });

      const shipment = await logisticsRepo.createShipment({
        orderId: order.id,
        courier: "STEADFAST",
        status: "BOOKED",
        consignmentNo: "STF-20261020-0091",
        weightGrams: 450,
        expectedCodPaisa: order.codAmountPaisa,
      });

      const label = await logisticsService.getShippingLabel(shipment.id, dispatchStaff);

      expect(label.order_number).toBe(order.orderNumber);
      expect(label.consignment_no).toBe("STF-20261020-0091");
      expect(label.consignee.consigneeName).toBe("Karim Uddin");
      expect(label.consignee.contactPhone).toBe("+8801712345678");
      expect(label.expected_cod_paisa).toBe(150_000);
      expect(label.barcode_data).toBe("STF-20261020-0091");
      expect(label.printable_html).toContain("NCAMart Shipping Label");
      expect(label.printable_html).toContain("STF-20261020-0091");
    });
  });

  // --------------------------------------------------------------------------
  // 7. Dev Status Advancement Endpoint
  // --------------------------------------------------------------------------
  describe("7. Dev Consignment Status Progression", () => {
    it("advances mock consignment status and updates database shipment and events", async () => {
      const { order } = await createTestOrder({ fulfillmentChannel: "COURIER" });

      const adapter = new MockCourierAdapter();
      const booking = await adapter.createShipment({
        orderId: order.id,
        orderNumber: order.orderNumber,
        recipientName: "Customer",
        recipientPhone: "+8801700000000",
        recipientAddress: "Dhaka",
        expectedCodPaisa: order.codAmountPaisa,
        weightGrams: 500,
      });

      const shipment = await logisticsRepo.createShipment({
        orderId: order.id,
        courier: "MOCK",
        status: "BOOKED",
        consignmentNo: booking.consignmentNo,
        weightGrams: 500,
        expectedCodPaisa: order.codAmountPaisa,
      });

      // Advance via service helper
      const advanced = await logisticsService.advanceMockConsignment(
        booking.consignmentNo,
        "OUT_FOR_DELIVERY"
      );
      expect(advanced.status).toBe("OUT_FOR_DELIVERY");

      const refreshed = (await logisticsRepo.getShipmentById(shipment.id))!;
      expect(refreshed.status).toBe("OUT_FOR_DELIVERY");

      // Advance to DELIVERED
      const delivered = await logisticsService.advanceMockConsignment(
        booking.consignmentNo,
        "DELIVERED"
      );
      expect(delivered.status).toBe("DELIVERED");
      expect(delivered.deliveredAt).toBeInstanceOf(Date);
      expect(delivered.collectedCodPaisa).toBe(order.codAmountPaisa);

      const events = await logisticsRepo.listEventsByShipmentId(shipment.id);
      expect(events.some((e) => e.normalizedStatus === "DELIVERED")).toBe(true);
    });
  });
});
