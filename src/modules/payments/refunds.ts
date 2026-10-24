import { Actor } from "@/lib/http/route";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  BusinessError,
} from "@/lib/errors";
import { emitOutbox } from "@/lib/outbox";
import { aesGcmEncrypt, aesGcmDecrypt } from "@/lib/crypto";
import { addBusinessDays } from "@/lib/time";
import { generateRefundNumber } from "@/db/counters";
import { ordersRepo } from "@/modules/orders/repo";
import { ledgerService, postingRules } from "@/modules/ledger";
import { promotionsService } from "@/modules/promotions";
import {
  refundableAmountForLines,
  RefundableOrder,
  COURIER_HANDED_STATUSES,
} from "@/modules/orders/pricing/refund";
import { getSslcommerzClient, MockSslcommerzClient } from "./client";
import { refundsRepo } from "./repo";
import { paymentsPolicies } from "./policies";
import {
  RefundRow,
  InsertRefundRow,
  RefundStatus,
  RefundMethod,
  RefundReason,
} from "./schema";
import {
  RequestRefundInput,
  ApproveRefundInput,
  RejectRefundInput,
  ExecuteManualRefundInput,
  ChooseStoreCreditInput,
  ListRefundsQuery,
  RefundDetailDto,
  RefundEventDto,
} from "./dto";
import { REFUND_EVENTS } from "./events";

