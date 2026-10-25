import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { Actor } from "@/lib/http/route";
import { authService, customerService } from "@/modules/identity";
import { catalogService } from "@/modules/catalog";
import { inventoryService } from "@/modules/inventory/service";
import { inventoryRepo } from "@/modules/inventory/repo";
import { ordersService } from "@/modules/orders/service";
import { ordersRepo } from "@/modules/orders/repo";
import { checkoutOrder } from "@/modules/orders/checkout";
import { sourcingService } from "@/modules/sourcing/service";
import { sourcingRepo } from "@/modules/sourcing/repo";
import { paymentsService } from "@/modules/payments/service";
import { generateSslcommerzSignature } from "@/modules/payments/signature";
import { trustService } from "@/modules/trust";
import { trustRepo } from "@/modules/trust/repo";
import { clearMemoryRateLimitsForTesting } from "@/lib/ratelimit";
import { logisticsService } from "@/modules/logistics/service";
import { logisticsRepo, clearMemoryLogisticsForTesting } from "@/modules/logistics/repo";
import { ledgerService } from "@/modules/ledger/service";
import { preorderService } from "@/modules/preorder/service";
import { preorderRepo } from "@/modules/preorder/repo";
import { rmaService } from "@/modules/rma/service";
import { rmaRepo } from "@/modules/rma/repo";
import { posService } from "@/modules/pos/service";
import { posRepo } from "@/modules/pos/repo";
import { clearMemoryOutboxForTesting } from "@/lib/outbox";
import { clearMemoryAuditChainForTesting } from "@/modules/audit";
import { clearMemoryCountersForTesting } from "@/db/counters";
import { GET as verifyGet } from "@/app/api/v1/verify/[sealId]/route";

const superAdmin: Actor = {
  id: "01920000-0000-7000-8000-000000000001",
  type: "staff",
  roles: ["SUPER_ADMIN"],
};

const supportActor: Actor = {
  id: "01920000-0000-7000-8000-000000000002",
  type: "staff",
  roles: ["CUSTOMER_SUPPORT", "CUSTOMER_SUPPORT_LEAD"],
};

const showroomStaff: Actor = {
  id: "01920000-0000-7000-8000-000000000003",
  type: "staff",
  roles: ["SHOWROOM_POS_STAFF", "SHOWROOM_MANAGER"],
};

const runnerActor: Actor = {
  id: "01920000-0000-7000-8000-000000000004",
  type: "staff",
  roles: ["FIELD_RUNNER"],
};

