import { Tx, db } from "@/lib/db";
import { Actor } from "@/lib/http/route";
import { generateOrderNumber } from "@/db/counters";
import { generateTransactionId } from "@/lib/ids";
import { emitOutbox } from "@/lib/outbox";
import { NotFoundError, ForbiddenError, BusinessError } from "@/lib/errors";
import {
  OrderStatus,
  OrderRow,
  PaymentTransactionRow,
  PaymentTransactionStatus,
  OrderActorType,
  OrderType,
  OrderChannel,
} from "./schema";
import {
  ordersRepo,
  OrderWithDetails,
  clearMemoryOrdersForTesting,
} from "./repo";
import {
  transitionOrder as smTransitionOrder,
  recomputePaymentStatus as smRecomputePaymentStatus,
  RecomputePaymentResult,
} from "./state-machine";
import {
  CreateOrderDto,
  CreatePaymentTransactionDto,
} from "./dto";
import { inventoryService } from "@/modules/inventory";
import { promotionsService } from "@/modules/promotions";
import { sourcingService } from "@/modules/sourcing";
import { financeService } from "@/modules/finance";
import { piiSerializers, CustomerRawData } from "@/modules/identity";

export const ordersService = {
  /**
   * Create a new order with items and physical unit records.
   * Special Path: SHOWROOM_POS walk-in orders are created directly as DELIVERED_COUNTER.
   */
  async createOrder(
    tx: Tx,
    dto: CreateOrderDto,
    actor: Actor
  ): Promise<OrderWithDetails> {
    const orderNumber = await generateOrderNumber(tx);

    let initialStatus: OrderStatus;
    if (dto.status) {
      initialStatus = dto.status;
    } else if (
      dto.channel === "SHOWROOM_POS" &&
      dto.fulfillmentChannel === "WALK_IN"
    ) {
      // Special path documented in PRD §3.12 / DECISIONS.md:
      // Walk-in POS orders immediately complete at counter handover.
      initialStatus = "DELIVERED_COUNTER";
    } else if (dto.orderType === "PRE_ORDER") {
      initialStatus = "DEPOSIT_PENDING";
    } else {
      initialStatus = "PENDING_PAYMENT";
    }

    const created = await ordersRepo.createOrder(tx, {
      order: {
        orderNumber,
        customerId: dto.customerId,
        channel: dto.channel,
        orderType: dto.orderType,
        fulfillmentChannel: dto.fulfillmentChannel,
        deliveryZone: dto.deliveryZone ?? null,
        status: initialStatus,
        paymentStatus: dto.paymentStatus ?? "UNPAID",
        paymentMode: dto.paymentMode,
        addressSnapshot: dto.addressSnapshot ?? null,
        subtotalPaisa: dto.subtotalPaisa,
        discountPaisa: dto.discountPaisa ?? 0,
        deliveryFeePaisa: dto.deliveryFeePaisa ?? 0,
        vatTotalPaisa: dto.vatTotalPaisa ?? 0,
        totalPayablePaisa: dto.totalPayablePaisa,
        storeCreditAppliedPaisa: dto.storeCreditAppliedPaisa ?? 0,
        advanceRequiredPaisa: dto.advanceRequiredPaisa ?? 0,
        advancePaidPaisa: dto.advancePaidPaisa ?? 0,
        advancePurpose: dto.advancePurpose ?? null,
        codAmountPaisa: dto.codAmountPaisa ?? 0,
        paidTotalPaisa: 0,
        refundedTotalPaisa: 0,
        couponId: dto.couponId ?? null,
        mushakRequested: dto.mushakRequested ?? false,
        buyerCompanyName: dto.buyerCompanyName ?? null,
        buyerBin: dto.buyerBin ?? null,
      },
      items: dto.items.map((it) => ({
        skuId: it.skuId,
        productId: it.productId,
        titleEn: it.titleEn,
        titleBn: it.titleBn,
        tier: it.tier,
        skuCode: it.skuCode,
        qty: it.qty,
        unitPricePaisa: it.unitPricePaisa,
        allocatedDiscountPaisa: it.allocatedDiscountPaisa ?? 0,
        lineTotalPaisa: it.lineTotalPaisa,
        vatRateBp: it.vatRateBp,
        vatPaisa: it.vatPaisa,
        unitCostPaisa: it.unitCostPaisa ?? null,
        source: it.source,
        sourceLocationId: it.sourceLocationId ?? null,
        status: it.status ?? "ACTIVE",
        units: it.units,
      })),
      preOrder: dto.preOrder
        ? {
            depositPaisa: dto.preOrder.depositPaisa,
            balancePaisa: dto.preOrder.balancePaisa,
            etaDate: dto.preOrder.etaDate,
            etaMinDays: dto.preOrder.etaMinDays,
            etaMaxDays: dto.preOrder.etaMaxDays,
            priceLockedPaisa: dto.preOrder.priceLockedPaisa,
            milestone: dto.preOrder.milestone,
            batchKey: dto.preOrder.batchKey ?? null,
          }
        : undefined,
    });

    const actorType: OrderActorType =
      actor.type === "customer"
        ? "CUSTOMER"
        : actor.type === "staff"
        ? "STAFF"
        : "SYSTEM";

    await ordersRepo.createStatusHistory(tx, {
      orderId: created.id,
      fromStatus: null,
      toStatus: initialStatus,
      actorType,
      actorId: actor.id ?? null,
      reason: "Order placed",
      metadata: {},
    });

    await emitOutbox(tx, {
      type: "order.created",
      aggregateType: "order",
      aggregateId: created.id,
      payload: {
        orderId: created.id,
        orderNumber: created.orderNumber,
        customerId: created.customerId,
        orderType: created.orderType,
        channel: created.channel,
        totalPayablePaisa: created.totalPayablePaisa,
      },
    });

    return created;
  },

  /**
   * Transition order to target status.
   */
  async transitionOrder(
    tx: Tx,
    orderId: string,
    to: OrderStatus,
    actor: Actor,
    reason?: string,
    metadata?: Record<string, unknown>
  ): Promise<OrderRow> {
    return smTransitionOrder(tx, orderId, to, actor, reason, metadata);
  },

  /**
   * Recompute order payment status derived strictly from payment_transactions.
   */
  async recomputePaymentStatus(
    tx: Tx,
    orderId: string
  ): Promise<RecomputePaymentResult> {
    return smRecomputePaymentStatus(tx, orderId);
  },

  /**
   * Record a payment transaction for an order and recompute payment status.
   */
  async createPaymentTransaction(
    tx: Tx,
    dto: CreatePaymentTransactionDto
  ): Promise<PaymentTransactionRow> {
    const tranId = generateTransactionId();

    const created = await ordersRepo.createPaymentTransaction(tx, {
      tranId,
      orderId: dto.orderId,
      customerId: dto.customerId,
      purpose: dto.purpose,
      method: dto.method,
      amountPaisa: dto.amountPaisa,
      currency: dto.currency ?? "BDT",
      status: "INITIATED",
      gatewaySessionKey: dto.gatewaySessionKey ?? null,
      valId: dto.valId ?? null,
      bankTranId: dto.bankTranId ?? null,
      cardType: dto.cardType ?? null,
      riskLevel: dto.riskLevel ?? null,
      riskTitle: dto.riskTitle ?? null,
      rawIpn: dto.rawIpn ?? null,
      rawValidation: dto.rawValidation ?? null,
      externalRef: dto.externalRef ?? null,
    });

    await smRecomputePaymentStatus(tx, dto.orderId);
    return created;
  },

  /**
   * Update payment transaction status (e.g. PAID, FAILED, HOLD_REVIEW).
   */
  async updatePaymentTransactionStatus(
    tx: Tx,
    tranId: string,
    status: PaymentTransactionStatus,
    details?: Partial<PaymentTransactionRow>
  ): Promise<PaymentTransactionRow> {
    const found = await ordersRepo.getPaymentTransactionByTranId(tx, tranId);
    if (!found) {
      throw new NotFoundError(`Transaction '${tranId}' not found`);
    }

    const updated = await ordersRepo.updatePaymentTransaction(tx, found.id, {
      status,
      validatedAt: status === "PAID" ? new Date() : found.validatedAt,
      ...details,
      updatedAt: new Date(),
    });

    await smRecomputePaymentStatus(tx, found.orderId);
    return updated;
  },

  /**
   * Get order with full details (items, physical units, pre-order, history, transactions).
   */
  async getOrder(
    tx: Tx | undefined,
    id: string
  ): Promise<OrderWithDetails | null> {
    return ordersRepo.getOrderWithDetails(tx, id);
  },

  /**
   * Get order with full details by ID.
   */
  async getOrderWithDetails(
    tx: Tx | undefined,
    id: string
  ): Promise<OrderWithDetails | null> {
    return ordersRepo.getOrderWithDetails(tx, id);
  },

  /**
   * Get order with full details by ID.
   */
  async getOrderById(
    tx: Tx | undefined,
    id: string
  ): Promise<OrderWithDetails | null> {
    return ordersRepo.getOrderWithDetails(tx, id);
  },

  /**
   * Get order with full details by orderNumber.
   */
  async getOrderByNumber(
    tx: Tx | undefined,
    orderNumber: string
  ): Promise<OrderWithDetails | null> {
    return ordersRepo.getOrderByNumberWithDetails(tx, orderNumber);
  },

  /**
   * Core checkout flow for REGULAR_DROP_PACK orders.
   */
  async checkout(
    input: import("./checkout").CheckoutInputDto,
    actor: Actor,
    idempotencyKey?: string,
    txClient?: Tx
  ): Promise<import("./checkout").CheckoutResponse> {
    const { checkoutOrder } = await import("./checkout");
    return checkoutOrder(input, actor, idempotencyKey, txClient);
  },

  /**
   * Shared order confirmation logic.
   */
  async confirmOrder(
    tx: Tx,
    orderId: string,
    actor?: Actor
  ): Promise<OrderWithDetails> {
    const { confirmOrder } = await import("./checkout");
    return confirmOrder(tx, orderId, actor);
  },

  /**
   * Retry payment gateway session initialization.
   */
  async retryPayment(
    orderNumber: string,
    actor: Actor
  ): Promise<import("./checkout").OrderCheckoutPaymentNeededResponse> {
    const { retryPayment } = await import("./checkout");
    return retryPayment(orderNumber, actor);
  },

  /**
   * Find payment transaction by tranId.
   */
  async getPaymentTransaction(
    tx: Tx | undefined,
    tranId: string
  ): Promise<PaymentTransactionRow | null> {
    return ordersRepo.getPaymentTransactionByTranId(tx, tranId);
  },

  /**
   * Find payment transaction with row lock.
   */
  async getPaymentTransactionForUpdate(
    tx: Tx | undefined,
    tranId: string
  ): Promise<PaymentTransactionRow | null> {
    return ordersRepo.getPaymentTransactionForUpdate(tx, tranId);
  },

  /**
   * Get pending transactions for reconciliation.
   */
  async getPendingTransactionsForReconciliation(
    olderThanMs?: number,
    newerThanMs?: number,
    tx?: Tx
  ): Promise<PaymentTransactionRow[]> {
    return ordersRepo.getPendingTransactionsForReconciliation(
      olderThanMs,
      newerThanMs,
      tx
    );
  },

  /**
   * List all payment transactions for admin with filters.
   */
  async listAllPaymentTransactions(
    filters: {
      status?: string;
      orderNumber?: string;
      tranId?: string;
      purpose?: string;
      page?: number;
      limit?: number;
    },
    tx?: Tx
  ): Promise<{ rows: (PaymentTransactionRow & { orderNumber?: string })[]; total: number }> {
    return ordersRepo.listAllPaymentTransactions(filters, tx);
  },

  /**
   * Unpaid auto-cancel job (every 15 min):
   * PENDING_PAYMENT / DEPOSIT_PENDING orders older than UNPAID_ORDER_CANCEL_HOURS (24h)
   * -> CANCELLED, release reservations, release coupon, reverse store credit,
   * transactions -> EXPIRED.
   */
  async autoCancelUnpaidOrdersJob(hours: number = 24): Promise<number> {
    const expiredOrders = await ordersRepo.getUnpaidOrdersOlderThan(hours);
    let cancelledCount = 0;

    for (const order of expiredOrders) {
      try {
        const executeCancel = async (tx?: Tx) => {
          // 1. Transition order to CANCELLED
          await smTransitionOrder(
            tx as Tx,
            order.id,
            "CANCELLED",
            { id: "00000000-0000-0000-0000-000000000000", type: "system" },
            "UNPAID_ORDER_TIMEOUT_24H"
          );

          // 2. Release physical reservations
          const { inventoryService } = await import("@/modules/inventory");
          await inventoryService.release(tx, { orderId: order.id });

          // 3. Release coupon redemption if applied
          if (order.couponId) {
            const { promotionsService } = await import("@/modules/promotions");
            await promotionsService.releaseCoupon(tx, order.id);
          }

          // 4. Reverse store credit application if any
          if (order.storeCreditAppliedPaisa > 0) {
            const { promotionsService } = await import("@/modules/promotions");
            await promotionsService.reverseStoreCredit(tx, {
              customerId: order.customerId,
              orderId: order.id,
              amountPaisa: order.storeCreditAppliedPaisa,
              reason: "REVERSAL",
            });
          }

          // 5. Expire open payment transactions
          const txs = await ordersRepo.listPaymentTransactionsForOrder(tx, order.id);
          for (const t of txs) {
            if (t.status === "INITIATED" || t.status === "PENDING") {
              await ordersRepo.updatePaymentTransaction(tx, t.id, {
                status: "EXPIRED",
                updatedAt: new Date(),
              });
            }
          }

          // 6. Emit outbox event
          await emitOutbox(tx, {
            type: "order.cancelled",
            aggregateType: "order",
            aggregateId: order.id,
            payload: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              reason: "UNPAID_ORDER_TIMEOUT_24H",
            },
          });
        };

        try {
          const { db } = await import("@/lib/db");
          await db.transaction(async (tx) => executeCancel(tx));
        } catch {
          await executeCancel(undefined);
        }

        cancelledCount++;
      } catch {
        // Continue with next order
      }
    }

    return cancelledCount;
  },

  /**
   * Helper to evaluate customer cancellation eligibility.
   */
  async evaluateCancellationEligibility(
    order: OrderWithDetails
  ): Promise<{ can_cancel: boolean; reason: string | null }> {
    if (order.status === "CANCELLED") {
      return { can_cancel: false, reason: "Order is already cancelled" };
    }

    if (order.orderType === "REGULAR_DROP_PACK") {
      if (order.status === "PENDING_PAYMENT" || order.status === "CONFIRMED") {
        return { can_cancel: true, reason: null };
      }
      if (order.status === "SOURCING") {
        const hasPurchase = await sourcingService.hasRunnerPurchaseForOrder(order.id);
        if (hasPurchase) {
          return {
            can_cancel: false,
            reason: "Runner purchase has already been recorded for this order. Contact support.",
          };
        }
        return { can_cancel: true, reason: null };
      }
      return {
        can_cancel: false,
        reason: "Cancellation disallowed once order is packed or in transit. Contact support.",
      };
    }

    if (order.orderType === "PRE_ORDER") {
      if (order.status === "DEPOSIT_PENDING" || order.status === "DEPOSIT_PAID") {
        return { can_cancel: true, reason: null };
      }
      // From SOURCED_IN_TRANSIT onward: deposit non-refundable
      return {
        can_cancel: false,
        reason: "Deposit non-refundable after sourcing in transit. Contact support.",
      };
    }

    return { can_cancel: false, reason: "Cancellation disallowed for this order type." };
  },

  /**
   * List customer's own orders with status/type filters & pagination.
   */
  async getCustomerOrders(
    customerId: string,
    filter?: {
      status?: OrderStatus;
      orderType?: OrderType;
      page?: number;
      limit?: number;
    }
  ) {
    const { orders, total } = await ordersRepo.listCustomerOrders(
      undefined,
      customerId,
      filter
    );

    const items = orders.map((o) => {
      const statusLabel = STATUS_TIMELINE_LABELS[o.status] ?? {
        en: o.status,
        bn: o.status,
      };
      return {
        order_number: o.orderNumber,
        status: o.status,
        payment_status: o.paymentStatus,
        order_type: o.orderType,
        fulfillment_channel: o.fulfillmentChannel,
        placed_at: o.placedAt,
        total_payable_paisa: o.totalPayablePaisa,
        item_count: o.items.length,
        items_preview: o.items.slice(0, 3).map((it) => ({
          title_en: it.titleEn,
          qty: it.qty,
          tier: it.tier,
          unit_price_paisa: it.unitPricePaisa,
        })),
        current_status_label: {
          en: statusLabel.en,
          bn: statusLabel.bn,
        },
      };
    });

    return {
      items,
      pagination: {
        page: filter?.page ?? 1,
        limit: filter?.limit ?? 20,
        total,
      },
    };
  },

  /**
   * Get full detail of an order for its customer owner.
   */
  async getCustomerOrderDetail(customerId: string, orderNumber: string) {
    const order = await ordersRepo.getOrderByNumberWithDetails(
      undefined,
      orderNumber
    );
    if (!order || order.customerId !== customerId) {
      throw new NotFoundError(`Order '${orderNumber}' not found`);
    }

    const timeline = (order.history ?? []).map((h) => {
      const info = STATUS_TIMELINE_LABELS[h.toStatus] ?? {
        en: h.toStatus,
        bn: h.toStatus,
        descEn: h.reason ?? "",
        descBn: h.reason ?? "",
      };
      return {
        status: h.toStatus,
        timestamp: h.createdAt,
        label: { en: info.en, bn: info.bn },
        description: { en: info.descEn, bn: info.descBn },
      };
    });

    const eligibility = await this.evaluateCancellationEligibility(order);

    const assignedSealIds = (order.items ?? [])
      .flatMap((i) => (i.units ?? []).map((u) => u.sealId).filter(Boolean)) as string[];

    const mushakInvoice = await financeService.getMushakInvoiceForOrder(
      undefined,
      order.id
    );

    return {
      order_number: order.orderNumber,
      status: order.status,
      order_type: order.orderType,
      fulfillment_channel: order.fulfillmentChannel,
      delivery_zone: order.deliveryZone,
      placed_at: order.placedAt,
      confirmed_at: order.confirmedAt,
      cancelled_at: order.cancelledAt,
      cancel_reason: order.cancelReason,
      shipping_address: order.addressSnapshot,
      items: order.items.map((i) => ({
        id: i.id,
        sku_id: i.skuId,
        sku_code: i.skuCode,
        title_en: i.titleEn,
        title_bn: i.titleBn,
        tier: i.tier,
        quantity: i.qty,
        unit_price_paisa: i.unitPricePaisa,
        allocated_discount_paisa: i.allocatedDiscountPaisa,
        line_total_paisa: i.lineTotalPaisa,
        vat_rate_bp: i.vatRateBp,
        vat_paisa: i.vatPaisa,
        source: i.source,
        status: i.status,
      })),
      totals: {
        subtotal_paisa: order.subtotalPaisa,
        discount_paisa: order.discountPaisa,
        delivery_fee_paisa: order.deliveryFeePaisa,
        vat_total_paisa: order.vatTotalPaisa,
        total_payable_paisa: order.totalPayablePaisa,
        store_credit_applied_paisa: order.storeCreditAppliedPaisa,
        advance_required_paisa: order.advanceRequiredPaisa,
        advance_paid_paisa: order.advancePaidPaisa,
        cod_amount_paisa: order.codAmountPaisa,
        paid_total_paisa: order.paidTotalPaisa,
        refunded_total_paisa: order.refundedTotalPaisa,
      },
      payment_summary: {
        payment_status: order.paymentStatus,
        payment_mode: order.paymentMode,
        advance_purpose: order.advancePurpose,
        transactions: (order.transactions ?? []).map((t) => ({
          tran_id: t.tranId,
          amount_paisa: t.amountPaisa,
          status: t.status,
          method: t.method,
          created_at: t.createdAt,
        })),
      },
      timeline,
      courier_tracking_url: null, // P29 stub
      pre_order_milestones: order.preOrder
        ? {
            milestone: order.preOrder.milestone,
            eta_date: order.preOrder.etaDate,
            price_locked_paisa: order.preOrder.priceLockedPaisa,
            deposit_paisa: order.preOrder.depositPaisa,
            balance_paisa: order.preOrder.balancePaisa,
            arrived_at: order.preOrder.arrivedAt,
            qc_verified_at: order.preOrder.qcVerifiedAt,
            balance_due_date: order.preOrder.balanceDueDate,
            forfeiture_date: order.preOrder.forfeitureDate,
            delay_option: order.preOrder.delayOption,
            repricing_status: order.preOrder.repricingStatus,
            milestones: [
              {
                milestone: "DEPOSIT_PENDING",
                timestamp: order.placedAt,
                reached: true,
              },
              {
                milestone: "DEPOSIT_PAID",
                timestamp:
                  order.confirmedAt ??
                  order.history?.find((h) => h.toStatus === "DEPOSIT_PAID")
                    ?.createdAt ??
                  null,
                reached: [
                  "DEPOSIT_PAID",
                  "SOURCED_IN_TRANSIT",
                  "ARRIVED_GODOWN",
                  "QC_VERIFIED_BALANCE_DUE",
                  "BALANCE_PAID",
                  "BALANCE_COD_SCHEDULED",
                  "PACKED",
                  "HANDED_TO_COURIER",
                  "DELIVERED",
                ].includes(order.status),
              },
              {
                milestone: "SOURCED_IN_TRANSIT",
                timestamp:
                  order.history?.find(
                    (h) => h.toStatus === "SOURCED_IN_TRANSIT"
                  )?.createdAt ?? null,
                reached: [
                  "SOURCED_IN_TRANSIT",
                  "ARRIVED_GODOWN",
                  "QC_VERIFIED_BALANCE_DUE",
                  "BALANCE_PAID",
                  "BALANCE_COD_SCHEDULED",
                  "PACKED",
                  "HANDED_TO_COURIER",
                  "DELIVERED",
                ].includes(order.status),
              },
              {
                milestone: "ARRIVED_GODOWN",
                timestamp:
                  order.preOrder.arrivedAt ??
                  order.history?.find((h) => h.toStatus === "ARRIVED_GODOWN")
                    ?.createdAt ??
                  null,
                reached: [
                  "ARRIVED_GODOWN",
                  "QC_VERIFIED_BALANCE_DUE",
                  "BALANCE_PAID",
                  "BALANCE_COD_SCHEDULED",
                  "PACKED",
                  "HANDED_TO_COURIER",
                  "DELIVERED",
                ].includes(order.status),
              },
              {
                milestone: "QC_VERIFIED",
                timestamp:
                  order.preOrder.qcVerifiedAt ??
                  order.history?.find(
                    (h) => h.toStatus === "QC_VERIFIED_BALANCE_DUE"
                  )?.createdAt ??
                  null,
                reached: [
                  "QC_VERIFIED_BALANCE_DUE",
                  "BALANCE_PAID",
                  "BALANCE_COD_SCHEDULED",
                  "PACKED",
                  "HANDED_TO_COURIER",
                  "DELIVERED",
                ].includes(order.status),
              },
              {
                milestone: "BALANCE_PAID",
                timestamp:
                  order.history?.find(
                    (h) =>
                      h.toStatus === "BALANCE_PAID" ||
                      h.toStatus === "BALANCE_COD_SCHEDULED"
                  )?.createdAt ?? null,
                reached: [
                  "BALANCE_PAID",
                  "BALANCE_COD_SCHEDULED",
                  "PACKED",
                  "HANDED_TO_COURIER",
                  "DELIVERED",
                ].includes(order.status),
              },
            ],
          }
        : null,
      assigned_seal_ids: assignedSealIds,
      invoice_links: {
        system_invoice_url: `/api/v1/orders/${order.orderNumber}/invoices`,
        mushak_invoice_url: mushakInvoice
          ? `/api/v1/finance/invoices/${order.id}/mushak-6-3`
          : null,
      },
      cancellation_eligibility: eligibility,
    };
  },

  /**
   * Customer cancellation:
   * Enforces status eligibility and runner purchase check, performs atomic teardown:
   * transition -> CANCELLED, release reservations, release coupon, reverse store credit,
   * create refund requests for paid amounts, outbox notifications.
   */
  async cancelOrderByCustomer(
    customerId: string,
    orderNumber: string,
    reason: string
  ) {
    const order = await ordersRepo.getOrderByNumberWithDetails(
      undefined,
      orderNumber
    );
    if (!order || order.customerId !== customerId) {
      throw new NotFoundError(`Order '${orderNumber}' not found`);
    }

    const eligibility = await this.evaluateCancellationEligibility(order);
    if (!eligibility.can_cancel) {
      throw new BusinessError(
        "ERR_CANCELLATION_DISALLOWED",
        eligibility.reason ?? "Cancellation disallowed. Contact support.",
        { orderNumber, status: order.status },
        403
      );
    }

    const executeCancel = async (txClient: Tx | undefined) => {
      // 1. Transition -> CANCELLED
      await ordersRepo.updateOrder(txClient, order.id, {
        status: "CANCELLED",
        cancelReason: reason,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      });

      // 2. Release physical reservations
      await inventoryService.release(txClient, { orderId: order.id });

      // 3. Release coupon
      if (order.couponId) {
        await promotionsService.releaseCoupon(txClient, order.id);
      }

      // 4. Reverse store credit
      if (order.storeCreditAppliedPaisa > 0) {
        await promotionsService.reverseStoreCredit(txClient, {
          customerId: order.customerId,
          orderId: order.id,
          amountPaisa: order.storeCreditAppliedPaisa,
          reason: "REVERSAL",
        });
      }

      // 5. Create refund requests for all paid amounts (P33 hook: emit 'refund.requested')
      if (order.paidTotalPaisa > 0) {
        await emitOutbox(txClient, {
          type: "refund.requested",
          aggregateType: "order",
          aggregateId: order.id,
          payload: {
            orderId: order.id,
            customerId: order.customerId,
            amountPaisa: order.paidTotalPaisa,
            reason: "CUSTOMER_CANCELLATION",
            autoApproved: true,
          },
        });
      }

      // 6. Record status history
      await ordersRepo.createStatusHistory(txClient, {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: "CANCELLED",
        actorType: "CUSTOMER",
        actorId: customerId,
        reason,
        metadata: { customerId },
      });

      // 7. Emit order.cancelled
      await emitOutbox(txClient, {
        type: "order.cancelled",
        aggregateType: "order",
        aggregateId: order.id,
        payload: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          cancelledBy: "CUSTOMER",
          reason,
        },
      });

      return ordersRepo.getOrderWithDetails(txClient, order.id);
    };

    try {
      return await db.transaction(async (tx) => executeCancel(tx));
    } catch (err: unknown) {
      const isConnectionError =
        (typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: string }).code === "ECONNREFUSED") ||
        (err instanceof Error &&
          (err.name === "AggregateError" ||
            err.message.includes("ECONNREFUSED")));

      if (isConnectionError) {
        return executeCancel(undefined);
      }
      throw err;
    }
  },

  /**
   * Staff cancellation endpoint (CUSTOMER_SUPPORT / SUPER_ADMIN):
   * Covers after-purchase / before-handover cancellations.
   * Purchased items are received into GODOWN_NAWABPUR physical stock (CANCELLATION_RECEIPT movement).
   * Full refund requested.
   */
  async cancelOrderByStaff(
    staffActor: Actor,
    orderId: string,
    reason: string
  ) {
    const roles = staffActor.roles ?? [];
    if (!roles.includes("CUSTOMER_SUPPORT") && !roles.includes("SUPER_ADMIN")) {
      throw new ForbiddenError("Only CUSTOMER_SUPPORT or SUPER_ADMIN can execute staff order cancellation");
    }

    const order = await ordersRepo.getOrderWithDetails(undefined, orderId);
    if (!order) {
      throw new NotFoundError(`Order '${orderId}' not found`);
    }

    if (order.status === "CANCELLED") {
      throw new BusinessError(
        "ERR_CANCELLATION_DISALLOWED",
        "Order is already cancelled",
        { orderId },
        400
      );
    }

    const executeStaffCancel = async (txClient: Tx | undefined) => {
      // 1. Transition -> CANCELLED
      await ordersRepo.updateOrder(txClient, order.id, {
        status: "CANCELLED",
        cancelReason: reason,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      });

      // 2. Receive purchased items into GODOWN_NAWABPUR physical stock (CANCELLATION_RECEIPT movement)
      for (const item of order.items) {
        if (item.status === "ACTIVE") {
          await inventoryService.receive(
            txClient,
            {
              skuId: item.skuId,
              qty: item.qty,
              unitCostPaisa: item.unitCostPaisa ?? item.unitPricePaisa ?? 0,
              locationCode: "GODOWN_NAWABPUR",
              reason: "CANCELLATION_RECEIPT",
              refType: "ORDER",
              refId: order.id,
              staffId: staffActor.id,
            }
          );
        }
      }

      // 3. Release physical reservations
      await inventoryService.release(txClient, { orderId: order.id });

      // 4. Release coupon
      if (order.couponId) {
        await promotionsService.releaseCoupon(txClient, order.id);
      }

      // 5. Reverse store credit
      if (order.storeCreditAppliedPaisa > 0) {
        await promotionsService.reverseStoreCredit(txClient, {
          customerId: order.customerId,
          orderId: order.id,
          amountPaisa: order.storeCreditAppliedPaisa,
          reason: "REVERSAL",
        });
      }

      // 6. Create refund request for all paid amounts (P33 hook)
      if (order.paidTotalPaisa > 0) {
        await emitOutbox(txClient, {
          type: "refund.requested",
          aggregateType: "order",
          aggregateId: order.id,
          payload: {
            orderId: order.id,
            customerId: order.customerId,
            amountPaisa: order.paidTotalPaisa,
            reason: "STAFF_CANCELLATION",
            autoApproved: true,
          },
        });
      }

      // 7. Record status history
      await ordersRepo.createStatusHistory(txClient, {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: "CANCELLED",
        actorType: "STAFF",
        actorId: staffActor.id,
        reason,
        metadata: { staffId: staffActor.id },
      });

      // 8. Emit order.cancelled
      await emitOutbox(txClient, {
        type: "order.cancelled",
        aggregateType: "order",
        aggregateId: order.id,
        payload: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          cancelledBy: "STAFF",
          staffId: staffActor.id,
          reason,
        },
      });

      return ordersRepo.getOrderWithDetails(txClient, order.id);
    };

    try {
      return await db.transaction(async (tx) => executeStaffCancel(tx));
    } catch (err: unknown) {
      const isConnectionError =
        (typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: string }).code === "ECONNREFUSED") ||
        (err instanceof Error &&
          (err.name === "AggregateError" ||
            err.message.includes("ECONNREFUSED")));

      if (isConnectionError) {
        return executeStaffCancel(undefined);
      }
      throw err;
    }
  },

  /**
   * Staff order list view with filters by status/type/channel/date/phone.
   */
  async getAdminOrders(
    staffActor: Actor,
    filter?: {
      status?: OrderStatus;
      orderType?: OrderType;
      channel?: OrderChannel;
      fromDate?: Date;
      toDate?: Date;
      phone?: string;
      page?: number;
      limit?: number;
    }
  ) {
    return ordersRepo.listAdminOrders(undefined, filter);
  },

  /**
   * Staff order detail view with PII serialization mapped via staff actor roles.
   */
  async getAdminOrderDetail(staffActor: Actor, id: string) {
    const order = await ordersRepo.getOrderWithDetails(undefined, id);
    if (!order) {
      throw new NotFoundError(`Order '${id}' not found`);
    }

    const rawCustomer: CustomerRawData = {
      id: order.customerId,
      fullName: order.addressSnapshot?.consignee ?? null,
      phone: order.addressSnapshot?.phone ?? "",
      email: null,
      addressLine: order.addressSnapshot?.addressLine ?? null,
      thanaName: order.addressSnapshot?.thanaName ?? null,
      districtName: order.addressSnapshot?.districtName ?? null,
      divisionName: order.addressSnapshot?.divisionName ?? null,
      bin: order.buyerBin ?? null,
      invoiceNo: null,
    };

    let serializedCustomer: unknown;
    const roles = staffActor.roles ?? [];
    if (roles.includes("CUSTOMER_SUPPORT") || roles.includes("SUPER_ADMIN")) {
      serializedCustomer = await piiSerializers.toFull(
        rawCustomer,
        staffActor,
        "ADMIN_ORDER_VIEW"
      );
    } else if (roles.includes("FINANCE_OFFICER")) {
      serializedCustomer = piiSerializers.toBilling(rawCustomer);
    } else if (roles.includes("DISPATCH_OFFICER")) {
      serializedCustomer = piiSerializers.toShipping(rawCustomer);
    } else if (roles.includes("SHOWROOM_SALES") || roles.includes("COUNTER")) {
      serializedCustomer = piiSerializers.toCounter(rawCustomer);
    } else {
      serializedCustomer = piiSerializers.toMasked(rawCustomer);
    }

    const invoices = await financeService.getInvoicesForOrder(undefined, order.id);

    return {
      order,
      customer_pii: serializedCustomer,
      invoices,
    };
  },

  /**
   * Add internal staff note to an order.
   */
  async addAdminOrderNote(staffActor: Actor, id: string, note: string) {
    const order = await ordersRepo.getOrderById(undefined, id);
    if (!order) {
      throw new NotFoundError(`Order '${id}' not found`);
    }

    const createdNote = await ordersRepo.createOrderNote(undefined, {
      orderId: id,
      staffId: staffActor.id,
      staffName: staffActor.id,
      note,
    });

    await ordersRepo.createStatusHistory(undefined, {
      orderId: id,
      fromStatus: order.status,
      toStatus: order.status,
      actorType: "STAFF",
      actorId: staffActor.id,
      reason: "STAFF_NOTE",
      metadata: { noteId: createdNote.id, note },
    });

    return createdNote;
  },

  /**
   * Get pre-order metadata row.
   */
  async getPreOrder(tx: Tx | undefined, orderId: string) {
    return ordersRepo.getPreOrder(tx, orderId);
  },

  /**
   * Update pre-order metadata row.
   */
  async updatePreOrder(
    tx: Tx | undefined,
    orderId: string,
    updates: Partial<import("./schema").InsertPreOrderRow>
  ) {
    return ordersRepo.updatePreOrder(tx, orderId, updates);
  },

  /**
   * List pre-orders with filtering for staff.
   */
  async listPreOrders(
    filter?: {
      status?: OrderStatus;
      sku?: string;
      etaOverdue?: boolean;
      batchKey?: string;
      page?: number;
      limit?: number;
    },
    tx?: Tx
  ) {
    return ordersRepo.listPreOrders(tx, filter);
  },

  /**
   * Create a zero-price replacement order for DOA fast-track or verified RMA claims.
   */
  async createReplacementOrder(input: {
    customerId: string;
    originalOrderId: string;
    claimId: string;
    skuId: string;
    skuTitle: string;
    shippingAddress: string;
    shippingDistrict: string;
    shippingThana: string;
    customerPhone: string;
    customerName: string;
  }): Promise<OrderWithDetails> {
    const orderNumber = await generateOrderNumber(undefined);
    const orderId = crypto.randomUUID();
    const itemId = crypto.randomUUID();
    const unitId = crypto.randomUUID();

    const created = await ordersRepo.createOrder(undefined, {
      order: {
        id: orderId,
        orderNumber,
        customerId: input.customerId,
        channel: "ONLINE",
        orderType: "REGULAR",
        fulfillmentChannel: "REGULAR_DROP_PACK",
        deliveryZone: input.shippingDistrict.toLowerCase().includes("dhaka")
          ? "DHAKA_INSIDE"
          : "DHAKA_OUTSIDE",
        status: "CONFIRMED",
        paymentStatus: "PAID",
        paymentMode: "ONLINE",
        addressSnapshot: {
          address: input.shippingAddress,
          district: input.shippingDistrict,
          thana: input.shippingThana,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
        },
        subtotalPaisa: 0,
        discountPaisa: 0,
        deliveryFeePaisa: 0,
        vatTotalPaisa: 0,
        totalPayablePaisa: 0,
        storeCreditAppliedPaisa: 0,
        advanceRequiredPaisa: 0,
        advancePaidPaisa: 0,
        advancePurpose: null,
        codAmountPaisa: 0,
        paidTotalPaisa: 0,
        refundedTotalPaisa: 0,
        notes: `RMA Replacement for claim: ${input.claimId} (Original: ${input.originalOrderId})`,
      },
      items: [
        {
          id: itemId,
          skuId: input.skuId,
          skuTitle: input.skuTitle,
          quantity: 1,
          unitPricePaisa: 0,
          subtotalPaisa: 0,
          discountPaisa: 0,
          totalPaisa: 0,
          status: "CONFIRMED",
        },
      ],
      units: [
        {
          id: unitId,
          orderItemId: itemId,
          unitIndex: 1,
          status: "ALLOCATED",
        },
      ],
    });

    return created;
  },

  /**
   * Reset in-memory state for clean test isolation.
   */
  clearMemoryForTesting(): void {
    clearMemoryOrdersForTesting();
    import("./checkout").then((m) => m.clearMemoryCheckoutForTesting());
    financeService.clearMemoryForTesting();
  },
};

