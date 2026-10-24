import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import { Tx } from "@/lib/db";
import { Actor } from "@/lib/http/route";
import { BusinessError } from "@/lib/errors";
import {
  ordersService,
  TRANSITIONS,
  transitionOrder,
  recomputePaymentStatus,
  CreateOrderDto,
} from "../index";

const staffActor: Actor = {
  id: "staff-1111-2222-3333-444444444444",
  type: "staff",
  roles: ["OPERATIONS_OFFICER"],
};

const customerActor: Actor = {
  id: "cust-1111-2222-3333-444444444444",
  type: "customer",
};

const systemActor: Actor = {
  id: "system-cron-job",
  type: "system",
};

function createSampleOrderDto(overrides: Partial<CreateOrderDto> = {}): CreateOrderDto {
  return {
    customerId: "cust-1111-2222-3333-444444444444",
    channel: "STOREFRONT_WEB",
    orderType: "REGULAR_DROP_PACK",
    fulfillmentChannel: "COURIER",
    deliveryZone: "INSIDE_DHAKA",
    paymentMode: "ONLINE_FULL",
    subtotalPaisa: 500000, // ৳5,000
    discountPaisa: 0,
    deliveryFeePaisa: 6000, // ৳60
    vatTotalPaisa: 37500, // ৳375
    totalPayablePaisa: 506000,
    items: [
      {
        skuId: crypto.randomUUID(),
        productId: crypto.randomUUID(),
        titleEn: "Fast Charger 65W",
        titleBn: "ফাস্ট চার্জার ৬৫ ওয়াট",
        tier: "FAST_RUNNER",
        skuCode: "CHG-65W-BLK",
        qty: 3,
        unitPricePaisa: 168666,
        allocatedDiscountPaisa: 0,
        lineTotalPaisa: 506000,
        vatRateBp: 750,
        vatPaisa: 37500,
        source: "PHYSICAL",
      },
    ],
    ...overrides,
  };
}

