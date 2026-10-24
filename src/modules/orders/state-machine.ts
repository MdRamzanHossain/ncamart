import { Tx } from "@/lib/db";
import { BusinessError, NotFoundError } from "@/lib/errors";
import { Actor } from "@/lib/http/route";
import { emitOutbox } from "@/lib/outbox";
import {
  orders,
  OrderStatus,
  OrderType,
  PaymentStatus,
  OrderActorType,
} from "./schema";
import { ordersRepo } from "./repo";

/**
 * Declared valid status transitions for REGULAR_DROP_PACK and PRE_ORDER.
 * Strictly conforms to PRD §3.12 and architechture.md §8.3.
 */
export const TRANSITIONS: Record<
  OrderType,
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  REGULAR_DROP_PACK: {
    PENDING_PAYMENT: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["SOURCING", "AT_GODOWN_QC", "CANCELLED"],
    SOURCING: ["AT_GODOWN_QC", "CANCELLED"],
    AT_GODOWN_QC: ["PACKED", "CANCELLED"],
    PACKED: ["HANDED_TO_COURIER", "READY_FOR_PICKUP"],
    HANDED_TO_COURIER: ["DELIVERED", "PARTIALLY_DELIVERED", "RTO_IN_TRANSIT"],
    PARTIALLY_DELIVERED: ["RTO_IN_TRANSIT"],
    RTO_IN_TRANSIT: ["RTO_RECEIVED"],
    READY_FOR_PICKUP: ["DELIVERED_COUNTER", "PICKUP_EXPIRED"],
    DELIVERED: [],
    DELIVERED_COUNTER: [],
    RTO_RECEIVED: [],
    PICKUP_EXPIRED: [],
    CANCELLED: [],
    // Disallowed for REGULAR_DROP_PACK
    DEPOSIT_PENDING: [],
    DEPOSIT_PAID: [],
    SOURCED_IN_TRANSIT: [],
    REPRICING_PENDING: [],
    ARRIVED_GODOWN: [],
    QC_VERIFIED_BALANCE_DUE: [],
    BALANCE_PAID: [],
    BALANCE_COD_SCHEDULED: [],
    BALANCE_COUNTER_SCHEDULED: [],
    DEPOSIT_FORFEITED_CANCELLED: [],
    CANCELLED_REFUNDED: [],
  },

  PRE_ORDER: {
    DEPOSIT_PENDING: ["DEPOSIT_PAID", "CANCELLED"],
    DEPOSIT_PAID: ["SOURCED_IN_TRANSIT", "CANCELLED_REFUNDED", "REPRICING_PENDING"],
    SOURCED_IN_TRANSIT: [
      "ARRIVED_GODOWN",
      "REPRICING_PENDING",
      "CANCELLED_REFUNDED",
    ],
    REPRICING_PENDING: [
      "DEPOSIT_PAID",
      "SOURCED_IN_TRANSIT",
      "CANCELLED_REFUNDED",
    ],
    ARRIVED_GODOWN: ["QC_VERIFIED_BALANCE_DUE"],
    QC_VERIFIED_BALANCE_DUE: [
      "BALANCE_PAID",
      "BALANCE_COD_SCHEDULED",
      "BALANCE_COUNTER_SCHEDULED",
      "DEPOSIT_FORFEITED_CANCELLED",
    ],
    BALANCE_COUNTER_SCHEDULED: ["DELIVERED_COUNTER", "PICKUP_EXPIRED", "CANCELLED"],
    BALANCE_PAID: ["PACKED"],
    BALANCE_COD_SCHEDULED: ["PACKED"],
    PACKED: ["HANDED_TO_COURIER", "READY_FOR_PICKUP"],
    HANDED_TO_COURIER: ["DELIVERED", "PARTIALLY_DELIVERED", "RTO_IN_TRANSIT"],
    PARTIALLY_DELIVERED: ["RTO_IN_TRANSIT"],
    RTO_IN_TRANSIT: ["RTO_RECEIVED"],
    READY_FOR_PICKUP: ["DELIVERED_COUNTER", "PICKUP_EXPIRED"],
    DELIVERED: [],
    DELIVERED_COUNTER: [],
    RTO_RECEIVED: [],
    PICKUP_EXPIRED: [],
    CANCELLED: [],
    DEPOSIT_FORFEITED_CANCELLED: [],
    CANCELLED_REFUNDED: [],
    // Disallowed for PRE_ORDER
    PENDING_PAYMENT: [],
    CONFIRMED: [],
    SOURCING: [],
    AT_GODOWN_QC: [],
  },
};

