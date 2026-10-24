import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import { Actor } from "@/lib/http/route";
import { ForbiddenError, BadRequestError } from "@/lib/errors";
import { env } from "@/lib/env";
import { getMemoryOutbox, clearMemoryOutboxForTesting } from "@/lib/outbox";
import { catalogService } from "@/modules/catalog";
import { inventoryService } from "@/modules/inventory";
import { sourcingService } from "@/modules/sourcing";
import { promotionsService } from "@/modules/promotions";
import { authService } from "@/modules/identity";
import { ordersService } from "@/modules/orders";
import { ordersRepo } from "@/modules/orders/repo";
import { checkoutOrder } from "@/modules/orders/checkout";
import { ledgerService } from "@/modules/ledger";
import { clearMemoryLedgerForTesting } from "@/modules/ledger/repo";
import { clearMemoryRateLimitsForTesting } from "@/lib/ratelimit";
import {
  paymentsService,
  refundsService,
  refundsRepo,
  clearMemoryRefundsForTesting,
  generateSslcommerzSignature,
  getSslcommerzClient,
  MockSslcommerzClient,
  setSslcommerzClient,
  REFUND_EVENTS,
} from "../index";

const superAdminActor: Actor = {
  id: "01920000-0000-7000-8000-000000000001",
  type: "staff",
  roles: ["SUPER_ADMIN"],
};

const financeActor: Actor = {
  id: "01920000-0000-7000-8000-000000000004",
  type: "staff",
  roles: ["FINANCE_OFFICER"],
};

const supportActor: Actor = {
  id: "01920000-0000-7000-8000-000000000002",
  type: "staff",
  roles: ["CUSTOMER_SUPPORT"],
};

const systemActor: Actor = {
  id: "00000000-0000-0000-0000-000000000000",
  type: "system",
};

const customerActor: Actor = {
  id: "01920000-0000-7000-8000-000000000101",
  type: "customer",
};

const otherCustomerActor: Actor = {
  id: "01920000-0000-7000-8000-000000000102",
  type: "customer",
};