describe("P18 — Order Schema & State Machine", () => {
  beforeEach(() => {
    ordersService.clearMemoryForTesting();
  });

  describe("1. Order Creation & Unit Generation", () => {
    it("creates an order with items and auto-generates 1 physical unit row per item quantity (qty 3 -> 3 units)", async () => {
      const dto = createSampleOrderDto();
      const mockTx = null as unknown as Tx;

      const order = await ordersService.createOrder(mockTx, dto, customerActor);

      expect(order).toBeDefined();
      expect(order.orderNumber).toMatch(/^ORD-\d{4}-\d{5}$/);
      expect(order.status).toBe("PENDING_PAYMENT");
      expect(order.paymentStatus).toBe("UNPAID");
      expect(order.items.length).toBe(1);

      const item = order.items[0]!;
      expect(item.qty).toBe(3);
      expect(item.units.length).toBe(3);
      expect(item.units[0]!.unitIndex).toBe(1);
      expect(item.units[1]!.unitIndex).toBe(2);
      expect(item.units[2]!.unitIndex).toBe(3);
      expect(item.units[0]!.status).toBe("PENDING");
    });

    it("creates walk-in POS orders directly in DELIVERED_COUNTER status", async () => {
      const dto = createSampleOrderDto({
        channel: "SHOWROOM_POS",
        fulfillmentChannel: "WALK_IN",
        paymentMode: "PAY_AT_COUNTER",
      });
      const mockTx = null as unknown as Tx;

      const order = await ordersService.createOrder(mockTx, dto, staffActor);

      expect(order.status).toBe("DELIVERED_COUNTER");
    });

    it("creates pre-orders in DEPOSIT_PENDING status with pre-order metadata", async () => {
      const dto = createSampleOrderDto({
        orderType: "PRE_ORDER",
        paymentMode: "PREORDER_DEPOSIT",
        advanceRequiredPaisa: 100000,
        preOrder: {
          depositPaisa: 100000,
          balancePaisa: 406000,
          etaDate: new Date("2026-11-15"),
          etaMinDays: 14,
          etaMaxDays: 21,
          priceLockedPaisa: 506000,
          milestone: "DEPOSIT_PENDING",
        },
      });
      const mockTx = null as unknown as Tx;

      const order = await ordersService.createOrder(mockTx, dto, customerActor);

      expect(order.status).toBe("DEPOSIT_PENDING");
      expect(order.preOrder).toBeDefined();
      expect(order.preOrder?.depositPaisa).toBe(100000);
      expect(order.preOrder?.balancePaisa).toBe(406000);
    });
  });

  describe("2. REGULAR_DROP_PACK State Machine Transitions", () => {
    it("follows the complete courier delivery happy path", async () => {
      const mockTx = null as unknown as Tx;
      const order = await ordersService.createOrder(
        mockTx,
        createSampleOrderDto(),
        customerActor
      );

      // PENDING_PAYMENT -> CONFIRMED
      let updated = await transitionOrder(
        mockTx,
        order.id,
        "CONFIRMED",
        staffActor,
        "Payment verified"
      );
      expect(updated.status).toBe("CONFIRMED");
      expect(updated.confirmedAt).toBeInstanceOf(Date);

      // CONFIRMED -> SOURCING (for virtual items)
      updated = await transitionOrder(
        mockTx,
        order.id,
        "SOURCING",
        staffActor,
        "Runner task assigned"
      );
      expect(updated.status).toBe("SOURCING");

      // SOURCING -> AT_GODOWN_QC
      updated = await transitionOrder(
        mockTx,
        order.id,
        "AT_GODOWN_QC",
        staffActor,
        "Goods arrived at Nawabpur godown"
      );
      expect(updated.status).toBe("AT_GODOWN_QC");

      // AT_GODOWN_QC -> PACKED
      updated = await transitionOrder(
        mockTx,
        order.id,
        "PACKED",
        staffActor,
        "QC passed and packed with seals"
      );
      expect(updated.status).toBe("PACKED");

      // PACKED -> HANDED_TO_COURIER
      updated = await transitionOrder(
        mockTx,
        order.id,
        "HANDED_TO_COURIER",
        staffActor,
        "Handed to Steadfast with consignment"
      );
      expect(updated.status).toBe("HANDED_TO_COURIER");

      // HANDED_TO_COURIER -> DELIVERED
      updated = await transitionOrder(
        mockTx,
        order.id,
        "DELIVERED",
        systemActor,
        "Courier webhook delivered"
      );
      expect(updated.status).toBe("DELIVERED");
    });

    it("follows the showroom pickup happy path", async () => {
      const mockTx = null as unknown as Tx;
      const order = await ordersService.createOrder(
        mockTx,
        createSampleOrderDto({
          fulfillmentChannel: "PICKUP",
        }),
        customerActor
      );

      // PENDING_PAYMENT -> CONFIRMED -> AT_GODOWN_QC -> PACKED -> READY_FOR_PICKUP -> DELIVERED_COUNTER
      await transitionOrder(mockTx, order.id, "CONFIRMED", staffActor);
      await transitionOrder(mockTx, order.id, "AT_GODOWN_QC", staffActor);
      await transitionOrder(mockTx, order.id, "PACKED", staffActor);
      let updated = await transitionOrder(
        mockTx,
        order.id,
        "READY_FOR_PICKUP",
        staffActor,
        "Ready at Showroom Counter"
      );
      expect(updated.status).toBe("READY_FOR_PICKUP");

      updated = await transitionOrder(
        mockTx,
        order.id,
        "DELIVERED_COUNTER",
        staffActor,
        "Customer collected with PIN"
      );
      expect(updated.status).toBe("DELIVERED_COUNTER");
    });

    it("supports partial delivery followed by RTO in transit and receipt", async () => {
      const mockTx = null as unknown as Tx;
      const order = await ordersService.createOrder(
        mockTx,
        createSampleOrderDto(),
        customerActor
      );

      await transitionOrder(mockTx, order.id, "CONFIRMED", staffActor);
      await transitionOrder(mockTx, order.id, "AT_GODOWN_QC", staffActor);
      await transitionOrder(mockTx, order.id, "PACKED", staffActor);
      await transitionOrder(mockTx, order.id, "HANDED_TO_COURIER", staffActor);

      // Partial delivery
      let updated = await transitionOrder(
        mockTx,
        order.id,
        "PARTIALLY_DELIVERED",
        systemActor,
        "1 of 3 units returned by customer",
        { returnedUnits: [1] }
      );
      expect(updated.status).toBe("PARTIALLY_DELIVERED");

      // RTO in transit for rejected unit
      updated = await transitionOrder(
        mockTx,
        order.id,
        "RTO_IN_TRANSIT",
        systemActor,
        "Courier returning rejected unit"
      );
      expect(updated.status).toBe("RTO_IN_TRANSIT");

      // RTO received at godown
      updated = await transitionOrder(
        mockTx,
        order.id,
        "RTO_RECEIVED",
        staffActor,
        "Returned unit received at godown"
      );
      expect(updated.status).toBe("RTO_RECEIVED");
    });

    it("supports full RTO lifecycle when delivery fails", async () => {
      const mockTx = null as unknown as Tx;
      const order = await ordersService.createOrder(
        mockTx,
        createSampleOrderDto(),
        customerActor
      );

      await transitionOrder(mockTx, order.id, "CONFIRMED", staffActor);
      await transitionOrder(mockTx, order.id, "AT_GODOWN_QC", staffActor);
      await transitionOrder(mockTx, order.id, "PACKED", staffActor);
      await transitionOrder(mockTx, order.id, "HANDED_TO_COURIER", staffActor);

      let updated = await transitionOrder(
        mockTx,
        order.id,
        "RTO_IN_TRANSIT",
        systemActor,
        "Customer unreachable after 3 attempts"
      );
      expect(updated.status).toBe("RTO_IN_TRANSIT");

      updated = await transitionOrder(
        mockTx,
        order.id,
        "RTO_RECEIVED",
        staffActor,
        "Returned parcel received at godown"
      );
      expect(updated.status).toBe("RTO_RECEIVED");
    });

    it("supports pickup expiration when counter deadline passes", async () => {
      const mockTx = null as unknown as Tx;
      const order = await ordersService.createOrder(
        mockTx,
        createSampleOrderDto({ fulfillmentChannel: "PICKUP" }),
        customerActor
      );

      await transitionOrder(mockTx, order.id, "CONFIRMED", staffActor);
      await transitionOrder(mockTx, order.id, "AT_GODOWN_QC", staffActor);
      await transitionOrder(mockTx, order.id, "PACKED", staffActor);
      await transitionOrder(mockTx, order.id, "READY_FOR_PICKUP", staffActor);

      const updated = await transitionOrder(
        mockTx,
        order.id,
        "PICKUP_EXPIRED",
        systemActor,
        "7 days passed without counter pickup"
      );
      expect(updated.status).toBe("PICKUP_EXPIRED");
    });

    it("allows cancellation from reachable states (PENDING_PAYMENT, CONFIRMED, AT_GODOWN_QC)", async () => {
      const mockTx = null as unknown as Tx;

      // 1. Cancel from PENDING_PAYMENT
      const o1 = await ordersService.createOrder(mockTx, createSampleOrderDto(), customerActor);
      const c1 = await transitionOrder(mockTx, o1.id, "CANCELLED", customerActor, "Customer requested");
      expect(c1.status).toBe("CANCELLED");
      expect(c1.cancelledAt).toBeInstanceOf(Date);
      expect(c1.cancelReason).toBe("Customer requested");

      // 2. Cancel from CONFIRMED
      const o2 = await ordersService.createOrder(mockTx, createSampleOrderDto(), customerActor);
      await transitionOrder(mockTx, o2.id, "CONFIRMED", staffActor);
      const c2 = await transitionOrder(mockTx, o2.id, "CANCELLED", staffActor, "Customer changed mind");
      expect(c2.status).toBe("CANCELLED");

      // 3. Cancel from AT_GODOWN_QC
      const o3 = await ordersService.createOrder(mockTx, createSampleOrderDto(), customerActor);
      await transitionOrder(mockTx, o3.id, "CONFIRMED", staffActor);
      await transitionOrder(mockTx, o3.id, "AT_GODOWN_QC", staffActor);
      const c3 = await transitionOrder(mockTx, o3.id, "CANCELLED", staffActor, "QC defect and out of stock");
      expect(c3.status).toBe("CANCELLED");
    });
  });

  describe("3. Transition Guard Rules", () => {
    it("rejects customer from cancelling order once in SOURCING", async () => {
      const mockTx = null as unknown as Tx;
      const order = await ordersService.createOrder(
        mockTx,
        createSampleOrderDto(),
        customerActor
      );

      await transitionOrder(mockTx, order.id, "CONFIRMED", staffActor);
      await transitionOrder(mockTx, order.id, "SOURCING", staffActor);

      // Customer attempts to cancel
      await expect(
        transitionOrder(mockTx, order.id, "CANCELLED", customerActor, "Customer tries to cancel")
      ).rejects.toThrow(BusinessError);

      // Staff CAN cancel
      const cancelled = await transitionOrder(
        mockTx,
        order.id,
        "CANCELLED",
        staffActor,
        "Staff cancelled due to stall closed"
      );
      expect(cancelled.status).toBe("CANCELLED");
    });
  });

  describe("4. PRE_ORDER State Machine Transitions", () => {
    it("follows the pre-order happy path to final delivery", async () => {
      const mockTx = null as unknown as Tx;
      const order = await ordersService.createOrder(
        mockTx,
        createSampleOrderDto({
          orderType: "PRE_ORDER",
          paymentMode: "PREORDER_DEPOSIT",
          preOrder: {
            depositPaisa: 100000,
            balancePaisa: 406000,
            etaDate: new Date("2026-11-20"),
            etaMinDays: 14,
            etaMaxDays: 25,
            priceLockedPaisa: 506000,
            milestone: "DEPOSIT_PENDING",
          },
        }),
        customerActor
      );

      expect(order.status).toBe("DEPOSIT_PENDING");

      // DEPOSIT_PENDING -> DEPOSIT_PAID
      let updated = await transitionOrder(
        mockTx,
        order.id,
        "DEPOSIT_PAID",
        staffActor,
        "Deposit received via SSLCommerz"
      );
      expect(updated.status).toBe("DEPOSIT_PAID");
      expect(updated.confirmedAt).toBeInstanceOf(Date);

      // DEPOSIT_PAID -> SOURCED_IN_TRANSIT
      updated = await transitionOrder(
        mockTx,
        order.id,
        "SOURCED_IN_TRANSIT",
        staffActor,
        "International sourcing batch dispatched"
      );
      expect(updated.status).toBe("SOURCED_IN_TRANSIT");

      // SOURCED_IN_TRANSIT -> ARRIVED_GODOWN
      updated = await transitionOrder(
        mockTx,
        order.id,
        "ARRIVED_GODOWN",
        staffActor,
        "Batch arrived at Nawabpur godown"
      );
      expect(updated.status).toBe("ARRIVED_GODOWN");

      // ARRIVED_GODOWN -> QC_VERIFIED_BALANCE_DUE
      updated = await transitionOrder(
        mockTx,
        order.id,
        "QC_VERIFIED_BALANCE_DUE",
        staffActor,
        "Batch QC passed; balance payment requested"
      );
      expect(updated.status).toBe("QC_VERIFIED_BALANCE_DUE");

      // QC_VERIFIED_BALANCE_DUE -> BALANCE_PAID
      updated = await transitionOrder(
        mockTx,
        order.id,
        "BALANCE_PAID",
        staffActor,
        "Customer paid balance online"
      );
      expect(updated.status).toBe("BALANCE_PAID");

      // BALANCE_PAID -> PACKED -> HANDED_TO_COURIER -> DELIVERED
      await transitionOrder(mockTx, order.id, "PACKED", staffActor);
      await transitionOrder(mockTx, order.id, "HANDED_TO_COURIER", staffActor);
      updated = await transitionOrder(mockTx, order.id, "DELIVERED", systemActor);
      expect(updated.status).toBe("DELIVERED");
    });

    it("supports balance COD scheduled branch for pre-orders", async () => {
      const mockTx = null as unknown as Tx;
      const order = await ordersService.createOrder(
        mockTx,
        createSampleOrderDto({
          orderType: "PRE_ORDER",
          paymentMode: "PREORDER_DEPOSIT",
          preOrder: {
            depositPaisa: 100000,
            balancePaisa: 200000, // <= ৳30,000 max COD balance
            etaDate: new Date("2026-11-20"),
            etaMinDays: 14,
            etaMaxDays: 25,
            priceLockedPaisa: 300000,
            milestone: "DEPOSIT_PENDING",
          },
        }),
        customerActor
      );

      await transitionOrder(mockTx, order.id, "DEPOSIT_PAID", staffActor);
      await transitionOrder(mockTx, order.id, "SOURCED_IN_TRANSIT", staffActor);
      await transitionOrder(mockTx, order.id, "ARRIVED_GODOWN", staffActor);
      await transitionOrder(mockTx, order.id, "QC_VERIFIED_BALANCE_DUE", staffActor);

      // Schedule balance as COD
      const updated = await transitionOrder(
        mockTx,
        order.id,
        "BALANCE_COD_SCHEDULED",
        staffActor,
        "Customer opted to pay remaining ৳2,000 on COD delivery"
      );
      expect(updated.status).toBe("BALANCE_COD_SCHEDULED");

      // Proceeds to PACKED
      const packed = await transitionOrder(mockTx, order.id, "PACKED", staffActor);
      expect(packed.status).toBe("PACKED");
    });

    it("handles pre-order repricing pending branch and reversion", async () => {
      const mockTx = null as unknown as Tx;
      const order = await ordersService.createOrder(
        mockTx,
        createSampleOrderDto({
          orderType: "PRE_ORDER",
          preOrder: {
            depositPaisa: 100000,
            balancePaisa: 400000,
            etaDate: new Date("2026-11-20"),
            etaMinDays: 14,
            etaMaxDays: 25,
            priceLockedPaisa: 500000,
            milestone: "DEPOSIT_PENDING",
          },
        }),
        customerActor
      );

      await transitionOrder(mockTx, order.id, "DEPOSIT_PAID", staffActor);

      // Sourcing manager moves to REPRICING_PENDING due to dollar exchange spike
      let updated = await transitionOrder(
        mockTx,
        order.id,
        "REPRICING_PENDING",
        staffActor,
        "Currency devaluation requires price adjustment",
        { previousStatus: "DEPOSIT_PAID", newPricePaisa: 550000 }
      );
      expect(updated.status).toBe("REPRICING_PENDING");

      // Customer accepts repricing -> returns to previous state
      updated = await transitionOrder(
        mockTx,
        order.id,
        "DEPOSIT_PAID",
        customerActor,
        "Customer accepted price update",
        { previousStatus: "DEPOSIT_PAID" }
      );
      expect(updated.status).toBe("DEPOSIT_PAID");
    });

    it("allows customer to cancel and refund if they reject repricing", async () => {
      const mockTx = null as unknown as Tx;
      const order = await ordersService.createOrder(
        mockTx,
        createSampleOrderDto({
          orderType: "PRE_ORDER",
          preOrder: {
            depositPaisa: 100000,
            balancePaisa: 400000,
            etaDate: new Date("2026-11-20"),
            etaMinDays: 14,
            etaMaxDays: 25,
            priceLockedPaisa: 500000,
            milestone: "DEPOSIT_PENDING",
          },
        }),
        customerActor
      );

      await transitionOrder(mockTx, order.id, "DEPOSIT_PAID", staffActor);
      await transitionOrder(mockTx, order.id, "REPRICING_PENDING", staffActor, "Repricing", {
        previousStatus: "DEPOSIT_PAID",
      });

      const refunded = await transitionOrder(
        mockTx,
        order.id,
        "CANCELLED_REFUNDED",
        customerActor,
        "Customer rejected repricing; full refund queued"
      );
      expect(refunded.status).toBe("CANCELLED_REFUNDED");
    });

    it("forfeits deposit if balance is unpaid after 7-day forfeiture date", async () => {
      const mockTx = null as unknown as Tx;
      const order = await ordersService.createOrder(
        mockTx,
        createSampleOrderDto({
          orderType: "PRE_ORDER",
          preOrder: {
            depositPaisa: 100000,
            balancePaisa: 400000,
            etaDate: new Date("2026-11-20"),
            etaMinDays: 14,
            etaMaxDays: 25,
            priceLockedPaisa: 500000,
            milestone: "DEPOSIT_PENDING",
          },
        }),
        customerActor
      );

      await transitionOrder(mockTx, order.id, "DEPOSIT_PAID", staffActor);
      await transitionOrder(mockTx, order.id, "SOURCED_IN_TRANSIT", staffActor);
      await transitionOrder(mockTx, order.id, "ARRIVED_GODOWN", staffActor);
      await transitionOrder(mockTx, order.id, "QC_VERIFIED_BALANCE_DUE", staffActor);

      const forfeited = await transitionOrder(
        mockTx,
        order.id,
        "DEPOSIT_FORFEITED_CANCELLED",
        systemActor,
        "7 days elapsed without balance payment; deposit forfeited"
      );
      expect(forfeited.status).toBe("DEPOSIT_FORFEITED_CANCELLED");
    });
  });

  describe("5. Illegal Transition Rejection", () => {
    it("fails illegal transitions with ERR_ILLEGAL_TRANSITION (409)", async () => {
      const mockTx = null as unknown as Tx;
      const order = await ordersService.createOrder(
        mockTx,
        createSampleOrderDto(),
        customerActor
      );

      // Attempt jump from PENDING_PAYMENT to DELIVERED
      await expect(
        transitionOrder(mockTx, order.id, "DELIVERED", staffActor)
      ).rejects.toThrow(BusinessError);

      // Attempt jump from PENDING_PAYMENT to PACKED
      await expect(
        transitionOrder(mockTx, order.id, "PACKED", staffActor)
      ).rejects.toThrow(BusinessError);

      // Attempt jump from PENDING_PAYMENT to pre-order state
      await expect(
        transitionOrder(mockTx, order.id, "DEPOSIT_PAID", staffActor)
      ).rejects.toThrow(BusinessError);

      // Progress to CONFIRMED
      await transitionOrder(mockTx, order.id, "CONFIRMED", staffActor);

      // Attempt illegal backward transition CONFIRMED -> PENDING_PAYMENT
      await expect(
        transitionOrder(mockTx, order.id, "PENDING_PAYMENT", staffActor)
      ).rejects.toThrow(BusinessError);

      // Progress to CANCELLED (terminal state)
      await transitionOrder(mockTx, order.id, "CANCELLED", staffActor, "Cancelled");

      // Attempt transition from terminal CANCELLED state
      await expect(
        transitionOrder(mockTx, order.id, "CONFIRMED", staffActor)
      ).rejects.toThrow(BusinessError);
    });
  });

  describe("6. Append-Only Order Status History", () => {
    it("records an audit history row on creation and every subsequent transition", async () => {
      const mockTx = null as unknown as Tx;
      const order = await ordersService.createOrder(
        mockTx,
        createSampleOrderDto(),
        customerActor
      );

      await transitionOrder(mockTx, order.id, "CONFIRMED", staffActor, "Payment verified");
      await transitionOrder(mockTx, order.id, "AT_GODOWN_QC", staffActor, "QC hold");
      await transitionOrder(mockTx, order.id, "PACKED", staffActor, "Packed");

      const fullOrder = await ordersService.getOrder(mockTx, order.id);
      expect(fullOrder).toBeDefined();

      const history = fullOrder?.history ?? [];
      expect(history.length).toBe(4);

      expect(history[0]!.fromStatus).toBeNull();
      expect(history[0]!.toStatus).toBe("PENDING_PAYMENT");
      expect(history[0]!.actorType).toBe("CUSTOMER");

      expect(history[1]!.fromStatus).toBe("PENDING_PAYMENT");
      expect(history[1]!.toStatus).toBe("CONFIRMED");
      expect(history[1]!.actorType).toBe("STAFF");
      expect(history[1]!.reason).toBe("Payment verified");

      expect(history[2]!.fromStatus).toBe("CONFIRMED");
      expect(history[2]!.toStatus).toBe("AT_GODOWN_QC");

      expect(history[3]!.fromStatus).toBe("AT_GODOWN_QC");
      expect(history[3]!.toStatus).toBe("PACKED");
    });
  });

  describe("7. Derived Payment Status Machine", () => {
    it("derives UNPAID, PENDING, PAID, and REFUNDED correctly from payment transactions", async () => {
      const mockTx = null as unknown as Tx;
      const order = await ordersService.createOrder(
        mockTx,
        createSampleOrderDto({
          totalPayablePaisa: 500000, // ৳5,000
        }),
        customerActor
      );

      expect(order.paymentStatus).toBe("UNPAID");

      // 1. Create initiated payment transaction -> PENDING
      const txn1 = await ordersService.createPaymentTransaction(mockTx, {
        orderId: order.id,
        customerId: order.customerId,
        purpose: "FULL",
        method: "SSLCOMMERZ",
        amountPaisa: 500000,
      });
      expect(txn1.tranId).toMatch(/^NCA-TXN-\d{8}-[0-9A-F]{6}$/);

      let paymentResult = await recomputePaymentStatus(mockTx, order.id);
      expect(paymentResult.nextPaymentStatus).toBe("PENDING");

      // 2. Mark transaction as PAID -> PAID
      await ordersService.updatePaymentTransactionStatus(mockTx, txn1.tranId, "PAID");

      paymentResult = await recomputePaymentStatus(mockTx, order.id);
      expect(paymentResult.nextPaymentStatus).toBe("PAID");
      expect(paymentResult.paidTotalPaisa).toBe(500000);

      // Verify on order
      const updatedOrder = await ordersService.getOrder(mockTx, order.id);
      expect(updatedOrder?.paymentStatus).toBe("PAID");
      expect(updatedOrder?.paidTotalPaisa).toBe(500000);
    });

    it("derives PARTIALLY_PAID for COD orders when advance fee is paid", async () => {
      const mockTx = null as unknown as Tx;
      const order = await ordersService.createOrder(
        mockTx,
        createSampleOrderDto({
          paymentMode: "COD",
          totalPayablePaisa: 506000,
          advanceRequiredPaisa: 6000, // ৳60 advance delivery fee
          advancePaidPaisa: 0,
        }),
        customerActor
      );

      // Pay the ৳60 advance fee
      const advanceTxn = await ordersService.createPaymentTransaction(mockTx, {
        orderId: order.id,
        customerId: order.customerId,
        purpose: "ADVANCE_FEE",
        method: "SSLCOMMERZ",
        amountPaisa: 6000,
      });

      await ordersService.updatePaymentTransactionStatus(mockTx, advanceTxn.tranId, "PAID");

      const paymentResult = await recomputePaymentStatus(mockTx, order.id);
      expect(paymentResult.nextPaymentStatus).toBe("PARTIALLY_PAID");
      expect(paymentResult.paidTotalPaisa).toBe(6000);
    });

    it("derives FAILED when payment transaction fails without any paid transaction", async () => {
      const mockTx = null as unknown as Tx;
      const order = await ordersService.createOrder(
        mockTx,
        createSampleOrderDto(),
        customerActor
      );

      const txn = await ordersService.createPaymentTransaction(mockTx, {
        orderId: order.id,
        customerId: order.customerId,
        purpose: "FULL",
        method: "SSLCOMMERZ",
        amountPaisa: 500000,
      });

      await ordersService.updatePaymentTransactionStatus(mockTx, txn.tranId, "FAILED");

      const paymentResult = await recomputePaymentStatus(mockTx, order.id);
      expect(paymentResult.nextPaymentStatus).toBe("FAILED");
    });
  });

  describe("8. Transition Matrix Data Completeness", () => {
    it("ensures every defined transition in TRANSITIONS matches declared OrderStatus values", () => {
      const validStatuses = new Set([
        "PENDING_PAYMENT",
        "CONFIRMED",
        "SOURCING",
        "AT_GODOWN_QC",
        "PACKED",
        "HANDED_TO_COURIER",
        "DELIVERED",
        "PARTIALLY_DELIVERED",
        "RTO_IN_TRANSIT",
        "RTO_RECEIVED",
        "READY_FOR_PICKUP",
        "DELIVERED_COUNTER",
        "PICKUP_EXPIRED",
        "CANCELLED",
        "DEPOSIT_PENDING",
        "DEPOSIT_PAID",
        "SOURCED_IN_TRANSIT",
        "REPRICING_PENDING",
        "ARRIVED_GODOWN",
        "QC_VERIFIED_BALANCE_DUE",
        "BALANCE_PAID",
        "BALANCE_COD_SCHEDULED",
        "BALANCE_COUNTER_SCHEDULED",
        "DEPOSIT_FORFEITED_CANCELLED",
        "CANCELLED_REFUNDED",
      ]);

      for (const [_orderType, matrix] of Object.entries(TRANSITIONS)) {
        for (const [from, toList] of Object.entries(matrix)) {
          expect(validStatuses.has(from)).toBe(true);
          for (const to of toList) {
            expect(validStatuses.has(to)).toBe(true);
          }
        }
      }
    });
  });
});
