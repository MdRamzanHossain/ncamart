import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import { Actor } from "@/lib/http/route";
import { ForbiddenError } from "@/lib/errors";
import { env } from "@/lib/env";
import { getMemoryOutbox, clearMemoryOutboxForTesting } from "@/lib/outbox";
import { catalogService } from "@/modules/catalog";
import { inventoryService } from "@/modules/inventory";
import { sourcingService } from "@/modules/sourcing";
import { promotionsService } from "@/modules/promotions";
import { authService } from "@/modules/identity";
import { ordersService } from "@/modules/orders";
import { checkoutOrder } from "@/modules/orders/checkout";
import {
  paymentsService,
  generateSslcommerzSignature,
  verifySslcommerzSignature,
} from "../index";

const superAdminActor: Actor = {
  id: "01920000-0000-7000-8000-000000000001",
  type: "staff",
  roles: ["SUPER_ADMIN"],
};

const catalogManagerActor: Actor = {
  id: "01920000-0000-7000-8000-000000000010",
  type: "staff",
  roles: ["CATALOG_MANAGER"],
};

const customerSupportActor: Actor = {
  id: "01920000-0000-7000-8000-000000000002",
  type: "staff",
  roles: ["CUSTOMER_SUPPORT"],
};

const warehouseStaffActor: Actor = {
  id: "01920000-0000-7000-8000-000000000003",
  type: "staff",
  roles: ["WAREHOUSE_STAFF"],
};

const customerActor: Actor = {
  id: "01920000-0000-7000-8000-000000000101",
  type: "customer",
};