export const refundsService = {
  /**
   * 1. Request a refund (Staff or System Events)
   * Amount is computed server-side with refundableAmountForLines (never trusted from input).
   * Total refunds are strictly capped at order paidTotalPaisa.
   * Full pre-fulfillment cancellations by SYSTEM are auto-approved.
   */
  async requestRefund(
    actor: Actor,
    input: RequestRefundInput
  ): Promise<RefundRow> {
    paymentsPolicies.assertCanRequestRefund(actor);

    // 1. Retrieve order with full line items and transaction details
    const order = await ordersRepo.getOrderWithDetails(undefined, input.order_id);
    if (!order) {
      throw new NotFoundError(`Order '${input.order_id}' not found`);
    }

    // 2. Identify target order line items
    const allLineIds = (order.items || []).map((i) => i.id);
    const targetLineIds =
      input.order_item_ids && input.order_item_ids.length > 0
        ? input.order_item_ids
        : allLineIds;

    // 3. Compute server-side refundable amount via pricing engine
    const lines = (order.items || []).map((i) => {
      const lineTotal =
        i.lineTotalPaisa ??
        (i as any).totalPaisa ??
        (i.unitPricePaisa ? i.unitPricePaisa * (i.qty || 1) : 0);
      const discount = i.allocatedDiscountPaisa ?? 0;
      return {
        id: i.id,
        netPaisa: Math.max(0, lineTotal - discount),
      };
    });

    const refundableOrder: RefundableOrder = {
      status: order.status,
      lines,
      advanceFeePaisa: order.advanceFeePaisa ?? (order as any).deliveryFeePaisa ?? (order as any).shippingTotalPaisa ?? 0,
      handedToCourier: COURIER_HANDED_STATUSES.has(order.status),
    };

    let calculatedAmountPaisa = 0;
    let isFullOrder = true;
    if (lines.length > 0) {
      const refundCalc = refundableAmountForLines(refundableOrder, targetLineIds);
      calculatedAmountPaisa = refundCalc.totalRefundablePaisa;
      isFullOrder = refundCalc.isFullOrderRefund;
    } else {
      calculatedAmountPaisa = order.paidTotalPaisa ?? 0;
    }

    // 4. Cap total refunds at paid_total (cannot refund more than paid)
    const existingRefunds = await refundsRepo.listRefundsForOrder(order.id);
    const alreadyRefundedOrCommitted = existingRefunds
      .filter(
        (r) =>
          r.status === "COMPLETED" ||
          r.status === "PROCESSING" ||
          r.status === "APPROVED" ||
          r.status === "REQUESTED"
      )
      .reduce((sum, r) => sum + r.amountPaisa, 0);

    const paidTotal = order.paidTotalPaisa ?? 0;
    const maxRefundable = Math.max(0, paidTotal - alreadyRefundedOrCommitted);

    if (calculatedAmountPaisa > maxRefundable) {
      if (maxRefundable <= 0) {
        throw new BadRequestError(
          `Cannot refund more than paid: order '${order.orderNumber}' has paid ৳${(
            paidTotal / 100
          ).toFixed(2)} and already has ৳${(
            alreadyRefundedOrCommitted / 100
          ).toFixed(2)} in processed/requested refunds.`
        );
      }
    }

    const finalAmountPaisa = Math.min(calculatedAmountPaisa, maxRefundable);

    // 5. Determine if refund is before delivery
    const isBeforeDelivery =
      order.status !== "DELIVERED" &&
      order.status !== "DELIVERED_COUNTER" &&
      order.status !== "PARTIALLY_DELIVERED";

    // 6. Determine refund method
    const onlineTx = (order.transactions || []).find(
      (t) => (t.status === "VALID" || t.status === "PAID") && t.bankTranId
    );

    let defaultMethod: RefundMethod = "BKASH";
    if (onlineTx?.bankTranId) {
      defaultMethod = "GATEWAY";
    }

    const method: RefundMethod = input.method || defaultMethod;

    // 7. Encrypt payout account details if provided
    let encryptedPayoutAccount: string | null = null;
    if (input.payout_account) {
      encryptedPayoutAccount = aesGcmEncrypt(input.payout_account);
    }

    // 8. Auto-approve system-generated refunds for full cancellations before fulfillment
    const isPreFulfillmentCancellation =
      actor.type === "system" &&
      isBeforeDelivery &&
      (input.reason === "CUSTOMER_CANCELLATION" ||
        input.reason === "STOCKOUT" ||
        input.reason === "PREORDER_IMPORT_FAILED" ||
        input.reason === "PREORDER_DELAY_CANCEL" ||
        input.reason === "REPRICING_REJECTED" ||
        input.reason === "RISK_REJECTED") &&
      isFullOrder;

    const now = new Date();
    const status: RefundStatus = isPreFulfillmentCancellation ? "APPROVED" : "REQUESTED";
    const approvedBy = isPreFulfillmentCancellation ? "SYSTEM" : null;
    const approvedAt = isPreFulfillmentCancellation ? now : null;
    const dueBy = isPreFulfillmentCancellation ? addBusinessDays(now, 7) : null;

    // 9. Generate gapless sequential refund number (REF-YYYY-NNNNN)
    const refundNumber = await generateRefundNumber(null, now);

    // 10. Persist refund record
    const refund = await refundsRepo.createRefund({
      refundNumber,
      orderId: order.id,
      orderItemIds: targetLineIds,
      paymentTranId: onlineTx?.tranId ?? null,
      amountPaisa: finalAmountPaisa,
      reason: input.reason,
      method,
      status,
      isBeforeDelivery,
      requestedByType: actor.type.toUpperCase() as any,
      requestedById: actor.id ?? null,
      approvedBy,
      approvedAt,
      dueBy,
      payoutAccount: encryptedPayoutAccount,
    });

    // 11. Record initial append-only events
    await refundsRepo.recordRefundEvent({
      refundId: refund.id,
      fromStatus: null,
      toStatus: "REQUESTED",
      actorType: actor.type.toUpperCase(),
      actorId: actor.id ?? null,
      notes: input.notes || `Refund requested for reason: ${input.reason}`,
      metadata: {
        amountPaisa: finalAmountPaisa,
        orderNumber: order.orderNumber,
        isBeforeDelivery,
      },
    });

    if (isPreFulfillmentCancellation) {
      await refundsRepo.recordRefundEvent({
        refundId: refund.id,
        fromStatus: "REQUESTED",
        toStatus: "APPROVED",
        actorType: "SYSTEM",
        actorId: "SYSTEM",
        notes: "Auto-approved by SYSTEM for full cancellation before fulfillment.",
        metadata: {
          approvedBy: "SYSTEM",
          dueBy: dueBy?.toISOString(),
        },
      });
    }

    // 12. Emit outbox events
    await emitOutbox(undefined, {
      type: REFUND_EVENTS.REQUESTED,
      aggregateType: "refund",
      aggregateId: refund.id,
      payload: {
        refundId: refund.id,
        refundNumber: refund.refundNumber,
        orderId: refund.orderId,
        amountPaisa: refund.amountPaisa,
        reason: refund.reason,
        method: refund.method,
        isBeforeDelivery: refund.isBeforeDelivery,
        requestedByType: refund.requestedByType,
        requestedById: refund.requestedById,
      },
      notificationClass: "B",
    });

    if (isPreFulfillmentCancellation) {
      await emitOutbox(undefined, {
        type: REFUND_EVENTS.APPROVED,
        aggregateType: "refund",
        aggregateId: refund.id,
        payload: {
          refundId: refund.id,
          refundNumber: refund.refundNumber,
          orderId: refund.orderId,
          amountPaisa: refund.amountPaisa,
          method: refund.method,
          approvedBy: "SYSTEM",
          approvedAt: now.toISOString(),
          dueBy: dueBy?.toISOString() ?? null,
        },
        notificationClass: "B",
      });

      // If method is GATEWAY, auto-initiate
      if (refund.method === "GATEWAY") {
        await this.initiateGatewayRefund(actor, refund.id).catch(() => {});
      }
    }

    return refund;
  },

  /**
   * 2. Approve a refund (Support <= ৳1k, Finance <= ৳20k, Admin above)
   */
  async approveRefund(
    actor: Actor,
    identifier: string,
    input?: ApproveRefundInput
  ): Promise<RefundRow> {
    const refund = await refundsRepo.getRefundByIdOrNumber(identifier);
    if (!refund) {
      throw new NotFoundError(`Refund '${identifier}' not found`);
    }

    if (refund.status === "APPROVED" || refund.status === "COMPLETED") {
      return refund;
    }

    if (refund.status !== "REQUESTED") {
      throw new BadRequestError(
        `Refund '${refund.refundNumber}' is in status '${refund.status}' and cannot be approved.`
      );
    }

    // Enforce approval limit boundaries per PRD §3.14.2 & Flow 13
    paymentsPolicies.assertCanApproveRefund(actor, refund.amountPaisa);

    const now = new Date();
    const dueBy = addBusinessDays(now, 7);

    const updated = await refundsRepo.updateRefund(refund.id, {
      status: "APPROVED",
      approvedBy: actor.id,
      approvedAt: now,
      dueBy,
    });

    await refundsRepo.recordRefundEvent({
      refundId: refund.id,
      fromStatus: refund.status,
      toStatus: "APPROVED",
      actorType: actor.type.toUpperCase(),
      actorId: actor.id,
      notes: input?.notes || `Refund approved by ${actor.type} (${actor.id})`,
      metadata: {
        amountPaisa: refund.amountPaisa,
        dueBy: dueBy.toISOString(),
      },
    });

    await emitOutbox(undefined, {
      type: REFUND_EVENTS.APPROVED,
      aggregateType: "refund",
      aggregateId: refund.id,
      payload: {
        refundId: refund.id,
        refundNumber: refund.refundNumber,
        orderId: refund.orderId,
        amountPaisa: refund.amountPaisa,
        method: refund.method,
        approvedBy: actor.id,
        approvedAt: now.toISOString(),
        dueBy: dueBy.toISOString(),
      },
      notificationClass: "B",
    });

    // If method is GATEWAY, initiate gateway refund
    if (updated.method === "GATEWAY") {
      try {
        return await this.initiateGatewayRefund(actor, updated.id);
      } catch {
        // Leave in APPROVED for background retry
      }
    }

    return updated;
  },

  /**
   * 3. Reject a refund with reason
   */
  async rejectRefund(
    actor: Actor,
    identifier: string,
    input: RejectRefundInput
  ): Promise<RefundRow> {
    const refund = await refundsRepo.getRefundByIdOrNumber(identifier);
    if (!refund) {
      throw new NotFoundError(`Refund '${identifier}' not found`);
    }

    if (refund.status === "COMPLETED") {
      throw new BadRequestError("Cannot reject an already completed refund");
    }

    const updated = await refundsRepo.updateRefund(refund.id, {
      status: "REJECTED",
    });

    await refundsRepo.recordRefundEvent({
      refundId: refund.id,
      fromStatus: refund.status,
      toStatus: "REJECTED",
      actorType: actor.type.toUpperCase(),
      actorId: actor.id,
      notes: input.reason + (input.notes ? ` - ${input.notes}` : ""),
      metadata: { reason: input.reason },
    });

    await emitOutbox(undefined, {
      type: REFUND_EVENTS.REJECTED,
      aggregateType: "refund",
      aggregateId: refund.id,
      payload: {
        refundId: refund.id,
        refundNumber: refund.refundNumber,
        orderId: refund.orderId,
        rejectedBy: actor.id,
        reason: input.reason,
      },
      notificationClass: "B",
    });

    return updated;
  },

  /**
   * 4. Initiate Gateway Refund (SSLCommerz Refund API)
   */
  async initiateGatewayRefund(
    actor: Actor,
    identifier: string
  ): Promise<RefundRow> {
    const refund = await refundsRepo.getRefundByIdOrNumber(identifier);
    if (!refund) {
      throw new NotFoundError(`Refund '${identifier}' not found`);
    }

    if (refund.status !== "APPROVED" && refund.status !== "PROCESSING") {
      throw new BadRequestError(
        `Cannot initiate gateway refund for refund in status '${refund.status}'`
      );
    }

    const order = await ordersRepo.getOrderWithDetails(undefined, refund.orderId);
    if (!order) {
      throw new NotFoundError(`Order '${refund.orderId}' not found`);
    }

    const onlineTx = (order.transactions || []).find(
      (t) => t.bankTranId || t.status === "VALID" || t.status === "PAID"
    );
    const bankTranId = onlineTx?.bankTranId || `BANK_TRAN_${order.orderNumber}`;

    const sslClient = getSslcommerzClient();
    const refundRes = await sslClient.initiateRefund({
      bank_tran_id: bankTranId,
      refund_amount: (refund.amountPaisa / 100).toFixed(2),
      refund_remarks: `Refund ${refund.refundNumber}`,
      re_fe_id: refund.refundNumber,
    });

    if (refundRes.status === "success" && refundRes.refund_ref_id) {
      const updated = await refundsRepo.updateRefund(refund.id, {
        status: "PROCESSING",
        gatewayRefundRef: refundRes.refund_ref_id,
      });

      await refundsRepo.recordRefundEvent({
        refundId: refund.id,
        fromStatus: refund.status,
        toStatus: "PROCESSING",
        actorType: actor.type.toUpperCase(),
        actorId: actor.id,
        notes: `Gateway refund initiated with ref '${refundRes.refund_ref_id}'.`,
        metadata: {
          refundRefId: refundRes.refund_ref_id,
          bankTranId,
        },
      });

      await emitOutbox(undefined, {
        type: REFUND_EVENTS.PROCESSING,
        aggregateType: "refund",
        aggregateId: refund.id,
        payload: {
          refundId: refund.id,
          refundNumber: refund.refundNumber,
          gatewayRefundRef: refundRes.refund_ref_id,
        },
        notificationClass: "B",
      });

      // Poll status immediately
      const queryRes = await sslClient.queryRefund(refundRes.refund_ref_id);
      const queryStatus = queryRes.refund_status?.toUpperCase();
      if (queryStatus === "COMPLETED" || queryStatus === "SUCCESS") {
        return await this.completeRefund(actor, refund.id, {
          method: "GATEWAY",
          externalRef: refundRes.refund_ref_id,
        });
      }

      return updated;
    } else {
      const updated = await refundsRepo.updateRefund(refund.id, {
        status: "FAILED",
      });

      await refundsRepo.recordRefundEvent({
        refundId: refund.id,
        fromStatus: refund.status,
        toStatus: "FAILED",
        actorType: actor.type.toUpperCase(),
        actorId: actor.id,
        notes: `Gateway refund initiation failed: ${
          refundRes.errorReason || "Unknown error"
        }`,
      });

      await emitOutbox(undefined, {
        type: REFUND_EVENTS.FAILED,
        aggregateType: "refund",
        aggregateId: refund.id,
        payload: {
          refundId: refund.id,
          refundNumber: refund.refundNumber,
          orderId: refund.orderId,
          amountPaisa: refund.amountPaisa,
          method: "GATEWAY",
          errorReason: refundRes.errorReason || "Gateway rejection",
        },
        notificationClass: "B",
      });

      return updated;
    }
  },

  /**
   * 5. Poll Gateway Refund Status (Job every 30 min)
   */
  async pollGatewayRefundStatus(
    actor: Actor,
    identifier: string
  ): Promise<RefundRow> {
    const refund = await refundsRepo.getRefundByIdOrNumber(identifier);
    if (!refund) {
      throw new NotFoundError(`Refund '${identifier}' not found`);
    }

    if (refund.status !== "PROCESSING" || !refund.gatewayRefundRef) {
      return refund;
    }

    const sslClient = getSslcommerzClient();
    const queryRes = await sslClient.queryRefund(refund.gatewayRefundRef);
    const normalizedStatus = queryRes.refund_status?.toUpperCase();

    if (normalizedStatus === "COMPLETED" || normalizedStatus === "SUCCESS") {
      return await this.completeRefund(actor, refund.id, {
        method: "GATEWAY",
        externalRef: refund.gatewayRefundRef,
      });
    } else if (normalizedStatus === "FAILED" || normalizedStatus === "CANCELLED") {
      const updated = await refundsRepo.updateRefund(refund.id, {
        status: "FAILED",
      });
      await refundsRepo.recordRefundEvent({
        refundId: refund.id,
        fromStatus: "PROCESSING",
        toStatus: "FAILED",
        actorType: actor.type.toUpperCase(),
        actorId: actor.id,
        notes: `Gateway reported refund failure: ${
          queryRes.errorReason || "Declined"
        }`,
      });
      return updated;
    }

    return refund;
  },

  /**
   * 6. Manual Payout Execution (FINANCE_OFFICER)
   * POST /api/v1/finance/refunds/execute
   */
  async executeManualPayout(
    actor: Actor,
    input: ExecuteManualRefundInput
  ): Promise<RefundRow> {
    paymentsPolicies.assertCanExecuteRefund(actor);

    const identifier = input.refund_id;
    if (!identifier) {
      throw new BadRequestError("refund_id is required");
    }

    const refund = await refundsRepo.getRefundByIdOrNumber(identifier);
    if (!refund) {
      throw new NotFoundError(`Refund '${identifier}' not found`);
    }

    if (refund.status === "COMPLETED") {
      return refund;
    }

    if (refund.status === "REJECTED") {
      throw new BadRequestError("Cannot execute a rejected refund");
    }

    // Auto-approve if needed when within Finance authority
    if (refund.status === "REQUESTED") {
      paymentsPolicies.assertCanApproveRefund(actor, refund.amountPaisa);
      await this.approveRefund(actor, refund.id);
    }

    return await this.completeRefund(actor, refund.id, {
      method: (input.method === "SSLCOMMERZ_API" ? "GATEWAY" : input.method) as RefundMethod,
      externalRef: input.external_ref,
      proofMediaId: input.proof_media_id ?? null,
      notes: input.notes,
    });
  },

  /**
   * 7. Customer Store Credit Choice
   * POST /api/v1/orders/:orderNumber/refunds/:id/choose-store-credit
   * Customer elects to receive withdrawable, never-expiring store credit instead of cash.
   */
  async chooseStoreCredit(
    actor: Actor,
    orderNumber: string,
    refundIdentifier: string,
    input?: ChooseStoreCreditInput
  ): Promise<RefundRow> {
    const order = await ordersRepo.getOrderByNumber(undefined, orderNumber);
    if (!order) {
      throw new NotFoundError(`Order '${orderNumber}' not found`);
    }

    // Verify customer ownership
    if (actor.type === "customer" && order.customerId !== actor.id) {
      throw new ForbiddenError("You can only select store credit for your own order");
    }

    const refund = await refundsRepo.getRefundByIdOrNumber(refundIdentifier);
    if (!refund) {
      throw new NotFoundError(`Refund '${refundIdentifier}' not found`);
    }

    if (refund.orderId !== order.id) {
      throw new BadRequestError("Refund does not belong to the specified order");
    }

    if (refund.status === "COMPLETED") {
      throw new BadRequestError("Refund has already been completed");
    }

    if (refund.status === "REJECTED") {
      throw new BadRequestError("Cannot select store credit for a rejected refund");
    }

    // Issue withdrawable, never-expiring store credit (PRD §3.14.6)
    await promotionsService.issueStoreCredit(undefined, {
      customerId: order.customerId,
      amountPaisa: refund.amountPaisa,
      reason: "REFUND_AS_CREDIT",
      withdrawable: true,
      expiresAt: null,
      refType: "REFUND",
      refId: refund.id,
    });

    return await this.completeRefund(actor, refund.id, {
      method: "STORE_CREDIT",
      notes:
        input?.notes ||
        "Customer explicitly elected to receive withdrawable, never-expiring store credit.",
    });
  },

  /**
   * Internal Completion Helper: Posts Double-Entry Ledger, Updates Order Payment Status,
   * Emits Notification 4 (Class A)
   */
  async completeRefund(
    actor: Actor,
    refundId: string,
    completion: {
      method: RefundMethod;
      externalRef?: string | null;
      proofMediaId?: string | null;
      notes?: string | null;
    }
  ): Promise<RefundRow> {
    const refund = await refundsRepo.getRefundById(refundId);
    if (!refund) {
      throw new NotFoundError(`Refund '${refundId}' not found`);
    }

    const order = await ordersRepo.getOrderWithDetails(undefined, refund.orderId);
    if (!order) {
      throw new NotFoundError(`Order '${refund.orderId}' not found`);
    }

    const now = new Date();
    const updated = await refundsRepo.updateRefund(refund.id, {
      status: "COMPLETED",
      method: completion.method,
      externalRef: completion.externalRef ?? refund.externalRef,
      proofMediaId: completion.proofMediaId ?? refund.proofMediaId,
      executedBy: actor.id,
      executedAt: now,
    });

    // 1. Post Double-Entry Ledger Entry
    const isPreOrder = order.orderType === "PRE_ORDER";
    const ledgerMethod: "GATEWAY" | "MANUAL" | "STORE_CREDIT" =
      completion.method === "STORE_CREDIT"
        ? "STORE_CREDIT"
        : completion.method === "GATEWAY"
        ? "GATEWAY"
        : "MANUAL";

    if (refund.isBeforeDelivery) {
      const lines = postingRules.REFUND_BEFORE_DELIVERY({
        amountPaisa: refund.amountPaisa,
        orderId: order.id,
        isPreOrder,
        method: ledgerMethod,
        customerId: order.customerId,
      });

      await ledgerService.post(
        undefined,
        {
          eventType: "REFUND_BEFORE_DELIVERY",
          sourceType: "REFUND",
          sourceId: refund.id,
          description: `Refund ${refund.refundNumber}`,
          lines,
        },
        actor
      );
    } else {
      // Refund after delivery (RMA)
      const orderTotal =
        order.totalPayablePaisa || order.paidTotalPaisa || refund.amountPaisa;
      const vatRatio =
        order.vatTotalPaisa && orderTotal
          ? order.vatTotalPaisa / orderTotal
          : 0.15 / 1.15;
      const returnVatPaisa = Math.round(refund.amountPaisa * vatRatio);
      const returnRevenueExVatPaisa = refund.amountPaisa - returnVatPaisa;

      const lines = postingRules.REFUND_AFTER_DELIVERY({
        returnRevenueExVatPaisa,
        returnVatPaisa,
        method: ledgerMethod,
        customerId: order.customerId,
        returnedUnitCostPaisa: 0,
      });

      await ledgerService.post(
        undefined,
        {
          eventType: "REFUND_AFTER_DELIVERY",
          sourceType: "REFUND",
          sourceId: refund.id,
          description: `Refund ${refund.refundNumber} (post-delivery)`,
          lines,
        },
        actor
      );
    }

    // 2. Recompute Order Payment Status
    const allOrderRefunds = await refundsRepo.listRefundsForOrder(order.id);
    const completedRefundsTotal = allOrderRefunds
      .filter((r) => r.status === "COMPLETED" || r.id === refund.id)
      .reduce((acc, r) => acc + r.amountPaisa, 0);

    const paidTotal = order.paidTotalPaisa ?? 0;
    let newPaymentStatus = order.paymentStatus;
    if (completedRefundsTotal >= paidTotal && paidTotal > 0) {
      newPaymentStatus = "REFUNDED";
    } else if (completedRefundsTotal > 0) {
      newPaymentStatus = "PARTIALLY_REFUNDED";
    }

    await ordersRepo.updateOrder(undefined, order.id, {
      refundedTotalPaisa: completedRefundsTotal,
      paymentStatus: newPaymentStatus,
    });

    // 3. Record Append-Only Event
    await refundsRepo.recordRefundEvent({
      refundId: refund.id,
      fromStatus: refund.status,
      toStatus: "COMPLETED",
      actorType: actor.type.toUpperCase(),
      actorId: actor.id,
      notes:
        completion.notes ||
        `Refund completed via ${completion.method}. Ref: ${
          completion.externalRef || "N/A"
        }`,
      metadata: {
        method: completion.method,
        externalRef: completion.externalRef,
        orderPaymentStatus: newPaymentStatus,
      },
    });

    // 4. Emit Notification 4 (Class A) & Outbox Event
    await emitOutbox(undefined, {
      type: "notification.class_a_queued",
      aggregateType: "refund",
      aggregateId: refund.id,
      payload: {
        template: "REFUND_COMPLETED",
        recipient: order.customerPhone,
        customerId: order.customerId,
        refundNumber: refund.refundNumber,
        amountPaisa: refund.amountPaisa,
        method: completion.method,
        orderNumber: order.orderNumber,
      },
      notificationClass: "A",
    });

    await emitOutbox(undefined, {
      type: REFUND_EVENTS.COMPLETED,
      aggregateType: "refund",
      aggregateId: refund.id,
      payload: {
        refundId: refund.id,
        refundNumber: refund.refundNumber,
        orderId: refund.orderId,
        amountPaisa: refund.amountPaisa,
        method: completion.method,
        executedBy: actor.id,
        executedAt: now.toISOString(),
        externalRef: completion.externalRef,
        orderPaymentStatus: newPaymentStatus,
      },
      notificationClass: "A",
    });

    return updated;
  },

  /**
   * 8. Hourly SLA Monitor Job
   * Approved refunds not initiated within 24h -> alert finance
   * Not completed by due_by -> escalate to SUPER_ADMIN
   */
  async runSlaMonitorJob(): Promise<{
    alertedApprovedCount: number;
    escalatedCount: number;
  }> {
    const now = new Date();
    const cutoff24h = new Date(now.getTime() - 24 * 3600 * 1000);

    // 1. Approved but not initiated within 24h
    const overdueApproved = await refundsRepo.getOverdueApprovedRefunds(cutoff24h);
    let alertedApprovedCount = 0;
    for (const r of overdueApproved) {
      await emitOutbox(undefined, {
        type: REFUND_EVENTS.SLA_ALERT,
        aggregateType: "refund",
        aggregateId: r.id,
        payload: {
          refundId: r.id,
          refundNumber: r.refundNumber,
          orderId: r.orderId,
          amountPaisa: r.amountPaisa,
          approvedAt: r.approvedAt?.toISOString(),
          message: `Approved refund ${r.refundNumber} (৳${(
            r.amountPaisa / 100
          ).toFixed(2)}) has not been initiated after 24 hours. Finance action required.`,
        },
        notificationClass: "B",
      });
      alertedApprovedCount++;
    }

    // 2. Open refunds past due_by (7 working days) -> Escalate to SUPER_ADMIN
    const overdueOpen = await refundsRepo.getOverdueOpenRefunds(now);
    let escalatedCount = 0;
    for (const r of overdueOpen) {
      await emitOutbox(undefined, {
        type: REFUND_EVENTS.SLA_ESCALATION,
        aggregateType: "refund",
        aggregateId: r.id,
        payload: {
          refundId: r.id,
          refundNumber: r.refundNumber,
          orderId: r.orderId,
          amountPaisa: r.amountPaisa,
          dueBy: r.dueBy?.toISOString(),
          status: r.status,
          message: `URGENT: Refund ${r.refundNumber} exceeded 7-working-day SLA due date (${r.dueBy?.toLocaleDateString(
            "en-GB"
          )}). Escalated to Super Admin.`,
        },
        notificationClass: "A",
      });
      escalatedCount++;
    }

    return { alertedApprovedCount, escalatedCount };
  },

  /**
   * 9. List Refunds (Admin Queue)
   */
  async listRefunds(
    actor: Actor,
    query?: ListRefundsQuery
  ): Promise<{ items: RefundDetailDto[]; total: number }> {
    paymentsPolicies.canViewPayments(actor);

    const { items, total } = await refundsRepo.listRefunds(query);
    const now = new Date();

    const detailItems: RefundDetailDto[] = items.map((r) => {
      let maskedAccount: string | null = null;
      if (r.payoutAccount) {
        try {
          const dec = aesGcmDecrypt(r.payoutAccount);
          maskedAccount =
            dec.length > 4 ? `***${dec.slice(-4)}` : "***";
        } catch {
          maskedAccount = "***";
        }
      }

      return {
        id: r.id,
        refund_number: r.refundNumber,
        order_id: r.orderId,
        order_item_ids: r.orderItemIds,
        amount_paisa: r.amountPaisa,
        reason: r.reason,
        method: r.method,
        status: r.status,
        is_before_delivery: r.isBeforeDelivery,
        requested_by_type: r.requestedByType,
        requested_by_id: r.requestedById,
        approved_by: r.approvedBy,
        approved_at: r.approvedAt?.toISOString() ?? null,
        executed_by: r.executedBy,
        executed_at: r.executedAt?.toISOString() ?? null,
        external_ref: r.externalRef,
        proof_media_id: r.proofMediaId,
        gateway_refund_ref: r.gatewayRefundRef,
        payout_account_masked: maskedAccount,
        due_by: r.dueBy?.toISOString() ?? null,
        is_overdue:
          Boolean(r.dueBy && r.dueBy.getTime() < now.getTime()) &&
          r.status !== "COMPLETED" &&
          r.status !== "REJECTED",
        created_at: r.createdAt.toISOString(),
        updated_at: r.updatedAt.toISOString(),
      };
    });

    return { items: detailItems, total };
  },

  /**
   * 10. Get Refund Detail by ID or Number
   */
  async getRefundDetail(
    actor: Actor,
    identifier: string
  ): Promise<RefundDetailDto> {
    const refund = await refundsRepo.getRefundByIdOrNumber(identifier);
    if (!refund) {
      throw new NotFoundError(`Refund '${identifier}' not found`);
    }

    const order = await ordersRepo.getOrderById(undefined, refund.orderId);
    paymentsPolicies.assertCanViewRefund(actor, refund, order?.customerId);

    const events = await refundsRepo.listRefundEvents(refund.id);
    const eventDtos: RefundEventDto[] = events.map((e) => ({
      id: e.id,
      from_status: e.fromStatus,
      to_status: e.toStatus,
      actor_type: e.actorType,
      actor_id: e.actorId,
      notes: e.notes,
      created_at: e.createdAt.toISOString(),
    }));

    let maskedAccount: string | null = null;
    if (refund.payoutAccount) {
      try {
        const dec = aesGcmDecrypt(refund.payoutAccount);
        maskedAccount =
          dec.length > 4 ? `***${dec.slice(-4)}` : "***";
      } catch {
        maskedAccount = "***";
      }
    }

    const now = new Date();
    return {
      id: refund.id,
      refund_number: refund.refundNumber,
      order_id: refund.orderId,
      order_number: order?.orderNumber,
      order_item_ids: refund.orderItemIds,
      amount_paisa: refund.amountPaisa,
      reason: refund.reason,
      method: refund.method,
      status: refund.status,
      is_before_delivery: refund.isBeforeDelivery,
      requested_by_type: refund.requestedByType,
      requested_by_id: refund.requestedById,
      approved_by: refund.approvedBy,
      approved_at: refund.approvedAt?.toISOString() ?? null,
      executed_by: refund.executedBy,
      executed_at: refund.executedAt?.toISOString() ?? null,
      external_ref: refund.externalRef,
      proof_media_id: refund.proofMediaId,
      gateway_refund_ref: refund.gatewayRefundRef,
      payout_account_masked: maskedAccount,
      due_by: refund.dueBy?.toISOString() ?? null,
      is_overdue:
        Boolean(refund.dueBy && refund.dueBy.getTime() < now.getTime()) &&
        refund.status !== "COMPLETED" &&
        refund.status !== "REJECTED",
      created_at: refund.createdAt.toISOString(),
      updated_at: refund.updatedAt.toISOString(),
      events: eventDtos,
    };
  },
};