export const STATUS_TIMELINE_LABELS: Record<
  string,
  { en: string; bn: string; descEn: string; descBn: string }
> = {
  PENDING_PAYMENT: {
    en: "Payment Pending",
    bn: "পেমেন্ট বাকি",
    descEn: "Awaiting payment verification",
    descBn: "পেমেন্ট নিশ্চিতকরণের অপেক্ষায়",
  },
  CONFIRMED: {
    en: "Order Confirmed",
    bn: "অর্ডার নিশ্চিত করা হয়েছে",
    descEn: "Order has been confirmed",
    descBn: "আপনার অর্ডারটি গ্রহণ করা হয়েছে",
  },
  SOURCING: {
    en: "Sourcing Items",
    bn: "পণ্য সংগ্রহ করা হচ্ছে",
    descEn: "Runner is sourcing parts from Nawabpur market",
    descBn: "নবাবপুর মার্কেট থেকে পণ্য সংগ্রহ করা হচ্ছে",
  },
  AT_GODOWN_QC: {
    en: "Quality Check & Packing",
    bn: "মান যাচাই ও প্যাকিং",
    descEn: "Goods arrived at Nawabpur godown for quality inspection",
    descBn: "নবাবপুর গুদামে পণ্যের মান যাচাই করা হচ্ছে",
  },
  PACKED: {
    en: "Packed & Sealed",
    bn: "প্যাকেজিং সম্পন্ন",
    descEn: "Items verified, sealed with tamper-proof seal, and packed",
    descBn: "নিরাপত্তা সিলযুক্ত করে প্যাকেজিং সম্পন্ন করা হয়েছে",
  },
  HANDED_TO_COURIER: {
    en: "Handed to Courier",
    bn: "কুরিয়ারে হস্তান্তর",
    descEn: "Package is on the way with courier delivery partner",
    descBn: "কুরিয়ার পার্টনারের কাছে পার্সেল হস্তান্তর করা হয়েছে",
  },
  DELIVERED: {
    en: "Delivered",
    bn: "ডেলিভারি সম্পন্ন",
    descEn: "Order successfully delivered to customer",
    descBn: "অর্ডার সফলভাবে গ্রাহকের নিকট পৌঁছে দেওয়া হয়েছে",
  },
  PARTIALLY_DELIVERED: {
    en: "Partially Delivered",
    bn: "আংশিক ডেলিভারি সম্পন্ন",
    descEn: "Part of the order has been delivered",
    descBn: "অর্ডারের কিছু অংশ ডেলিভারি করা হয়েছে",
  },
  READY_FOR_PICKUP: {
    en: "Ready for Pickup",
    bn: "সংগ্রহের জন্য প্রস্তুত",
    descEn: "Package is ready for collection at Nawabpur showroom",
    descBn: "নবাবপুর শোরুম থেকে সংগ্রহের জন্য প্রস্তুত",
  },
  DELIVERED_COUNTER: {
    en: "Delivered at Counter",
    bn: "কাউন্টার থেকে হস্তান্তরিত",
    descEn: "Handed over to customer at showroom counter",
    descBn: "শোরুম কাউন্টার থেকে গ্রাহকের নিকট হস্তান্তর সম্পন্ন",
  },
  CANCELLED: {
    en: "Cancelled",
    bn: "অর্ডার বাতিল",
    descEn: "Order has been cancelled",
    descBn: "অর্ডারটি বাতিল করা হয়েছে",
  },
  DEPOSIT_PENDING: {
    en: "Deposit Pending",
    bn: "অগ্রিম জামানত বাকি",
    descEn: "Awaiting pre-order deposit payment",
    descBn: "প্রি-অর্ডার জামানত পরিশোধের অপেক্ষায়",
  },
  DEPOSIT_PAID: {
    en: "Deposit Paid",
    bn: "জামানত পরিশোধিত",
    descEn: "Deposit received, procurement initiated",
    descBn: "জামানত জমা হয়েছে, সংগ্রহ প্রক্রিয়া শুরু হয়েছে",
  },
  SOURCED_IN_TRANSIT: {
    en: "Sourced & In Transit",
    bn: "সংগৃহীত ও পথে রয়েছে",
    descEn: "Items procured and in transit to godown",
    descBn: "পণ্য সংগৃহীত হয়ে নবাবপুর গুদামের পথে রয়েছে",
  },
};