describe("P21 — SSLCommerz Payments (Session, IPN, Validation, Reconciliation)", () => {
  let categoryId: string;
  let regularProduct: Awaited<ReturnType<typeof catalogService.createProduct>>;
  let regularSku: Awaited<ReturnType<typeof catalogService.createSku>>;

  beforeEach(async () => {
    catalogService.clearMemoryCatalogForTesting();
    inventoryService.clearMemoryForTesting();
    sourcingService.clearMemoryForTesting();
    promotionsService.clearMemoryForTesting();
    ordersService.clearMemoryForTesting();
    authService.clearMemoryAuthForTesting();
    paymentsService.clearMemoryForTesting();
    clearMemoryOutboxForTesting();

    // 1. Create Category & SKU
    const category = await catalogService.createCategory({
      slug: "power-cables",
      nameEn: "Power Cables",
      nameBn: "পাওয়ার কেবল",
      level: 1,
    });
    categoryId = category.id;

    regularProduct = await catalogService.createProduct(
      {
        slug: "baseus-65w-cable",
        titleEn: "Baseus 65W Cable",
        titleBn: "বেসিউস ৬৫ ওয়াট কেবল",
        categoryId,
        productTier: "AUTHENTIC",
        fulfillmentType: "DROP_AND_PACK",
        vatRateBp: 750,
      },
      superAdminActor
    );

    regularSku = await catalogService.createSku(
      {
        productId: regularProduct.id,
        skuCode: "BAS-65W-CBL",
        pricePaisa: 100000, // ৳1,000
        baseCostPaisa: 70000,
        weightGrams: 100,
        warrantyType: "OFFICIAL_DISTRIBUTOR",
        warrantyDays: 365,
      },
      superAdminActor
    );
    catalogService.setProductStatusForTesting(regularProduct.id, "PUBLISHED");

    // 2. Save Customer
    await authService.saveCustomer({
      id: customerActor.id,
      phone: "+8801711111111",
      fullName: "Tanvir Ahmed",
      email: "tanvir@example.com",
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

    // 3. Receive stock
    await inventoryService.receive(
      undefined,
      {
        skuId: regularSku.id,
        locationCode: "GODOWN_NAWABPUR",
        qty: 20,
        unitCostPaisa: 70000,
        refId: "PO-P21-TEST",
      },
      superAdminActor
    );
  });

  // Helper to create an ONLINE_FULL order
  async function createOnlineOrder() {
    const res = await checkoutOrder(
      {
        order_type: "REGULAR_DROP_PACK",
        items: [{ sku_id: regularSku.id, quantity: 1 }],
        fulfillment_channel: "COURIER",
        shipping_address: {
          consignee_name: "Tanvir Ahmed",
          phone: "+8801711111111",
          district_id: "1", // Dhaka
          thana_id: "102", // Dhanmondi
          address_line: "Road 27, Dhanmondi",
        },
        payment_mode: "ONLINE_FULL",
      },
      customerActor
    );

    if (!("payment_redirect_url" in res)) {
      throw new Error("Expected payment_redirect_url in checkout response");
    }

    return res;
  }

  describe("1. Signature verification unit tests with known vectors", () => {
    const storePasswd = "test_store_secret";

    it("verifies known static vector deterministically", () => {
      const payload: Record<string, string> = {
        amount: "1000.00",
        currency: "BDT",
        status: "VALID",
        tran_id: "TXN-STATIC-001",
        val_id: "VAL-STATIC-001",
      };

      // Deterministic calculation:
      // store_passwd MD5 = md5("test_store_secret")
      const storePasswdMd5 = crypto.createHash("md5").update(storePasswd).digest("hex");
      // sorted keys: amount, currency, status, store_passwd, tran_id, val_id
      const queryString =
        `amount=1000.00&currency=BDT&status=VALID&store_passwd=${storePasswdMd5}&tran_id=TXN-STATIC-001&val_id=VAL-STATIC-001`;
      const expectedVerifySign = crypto.createHash("md5").update(queryString).digest("hex");
      const expectedVerifyKey = "amount,currency,status,tran_id,val_id";

      const signedPayload = {
        ...payload,
        verify_sign: expectedVerifySign,
        verify_key: expectedVerifyKey,
      };

      expect(verifySslcommerzSignature(signedPayload, storePasswd)).toBe(true);
    });

    it("generates and verifies signature round-trip", () => {
      const payload = {
        amount: "500.50",
        bank_tran_id: "BANK1234",
        card_type: "BKASH-bKash",
        currency: "BDT",
        status: "VALID",
        tran_id: "TXN-TEST-999",
        val_id: "VAL-TEST-999",
      };

      const sig = generateSslcommerzSignature(payload, storePasswd);
      expect(sig.verify_sign).toBeDefined();
      expect(sig.verify_key).toBeDefined();

      const fullPayload = { ...payload, ...sig };
      expect(verifySslcommerzSignature(fullPayload, storePasswd)).toBe(true);
    });

    it("rejects tampered amount or fields", () => {
      const payload = {
        amount: "1000.00",
        currency: "BDT",
        status: "VALID",
        tran_id: "TXN-TEST-123",
        val_id: "VAL-TEST-123",
      };

      const sig = generateSslcommerzSignature(payload, storePasswd);
      const tampered = { ...payload, ...sig, amount: "100.00" }; // tampered amount

      expect(verifySslcommerzSignature(tampered, storePasswd)).toBe(false);
    });

    it("rejects wrong store password, missing verify_sign, or missing verify_key", () => {
      const payload = {
        amount: "1000.00",
        currency: "BDT",
        tran_id: "TXN-TEST-123",
      };
      const sig = generateSslcommerzSignature(payload, storePasswd);

      // Wrong password
      expect(verifySslcommerzSignature({ ...payload, ...sig }, "wrong_secret")).toBe(false);

      // Missing verify_sign
      expect(verifySslcommerzSignature({ ...payload, verify_key: sig.verify_key }, storePasswd)).toBe(false);

      // Missing verify_key
      expect(verifySslcommerzSignature({ ...payload, verify_sign: sig.verify_sign }, storePasswd)).toBe(false);
    });

    it("IPN throws 400 ERR_INVALID_SIGNATURE_HASH on invalid signature", async () => {
      const badIpnPayload = {
        tran_id: "TXN-ANY",
        val_id: "VAL-ANY",
        amount: "100.00",
        verify_sign: "invalid_hash_signature",
        verify_key: "tran_id,val_id,amount",
      };

      await expect(paymentsService.handleIpn(badIpnPayload)).rejects.toThrow(
        expect.objectContaining({
          code: "ERR_INVALID_SIGNATURE_HASH",
          status: 400,
        })
      );
    });
  });

  describe("2. Concurrency: valid IPN confirms order once across concurrent IPN + success + reconciliation", () => {
    it("confirms order exactly once even when IPN, success redirect, and reconciliation run concurrently", async () => {
      const checkout = await createOnlineOrder();
      const tranId = checkout.tran_id;
      const amountTaka = (checkout.payable_paisa / 100).toFixed(2);

      // Verify initial state
      const initialOrder = await ordersService.getOrderByNumber(undefined, checkout.order_number);
      expect(initialOrder?.status).toBe("PENDING_PAYMENT");
      const initialTx = initialOrder?.transactions?.find((t) => t.tranId === tranId);
      expect(initialTx?.status).toBe("PENDING");

      // Prepare valid IPN payload
      const ipnData = {
        tran_id: tranId,
        val_id: `VAL_${tranId}`,
        amount: amountTaka,
        card_type: "BKASH-bKash",
        currency: "BDT",
        status: "VALID",
      };
      const sig = generateSslcommerzSignature(ipnData, env.SSLCOMMERZ_STORE_PASS);
      const validIpnPayload = { ...ipnData, ...sig };

      const validSuccessPayload = {
        tran_id: tranId,
        val_id: `VAL_${tranId}`,
        amount: amountTaka,
      };

      // Run IPN, Browser Success, and Reconciliation concurrently
      const [ipnRes, successRes, _reconcileCount] = await Promise.all([
        paymentsService.handleIpn(validIpnPayload),
        paymentsService.handleBrowserSuccess(validSuccessPayload),
        paymentsService.reconcilePendingPaymentsJob(),
      ]);

      expect(ipnRes.status).toBe("IPN_PROCESSED_SUCCESSFULLY");
      expect(successRes.orderNumber).toBe(checkout.order_number);

      // Check order state: progressed through confirmation to godown QC and PAID
      const updatedOrder = await ordersService.getOrderByNumber(undefined, checkout.order_number);
      expect(updatedOrder?.status).toBe("AT_GODOWN_QC");
      expect(updatedOrder?.paymentStatus).toBe("PAID");
      expect(updatedOrder?.paidTotalPaisa).toBe(checkout.payable_paisa);

      // Check transaction state
      const updatedTx = updatedOrder?.transactions?.find((t) => t.tranId === tranId);
      expect(updatedTx?.status).toBe("PAID");

      // Verify outbox contains exactly ONE payment.succeeded event for this transaction
      const outbox = getMemoryOutbox();
      const succeededEvents = outbox.filter(
        (m) => m.type === "payment.succeeded" && (m.payload as Record<string, unknown>).tranId === tranId
      );
      expect(succeededEvents).toHaveLength(1);

      // Duplicate IPN returns 200 without double-confirming
      const dupIpnRes = await paymentsService.handleIpn(validIpnPayload);
      expect(dupIpnRes.status).toBe("IPN_PROCESSED_SUCCESSFULLY");
      const succeededEventsAfterDup = outbox.filter(
        (m) => m.type === "payment.succeeded" && (m.payload as Record<string, unknown>).tranId === tranId
      );
      expect(succeededEventsAfterDup).toHaveLength(1);
    });
  });

  describe("3. Tampered amount is rejected", () => {
    it("marks transaction FAILED, emits Class A alert payment.tampered, and leaves order unconfirmed", async () => {
      const checkout = await createOnlineOrder();
      const tranId = checkout.tran_id;

      // Mock gateway returns tampered amount ৳50.00 instead of ৳1,080.00
      paymentsService.mockSetTamperedAmount("50.00");

      const ipnData = {
        tran_id: tranId,
        val_id: `VAL_${tranId}`,
        amount: "50.00",
        card_type: "BKASH-bKash",
        currency: "BDT",
        status: "VALID",
      };
      const sig = generateSslcommerzSignature(ipnData, env.SSLCOMMERZ_STORE_PASS);
      const ipnPayload = { ...ipnData, ...sig };

      const res = await paymentsService.handleIpn(ipnPayload);
      expect(res.status).toBe("VALIDATION_FAILED");

      // Transaction marked FAILED
      const order = await ordersService.getOrderByNumber(undefined, checkout.order_number);
      const tx = order?.transactions?.find((t) => t.tranId === tranId);
      expect(tx?.status).toBe("FAILED");

      // Order remains PENDING_PAYMENT
      expect(order?.status).toBe("PENDING_PAYMENT");

      // Class A internal alert emitted in outbox
      const outbox = getMemoryOutbox();
      const alert = outbox.find(
        (m) => m.type === "payment.tampered" && (m.payload as Record<string, unknown>).tranId === tranId
      );
      expect(alert).toBeDefined();
      expect(alert?.payload).toMatchObject({
        tranId,
        expectedPaisa: checkout.payable_paisa,
        actualPaisa: 5000,
      });
    });
  });

  describe("4. Risk hold path & Admin review", () => {
    it("risk_level=1 transitions to HOLD_REVIEW, support queue item emitted, staff can approve", async () => {
      const checkout = await createOnlineOrder();
      const tranId = checkout.tran_id;
      const amountTaka = (checkout.payable_paisa / 100).toFixed(2);

      // Gateway reports high risk
      paymentsService.mockSetRiskLevel(1, "High Risk Suspicious IP");

      const ipnData = {
        tran_id: tranId,
        val_id: `VAL_${tranId}`,
        amount: amountTaka,
        card_type: "BKASH-bKash",
        currency: "BDT",
        status: "VALID",
      };
      const sig = generateSslcommerzSignature(ipnData, env.SSLCOMMERZ_STORE_PASS);
      const ipnPayload = { ...ipnData, ...sig };

      const res = await paymentsService.handleIpn(ipnPayload);
      expect(res.status).toBe("HOLD_REVIEW");

      // Order remains PENDING_PAYMENT and NOT confirmed
      const order = await ordersService.getOrderByNumber(undefined, checkout.order_number);
      expect(order?.status).toBe("PENDING_PAYMENT");
      const tx = order?.transactions?.find((t) => t.tranId === tranId);
      expect(tx?.status).toBe("HOLD_REVIEW");

      // Support queue item emitted
      const outbox = getMemoryOutbox();
      const holdItem = outbox.find(
        (m) => m.type === "support.payment_held_review" && (m.payload as Record<string, unknown>).tranId === tranId
      );
      expect(holdItem).toBeDefined();

      // Unauthorized staff (WAREHOUSE_STAFF) or customer cannot review
      await expect(
        paymentsService.adminReviewPayment(tranId, "APPROVE", customerActor, "Approve please")
      ).rejects.toThrow(ForbiddenError);

      await expect(
        paymentsService.adminReviewPayment(tranId, "APPROVE", warehouseStaffActor, "Warehouse approval")
      ).rejects.toThrow(ForbiddenError);

      // Authorized staff (CUSTOMER_SUPPORT) approves review
      const reviewRes = await paymentsService.adminReviewPayment(
        tranId,
        "APPROVE",
        customerSupportActor,
        "Verified customer identity over phone call"
      );
      expect(reviewRes.status).toBe("PAID");
      expect(reviewRes.decision).toBe("APPROVE");

      // Order is now confirmed and paid
      const confirmedOrder = await ordersService.getOrderByNumber(undefined, checkout.order_number);
      expect(confirmedOrder?.status).toBe("AT_GODOWN_QC");
      expect(confirmedOrder?.paymentStatus).toBe("PAID");
    });

    it("staff can reject HOLD_REVIEW payment which emits refund.requested", async () => {
      const checkout = await createOnlineOrder();
      const tranId = checkout.tran_id;
      const amountTaka = (checkout.payable_paisa / 100).toFixed(2);

      paymentsService.mockSetRiskLevel(1, "Stolen Card Detected");

      const ipnData = {
        tran_id: tranId,
        val_id: `VAL_${tranId}`,
        amount: amountTaka,
        card_type: "BKASH-bKash",
        currency: "BDT",
        status: "VALID",
      };
      const sig = generateSslcommerzSignature(ipnData, env.SSLCOMMERZ_STORE_PASS);
      const ipnPayload = { ...ipnData, ...sig };

      await paymentsService.handleIpn(ipnPayload);

      // SUPER_ADMIN rejects review
      const reviewRes = await paymentsService.adminReviewPayment(
        tranId,
        "REJECT",
        superAdminActor,
        "Confirmed stolen credit card"
      );
      expect(reviewRes.status).toBe("FAILED");
      expect(reviewRes.decision).toBe("REJECT");

      const order = await ordersService.getOrderByNumber(undefined, checkout.order_number);
      const tx = order?.transactions?.find((t) => t.tranId === tranId);
      expect(tx?.status).toBe("FAILED");

      // Refund requested event emitted for P33
      const outbox = getMemoryOutbox();
      const refundEvent = outbox.find(
        (m) => m.type === "refund.requested" && (m.payload as Record<string, unknown>).tranId === tranId
      );
      expect(refundEvent).toBeDefined();
      expect(refundEvent?.payload).toMatchObject({
        tranId,
        reason: "HIGH_RISK_PAYMENT_REJECTED",
      });
    });
  });

  describe("5. Unpaid auto-cancel job releases reservations, coupon, store credit, and expires transactions", () => {
    it("cancels unpaid orders, releases reservations, coupon, and store credit", async () => {
      // 1. Issue store credit to customer
      await promotionsService.issueStoreCredit(undefined, {
        customerId: customerActor.id,
        amountPaisa: 20000, // ৳200
        reason: "REFUND_AS_CREDIT",
        withdrawable: true,
        actor: superAdminActor,
      });

      // 2. Create and activate coupon
      const coupon = await promotionsService.createCoupon(
        {
          code: "SAVE50",
          type: "PERCENT",
          value: 500, // 5%
          maxDiscountPaisa: 5000, // ৳50
          minOrderPaisa: 100000,
          startsAt: new Date(Date.now() - 3600 * 1000),
          endsAt: new Date(Date.now() + 30 * 86400 * 1000),
          perPhoneLimit: 1,
        },
        catalogManagerActor
      );
      await promotionsService.activateCoupon(coupon.id, superAdminActor);

      // Check balance before checkout
      const _initialStock = (await inventoryService.getSellableBalancesForSkus([regularSku.id]))[0]?.sellableOnHand;

      // 3. Checkout with coupon and store credit
      const checkout = await checkoutOrder(
        {
          order_type: "REGULAR_DROP_PACK",
          items: [{ sku_id: regularSku.id, quantity: 1 }],
          fulfillment_channel: "COURIER",
          shipping_address: {
            consignee_name: "Tanvir Ahmed",
            phone: "+8801711111111",
            district_id: "1",
            thana_id: "102",
            address_line: "Road 27, Dhanmondi",
          },
          payment_mode: "ONLINE_FULL",
          coupon_code: "SAVE50",
          store_credit_paisa: 20000,
        },
        customerActor
      );

      expect(checkout.status).toBe("PENDING_PAYMENT");
      const order = await ordersService.getOrderByNumber(undefined, checkout.order_number);
      expect(order?.couponId).toBe(coupon.id);
      expect(order?.storeCreditAppliedPaisa).toBe(20000);

      // Active reservation exists
      const reservations = await inventoryService.getActiveReservationsForOrder(order!.id);
      expect(reservations).toHaveLength(1);

      // Run auto-cancel job with hours = 0 (orders created up to current time)
      const cancelledCount = await ordersService.autoCancelUnpaidOrdersJob(0);
      expect(cancelledCount).toBeGreaterThanOrEqual(1);

      // 4. Verify order is CANCELLED
      const cancelledOrder = await ordersService.getOrderByNumber(undefined, checkout.order_number);
      expect(cancelledOrder?.status).toBe("CANCELLED");

      // 5. Verify physical reservations are released
      const remainingReservations = await inventoryService.getActiveReservationsForOrder(order!.id);
      expect(remainingReservations).toHaveLength(0);

      // 6. Verify store credit is restored
      const scBalance = await promotionsService.getStoreCreditBalance(undefined, customerActor.id);
      expect(scBalance.totalBalancePaisa).toBe(20000);

      // 7. Verify coupon redemption is released (outbox event emitted and can be reserved again)
      const outbox = getMemoryOutbox();
      const couponReleased = outbox.find(
        (m) => m.type === "promotions.coupon_released" && (m.payload as Record<string, unknown>).orderId === order!.id
      );
      expect(couponReleased).toBeDefined();

      const reReserved = await promotionsService.reserveCoupon(undefined, {
        couponId: coupon.id,
        orderId: "ORD-NEW-TEST-2",
        phone: "+8801711111111",
        discountPaisa: 5000,
      });
      expect(reReserved.status).toBe("RESERVED");

      // 8. Verify open payment transaction is EXPIRED
      const tranId = "tran_id" in checkout ? checkout.tran_id : "";
      const tx = cancelledOrder?.transactions?.find((t) => t.tranId === tranId);
      expect(tx?.status).toBe("EXPIRED");

      // 9. Verify order.cancelled event emitted in outbox
      const cancelEvent = getMemoryOutbox().find(
        (m) => m.type === "order.cancelled" && (m.payload as Record<string, unknown>).orderId === order!.id
      );
      expect(cancelEvent).toBeDefined();
    });
  });
});