export type TransitionGuard = (context: {
  order: typeof orders.$inferSelect;
  to: OrderStatus;
  actor: Actor;
  reason?: string;
  metadata?: Record<string, unknown>;
}) => Promise<void> | void;

/**
 * Optional transition guards enforcing business rules prior to status transition.
 */
export const transitionGuards: TransitionGuard[] = [
  // Rule: Customers cannot cancel an order once in SOURCING (PRD §3.4.6)
  ({ order, to, actor }) => {
    if (order.status === "SOURCING" && to === "CANCELLED") {
      if (actor.type === "customer") {
        throw new BusinessError(
          "ERR_CANCELLATION_DISALLOWED",
          "Customer cannot cancel order once sourcing has commenced. Please contact support.",
          { orderId: order.id, status: order.status },
          422
        );
      }
    }
  },

  // Rule: Returning from REPRICING_PENDING must restore recorded previous status or CANCELLED_REFUNDED
  ({ order, to, metadata }) => {
    if (order.status === "REPRICING_PENDING" && to !== "CANCELLED_REFUNDED") {
      const prev = metadata?.previousStatus as OrderStatus | undefined;
      if (prev && to !== prev) {
        throw new BusinessError(
          "ERR_ILLEGAL_TRANSITION",
          `REPRICING_PENDING can only return to previous status '${prev}', but attempted '${to}'`,
          { orderId: order.id, expected: prev, attempted: to },
          409
        );
      }
    }
  },
];

/**
 * Transition an order to a target status inside a database transaction.
 * Follows architechture.md §8.3 (SELECT ... FOR UPDATE, validate, update, history, outbox).
 */
export async function transitionOrder(
  tx: Tx,
  orderId: string,
  to: OrderStatus,
  actor: Actor,
  reason?: string,
  metadata?: Record<string, unknown>
): Promise<typeof orders.$inferSelect> {
  // 1. Row-lock order
  const order = await ordersRepo.getOrderForUpdate(tx, orderId);
  if (!order) {
    throw new NotFoundError(`Order '${orderId}' not found`);
  }

  // 2. Validate transition against TRANSITIONS matrix
  const orderTypeKey =
    order.orderType === ("REGULAR" as any)
      ? "REGULAR_DROP_PACK"
      : order.orderType;
  const allowed = (TRANSITIONS as any)[orderTypeKey]?.[order.status] ?? [];
  if (!allowed.includes(to)) {
    throw new BusinessError(
      "ERR_ILLEGAL_TRANSITION",
      `Illegal transition from '${order.status}' to '${to}' for ${order.orderType} order`,
      { orderId, from: order.status, to, orderType: order.orderType },
      409
    );
  }

  // 3. Run transition guards
  for (const guard of transitionGuards) {
    await guard({ order, to, actor, reason, metadata });
  }

  // 4. Determine timestamps and updates
  const now = new Date();
  const updates: Partial<typeof orders.$inferInsert> = {
    status: to,
    updatedAt: now,
  };

  if (to === "CONFIRMED" || to === "DEPOSIT_PAID") {
    if (!order.confirmedAt) {
      updates.confirmedAt = now;
    }
  }

  if (
    to === "CANCELLED" ||
    to === "CANCELLED_REFUNDED" ||
    to === "DEPOSIT_FORFEITED_CANCELLED"
  ) {
    updates.cancelledAt = now;
    updates.cancelReason = reason ?? null;
  }

  // 5. Apply update
  const updatedOrder = await ordersRepo.updateOrder(tx, orderId, updates);

  // 6. Record append-only history row
  const actorType: OrderActorType =
    actor.type === "customer"
      ? "CUSTOMER"
      : actor.type === "staff"
      ? "STAFF"
      : "SYSTEM";

  await ordersRepo.createStatusHistory(tx, {
    orderId,
    fromStatus: order.status,
    toStatus: to,
    actorType,
    actorId: actor.id ?? null,
    reason: reason ?? null,
    metadata: metadata ?? {},
  });

  // 7. Emit outbox event
  await emitOutbox(tx, {
    type: "order.status_changed",
    aggregateType: "order",
    aggregateId: orderId,
    payload: {
      orderId,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      fromStatus: order.status,
      toStatus: to,
      actorType,
      actorId: actor.id,
      reason,
      metadata,
    },
  });

  return updatedOrder;
}

export interface RecomputePaymentResult {
  previousPaymentStatus: PaymentStatus;
  nextPaymentStatus: PaymentStatus;
  paidTotalPaisa: number;
  refundedTotalPaisa: number;
}

/**
 * Recompute order payment status derived strictly from payment_transactions and refunds.
 * Payment status is NEVER set manually (PRD §3.12).
 */