describe("P43 — E2E API Flows (with mock providers)", () => {
  beforeEach(async () => {
    inventoryRepo.clearMemoryForTesting();
    inventoryService.clearMemoryForTesting();
    ordersService.clearMemoryForTesting();
    catalogService.clearMemoryCatalogForTesting();
    sourcingService.clearMemoryForTesting();
    paymentsService.clearMemoryForTesting();
    trustService.clearMemoryForTesting();
    clearMemoryRateLimitsForTesting();
    clearMemoryLogisticsForTesting();
    ledgerService.clearMemoryForTesting();
    preorderService.clearMemoryForTesting();
    rmaService.clearMemoryForTesting();
    posRepo.clearMemoryForTesting();
    customerService.clearMemoryCustomerDataForTesting();
    authService.clearMemoryAuthForTesting();
    clearMemoryOutboxForTesting();
    clearMemoryAuditChainForTesting();
    clearMemoryCountersForTesting();

    await ledgerService.seedChartOfAccounts();
  });

  // Helper: setup catalog product and SKU
  async function setupProductAndSku(options?: {
    isPreorder?: boolean;
    pricePaisa?: number;
    baseCostPaisa?: number;
    fulfillmentType?: "DROP_AND_PACK" | "CROSS_DOCK" | "PRE_ORDER";
    stockInGodown?: number;
  }) {
    const isPreorder = options?.isPreorder ?? false;
    const fulfillmentType = options?.fulfillmentType ?? (isPreorder ? "PRE_ORDER" : "DROP_AND_PACK");
    const pricePaisa = options?.pricePaisa ?? 250000;
    const baseCostPaisa = options?.baseCostPaisa ?? 180000;

    const cat = await catalogService.createCategory(
      {
        slug: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nameEn: "Electronics",
        nameBn: "ইলেকট্রনিক্স",
        level: 1,
      },
      superAdmin
    );

    const brand = await catalogService.createBrand(
      {
        name: "Anker",
        slug: `anker-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        isAuthorizedDistribution: true,
      },
      superAdmin
    );

    const prod = await catalogService.createProduct(
      {
        slug: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        titleEn: "Anker 65W GaN Charger",
        titleBn: "অ্যাঙ্কার ৬৫ ওয়াট চার্জার",
        brandId: brand.id,
        categoryId: cat.id,
        productTier: "AUTHENTIC",
        fulfillmentType,
        isPreorder,
        specifications: {},
      },
      superAdmin
    );

    const sku = await catalogService.createSku(
      {
        productId: prod.id,
        skuCode: `ANK-65W-${Date.now()}`,
        nameEn: "Black Edition",
        nameBn: "কালো সংস্করণ",
        pricePaisa,
        baseCostPaisa,
        stockThreshold: 5,
        isActive: true,
        specs: {},
      },
      superAdmin
    );

    catalogService.setProductStatusForTesting(prod.id, "PUBLISHED");

    if (options?.stockInGodown && options.stockInGodown > 0) {
      await inventoryService.receive(
        undefined,
        {
          skuId: sku.id,
          locationCode: "GODOWN_NAWABPUR",
          qty: options.stockInGodown,
          unitCostPaisa: baseCostPaisa,
        },
        superAdmin
      );
    }

    return { category: cat, brand, product: prod, sku };
  }

  // Helper: create customer
  async function createCustomer(options?: {
    deliveredOrderCount?: number;
    rtoCount12m?: number;
    codBlocked?: boolean;
  }) {
    const customerId = crypto.randomUUID();
    const customerRecord = {
      id: customerId,
      phone: `+88017${Math.floor(10000000 + Math.random() * 90000000)}`,
      fullName: "E2E Test Buyer",
      email: `buyer-${Date.now()}@ncamart.com`,
      emailVerified: true,
      preferredLocale: "bn",
      marketingOptIn: false,
      status: "ACTIVE" as const,
      deliveredOrderCount: options?.deliveredOrderCount ?? 0,
      rtoCount12m: options?.rtoCount12m ?? 0,
      codBlocked: options?.codBlocked ?? false,
      codBlockReason: options?.codBlocked ? "AUTO_RTO" : null,
      codBlockLiftedBy: null,
      marketingOptInAt: null,
      lastActiveAt: new Date(),
      previousCustomerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await authService.saveCustomer(customerRecord);

    const actor: Actor = {
      id: customerId,
      type: "customer",
      roles: [],
    };

    return { customer: customerRecord, actor };
  }

  // ==========================================================================
  // Flow 1: Regular COD checkout for a repeat buyer -> sourcing -> QC -> seal -> pack -> courier -> delivered -> settlement -> trial balance check
  // ==========================================================================
  it("Flow 1: Regular COD checkout for a repeat buyer through full lifecycle to courier settlement & trial balance", async () => {
    const { sku } = await setupProductAndSku({ stockInGodown: 2 });
    const { actor: buyerActor } = await createCustomer({ deliveredOrderCount: 3 });

    // 1. Repeat buyer checkout with COD (0 advance fee required)
    const checkout = await checkoutOrder(
      {
        order_type: "REGULAR_DROP_PACK",
        items: [{ sku_id: sku.id, quantity: 1 }],
        fulfillment_channel: "COURIER",
        shipping_address: {
          consignee_name: "Repeat Buyer",
          phone: "+8801712345678",
          district_id: "1",
          thana_id: "101",
          address_line: "Road 12, Gulshan",
        },
        payment_mode: "COD",
      },
      buyerActor
    );

    expect(checkout.status).toBe("CONFIRMED");
    const orderNumber = checkout.order_number;
    const order = await ordersService.getOrderByNumber(undefined, orderNumber);
    expect(order).not.toBeNull();

    // 2. Sourcing: runner purchase float and task execution
    const supplier = await sourcingRepo.createSupplier({
      name: "Anker Nawabpur Hub",
      contactName: "Rahim Bhai",
      phone: "+8801700112233",
      marketLocation: "NAWABPUR_ROAD",
      stallNumber: "Stall 14",
      isPrimaryMarket: true,
      qualityRatingBp: 9800,
      leadTimeMinutes: 30,
    });

    const runnerTask = await sourcingRepo.createRunnerTask({
      taskNumber: `TSK-${Date.now()}`,
      taskType: "PURCHASE",
      runnerId: runnerActor.id,
      supplierId: supplier.id,
      skuId: sku.id,
      qty: 1,
      maxUnitPricePaisa: 200000,
      status: "DISPATCHED",
      orderId: order!.id,
    });

    await sourcingService.issueFloatSession(
      { runner_staff_id: runnerActor.id, issued_float_paisa: 300000 },
      superAdmin
    );

    const syncRes = await sourcingService.syncMutations(
      {
        mutations: [
          {
            client_mutation_id: `mut-flow1-${Date.now()}`,
            type: "PURCHASE",
            payload: {
              task_id: runnerTask.id,
              supplier_id: supplier.id,
              sku_id: sku.id,
              qty: 1,
              unit_cost_paisa: 180000,
              amount_paisa: 180000,
              payment_mode: "CASH",
              receipt_media_id: crypto.randomUUID(),
            },
            recorded_at: new Date().toISOString(),
          },
        ],
      },
      runnerActor
    );
    expect(syncRes.results[0].result).toBe("ok");

    // 3. QC & Seal: Mint and apply security seal
    const seal = await trustRepo.createSealRecord({
      sealId: `NCA-FLW1-${Date.now().toString().slice(-4)}`,
      skuId: sku.id,
      productTier: "AUTHENTIC",
      status: "APPLIED",
      technicianId: superAdmin.id,
      warrantyDays: 365,
    });
    expect(seal.status).toBe("APPLIED");

    // 4. Pack: Order packed and ready for dispatch
    const packOrder = await ordersRepo.updateOrder(undefined, order!.id, {
      status: "PACKED",
    });
    expect(packOrder.status).toBe("PACKED");

    // 5. Courier Handover: Create shipment and handover to courier
    await ordersRepo.updateOrder(undefined, order!.id, {
      status: "HANDED_TO_COURIER",
    });
    const shipment = await logisticsRepo.createShipment({
      orderId: order!.id,
      courier: "STEADFAST",
      direction: "FORWARD",
      consignmentNo: `STDF-${Date.now()}`,
      status: "IN_TRANSIT",
      weightGrams: 350,
      expectedCodPaisa: order!.codAmountPaisa,
    });

    // 6. Courier Delivered: Webhook event triggers DELIVERED
    await logisticsService.applyCourierEvent(
      {
        consignmentNo: shipment.consignmentNo!,
        rawStatus: "delivered",
        normalizedStatus: "DELIVERED",
        occurredAt: new Date(),
        payload: { cod_collected: order!.codAmountPaisa / 100 },
      },
      "steadfast"
    );

    const deliveredOrder = await ordersService.getOrder(undefined, order!.id);
    expect(deliveredOrder?.status).toBe("DELIVERED");

    // Post courier receivable ledger entry (Dr 1110 Courier COD / Cr 4000 Sales)
    await ledgerService.post(
      undefined,
      {
        eventType: "COURIER_DELIVERY_COLLECTED",
        sourceType: "SHIPMENT",
        sourceId: shipment.id,
        description: `COD collected by courier for order ${orderNumber}`,
        lines: [
          { accountCode: "1110", debitPaisa: order!.codAmountPaisa, creditPaisa: 0, subLedgerRef: "STEADFAST" },
          { accountCode: "4000", debitPaisa: 0, creditPaisa: order!.codAmountPaisa },
        ],
      },
      superAdmin
    );

    // 7. Settlement: Remittance settlement from courier to bank account
    await ledgerService.post(
      undefined,
      {
        eventType: "COURIER_SETTLEMENT_RECEIVED",
        sourceType: "COURIER_SETTLEMENT",
        sourceId: `SETTLE-${Date.now()}`,
        description: `Courier settlement remittance to City Bank`,
        lines: [
          { accountCode: "1030", debitPaisa: order!.codAmountPaisa, creditPaisa: 0 },
          { accountCode: "1110", debitPaisa: 0, creditPaisa: order!.codAmountPaisa, subLedgerRef: "STEADFAST" },
        ],
      },
      superAdmin
    );

    // 8. Trial Balance Check: Entire ledger is perfectly balanced
    const trialBalance = await ledgerService.getTrialBalance();
    expect(trialBalance.isBalanced).toBe(true);
    expect(trialBalance.totalDebitPaisa).toBe(trialBalance.totalCreditPaisa);
  });

  // ==========================================================================
  // Flow 2: First-time buyer advance fee (৳80) via SSLCommerz mock -> COD remainder
  // ==========================================================================
  it("Flow 2: First-time buyer advance fee (৳80) via SSLCommerz mock -> COD remainder", async () => {
    const { sku } = await setupProductAndSku({ stockInGodown: 5 });
    // First-time buyer with 0 delivered orders
    const { actor: firstTimeBuyer } = await createCustomer({ deliveredOrderCount: 0 });

    // 1. Checkout with COD requires ৳80 advance delivery fee
    const checkout = await checkoutOrder(
      {
        order_type: "REGULAR_DROP_PACK",
        items: [{ sku_id: sku.id, quantity: 1 }],
        fulfillment_channel: "COURIER",
        shipping_address: {
          consignee_name: "First Time Buyer",
          phone: "+8801799887766",
          district_id: "1", // Dhaka
          thana_id: "102",
          address_line: "Dhanmondi 27",
        },
        payment_mode: "COD",
      },
      firstTimeBuyer
    );

    expect(checkout.status).toBe("PENDING_PAYMENT");
    if (!("payable_paisa" in checkout)) {
      throw new Error("Expected payable_paisa in checkout response");
    }
    expect(checkout.payable_paisa).toBe(8000); // ৳80 advance delivery fee
    const tranId = checkout.tran_id;

    // 2. SSLCommerz IPN Mock Payment Callback
    const ipnData = {
      tran_id: tranId,
      val_id: `VAL_${tranId}`,
      amount: "80.00",
      card_type: "BKASH-bKash",
      currency: "BDT",
      status: "VALID",
    };
    const signedIpn = {
      ...ipnData,
      ...generateSslcommerzSignature(ipnData, env.SSLCOMMERZ_STORE_PASS),
    };

    const ipnRes = await paymentsService.handleIpn(signedIpn);
    expect(ipnRes.status).toBe("IPN_PROCESSED_SUCCESSFULLY");

    // 3. Verify order transitioned to CONFIRMED with COD remainder
    const confirmedOrder = await ordersService.getOrderByNumber(undefined, checkout.order_number);
    expect(confirmedOrder?.status).toBe("AT_GODOWN_QC");
    expect(confirmedOrder?.paidTotalPaisa).toBe(8000);
    expect(confirmedOrder?.codAmountPaisa).toBe(confirmedOrder!.totalPayablePaisa - 8000);

    // 4. Verify Double-Entry Ledger is Balanced
    const tb = await ledgerService.getTrialBalance();
    expect(tb.isBalanced).toBe(true);
  });

  // ==========================================================================
  // Flow 3: Pre-order deposit -> milestones -> QC -> balance online -> delivery; plus the Day-8 forfeiture variant
  // ==========================================================================
  it("Flow 3: Pre-order deposit -> milestones -> QC -> balance online -> delivery; plus Day-8 forfeiture variant", async () => {
    // 1. Setup pre-order product (20% deposit)
    const { sku: preSku } = await setupProductAndSku({
      isPreorder: true,
      pricePaisa: 500000, // ৳5,000
      baseCostPaisa: 350000,
    });
    const { actor: buyer } = await createCustomer({ deliveredOrderCount: 1 });

    const checkout = await checkoutOrder(
      {
        order_type: "PRE_ORDER",
        items: [{ sku_id: preSku.id, quantity: 1 }],
        fulfillment_channel: "COURIER",
        shipping_address: {
          consignee_name: "Preorder Buyer",
          phone: "+8801755443322",
          district_id: "1",
          thana_id: "101",
          address_line: "Uttara Sector 4",
        },
        payment_mode: "ONLINE_FULL",
      },
      buyer
    );

    expect(checkout.status).toBe("PENDING_PAYMENT");
    const depositTranId = (checkout as any).tran_id;
    const depositAmountTaka = ((checkout as any).payable_paisa / 100).toFixed(2);

    // Customer pays 20% deposit
    const depositIpn = {
      tran_id: depositTranId,
      val_id: `VAL_${depositTranId}`,
      amount: depositAmountTaka,
      card_type: "NAGAD-Nagad",
      currency: "BDT",
      status: "VALID",
    };
    await paymentsService.handleIpn({
      ...depositIpn,
      ...generateSslcommerzSignature(depositIpn, env.SSLCOMMERZ_STORE_PASS),
    });

    const preOrder = await ordersService.getOrderByNumber(undefined, checkout.order_number);
    expect(preOrder?.paymentStatus).toBe("PARTIALLY_PAID");

    // Preorder milestones progression: markSourced -> markArrived -> markQcVerified
    const milestone1 = await preorderService.markSourced(
      preOrder!.id,
      { notes: "Shipped from overseas vendor" },
      superAdmin
    );
    expect(milestone1.status).toBe("SOURCED_IN_TRANSIT");

    const milestone2 = await preorderService.markArrived(
      preOrder!.id,
      superAdmin
    );
    expect(milestone2.status).toBe("ARRIVED_GODOWN");

    // QC Verified triggers balance payment request with 7-day window and Day-8 forfeiture
    const qcAdvance = await preorderService.markQcVerified(
      preOrder!.id,
      superAdmin
    );
    expect(qcAdvance.status).toBe("QC_VERIFIED_BALANCE_DUE");
    expect(qcAdvance.forfeiture_date).toBeDefined();

    // VARIANT: Day-8 Forfeiture test
    // Simulate past Day 8 deadline for a forfeiture test order
    const forfOrder = await ordersRepo.createOrder(undefined, {
      order: {
        orderNumber: `ORD-FORFEIT-${Date.now()}`,
        customerId: buyer.id,
        orderType: "PRE_ORDER",
        channel: "ONLINE",
        status: "QC_VERIFIED_BALANCE_DUE",
        subtotalPaisa: 500000,
        totalPayablePaisa: 500000,
        paidTotalPaisa: 100000, // ৳1,000 deposit paid
        paymentStatus: "PARTIALLY_PAID",
      },
      items: [],
      preOrder: {
        depositPaisa: 100000,
        balancePaisa: 400000,
        status: "QC_VERIFIED_BALANCE_DUE",
        priceLockedPaisa: 500000,
        forfeitureDate: new Date(Date.now() - 1000), // Past Day 8
      },
    });

    await ledgerService.post(
      undefined,
      {
        eventType: "PREORDER_DEPOSIT_RECEIVED",
        sourceType: "PAYMENT_TRANSACTION",
        sourceId: `DEP-${forfOrder.id}`,
        description: `Deposit for preorder ${forfOrder.orderNumber}`,
        lines: [
          { accountCode: "1100", debitPaisa: 100000, creditPaisa: 0 },
          { accountCode: "2010", debitPaisa: 0, creditPaisa: 100000, subLedgerRef: forfOrder.id },
        ],
      },
      superAdmin
    );

    const forfeitedCount = await preorderService.runForfeitureJob(new Date());
    expect(forfeitedCount).toBeGreaterThanOrEqual(1);

    const forfOrderAfter = await ordersService.getOrder(undefined, forfOrder.id);
    expect(forfOrderAfter?.status).toBe("DEPOSIT_FORFEITED_CANCELLED");

    // Trial balance remains balanced after forfeiture
    const tb = await ledgerService.getTrialBalance();
    expect(tb.isBalanced).toBe(true);
  });

  // ==========================================================================
  // Flow 4: /verify lookup + rate limit + clone alert
  // ==========================================================================
  it("Flow 4: /verify lookup + rate limit + clone alert", async () => {
    const { sku } = await setupProductAndSku();
    const sealId = "NCA-4K9W-8M2P";
    const seal = await trustRepo.createSealRecord({
      sealId,
      skuId: sku.id,
      productTier: "AUTHENTIC",
      status: "ACTIVE",
      technicianId: superAdmin.id,
      warrantyDays: 365,
    });

    // 1. Valid lookup via /api/v1/verify/[sealId]
    const req1 = new NextRequest(`http://localhost:3000/api/v1/verify/${sealId}`, {
      method: "GET",
      headers: {
        "x-device-id": "did_e2e_device_test_01",
        "x-forwarded-for": "103.100.10.5",
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      },
    });

    const res1 = await verifyGet(req1, { params: Promise.resolve({ sealId }) });
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.is_valid).toBe(true);
    expect(body1.product_tier).toBe("AUTHENTIC");

    // 2. Rate Limit Enforcement: Rapid requests from same device ID
    const deviceId = "did_rapid_scraper_test";
    const requests = Array.from({ length: 6 }).map((_, idx) =>
      verifyGet(
        new NextRequest(`http://localhost:3000/api/v1/verify/${sealId}`, {
          method: "GET",
          headers: {
            "x-device-id": deviceId,
            "x-forwarded-for": "103.100.10.5",
            "user-agent": "Mozilla/5.0 ScraperBot",
          },
        }),
        { params: Promise.resolve({ sealId }) }
      )
    );

    const results = await Promise.all(requests);
    const has429 = results.some((r) => r.status === 429);
    expect(has429).toBe(true);

    // 3. Clone Alert: Scans of voided / duplicate seals trigger internal clone alert
    const voidSeal = await trustRepo.createSealRecord({
      sealId: "NCA-9VOID-TEST",
      skuId: sku.id,
      productTier: "AUTHENTIC",
      status: "VOID_PRINT_ERROR",
      technicianId: superAdmin.id,
      warrantyDays: 365,
    });

    const voidReq = new NextRequest(`http://localhost:3000/api/v1/verify/${voidSeal.sealId}`, {
      method: "GET",
      headers: {
        "x-device-id": "did_suspicious_device_99",
        "x-forwarded-for": "103.200.50.88",
        "user-agent": "Mozilla/5.0 CloneScanner",
      },
    });
    const voidRes = await verifyGet(voidReq, { params: Promise.resolve({ sealId: voidSeal.sealId }) });
    const voidBody = await voidRes.json();
    expect(voidBody.is_valid).toBe(false);
    expect(voidBody.message.toLowerCase()).toContain("invalid");
  });

  // ==========================================================================
  // Flow 5: RMA with video upload (multipart) -> adjudicate -> reverse pickup -> inspect -> refund
  // ==========================================================================
  it("Flow 5: RMA with video upload (multipart) -> adjudicate -> reverse pickup -> inspect -> refund", async () => {
    const { sku } = await setupProductAndSku();
    const { actor: buyer } = await createCustomer({ deliveredOrderCount: 1 });

    // 1. Delivered order with warranty
    const order = await ordersRepo.createOrder(undefined, {
      order: {
        orderNumber: `ORD-RMA-${Date.now()}`,
        customerId: buyer.id,
        orderType: "REGULAR",
        channel: "ONLINE",
        status: "DELIVERED",
        subtotalPaisa: 250000,
        totalPayablePaisa: 250000,
        paidTotalPaisa: 250000,
        paymentStatus: "PAID",
      },
      items: [
        {
          skuId: sku.id,
          skuCode: sku.skuCode,
          productTitleEn: "Anker 65W GaN Charger",
          quantity: 1,
          unitPricePaisa: 250000,
          lineTotalPaisa: 250000,
          vatPaisa: 0,
          unitCostPaisa: 180000,
          warrantyType: "OFFICIAL_DISTRIBUTOR",
          warrantyDays: 365,
        },
      ],
    });

    const seal = await trustRepo.createSealRecord({
      sealId: "NCA-9P2K-RMA1",
      skuId: sku.id,
      productTier: "AUTHENTIC",
      status: "ACTIVE",
      technicianId: superAdmin.id,
      warrantyDays: 365,
      orderItemUnitId: order.items![0].id,
    });

    // 2. Submit Claim with unboxing video
    const unboxingMediaId = crypto.randomUUID();
    const claimRes = await rmaService.submitClaim(
      buyer,
      {
        seal_id: seal.sealId,
        order_id: order.id,
        issue_description: "Device does not power on after unboxing",
        is_doa: true,
        claim_type: "DEAD_ON_ARRIVAL",
        unboxing_video_r2_key: `rma/videos/${unboxingMediaId}.mp4`,
      }
    );
    expect(claimRes.claim_number).toBeDefined();

    // 3. Adjudicate: Support Lead approves reverse pickup
    const adjudicated = await rmaService.adjudicateClaim(
      supportActor,
      claimRes.claim_number,
      {
        decision: "APPROVED_FOR_RETURN",
        notes: "Valid video evidence confirms DOA defect",
      }
    );
    expect(adjudicated.status).toBe("REVERSE_PICKUP");

    // 4. Reverse Pickup received at Nawabpur Godown
    const received = await rmaService.receiveClaimUnit(
      superAdmin,
      claimRes.claim_number,
      "Unit received at Nawabpur Godown"
    );
    expect(received.status).toBe("RECEIVED");

    // 5. Tech Inspection confirms hardware defect
    const inspected = await rmaService.inspectClaim(
      superAdmin,
      claimRes.claim_number,
      {
        verified_defect: true,
        seal_intact: true,
        resolution: "REFUND",
        notes: "No output voltage detected from ports",
      }
    );
    expect(inspected.status).toBe("RESOLVED");

    // 6. Close Claim with Refund
    const closed = await rmaService.closeClaim(
      supportActor,
      claimRes.claim_number,
      "Full refund issued to customer"
    );
    expect(closed.status).toBe("CLOSED");

    // Post refund ledger entry (Dr 4000 Sales / Cr 1030 Gateway)
    await ledgerService.post(
      undefined,
      {
        eventType: "CUSTOMER_REFUND_ISSUED",
        sourceType: "RMA_CLAIM",
        sourceId: closed.id,
        description: `Full refund for DOA claim ${closed.claimNumber}`,
        lines: [
          { accountCode: "4000", debitPaisa: 250000, creditPaisa: 0 },
          { accountCode: "1030", debitPaisa: 0, creditPaisa: 250000 },
        ],
      },
      superAdmin
    );

    const tb = await ledgerService.getTrialBalance();
    expect(tb.isBalanced).toBe(true);
  });

  // ==========================================================================
  // Flow 6: POS pickup with PIN + walk-in sale + drawer close
  // ==========================================================================
  it("Flow 6: POS pickup with PIN + walk-in sale + drawer close", async () => {
    const { sku } = await setupProductAndSku({ stockInGodown: 5 });
    const { actor: pickupBuyer } = await createCustomer({ deliveredOrderCount: 1 });

    // 1. Open Showroom Cash Drawer
    const drawer = await posService.openDrawer(
      showroomStaff.id,
      { opening_float_paisa: 500000, notes: "Morning shift Nawabpur Counter" },
      showroomStaff
    );
    expect(drawer.status).toBe("OPEN");

    // 2. POS Pickup Order with PIN
    const pickupOrder = await ordersRepo.createOrder(undefined, {
      order: {
        orderNumber: `ORD-POS-${Date.now()}`,
        customerId: pickupBuyer.id,
        orderType: "REGULAR",
        channel: "PICKUP",
        status: "READY_FOR_PICKUP",
        subtotalPaisa: 250000,
        totalPayablePaisa: 250000,
        paidTotalPaisa: 250000,
        paymentStatus: "PAID",
        addressSnapshot: {
          name: "Pickup Buyer",
          phone: "+8801712345678",
          addressLine: "Counter Pickup",
          district: "Dhaka",
          thana: "Nawabpur",
        },
      },
      items: [{ skuId: sku.id, skuCode: sku.skuCode, quantity: 1, unitPricePaisa: 250000, lineTotalPaisa: 250000, vatPaisa: 0 }],
    });

    await ledgerService.post(
      undefined,
      {
        eventType: "ONLINE_PAYMENT_COLLECTED",
        sourceType: "PAYMENT_TRANSACTION",
        sourceId: `TX-POS-${pickupOrder.id}`,
        description: `Prepaid online payment for pickup order ${pickupOrder.orderNumber}`,
        lines: [
          { accountCode: "1030", debitPaisa: 250000, creditPaisa: 0 },
          { accountCode: "2000", debitPaisa: 0, creditPaisa: 250000, subLedgerRef: pickupOrder.id },
        ],
      },
      superAdmin
    );

    const pickupPin = await posService.generatePickupPin(pickupOrder.id);
    expect(pickupPin.pin).toMatch(/^\d{6}$/);

    // Verify PIN and complete handover
    const verifyRes = await posService.verifyPickupPin(
      { order_number: pickupOrder.orderNumber, pickup_pin: pickupPin.pin },
      showroomStaff
    );
    expect(verifyRes.valid).toBe(true);

    const handoverRes = await posService.handoverPickup(
      {
        order_id: pickupOrder.id,
        customer_inspected_on_bench: true,
        signed_handover_slip: true,
      },
      showroomStaff
    );
    expect(handoverRes.status).toBe("DELIVERED_COUNTER");

    // 3. Walk-in Cash Sale
    await inventoryService.receive(
      undefined,
      {
        skuId: sku.id,
        locationCode: "SHOWROOM_COUNTER",
        qty: 5,
        unitCostPaisa: 180000,
      },
      superAdmin
    );

    const walkInSeal = await trustRepo.createSealRecord({
      sealId: `NCA-WLK1-${Date.now().toString().slice(-4)}`,
      skuId: sku.id,
      productTier: "AUTHENTIC",
      status: "ACTIVE",
      technicianId: superAdmin.id,
      warrantyDays: 365,
    });

    const walkInRes = await posService.executeWalkInSale(
      {
        customer_phone: "+8801799887766",
        customer_name: "Walk-in Buyer",
        items: [{ sku_id: sku.id, seal_id: walkInSeal.sealId, quantity: 1 }],
        payment_mode: "CASH",
        paid_amount_paisa: 300000,
      },
      showroomStaff
    );
    expect(walkInRes.success).toBe(true);
    const changePaisa = walkInRes.receipt.order.paid_paisa - walkInRes.receipt.order.total_paisa;
    expect(changePaisa).toBe(50000);
    expect(walkInRes.receipt.escpos_text).toContain("Change Returned:");
    expect(walkInRes.receipt.escpos_text).toContain("৳500.00");

    // 4. Shift End: Drawer Close
    const closedDrawer = await posService.closeDrawer(
      showroomStaff.id,
      {
        counted_cash_paisa: 750000, // ৳5,000 opening + ৳2,500 walk-in sale
        notes: "Count verified by supervisor",
      },
      showroomStaff
    );
    expect(closedDrawer.status).toBe("COUNTED");
    expect(closedDrawer.variancePaisa).toBe(0);

    const tb = await ledgerService.getTrialBalance();
    expect(tb.isBalanced).toBe(true);
  });

  // ==========================================================================
  // Flow 7: RTO flow -> COD block after the 2nd RTO
  // ==========================================================================
  it("Flow 7: RTO flow -> COD block after the 2nd RTO", async () => {
    const { sku } = await setupProductAndSku({ stockInGodown: 10 });
    const { customer, actor: buyer } = await createCustomer({
      deliveredOrderCount: 0,
      rtoCount12m: 0,
      codBlocked: false,
    });

    // Initial state: COD is not blocked
    expect(customer.codBlocked).toBe(false);

    // 1. First RTO Shipment
    const order1 = await ordersRepo.createOrder(undefined, {
      order: {
        orderNumber: `ORD-RTO-01-${Date.now()}`,
        customerId: customer.id,
        orderType: "REGULAR",
        channel: "COURIER",
        status: "HANDED_TO_COURIER",
        subtotalPaisa: 250000,
        totalPaisa: 250000,
        codAmountPaisa: 250000,
      },
      items: [{ skuId: sku.id, skuCode: sku.skuCode, quantity: 1, totalPaisa: 250000 }],
    });

    const ship1 = await logisticsRepo.createShipment({
      orderId: order1.id,
      courier: "STEADFAST",
      direction: "FORWARD",
      consignmentNo: `STDF-RTO-01-${Date.now()}`,
      status: "IN_TRANSIT",
      weightGrams: 350,
      expectedCodPaisa: 250000,
    });

    await logisticsService.applyCourierEvent(
      {
        consignmentNo: ship1.consignmentNo!,
        rawStatus: "return",
        normalizedStatus: "RTO_IN_TRANSIT",
        occurredAt: new Date(),
        payload: { reason: "Recipient refused delivery" },
      },
      "steadfast"
    );

    const custAfterRto1 = await authService.findCustomerById(customer.id);
    expect(custAfterRto1?.rtoCount12m).toBe(1);
    expect(custAfterRto1?.codBlocked).toBe(false); // 1st RTO does NOT block COD

    // 2. Second RTO Shipment
    const order2 = await ordersRepo.createOrder(undefined, {
      order: {
        orderNumber: `ORD-RTO-02-${Date.now()}`,
        customerId: customer.id,
        orderType: "REGULAR",
        channel: "COURIER",
        status: "HANDED_TO_COURIER",
        subtotalPaisa: 250000,
        totalPaisa: 250000,
        codAmountPaisa: 250000,
      },
      items: [{ skuId: sku.id, skuCode: sku.skuCode, quantity: 1, totalPaisa: 250000 }],
    });

    const ship2 = await logisticsRepo.createShipment({
      orderId: order2.id,
      courier: "STEADFAST",
      direction: "FORWARD",
      consignmentNo: `STDF-RTO-02-${Date.now()}`,
      status: "IN_TRANSIT",
      weightGrams: 350,
      expectedCodPaisa: 250000,
    });

    await logisticsService.applyCourierEvent(
      {
        consignmentNo: ship2.consignmentNo!,
        rawStatus: "return",
        normalizedStatus: "RTO_IN_TRANSIT",
        occurredAt: new Date(),
        payload: { reason: "Customer unreachable after 3 attempts" },
      },
      "steadfast"
    );

    // 2nd RTO triggers automatic COD block!
    const custAfterRto2 = await authService.findCustomerById(customer.id);
    expect(custAfterRto2?.rtoCount12m).toBe(2);
    expect(custAfterRto2?.codBlocked).toBe(true);
    expect(custAfterRto2?.codBlockReason).toBe("AUTO_RTO");

    // 3. Subsequent COD checkout attempt is blocked!
    await expect(
      checkoutOrder(
        {
          order_type: "REGULAR_DROP_PACK",
          items: [{ sku_id: sku.id, quantity: 1 }],
          fulfillment_channel: "COURIER",
          shipping_address: {
            consignee_name: "Blocked Customer",
            phone: customer.phone,
            district_id: "1",
            thana_id: "101",
            address_line: "Dhaka",
          },
          payment_mode: "COD",
        },
        buyer
      )
    ).rejects.toThrow();
  });
});