describe("P33 — Refunds (Approval Limits, Gateway/Manual Execution, Store Credit)", () => {
  let categoryId: string;
  let smallSku: any; // ৳1,000
  let mediumSku: any; // ৳20,000
  let largeSku: any; // ৳25,000
  let mockSslClient: MockSslcommerzClient;

  beforeEach(async () => {
    clearMemoryRateLimitsForTesting();
    catalogService.clearMemoryCatalogForTesting();
    inventoryService.clearMemoryForTesting();
    sourcingService.clearMemoryForTesting();
    promotionsService.clearMemoryForTesting();
    ordersService.clearMemoryForTesting();
    authService.clearMemoryAuthForTesting();
    paymentsService.clearMemoryForTesting();
    clearMemoryRefundsForTesting();
    clearMemoryLedgerForTesting();
    clearMemoryOutboxForTesting();

    mockSslClient = new MockSslcommerzClient();
    setSslcommerzClient(mockSslClient);

    // 1. Create Category
    const category = await catalogService.createCategory({
      slug: "refund-testing-cat",
      nameEn: "Refund Testing",
      nameBn: "রিফান্ড টেস্টিং",
      level: 1,
    });
    categoryId = category.id;

    // 2. Create Product
    const product = await catalogService.createProduct(
      {
        slug: "refund-test-product",
        titleEn: "Refund Test Product",
        titleBn: "রিফান্ড টেস্ট প্রোডাক্ট",
        categoryId,
        productTier: "AUTHENTIC",
        fulfillmentType: "DROP_AND_PACK",
        vatRateBp: 750, // 7.5%
      },
      superAdminActor
    );

    // SKU 1: ৳1,000 (100,000 paisa) - at Support approval limit
    smallSku = await catalogService.createSku(
      {
        productId: product.id,
        skuCode: "SKU-1000",
        pricePaisa: 100000,
        baseCostPaisa: 60000,
        weightGrams: 100,
        warrantyType: "NONE",
        warrantyDays: 0,
      },
      superAdminActor
    );

    // SKU 2: ৳20,000 (2,000,000 paisa) - at Finance approval limit
    mediumSku = await catalogService.createSku(
      {
        productId: product.id,
        skuCode: "SKU-20000",
        pricePaisa: 2000000,
        baseCostPaisa: 1200000,
        weightGrams: 500,
        warrantyType: "OFFICIAL_DISTRIBUTOR",
        warrantyDays: 365,
      },
      superAdminActor
    );

    // SKU 3: ৳25,000 (2,500,000 paisa) - requires Super Admin
    largeSku = await catalogService.createSku(
      {
        productId: product.id,
        skuCode: "SKU-25000",
        pricePaisa: 2500000,
        baseCostPaisa: 1500000,
        weightGrams: 1000,
        warrantyType: "OFFICIAL_DISTRIBUTOR",
        warrantyDays: 365,
      },
      superAdminActor
    );

    catalogService.setProductStatusForTesting(product.id, "PUBLISHED");

    // Stock up inventory
    for (const sku of [smallSku, mediumSku, largeSku]) {
      await inventoryService.receive(
        undefined,
        {
          skuId: sku.id,
          locationCode: "GODOWN_NAWABPUR",
          qty: 50,
          unitCostPaisa: sku.baseCostPaisa,
          refId: "PO-REFUND-INIT",
        },
        superAdminActor
      );
    }

    // Customer
    await authService.saveCustomer({
      id: customerActor.id,
      phone: "+8801711111111",
      fullName: "Refund Customer",
      email: "refund@example.com",
      emailVerified: true,
      preferredLocale: "en",
      marketingOptIn: false,
      status: "ACTIVE",
      deliveredOrderCount: 1,
      rtoCount12m: 0,
      codBlocked: false,
      codBlockReason: null,
      codBlockLiftedBy: null,
      marketingOptInAt: null,
      lastActiveAt: new Date(),
      previousCustomerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  // Helper: Create paid online order
  async function createPaidOnlineOrder(skuId: string, quantity = 1) {
    const checkout = await checkoutOrder(
      {
        order_type: "REGULAR_DROP_PACK",
        items: [{ sku_id: skuId, quantity }],
        fulfillment_channel: "COURIER",
        shipping_address: {
          consignee_name: "Refund Customer",
          phone: "+8801711111111",
          district_id: "1",
          thana_id: "102",
          address_line: "Test Road 10",
        },
        payment_mode: "ONLINE_FULL",
      },
      customerActor
    );

    if (!("payment_redirect_url" in checkout)) {
      throw new Error("Checkout failed to return redirect url");
    }

    const tranId = checkout.tran_id;
    const amountTaka = (checkout.payable_paisa / 100).toFixed(2);

    const ipnData = {
      tran_id: tranId,
      val_id: `VAL_${tranId}`,
      amount: amountTaka,
      card_type: "BKASH-bKash",
      currency: "BDT",
      status: "VALID",
    };
    const sig = generateSslcommerzSignature(ipnData, env.SSLCOMMERZ_STORE_PASS);
    await paymentsService.handleIpn({ ...ipnData, ...sig });

    const order = await ordersRepo.getOrderByNumber(undefined, checkout.order_number);
    if (order && order.deliveryFeePaisa) {
      const fullOrder = await ordersRepo.getOrderWithDetails(undefined, order.id);
      const items = fullOrder?.items || [];
      const itemsSubtotal = items.reduce(
        (s, it) => s + (it.lineTotalPaisa || it.unitPricePaisa * it.qty),
        0
      );
      await ordersRepo.updateOrder(undefined, order.id, {
        deliveryFeePaisa: 0,
        paidTotalPaisa: itemsSubtotal,
        totalPayablePaisa: itemsSubtotal,
      });
      return (await ordersRepo.getOrderById(undefined, order.id))!;
    }
    return order!;
  }

  // --------------------------------------------------------------------------
  // 1. Approval Limit Boundaries
  // --------------------------------------------------------------------------
  describe("1. Approval limit boundaries (PRD §3.14.2 & Flow 13)", () => {
    it("Support approves ≤ ৳1,000 successfully; rejects ৳1,000.01", async () => {
      // Create order with 1 item of smallSku (৳1,000)
      const order = await createPaidOnlineOrder(smallSku.id, 1);

      // Support requests refund with manual/bKash method
      const refund = await refundsService.requestRefund(supportActor, {
        order_id: order.id,
        reason: "CUSTOMER_CANCELLATION",
        method: "BKASH",
        notes: "Support requested refund",
      });

      expect(refund.status).toBe("REQUESTED");
      expect(refund.amountPaisa).toBe(100000); // ৳1,000

      // Support approves ৳1,000 -> OK!
      const approved = await refundsService.approveRefund(supportActor, refund.id);
      expect(approved.status).toBe("APPROVED");
      expect(approved.approvedBy).toBe(supportActor.id);
      expect(approved.dueBy).not.toBeNull();

      // Now create an order where amount is ৳1,000.01 (100,001 paisa)
      const orderOver = await createPaidOnlineOrder(smallSku.id, 1);
      // Manually set 100,001 paisa on line item to test boundary
      const fullOrderOver = await ordersRepo.getOrderWithDetails(undefined, orderOver.id);
      const items = fullOrderOver?.items || [];
      await ordersRepo.updateOrder(undefined, orderOver.id, { paidTotalPaisa: 100001 });

      const refundOver = await refundsRepo.createRefund({
        refundNumber: "REF-2026-99001",
        orderId: orderOver.id,
        orderItemIds: items.length > 0 ? [items[0].id] : [],
        paymentTranId: null,
        amountPaisa: 100001, // ৳1,000.01
        reason: "CUSTOMER_CANCELLATION",
        method: "BKASH",
        status: "REQUESTED",
        isBeforeDelivery: true,
        requestedByType: "STAFF",
        requestedById: supportActor.id,
        approvedBy: null,
        approvedAt: null,
        dueBy: null,
        payoutAccount: null,
      });

      // Support attempts to approve ৳1,000.01 -> ForbiddenError
      await expect(
        refundsService.approveRefund(supportActor, refundOver.id)
      ).rejects.toThrow(ForbiddenError);
    });

    it("Finance approves ≤ ৳20,000 successfully; rejects ৳20,000.01", async () => {
      const orderMedium = await createPaidOnlineOrder(mediumSku.id, 1);

      const refund = await refundsService.requestRefund(financeActor, {
        order_id: orderMedium.id,
        reason: "STOCKOUT",
        method: "BKASH",
        notes: "Finance refund request",
      });

      expect(refund.amountPaisa).toBe(2000000); // ৳20,000

      // Finance approves ৳20,000 -> OK!
      const approved = await refundsService.approveRefund(financeActor, refund.id);
      expect(approved.status).toBe("APPROVED");
      expect(approved.approvedBy).toBe(financeActor.id);

      // Now create an order where amount is ৳20,000.01 (2,000,001 paisa)
      const refundOver = await refundsRepo.createRefund({
        refundNumber: "REF-2026-99002",
        orderId: orderMedium.id,
        orderItemIds: [],
        paymentTranId: null,
        amountPaisa: 2000001, // ৳20,000.01
        reason: "STOCKOUT",
        method: "BKASH",
        status: "REQUESTED",
        isBeforeDelivery: true,
        requestedByType: "STAFF",
        requestedById: financeActor.id,
        approvedBy: null,
        approvedAt: null,
        dueBy: null,
        payoutAccount: null,
      });

      // Finance attempts to approve ৳20,000.01 -> ForbiddenError
      await expect(
        refundsService.approveRefund(financeActor, refundOver.id)
      ).rejects.toThrow(ForbiddenError);

      // Super Admin can approve ৳20,000.01 -> OK!
      const adminApproved = await refundsService.approveRefund(superAdminActor, refundOver.id);
      expect(adminApproved.status).toBe("APPROVED");
      expect(adminApproved.approvedBy).toBe(superAdminActor.id);
    });

    it("Super Admin can approve any amount exceeding ৳20,000", async () => {
      const orderLarge = await createPaidOnlineOrder(largeSku.id, 1);

      const refund = await refundsService.requestRefund(superAdminActor, {
        order_id: orderLarge.id,
        reason: "PREORDER_IMPORT_FAILED",
        method: "BKASH",
      });

      expect(refund.amountPaisa).toBe(2500000); // ৳25,000

      // Support & Finance both rejected
      await expect(refundsService.approveRefund(supportActor, refund.id)).rejects.toThrow(ForbiddenError);
      await expect(refundsService.approveRefund(financeActor, refund.id)).rejects.toThrow(ForbiddenError);

      // Super Admin approves
      const approved = await refundsService.approveRefund(superAdminActor, refund.id);
      expect(approved.status).toBe("APPROVED");
      expect(approved.approvedBy).toBe(superAdminActor.id);
    });

    it("Rejection with reason records event and emits outbox", async () => {
      const order = await createPaidOnlineOrder(smallSku.id, 1);
      const refund = await refundsService.requestRefund(supportActor, {
        order_id: order.id,
        reason: "CUSTOMER_CANCELLATION",
      });

      const rejected = await refundsService.rejectRefund(supportActor, refund.id, {
        reason: "Order already shipped via courier",
        notes: "Consignment tracking active",
      });

      expect(rejected.status).toBe("REJECTED");

      const events = await refundsRepo.listRefundEvents(refund.id);
      const rejectEvent = events.find((e) => e.toStatus === "REJECTED");
      expect(rejectEvent).toBeDefined();
      expect(rejectEvent?.notes).toContain("Order already shipped via courier");

      const outbox = getMemoryOutbox();
      const rejectMsg = outbox.find(
        (m) => m.type === REFUND_EVENTS.REJECTED && m.aggregateId === refund.id
      );
      expect(rejectMsg).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Server-side Amount Calculation & Cap at paid_total
  // --------------------------------------------------------------------------
  describe("2. Server-side computation and paid_total cap", () => {
    it("Computes refundable amount via pricing engine and caps total refunds at paid_total", async () => {
      const order = await createPaidOnlineOrder(smallSku.id, 1);
      const paidTotal = order.paidTotalPaisa;

      // 1st refund request for full order
      const refund1 = await refundsService.requestRefund(supportActor, {
        order_id: order.id,
        reason: "CUSTOMER_CANCELLATION",
      });
      expect(refund1.amountPaisa).toBe(paidTotal);

      // Approve and execute refund 1
      await refundsService.approveRefund(supportActor, refund1.id);
      await refundsService.executeManualPayout(financeActor, {
        refund_id: refund1.id,
        method: "BKASH",
        external_ref: "BKASH_TRAN_1001",
      });

      // 2nd refund request when paidTotal is exhausted throws BadRequestError
      await expect(
        refundsService.requestRefund(supportActor, {
          order_id: order.id,
          reason: "CUSTOMER_CANCELLATION",
        })
      ).rejects.toThrow(BadRequestError);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Gateway Refund Mock Success & Failure
  // --------------------------------------------------------------------------
  describe("3. Gateway refund via SSLCommerz API", () => {
    it("Gateway refund initiation and status polling completes successfully", async () => {
      const order = await createPaidOnlineOrder(smallSku.id, 1);

      // Request refund (auto detects GATEWAY method due to online payment)
      const refund = await refundsService.requestRefund(supportActor, {
        order_id: order.id,
        reason: "CUSTOMER_CANCELLATION",
      });
      expect(refund.method).toBe("GATEWAY");

      // Approve -> automatically initiates gateway refund
      // Configure mock client to return processing status initially
      mockSslClient.nextRefundStatus = "processing";
      const approved = await refundsService.approveRefund(supportActor, refund.id);
      expect(approved.status).toBe("PROCESSING");
      expect(approved.gatewayRefundRef).toBeTruthy();

      // Poll status: mock client transitions to success
      mockSslClient.nextRefundStatus = "success";
      const completed = await refundsService.pollGatewayRefundStatus(
        supportActor,
        approved.id
      );
      expect(completed.status).toBe("COMPLETED");

      // Order payment_status should be recomputed to REFUNDED
      const updatedOrder = await ordersRepo.getOrderByNumber(undefined, order.orderNumber);
      expect(updatedOrder?.paymentStatus).toBe("REFUNDED");
      expect(updatedOrder?.refundedTotalPaisa).toBe(refund.amountPaisa);
    });

    it("Gateway refund failure is handled and recorded properly", async () => {
      const order = await createPaidOnlineOrder(smallSku.id, 1);

      // Tell mock client to simulate refund failure
      mockSslClient.simulateRefundFailure = true;

      const refund = await refundsService.requestRefund(supportActor, {
        order_id: order.id,
        reason: "CUSTOMER_CANCELLATION",
      });

      // Approve -> tries initiateGatewayRefund, catches failure and marks FAILED
      const approved = await refundsService.approveRefund(supportActor, refund.id);
      expect(approved.status).toBe("FAILED");

      const events = await refundsRepo.listRefundEvents(refund.id);
      const failEvent = events.find((e) => e.toStatus === "FAILED");
      expect(failEvent).toBeDefined();

      const outbox = getMemoryOutbox();
      const failMsg = outbox.find(
        (m) => m.type === REFUND_EVENTS.FAILED && m.aggregateId === refund.id
      );
      expect(failMsg).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Double-Entry Ledger Postings: Before vs After Delivery
  // --------------------------------------------------------------------------
  describe("4. Double-entry ledger postings before vs after delivery", () => {
    it("REFUND_BEFORE_DELIVERY: Dr 2000 (Customer Advances) / Cr 1100 (Gateway)", async () => {
      const order = await createPaidOnlineOrder(smallSku.id, 1);

      const refund = await refundsService.requestRefund(supportActor, {
        order_id: order.id,
        reason: "CUSTOMER_CANCELLATION",
      });
      expect(refund.isBeforeDelivery).toBe(true);

      mockSslClient.nextRefundStatus = "success";
      await refundsService.approveRefund(supportActor, refund.id);

      // Verify ledger journal entries
      const journals = await ledgerService.listJournalEntries({
        sourceId: refund.id,
      });
      expect(journals.entries.length).toBeGreaterThanOrEqual(1);

      const refundJournal = journals.entries[0];
      expect(refundJournal.eventType).toBe("REFUND_BEFORE_DELIVERY");

      const debitLine = refundJournal.lines.find((l) => l.accountCode === "2000");
      const creditLine = refundJournal.lines.find((l) => l.accountCode === "1100");

      expect(debitLine).toBeDefined();
      expect(debitLine?.debitPaisa).toBe(refund.amountPaisa);
      expect(creditLine).toBeDefined();
      expect(creditLine?.creditPaisa).toBe(refund.amountPaisa);
    });

    it("REFUND_AFTER_DELIVERY: Dr 4040 (Sales Returns) + Dr 2100 (VAT) / Cr 1040 (bKash)", async () => {
      const order = await createPaidOnlineOrder(smallSku.id, 1);

      // Mark order delivered
      await ordersRepo.updateOrder(undefined, order.id, {
        status: "DELIVERED",
      });

      const refund = await refundsService.requestRefund(supportActor, {
        order_id: order.id,
        reason: "RMA_REFUND",
        method: "BKASH",
        payout_account: "01711223344",
      });
      expect(refund.isBeforeDelivery).toBe(false);

      await refundsService.approveRefund(supportActor, refund.id);

      // Execute manual payout by Finance
      await refundsService.executeManualPayout(financeActor, {
        refund_id: refund.id,
        method: "BKASH",
        external_ref: "BKASH_RMA_9988",
      });

      // Verify ledger journal entries
      const journals = await ledgerService.listJournalEntries({
        sourceId: refund.id,
      });
      const refundJournal = journals.entries.find((j) => j.eventType === "REFUND_AFTER_DELIVERY");
      expect(refundJournal).toBeDefined();

      const returnsLine = refundJournal?.lines.find((l) => l.accountCode === "4040");
      const vatLine = refundJournal?.lines.find((l) => l.accountCode === "2100");
      const payoutLine = refundJournal?.lines.find((l) => l.accountCode === "1040");

      expect(returnsLine).toBeDefined();
      expect(vatLine).toBeDefined();
      expect(payoutLine).toBeDefined();
      expect(payoutLine?.creditPaisa).toBe(refund.amountPaisa);

      const totalDebits = (returnsLine?.debitPaisa ?? 0) + (vatLine?.debitPaisa ?? 0);
      expect(totalDebits).toBe(refund.amountPaisa);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Store Credit Choice Path
  // --------------------------------------------------------------------------
  describe("5. Customer store credit choice path", () => {
    it("Customer elects store credit: withdrawable, never-expiring, and completes refund", async () => {
      const order = await createPaidOnlineOrder(smallSku.id, 1);

      const refund = await refundsService.requestRefund(supportActor, {
        order_id: order.id,
        reason: "CUSTOMER_CANCELLATION",
      });

      // Customer chooses store credit
      const updated = await refundsService.chooseStoreCredit(
        customerActor,
        order.orderNumber,
        refund.id,
        { notes: "Customer preferred instant store credit" }
      );

      expect(updated.status).toBe("COMPLETED");
      expect(updated.method).toBe("STORE_CREDIT");

      // Verify customer store credit account credited
      const balance = await promotionsService.getStoreCreditBalance(undefined, customerActor.id);
      expect(balance.withdrawableBalancePaisa).toBe(refund.amountPaisa);

      // Verify transactions in store credit
      const txs = await promotionsService.getCustomerCreditHistory(customerActor.id);
      expect(txs.length).toBeGreaterThanOrEqual(1);
      expect(txs[0].withdrawable).toBe(true);
      expect(txs[0].expiresAt).toBeNull();

      // Verify ledger entry posted against account 2020 (Store Credit)
      const journals = await ledgerService.listJournalEntries({
        sourceId: refund.id,
      });
      const creditJournal = journals.entries[0];
      const storeCreditLine = creditJournal.lines.find((l) => l.accountCode === "2020");
      expect(storeCreditLine).toBeDefined();
      expect(storeCreditLine?.creditPaisa).toBe(refund.amountPaisa);
    });

    it("Prevents non-owner customer from choosing store credit", async () => {
      const order = await createPaidOnlineOrder(smallSku.id, 1);
      const refund = await refundsService.requestRefund(supportActor, {
        order_id: order.id,
        reason: "CUSTOMER_CANCELLATION",
      });

      // Different customer attempts to choose credit
      await expect(
        refundsService.chooseStoreCredit(
          otherCustomerActor,
          order.orderNumber,
          refund.id
        )
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // --------------------------------------------------------------------------
  // 6. System Auto-Approval for Pre-Fulfillment Cancellations
  // --------------------------------------------------------------------------
  describe("6. System auto-approval for full pre-fulfillment cancellations", () => {
    it("Auto-approves system-generated full cancellation and sets 7 working days SLA due_by", async () => {
      const order = await createPaidOnlineOrder(smallSku.id, 1);

      const refund = await refundsService.requestRefund(systemActor, {
        order_id: order.id,
        reason: "STOCKOUT",
      });

      expect(refund.status).toBe("APPROVED");
      expect(refund.approvedBy).toBe("SYSTEM");
      expect(refund.approvedAt).not.toBeNull();
      expect(refund.dueBy).not.toBeNull();

      // Events should record SYSTEM auto-approval
      const events = await refundsRepo.listRefundEvents(refund.id);
      const approveEvent = events.find((e) => e.toStatus === "APPROVED");
      expect(approveEvent).toBeDefined();
      expect(approveEvent?.actorType).toBe("SYSTEM");
    });
  });

  // --------------------------------------------------------------------------
  // 7. Hourly SLA Monitor Job
  // --------------------------------------------------------------------------
  describe("7. SLA monitor hourly job", () => {
    it("Alerts Finance when approved refund is not initiated within 24h", async () => {
      const order = await createPaidOnlineOrder(smallSku.id, 1);

      // Create an approved refund approved 25 hours ago
      const past25h = new Date(Date.now() - 25 * 3600 * 1000);
      const refund = await refundsRepo.createRefund({
        refundNumber: "REF-2026-SLA01",
        orderId: order.id,
        orderItemIds: [],
        paymentTranId: null,
        amountPaisa: 100000,
        reason: "CUSTOMER_CANCELLATION",
        method: "BKASH",
        status: "APPROVED",
        isBeforeDelivery: true,
        requestedByType: "STAFF",
        requestedById: supportActor.id,
        approvedBy: supportActor.id,
        approvedAt: past25h,
        dueBy: new Date(Date.now() + 5 * 24 * 3600 * 1000),
        payoutAccount: null,
      });

      const res = await refundsService.runSlaMonitorJob();
      expect(res.alertedApprovedCount).toBeGreaterThanOrEqual(1);

      const outbox = getMemoryOutbox();
      const slaAlert = outbox.find(
        (m) => m.type === REFUND_EVENTS.SLA_ALERT && m.aggregateId === refund.id
      );
      expect(slaAlert).toBeDefined();
    });

    it("Escalates to Super Admin when open refund exceeds 7 working days due_by", async () => {
      const order = await createPaidOnlineOrder(smallSku.id, 1);

      // Create refund where dueBy expired yesterday
      const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
      const refund = await refundsRepo.createRefund({
        refundNumber: "REF-2026-SLA02",
        orderId: order.id,
        orderItemIds: [],
        paymentTranId: null,
        amountPaisa: 100000,
        reason: "CUSTOMER_CANCELLATION",
        method: "BKASH",
        status: "APPROVED",
        isBeforeDelivery: true,
        requestedByType: "STAFF",
        requestedById: supportActor.id,
        approvedBy: supportActor.id,
        approvedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
        dueBy: yesterday,
        payoutAccount: null,
      });

      const res = await refundsService.runSlaMonitorJob();
      expect(res.escalatedCount).toBeGreaterThanOrEqual(1);

      const outbox = getMemoryOutbox();
      const slaEscalation = outbox.find(
        (m) => m.type === REFUND_EVENTS.SLA_ESCALATION && m.aggregateId === refund.id
      );
      expect(slaEscalation).toBeDefined();
      expect(slaEscalation?.notificationClass).toBe("A");
    });
  });

  // --------------------------------------------------------------------------
  // 8. Admin Queue Listing & Payout Encryption
  // --------------------------------------------------------------------------
  describe("8. Admin listing and payout account encryption", () => {
    it("Encrypts payout account at rest and masks in queries", async () => {
      const order = await createPaidOnlineOrder(smallSku.id, 1);

      const refund = await refundsService.requestRefund(supportActor, {
        order_id: order.id,
        reason: "CUSTOMER_CANCELLATION",
        method: "BKASH",
        payout_account: "01711223344",
      });

      // Stored record should be encrypted
      const raw = await refundsRepo.getRefundById(refund.id);
      expect(raw?.payoutAccount).not.toBe("01711223344");
      expect(raw?.payoutAccount).toContain(":"); // iv:authTag:ciphertext

      // Listing masks the account number
      const list = await refundsService.listRefunds(financeActor);
      const item = list.items.find((r) => r.id === refund.id);
      expect(item?.payout_account_masked).toBe("***3344");

      // Detail view
      const detail = await refundsService.getRefundDetail(financeActor, refund.id);
      expect(detail.payout_account_masked).toBe("***3344");
    });
  });
});