export async function recomputePaymentStatus(
  tx: Tx,
  orderId: string
): Promise<RecomputePaymentResult> {
  const order = await ordersRepo.getOrderForUpdate(tx, orderId);
  if (!order) {
    throw new NotFoundError(`Order '${orderId}' not found`);
  }

  const txs = await ordersRepo.listPaymentTransactionsForOrder(tx, orderId);

  const paidTxs = txs.filter((t) => t.status === "PAID");
  const sumPaid = paidTxs.reduce((sum, t) => sum + t.amountPaisa, 0);
  const sumRefunded = order.refundedTotalPaisa;

  const hasPending = txs.some(
    (t) =>
      t.status === "PENDING" ||
      t.status === "INITIATED" ||
      t.status === "HOLD_REVIEW"
  );
  const hasFailed = txs.some((t) => t.status === "FAILED");

  let nextStatus: PaymentStatus;

  if (sumRefunded > 0 && sumPaid > 0 && sumRefunded >= sumPaid) {
    nextStatus = "REFUNDED";
  } else if (sumRefunded > 0 && sumPaid > 0 && sumRefunded < sumPaid) {
    nextStatus = "PARTIALLY_REFUNDED";
  } else if (sumPaid >= order.totalPayablePaisa && order.totalPayablePaisa > 0) {
    nextStatus = "PAID";
  } else if (order.paymentMode === "PREORDER_DEPOSIT") {
    if (sumPaid >= order.totalPayablePaisa) {
      nextStatus = "PAID";
    } else if (
      sumPaid >= order.advanceRequiredPaisa &&
      order.advanceRequiredPaisa > 0
    ) {
      nextStatus = "PARTIALLY_PAID";
    } else if (sumPaid > 0) {
      nextStatus = "PARTIALLY_PAID";
    } else if (hasPending) {
      nextStatus = "PENDING";
    } else if (hasFailed) {
      nextStatus = "FAILED";
    } else {
      nextStatus = "UNPAID";
    }
  } else if (order.paymentMode === "COD") {
    if (order.advanceRequiredPaisa > 0) {
      if (sumPaid >= order.advanceRequiredPaisa) {
        if (
          order.status === "DELIVERED" ||
          order.status === "DELIVERED_COUNTER"
        ) {
          nextStatus =
            sumPaid >= order.totalPayablePaisa ? "PAID" : "PARTIALLY_PAID";
        } else {
          nextStatus = "PARTIALLY_PAID";
        }
      } else if (sumPaid > 0) {
        nextStatus = "PARTIALLY_PAID";
      } else if (hasPending) {
        nextStatus = "PENDING";
      } else if (hasFailed) {
        nextStatus = "FAILED";
      } else {
        nextStatus = "UNPAID";
      }
    } else {
      // 100% COD without advance fee
      if (sumPaid >= order.totalPayablePaisa) {
        nextStatus = "PAID";
      } else if (sumPaid > 0) {
        nextStatus = "PARTIALLY_PAID";
      } else if (hasPending) {
        nextStatus = "PENDING";
      } else if (hasFailed) {
        nextStatus = "FAILED";
      } else {
        nextStatus = "UNPAID";
      }
    }
  } else {
    // ONLINE_FULL, PAY_AT_COUNTER
    if (sumPaid >= order.totalPayablePaisa) {
      nextStatus = "PAID";
    } else if (sumPaid > 0) {
      nextStatus = "PARTIALLY_PAID";
    } else if (hasPending) {
      nextStatus = "PENDING";
    } else if (hasFailed) {
      nextStatus = "FAILED";
    } else {
      nextStatus = "UNPAID";
    }
  }

  const prevStatus = order.paymentStatus;

  if (order.paidTotalPaisa !== sumPaid || prevStatus !== nextStatus) {
    await ordersRepo.updateOrder(tx, orderId, {
      paidTotalPaisa: sumPaid,
      paymentStatus: nextStatus,
      updatedAt: new Date(),
    });

    if (prevStatus !== nextStatus) {
      await emitOutbox(tx, {
        type: "order.payment_status_changed",
        aggregateType: "order",
        aggregateId: orderId,
        payload: {
          orderId,
          orderNumber: order.orderNumber,
          previousStatus: prevStatus,
          nextStatus,
          paidTotalPaisa: sumPaid,
        },
      });
    }
  }

  return {
    previousPaymentStatus: prevStatus,
    nextPaymentStatus: nextStatus,
    paidTotalPaisa: sumPaid,
    refundedTotalPaisa: sumRefunded,
  };
}
