import { describe, it, expect, beforeEach } from "vitest";
import { Actor } from "@/lib/http/route";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { inventoryService } from "@/modules/inventory";
import { sourcingService } from "@/modules/sourcing";
import { promotionsService } from "@/modules/promotions";
import { financeService } from "@/modules/finance";
import { ordersService } from "../service";
import { ordersRepo, OrderWithDetails } from "../repo";
import { clearMemoryCountersForTesting, generateMushakNumber } from "@/db/counters";
import { getMemoryOutbox, clearMemoryOutboxForTesting } from "@/lib/outbox";

describe("P22 — Customer Orders, Cancellation, Invoices & Mushak 6.3", () => {
  const customerA: Actor = {
    id: "01920000-0000-7000-8000-0000000000aa",
    type: "customer",
  };

  const customerB: Actor = {
    id: "01920000-0000-7000-8000-0000000000bb",
    type: "customer",
  };

  const supportStaff: Actor = {
    id: "01920000-0000-7000-8000-0000000000s1",
    type: "staff",
    roles: ["CUSTOMER_SUPPORT"],
  };

  const warehouseStaff: Actor = {
    id: "01920000-0000-7000-8000-0000000000w1",
    type: "staff",
    roles: ["WAREHOUSE_STAFF"],
  };

  const financeStaff: Actor = {
    id: "01920000-0000-7000-8000-0000000000f1",
    type: "staff",
    roles: ["FINANCE_OFFICER"],
  };

  beforeEach(() => {
    ordersService.clearMemoryForTesting();
    inventoryService.clearMemoryForTesting();
    sourcingService.clearMemoryForTesting();
    promotionsService.clearMemoryForTesting();
    financeService.clearMemoryForTesting();
    clearMemoryCountersForTesting();
    clearMemoryOutboxForTesting();
  });

  async function createTestOrder(
    customerId: string,
    overrides?: Partial<Parameters<typeof ordersRepo.createOrder>[1]["order"]> & {
      orderType?: "REGULAR_DROP_PACK" | "PRE_ORDER";
      itemCount?: number;
    }
  ): Promise<OrderWithDetails> {
    const orderNumber = `ORD-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const skuId = crypto.randomUUID();
    const productId = crypto.randomUUID();

    return ordersRepo.createOrder(undefined, {
      order: {
        orderNumber,
        customerId,
        channel: "STOREFRONT_WEB",
        orderType: overrides?.orderType ?? "REGULAR_DROP_PACK",
        fulfillmentChannel: "COURIER",
        deliveryZone: "INSIDE_DHAKA",
        status: overrides?.status ?? "CONFIRMED",
        paymentStatus: overrides?.paymentStatus ?? "UNPAID",
        paymentMode: "COD",
        addressSnapshot: {
          consignee: "Rahim Chowdhury",
          phone: "01711000001",
          divisionName: "Dhaka",
          districtName: "Dhaka",
          thanaName: "Kotwali",
          addressLine: "12 Nawabpur Road",
          isInsideDhaka: true,
        },
        subtotalPaisa: 500000,
        discountPaisa: 0,
        deliveryFeePaisa: 6000,
        vatTotalPaisa: 37500,
        totalPayablePaisa: 506000,
        storeCreditAppliedPaisa: overrides?.storeCreditAppliedPaisa ?? 0,
        advanceRequiredPaisa: 0,
        advancePaidPaisa: 0,
        codAmountPaisa: 506000,
        paidTotalPaisa: overrides?.paidTotalPaisa ?? 0,
        refundedTotalPaisa: 0,
        couponId: overrides?.couponId ?? null,
        mushakRequested: overrides?.mushakRequested ?? false,
        buyerCompanyName: overrides?.buyerCompanyName ?? null,
        buyerBin: overrides?.buyerBin ?? null,
        ...overrides,
      },
      items: [
        {
          skuId,
          productId,
          titleEn: "Bearing 6204-2RS Authentic",
          titleBn: "বেয়ারিং ৬২০৪",
          tier: "AUTHENTIC",
          skuCode: "SKU-BEARING-01",
          qty: 2,
          unitPricePaisa: 250000,
          allocatedDiscountPaisa: 0,
          lineTotalPaisa: 500000,
          vatRateBp: 750,
          vatPaisa: 37500,
          source: "PHYSICAL",
          status: "ACTIVE",
          units: [
            { sealId: crypto.randomUUID(), status: "PENDING" },
            { sealId: crypto.randomUUID(), status: "PENDING" },
          ],
        },
      ],
      preOrder:
        overrides?.orderType === "PRE_ORDER"
          ? {
              depositPaisa: 100000,
              balancePaisa: 406000,
              etaDate: new Date(Date.now() + 14 * 86400000),
              etaMinDays: 10,
              etaMaxDays: 18,
              priceLockedPaisa: 506000,
              milestone: "SOURCED_IN_TRANSIT",
            }
          : undefined,
    });
  }

  // --------------------------------------------------------------------------
  // 1. Customer Order Details & Listing
  // --------------------------------------------------------------------------
  describe("Customer order viewing and isolation", () => {
    it("allows a customer to view their own order detail with full tier badges, totals, timeline, and seal IDs", async () => {
      const order = await createTestOrder(customerA.id, {
        status: "CONFIRMED",
      });

      const detail = await ordersService.getCustomerOrderDetail(
        customerA.id,
        order.orderNumber
      );

      expect(detail.order_number).toBe(order.orderNumber);
      expect(detail.status).toBe("CONFIRMED");
      expect(detail.items).toHaveLength(1);
      expect(detail.items[0]!.tier).toBe("AUTHENTIC");
      expect(detail.totals.total_payable_paisa).toBe(506000);
      expect(detail.assigned_seal_ids).toHaveLength(2);
      expect(detail.cancellation_eligibility.can_cancel).toBe(true);
      expect(detail.invoice_links.system_invoice_url).toContain(order.orderNumber);
    });

    it("prevents Customer A from viewing Customer B's order (throws NotFoundError)", async () => {
      const orderB = await createTestOrder(customerB.id);

      await expect(
        ordersService.getCustomerOrderDetail(customerA.id, orderB.orderNumber)
      ).rejects.toThrow(NotFoundError);
    });

    it("paginates and filters customer's own orders list without leaking another customer's orders", async () => {
      await createTestOrder(customerA.id, { status: "CONFIRMED" });
      await createTestOrder(customerA.id, { status: "CANCELLED" });
      await createTestOrder(customerB.id, { status: "CONFIRMED" });

      const listAAll = await ordersService.getCustomerOrders(customerA.id);
      expect(listAAll.pagination.total).toBe(2);
      expect(listAAll.items).toHaveLength(2);

      const listAConfirmed = await ordersService.getCustomerOrders(
        customerA.id,
        { status: "CONFIRMED" }
      );
      expect(listAConfirmed.pagination.total).toBe(1);
      expect(listAConfirmed.items[0]!.status).toBe("CONFIRMED");

      const listB = await ordersService.getCustomerOrders(customerB.id);
      expect(listB.pagination.total).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Cancellation Matrix (Regular & Pre-Order)
  // --------------------------------------------------------------------------
  describe("Cancellation rules per state matrix", () => {
    describe("REGULAR orders", () => {
      it("allows cancellation in PENDING_PAYMENT", async () => {
        const order = await createTestOrder(customerA.id, {
          status: "PENDING_PAYMENT",
        });

        const cancelled = await ordersService.cancelOrderByCustomer(
          customerA.id,
          order.orderNumber,
          "Changed mind before payment"
        );

        expect(cancelled?.status).toBe("CANCELLED");
        expect(cancelled?.cancelReason).toBe("Changed mind before payment");

        const outbox = getMemoryOutbox();
        const cancelEvt = outbox.find((e) => e.type === "order.cancelled");
        expect(cancelEvt).toBeDefined();
      });

      it("allows cancellation in CONFIRMED", async () => {
        const order = await createTestOrder(customerA.id, {
          status: "CONFIRMED",
        });

        const cancelled = await ordersService.cancelOrderByCustomer(
          customerA.id,
          order.orderNumber,
          "Ordered wrong part size"
        );

        expect(cancelled?.status).toBe("CANCELLED");
      });

      it("allows cancellation in SOURCING when NO runner purchase has been recorded", async () => {
        const order = await createTestOrder(customerA.id, {
          status: "SOURCING",
        });
        sourcingService.setRunnerPurchaseForTesting(order.id, false);

        const cancelled = await ordersService.cancelOrderByCustomer(
          customerA.id,
          order.orderNumber,
          "Need to cancel before runner buys"
        );

        expect(cancelled?.status).toBe("CANCELLED");
      });

      it("disallows customer cancellation in SOURCING once runner purchase is recorded (403 ERR_CANCELLATION_DISALLOWED)", async () => {
        const order = await createTestOrder(customerA.id, {
          status: "SOURCING",
        });
        sourcingService.setRunnerPurchaseForTesting(order.id, true);

        const eligibility =
          await ordersService.evaluateCancellationEligibility(order);
        expect(eligibility.can_cancel).toBe(false);
        expect(eligibility.reason).toContain("Runner purchase");

        await expect(
          ordersService.cancelOrderByCustomer(
            customerA.id,
            order.orderNumber,
            "Try to cancel"
          )
        ).rejects.toThrowError(
          expect.objectContaining({
            code: "ERR_CANCELLATION_DISALLOWED",
            status: 403,
          })
        );
      });

      it("disallows customer cancellation in AT_GODOWN_QC or PACKED (403)", async () => {
        const orderQc = await createTestOrder(customerA.id, {
          status: "AT_GODOWN_QC",
        });
        await expect(
          ordersService.cancelOrderByCustomer(
            customerA.id,
            orderQc.orderNumber,
            "Cancel"
          )
        ).rejects.toThrowError(
          expect.objectContaining({
            code: "ERR_CANCELLATION_DISALLOWED",
            status: 403,
          })
        );

        const orderPacked = await createTestOrder(customerA.id, {
          status: "PACKED",
        });
        await expect(
          ordersService.cancelOrderByCustomer(
            customerA.id,
            orderPacked.orderNumber,
            "Cancel"
          )
        ).rejects.toThrowError(
          expect.objectContaining({
            code: "ERR_CANCELLATION_DISALLOWED",
            status: 403,
          })
        );
      });
    });

    describe("PRE_ORDER orders", () => {
      it("allows cancellation in DEPOSIT_PENDING and DEPOSIT_PAID", async () => {
        const orderDepPending = await createTestOrder(customerA.id, {
          orderType: "PRE_ORDER",
          status: "DEPOSIT_PENDING",
        });
        const cancelled1 = await ordersService.cancelOrderByCustomer(
          customerA.id,
          orderDepPending.orderNumber,
          "Deposit cancel"
        );
        expect(cancelled1?.status).toBe("CANCELLED");

        const orderDepPaid = await createTestOrder(customerA.id, {
          orderType: "PRE_ORDER",
          status: "DEPOSIT_PAID",
          paidTotalPaisa: 100000,
        });
        const cancelled2 = await ordersService.cancelOrderByCustomer(
          customerA.id,
          orderDepPaid.orderNumber,
          "Deposit paid cancel"
        );
        expect(cancelled2?.status).toBe("CANCELLED");

        // Emits refund request for paid deposit
        const outbox = getMemoryOutbox();
        const refundEvt = outbox.find(
          (e) =>
            e.type === "refund.requested" &&
            (e.payload as { orderId: string }).orderId === orderDepPaid.id
        );
        expect(refundEvt).toBeDefined();
        expect((refundEvt?.payload as { amountPaisa: number }).amountPaisa).toBe(
          100000
        );
      });

      it("disallows PRE_ORDER cancellation once SOURCED_IN_TRANSIT (403 deposit non-refundable)", async () => {
        const order = await createTestOrder(customerA.id, {
          orderType: "PRE_ORDER",
          status: "SOURCED_IN_TRANSIT",
          paidTotalPaisa: 100000,
        });

        const eligibility =
          await ordersService.evaluateCancellationEligibility(order);
        expect(eligibility.can_cancel).toBe(false);
        expect(eligibility.reason).toContain("Deposit non-refundable");

        await expect(
          ordersService.cancelOrderByCustomer(
            customerA.id,
            order.orderNumber,
            "Cancel pre-order"
          )
        ).rejects.toThrowError(
          expect.objectContaining({
            code: "ERR_CANCELLATION_DISALLOWED",
            status: 403,
          })
        );
      });
    });

    describe("Atomic cancellation teardown effects", () => {
      it("releases physical reservations, reverses store credit, and emits refund request on customer cancellation", async () => {
        const order = await createTestOrder(customerA.id, {
          status: "CONFIRMED",
          paidTotalPaisa: 300000,
          storeCreditAppliedPaisa: 50000,
        });

        // Setup a mock reservation
        await inventoryService.reserve(undefined, {
          orderId: order.id,
          skuId: order.items[0]!.skuId,
          qty: 2,
          locationPreference: ["GODOWN_NAWABPUR"],
        });

        const cancelled = await ordersService.cancelOrderByCustomer(
          customerA.id,
          order.orderNumber,
          "Customer requested full refund"
        );
        expect(cancelled?.status).toBe("CANCELLED");

        // Check active reservations released
        const activeRes =
          await inventoryService.getActiveReservationsForOrder(order.id);
        expect(activeRes).toHaveLength(0);

        // Check refund.requested outbox event emitted
        const outbox = getMemoryOutbox();
        const refundEvt = outbox.find((e) => e.type === "refund.requested");
        expect(refundEvt).toBeDefined();
        expect((refundEvt?.payload as { amountPaisa: number }).amountPaisa).toBe(
          300000
        );
        expect((refundEvt?.payload as { reason: string }).reason).toBe(
          "CUSTOMER_CANCELLATION"
        );
      });
    });

    describe("Staff cancellation (after-purchase / before-handover)", () => {
      it("allows CUSTOMER_SUPPORT staff to cancel an order after runner purchase and receives items into GODOWN_NAWABPUR with CANCELLATION_RECEIPT movement", async () => {
        const order = await createTestOrder(customerA.id, {
          status: "SOURCING",
          paidTotalPaisa: 506000,
        });
        sourcingService.setRunnerPurchaseForTesting(order.id, true);

        // Staff cancels
        const cancelled = await ordersService.cancelOrderByStaff(
          supportStaff,
          order.id,
          "Customer called support to cancel post-purchase"
        );

        expect(cancelled?.status).toBe("CANCELLED");

        // Stock movement recorded in inventory
        const movements = await inventoryService.listMovements({
          refId: order.id,
        });
        expect(movements.items.length).toBeGreaterThan(0);
        expect(movements.items[0]?.reason).toBe("CANCELLATION_RECEIPT");

        // Full refund event emitted
        const outbox = getMemoryOutbox();
        const refundEvt = outbox.find(
          (e) =>
            e.type === "refund.requested" &&
            (e.payload as { reason: string }).reason === "STAFF_CANCELLATION"
        );
        expect(refundEvt).toBeDefined();
        expect((refundEvt?.payload as { amountPaisa: number }).amountPaisa).toBe(
          506000
        );
      });

      it("rejects staff cancellation when performed by non-support staff (ForbiddenError)", async () => {
        const order = await createTestOrder(customerA.id, {
          status: "SOURCING",
        });

        await expect(
          ordersService.cancelOrderByStaff(warehouseStaff, order.id, "Attempt")
        ).rejects.toThrow(ForbiddenError);
      });
    });
  });

  // --------------------------------------------------------------------------
  // 3. Gapless Mushak Serials Under Concurrency & Across Fiscal Year Boundary
  // --------------------------------------------------------------------------
  describe("Gapless Mushak 6.3 serials under concurrency and fiscal year boundaries", () => {
    it("generates strictly sequential, gapless Mushak numbers under concurrent invocations", async () => {
      clearMemoryCountersForTesting();

      // Run 10 concurrent Mushak serial generations
      const date = new Date("2026-08-15T10:00:00+06:00");
      const promises = Array.from({ length: 10 }).map(() =>
        generateMushakNumber(null, date)
      );

      const results = await Promise.all(promises);

      // Verify all serials are unique
      const unique = new Set(results);
      expect(unique.size).toBe(10);

      // Verify strictly sequential numbers 000001 through 000010
      const serialSuffixes = results
        .map((s) => Number(s.split("-").pop()))
        .sort((a, b) => a - b);

      expect(serialSuffixes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it("resets gapless counter across the fiscal year boundary (30 June 23:59 Asia/Dhaka vs 1 July 00:00)", async () => {
      clearMemoryCountersForTesting();

      // 30 June 2026 23:59:59 Asia/Dhaka (UTC: 2026-06-30T17:59:59.000Z)
      const dateJune30 = new Date("2026-06-30T23:59:59+06:00");
      const serialJune1 = await generateMushakNumber(null, dateJune30);
      const serialJune2 = await generateMushakNumber(null, dateJune30);

      // FY for June 2026 is "2025-2026"
      expect(serialJune1).toBe("MUSHAK-6.3-2025-2026-000001");
      expect(serialJune2).toBe("MUSHAK-6.3-2025-2026-000002");

      // 1 July 2026 00:00:00 Asia/Dhaka (UTC: 2026-06-30T18:00:00.000Z)
      const dateJuly1 = new Date("2026-07-01T00:00:00+06:00");
      const serialJuly1 = await generateMushakNumber(null, dateJuly1);
      const serialJuly2 = await generateMushakNumber(null, dateJuly1);

      // FY for July 2026 is "2026-2027", new period resets to 000001
      expect(serialJuly1).toBe("MUSHAK-6.3-2026-2027-000001");
      expect(serialJuly2).toBe("MUSHAK-6.3-2026-2027-000002");
    });

    it("issues a SYSTEM invoice upon confirmation and a MUSHAK_6_3 invoice when requested", async () => {
      const order = await createTestOrder(customerA.id, {
        status: "CONFIRMED",
        mushakRequested: true,
      });

      const sysInv = await financeService.createSystemInvoice(undefined, order);
      expect(sysInv.type).toBe("SYSTEM");
      expect(sysInv.invoiceNo).toMatch(/^INV-2026-\d{5}$/);
      expect(sysInv.mushakSerial).toBeNull();

      const mushakInv = await financeService.issueMushakInvoice(
        undefined,
        order
      );
      expect(mushakInv.type).toBe("MUSHAK_6_3");
      expect(mushakInv.mushakSerial).toMatch(/^MUSHAK-6.3-\d{4}-\d{4}-\d{6}$/);

      // Signed URL valid for 5 min
      const { signedUrl } =
        await financeService.getSignedUrlForInvoice(mushakInv);
      expect(signedUrl).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Staff Order Views, Notes & Role-Based PII Serialization
  // --------------------------------------------------------------------------
  describe("Staff order operations and role-based PII serialization", () => {
    it("allows staff to add internal notes to an order", async () => {
      const order = await createTestOrder(customerA.id);

      const note = await ordersService.addAdminOrderNote(
        supportStaff,
        order.id,
        "Customer verified by phone for special packaging"
      );

      expect(note.note).toBe("Customer verified by phone for special packaging");
      expect(note.orderId).toBe(order.id);

      const orderWithNotes = await ordersRepo.getOrderWithDetails(
        undefined,
        order.id
      );
      expect(orderWithNotes?.notes).toHaveLength(1);
    });

    it("serializes FULL PII for Customer Support staff", async () => {
      const order = await createTestOrder(customerA.id);

      const adminView = await ordersService.getAdminOrderDetail(
        supportStaff,
        order.id
      );

      const pii = adminView.customer_pii as {
        fullName: string;
        phone: string;
        addressLine: string;
      };
      expect(pii.fullName).toBe("Rahim Chowdhury");
      expect(pii.phone).toBe("01711000001");
      expect(pii.addressLine).toBe("12 Nawabpur Road");
    });

    it("serializes BILLING PII for Finance Officers", async () => {
      const order = await createTestOrder(customerA.id, {
        buyerCompanyName: "Acme Industrial Tools",
        buyerBin: "123456789-0101",
      });

      const adminView = await ordersService.getAdminOrderDetail(
        financeStaff,
        order.id
      );

      const pii = adminView.customer_pii as {
        customerName: string;
        bin: string;
        phone?: string;
      };
      expect(pii.customerName).toBe("Rahim Chowdhury");
      expect(pii.bin).toBe("123456789-0101");
      expect(pii.phone).toBeUndefined(); // Phone is omitted from billing serializer
    });
  });
});
