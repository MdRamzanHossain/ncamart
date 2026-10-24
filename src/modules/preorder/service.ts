import { Tx } from "@/lib/db";
import { Actor } from "@/lib/http/route";
import { generateTransactionId } from "@/lib/ids";
import { emitOutbox } from "@/lib/outbox";
import { BusinessError, NotFoundError, ValidationError } from "@/lib/errors";
import { ordersService, OrderStatus } from "@/modules/orders";
import { inventoryService } from "@/modules/inventory";
import { promotionsService } from "@/modules/promotions";
import { paymentsService } from "@/modules/payments";
import { ledgerService, postingRules } from "@/modules/ledger";
import { catalogService } from "@/modules/catalog";
import { authService } from "@/modules/identity";
import { preorderRepo, clearMemoryPreorderForTesting } from "./repo";
import { preorderPolicies } from "./policies";
import {
  AdminPreorderFilterDto,
  AdminPreorderSourcedDto,
  AdminPreorderImportFailedDto,
  AdminPreorderRepricingDto,
  CustomerBalancePaymentDto,
  CustomerDelayChoiceDto,
  CustomerRepricingChoiceDto,
  CustomerSwitchSkuDto,
} from "./dto";

const PREORDER_COD_BALANCE_MAX_PAISA = 3_000_000; // ৳30,000

export const preorderService = {
  healthCheck: async () => ({ module: "preorder", status: "ok" }),

  /**
   * Reset in-memory state for clean test isolation.
   */
  clearMemoryForTesting(): void {
    clearMemoryPreorderForTesting();
  },

  /**
   * 1. GET /api/v1/admin/preorders
   * Lists pre-orders with filtering by status, sku, eta_overdue, batch.
   */
  async listPreorders(
    filters: AdminPreorderFilterDto,
    actor: Actor
  ) {
    preorderPolicies.assertCanViewPreorders(actor);
    const sku = filters.sku ?? filters.sku_id;
    const batchKey = filters.batch ?? filters.batch_key;

    return ordersService.listPreOrders({
      status: filters.status,
      sku,
      etaOverdue: filters.eta_overdue,
      batchKey,
      page: filters.page,
      limit: filters.limit,
    });
  },

  /**
   * 2. POST /api/v1/admin/preorders/:orderId/sourced
   * Transitions pre-order to SOURCED_IN_TRANSIT.
   * Customer cancellation is disabled from now on.
   * Emits Notification 5 (Class B).
   */
  async markSourced(
    orderId: string,
    input: AdminPreorderSourcedDto,
    actor: Actor
  ) {
    preorderPolicies.assertCanManageSourcing(actor);

    const order = await ordersService.getOrderWithDetails(undefined, orderId);
    if (!order) {
      throw new NotFoundError(`Order '${orderId}' not found`);
    }

    if (order.status !== "DEPOSIT_PAID") {
      throw new BusinessError(
        "ERR_BUSINESS_RULE",
        `Cannot mark pre-order as sourced from status '${order.status}'. Order must be DEPOSIT_PAID.`,
        { orderId, status: order.status },
        422
      );
    }

    // Update pre_orders metadata
    await ordersService.updatePreOrder(undefined, orderId, {
      milestone: "SOURCED_IN_TRANSIT",
      ...(input.eta_date ? { etaDate: input.eta_date } : {}),
      updatedAt: new Date(),
    });

    const reason = input.supplier_ref
      ? `Sourced from supplier ${input.supplier_ref}`
      : "Pre-order sourced and in transit";

    const updatedOrder = await ordersService.transitionOrder(
      undefined as unknown as Tx,
      orderId,
      "SOURCED_IN_TRANSIT",
      actor,
      reason,
      { supplierRef: input.supplier_ref }
    );

    // Notification 5 (Class B)
    await emitOutbox(undefined, {
      type: "notification.preorder_sourced",
      aggregateType: "order",
      aggregateId: orderId,
      payload: {
        orderId,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        supplierRef: input.supplier_ref,
        etaDate: input.eta_date ?? order.preOrder?.etaDate,
      },
    });

    return updatedOrder;
  },

  /**
   * 3. POST /api/v1/admin/preorders/:orderId/arrived
   * Transitions to ARRIVED_GODOWN, receives physical units into QC_HOLD,
   * and automatically awards ৳1,000 delay goodwill credit if delay choice was offered/kept.
   */
  async markArrived(orderId: string, actor: Actor) {
    preorderPolicies.assertCanManageArrival(actor);

    const order = await ordersService.getOrderWithDetails(undefined, orderId);
    if (!order) {
      throw new NotFoundError(`Order '${orderId}' not found`);
    }

    if (order.status !== "SOURCED_IN_TRANSIT") {
      throw new BusinessError(
        "ERR_BUSINESS_RULE",
        `Cannot mark pre-order as arrived from status '${order.status}'. Order must be SOURCED_IN_TRANSIT.`,
        { orderId, status: order.status },
        422
      );
    }

    const preOrder = order.preOrder;
    const now = new Date();

    // 1. Check delay credit: if delay was OFFERED or KEPT, issue ৳1,000 goodwill credit
    if (
      preOrder &&
      (preOrder.delayOption === "OFFERED" ||
        preOrder.delayOption === "KEPT" ||
        (preOrder.delayOption === "NONE" &&
          now.getTime() > preOrder.etaDate.getTime() + 7 * 24 * 60 * 60 * 1000))
    ) {
      try {
        const systemActor: Actor = {
          id: "00000000-0000-0000-0000-000000000000",
          type: "staff",
          roles: ["SUPER_ADMIN", "CUSTOMER_SUPPORT"],
        };
        await promotionsService.issueStoreCredit(undefined, {
          customerId: order.customerId,
          amountPaisa: 100_000, // ৳1,000 = 100,000 paisa
          reason: "PREORDER_DELAY",
          refType: "ORDER",
          refId: order.id,
          actor: systemActor,
        });

        await ordersService.updatePreOrder(undefined, orderId, {
          delayOption: "KEPT_WITH_CREDIT",
          updatedAt: now,
        });

        await emitOutbox(undefined, {
          type: "notification.preorder_delay_credit_issued",
          aggregateType: "order",
          aggregateId: orderId,
          payload: {
            orderId,
            orderNumber: order.orderNumber,
            customerId: order.customerId,
            amountPaisa: 100_000,
          },
        });
      } catch {
        // Non-blocking
      }
    }

    // 2. Receive units into QC_HOLD
    for (const item of order.items) {
      await inventoryService.receive(
        undefined,
        {
          skuId: item.skuId,
          locationCode: "QC_HOLD",
          qty: item.qty,
          reason: "PURCHASE_RECEIPT",
          refType: "PURCHASE",
          refId: order.id,
          unitCostPaisa: item.unitCostPaisa ?? item.unitPricePaisa ?? 0,
        },
        actor
      );
    }

    // 3. Update pre_orders metadata
    await ordersService.updatePreOrder(undefined, orderId, {
      milestone: "ARRIVED_GODOWN",
      arrivedAt: now,
      updatedAt: now,
    });

    // 4. Transition order to ARRIVED_GODOWN
    const updatedOrder = await ordersService.transitionOrder(
      undefined as unknown as Tx,
      orderId,
      "ARRIVED_GODOWN",
      actor,
      "Pre-order arrived at godown and received into QC_HOLD"
    );

    return updatedOrder;
  },

  /**
   * 4. POST /api/v1/admin/preorders/:orderId/qc-verified
   * Transitions to QC_VERIFIED_BALANCE_DUE,
   * sets qc_verified_at, balance_due_date = +7 days, forfeiture_date = Day 8.
   * Emits Notification 6.
   */
  async markQcVerified(orderId: string, actor: Actor) {
    preorderPolicies.assertCanManageArrival(actor);

    const order = await ordersService.getOrderWithDetails(undefined, orderId);
    if (!order) {
      throw new NotFoundError(`Order '${orderId}' not found`);
    }

    if (order.status !== "ARRIVED_GODOWN") {
      throw new BusinessError(
        "ERR_BUSINESS_RULE",
        `Cannot verify QC from status '${order.status}'. Order must be ARRIVED_GODOWN.`,
        { orderId, status: order.status },
        422
      );
    }

    const now = new Date();
    const balanceDueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Day 7
    const forfeitureDate = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000); // Day 8

    await ordersService.updatePreOrder(undefined, orderId, {
      milestone: "QC_VERIFIED",
      qcVerifiedAt: now,
      balanceDueDate,
      forfeitureDate,
      updatedAt: now,
    });

    const updatedOrder = await ordersService.transitionOrder(
      undefined as unknown as Tx,
      orderId,
      "QC_VERIFIED_BALANCE_DUE",
      actor,
      "Pre-order QC verified; balance payment due within 7 days"
    );

    // Notification 6
    await emitOutbox(undefined, {
      type: "notification.preorder_qc_verified_balance_due",
      aggregateType: "order",
      aggregateId: orderId,
      payload: {
        orderId,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        balanceDueDate,
        forfeitureDate,
      },
    });

    return {
      ...updatedOrder,
      balance_due_date: balanceDueDate,
      forfeiture_date: forfeitureDate,
    };
  },

  /**
   * 5. POST /api/v1/admin/preorders/:orderId/import-failed
   * Sourcing manager marks import failed:
   * Transitions to CANCELLED_REFUNDED, emits 100% refund request (P33),
   * and optionally offers SKU switch options to customer.
   */
  async markImportFailed(
    orderId: string,
    input: AdminPreorderImportFailedDto,
    actor: Actor
  ) {
    preorderPolicies.assertCanManageSourcing(actor);

    const order = await ordersService.getOrderWithDetails(undefined, orderId);
    if (!order) {
      throw new NotFoundError(`Order '${orderId}' not found`);
    }

    const updatedOrder = await ordersService.transitionOrder(
      undefined as unknown as Tx,
      orderId,
      "CANCELLED_REFUNDED",
      actor,
      `Pre-order import failed: ${input.reason}`,
      {
        importFailedReason: input.reason,
        offerSwitchSkuIds: input.offer_switch_sku_ids,
      }
    );

    await ordersService.updatePreOrder(undefined, orderId, {
      milestone: "IMPORT_FAILED",
      updatedAt: new Date(),
    });

    // 100% refund request emitted for P33
    if (order.paidTotalPaisa > 0) {
      await emitOutbox(undefined, {
        type: "refund.requested",
        aggregateType: "order",
        aggregateId: orderId,
        payload: {
          orderId,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          amountPaisa: order.paidTotalPaisa,
          reason: `IMPORT_FAILED: ${input.reason}`,
          autoApproved: true,
        },
      });
    }

    // Customer Notification: offered full refund or switch option
    if (input.offer_switch_sku_ids && input.offer_switch_sku_ids.length > 0) {
      await emitOutbox(undefined, {
        type: "notification.preorder_switch_offered",
        aggregateType: "order",
        aggregateId: orderId,
        payload: {
          orderId,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          reason: input.reason,
          switchSkuIds: input.offer_switch_sku_ids,
        },
      });
    }

    return updatedOrder;
  },

  /**
   * 6. POST /api/v1/admin/preorders/:orderId/repricing
   * Sourcing manager triggers spot repricing due to currency devaluation.
   * Requires fx_change_bp > 800 (>8%). Transitions to REPRICING_PENDING with 48h deadline.
   */
  async repricePreorder(
    orderId: string,
    input: AdminPreorderRepricingDto,
    actor: Actor
  ) {
    preorderPolicies.assertCanReprice(actor);

    if (input.fx_change_bp <= 800) {
      throw new BusinessError(
        "ERR_BUSINESS_RULE",
        "FX devaluation must exceed 800 basis points (8%) for spot repricing",
        { fx_change_bp: input.fx_change_bp },
        422
      );
    }

    const order = await ordersService.getOrderWithDetails(undefined, orderId);
    if (!order) {
      throw new NotFoundError(`Order '${orderId}' not found`);
    }

    if (
      order.status !== "DEPOSIT_PAID" &&
      order.status !== "SOURCED_IN_TRANSIT"
    ) {
      throw new BusinessError(
        "ERR_BUSINESS_RULE",
        `Cannot reprice pre-order from status '${order.status}'. Must be DEPOSIT_PAID or SOURCED_IN_TRANSIT.`,
        { orderId, status: order.status },
        422
      );
    }

    const totalQty = order.items.reduce((sum: number, it: { qty: number }) => sum + it.qty, 0);
    const newTotalPaisa = input.new_unit_price_paisa * totalQty;
    const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const previousStatus = order.status;

    await ordersService.updatePreOrder(undefined, orderId, {
      repricingStatus: "PENDING",
      repricingNewTotalPaisa: newTotalPaisa,
      repricingDeadline: deadline,
      updatedAt: new Date(),
    });

    const updatedOrder = await ordersService.transitionOrder(
      undefined as unknown as Tx,
      orderId,
      "REPRICING_PENDING",
      actor,
      `FX repricing: ${input.reason}`,
      { previousStatus }
    );

    await emitOutbox(undefined, {
      type: "notification.preorder_repricing_pending",
      aggregateType: "order",
      aggregateId: orderId,
      payload: {
        orderId,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        newTotalPaisa,
        deadline,
        reason: input.reason,
      },
    });

    return updatedOrder;
  },

  /**
   * 7. POST /api/v1/orders/:orderNumber/preorder/delay-choice
   * Customer delay choice: CANCEL (within 24h) -> CANCELLED_REFUNDED with 100% refund.
   * KEEP -> keep; on arrival ৳1,000 goodwill credit is issued.
   */
  async handleDelayChoice(
    customerId: string,
    orderNumber: string,
    dto: CustomerDelayChoiceDto
  ) {
    const ord = await ordersService.getOrderByNumber(undefined, orderNumber);
    if (!ord || ord.customerId !== customerId) {
      throw new NotFoundError(`Order '${orderNumber}' not found`);
    }

    const preOrder = await ordersService.getPreOrder(undefined, ord.id);
    if (!preOrder || preOrder.delayOption !== "OFFERED") {
      throw new BusinessError(
        "ERR_BUSINESS_RULE",
        "No delay choice is currently pending for this pre-order",
        { orderNumber },
        422
      );
    }

    // 24h window check
    const offeredAt = preOrder.delayOfferedAt ?? new Date();
    const isWithin24h = Date.now() - offeredAt.getTime() <= 24 * 60 * 60 * 1000;

    if (dto.choice === "CANCEL") {
      if (!isWithin24h) {
        throw new BusinessError(
          "ERR_BUSINESS_RULE",
          "The 24h delay cancellation window has expired. Order will be kept.",
          { offeredAt },
          422
        );
      }

      await ordersService.updatePreOrder(undefined, ord.id, {
        delayOption: "CANCELLED",
        updatedAt: new Date(),
      });

      const updated = await ordersService.transitionOrder(
        undefined as unknown as Tx,
        ord.id,
        "CANCELLED_REFUNDED",
        { id: customerId, type: "customer" },
        "Customer selected 100% refund due to pre-order shipping delay"
      );

      // 100% full refund
      if (ord.paidTotalPaisa > 0) {
        await emitOutbox(undefined, {
          type: "refund.requested",
          aggregateType: "order",
          aggregateId: ord.id,
          payload: {
            orderId: ord.id,
            customerId,
            amountPaisa: ord.paidTotalPaisa,
            reason: "PREORDER_DELAY_CANCELLATION",
            autoApproved: true,
          },
        });
      }

      return {
        ...updated,
        refund_amount_paisa: ord.paidTotalPaisa,
      };
    }

    // KEEP option explicitly chosen
    await ordersService.updatePreOrder(undefined, ord.id, {
      delayOption: "KEPT",
      updatedAt: new Date(),
    });

    return {
      order_number: ord.orderNumber,
      delay_choice: "KEEP",
      message: "Pre-order will be kept; ৳1,000 goodwill credit will be credited to your store credit on godown arrival.",
    };
  },

  /**
   * 8. POST /api/v1/orders/:orderNumber/preorder/repricing
   * Customer repricing response:
   * accept -> balance changes (deposit unchanged), transitions back to previous state.
   * reject or timeout -> CANCELLED_REFUNDED with 100% refund.
   */
  async handleRepricingChoice(
    customerId: string,
    orderNumber: string,
    dto: CustomerRepricingChoiceDto
  ) {
    const ord = await ordersService.getOrderByNumber(undefined, orderNumber);
    if (!ord || ord.customerId !== customerId) {
      throw new NotFoundError(`Order '${orderNumber}' not found`);
    }

    if (ord.status !== "REPRICING_PENDING") {
      throw new BusinessError(
        "ERR_BUSINESS_RULE",
        "Pre-order is not pending spot repricing approval",
        { status: ord.status },
        422
      );
    }

    const preOrder = await ordersService.getPreOrder(undefined, ord.id);
    if (!preOrder) {
      throw new NotFoundError(`Pre-order metadata for '${ord.id}' not found`);
    }

    // Check 48h deadline
    const isTimedOut =
      preOrder.repricingDeadline && Date.now() > preOrder.repricingDeadline.getTime();

    if (dto.accept && !isTimedOut) {
      // Find previous status from history
      const prevHistory = (ord.history ?? [])
        .slice()
        .reverse()
        .find((h) => h.toStatus === "REPRICING_PENDING");
      const previousStatus = (prevHistory?.fromStatus as OrderStatus) ?? "SOURCED_IN_TRANSIT";

      const newTotal = preOrder.repricingNewTotalPaisa ?? ord.totalPayablePaisa;
      const deposit = preOrder.depositPaisa;
      const newBalance = newTotal - deposit;

      // Deposit unchanged, only balance changes
      await ordersService.updatePreOrder(undefined, ord.id, {
        repricingStatus: "ACCEPTED",
        balancePaisa: newBalance,
        priceLockedPaisa: newTotal,
        updatedAt: new Date(),
      });

      const { ordersRepo } = await import("@/modules/orders/repo");
      await ordersRepo.updateOrder(undefined, ord.id, {
        totalPayablePaisa: newTotal,
        updatedAt: new Date(),
      });

      const updated = await ordersService.transitionOrder(
        undefined as unknown as Tx,
        ord.id,
        previousStatus,
        { id: customerId, type: "customer" },
        "Customer accepted spot repricing",
        { previousStatus }
      );

      return {
        order_number: ord.orderNumber,
        status: updated.status,
        deposit_paisa: deposit,
        new_balance_paisa: newBalance,
        total_payable_paisa: newTotal,
      };
    } else {
      // Reject or timed out -> Cancelled + 100% refund
      const updated = await ordersService.transitionOrder(
        undefined as unknown as Tx,
        ord.id,
        "CANCELLED_REFUNDED",
        { id: customerId, type: "customer" },
        "Customer rejected spot repricing"
      );

      await ordersService.updatePreOrder(undefined, ord.id, {
        repricingStatus: "REJECTED",
        updatedAt: new Date(),
      });

      if (ord.paidTotalPaisa > 0) {
        await emitOutbox(undefined, {
          type: "refund.requested",
          aggregateType: "order",
          aggregateId: ord.id,
          payload: {
            orderId: ord.id,
            customerId,
            amountPaisa: ord.paidTotalPaisa,
            reason: "REPRICING_REJECTED",
            autoApproved: true,
          },
        });
      }

      return {
        order_number: ord.orderNumber,
        status: updated.status,
        deposit_paisa: preOrder.depositPaisa,
        new_balance_paisa: 0,
        total_payable_paisa: ord.totalPayablePaisa,
      };
    }
  },

  async respondToRepricing(
    customerId: string,
    orderNumber: string,
    dto: CustomerRepricingChoiceDto
  ) {
    return this.handleRepricingChoice(customerId, orderNumber, dto);
  },

  /**
   * 9. POST /api/v1/orders/:orderNumber/preorder/switch
   * Customer SKU switch option after import failure.
   */
  async switchSku(
    customerId: string,
    orderNumber: string,
    dto: CustomerSwitchSkuDto
  ) {
    const ord = await ordersService.getOrderByNumber(undefined, orderNumber);
    if (!ord || ord.customerId !== customerId) {
      throw new NotFoundError(`Order '${orderNumber}' not found`);
    }

    const targetSku = await catalogService.getSkuById(dto.switch_sku_id);
    if (!targetSku) {
      throw new NotFoundError(`Target switch SKU '${dto.switch_sku_id}' not found`);
    }

    await emitOutbox(undefined, {
      type: "preorder.customer_switched_sku",
      aggregateType: "order",
      aggregateId: ord.id,
      payload: {
        orderId: ord.id,
        customerId,
        switchSkuId: dto.switch_sku_id,
      },
    });

    return {
      order_number: ord.orderNumber,
      switch_sku_id: dto.switch_sku_id,
      status: "SWITCH_REQUESTED",
      message: "SKU switch requested. Sourcing team will fulfill the new item.",
    };
  },

  /**
   * 10. POST /api/v1/orders/:orderNumber/balance
   * Customer pre-order balance payment:
   * ONLINE -> payment transaction purpose BALANCE -> SSLCommerz session.
   * COD -> only if balance <= PREORDER_COD_BALANCE_MAX and not COD-blocked -> BALANCE_COD_SCHEDULED.
   * COUNTER -> showroom pickup -> BALANCE_COUNTER_SCHEDULED.
   */
  async payBalance(
    customerId: string,
    orderNumber: string,
    dto: CustomerBalancePaymentDto
  ) {
    const ord = await ordersService.getOrderByNumber(undefined, orderNumber);
    if (!ord || ord.customerId !== customerId) {
      throw new NotFoundError(`Order '${orderNumber}' not found`);
    }

    if (ord.status !== "QC_VERIFIED_BALANCE_DUE") {
      throw new BusinessError(
        "ERR_BUSINESS_RULE",
        `Balance payment only allowed when order is QC_VERIFIED_BALANCE_DUE. Current status: '${ord.status}'`,
        { status: ord.status },
        422
      );
    }

    const preOrder = await ordersService.getPreOrder(undefined, ord.id);
    if (!preOrder) {
      throw new NotFoundError(`Pre-order metadata not found for '${ord.id}'`);
    }

    const balancePaisa = preOrder.balancePaisa;

    // Apply store credit if requested
    let storeCreditUsed = 0;
    if (dto.store_credit_paisa && dto.store_credit_paisa > 0) {
      const creditBal = await promotionsService.getStoreCreditBalance(
        undefined,
        customerId
      );
      if (dto.store_credit_paisa > creditBal.totalBalancePaisa) {
        throw new BusinessError(
          "ERR_BUSINESS_RULE",
          "Requested store credit exceeds available balance",
          {
            requestedPaisa: dto.store_credit_paisa,
            availablePaisa: creditBal.totalBalancePaisa,
          },
          422
        );
      }

      storeCreditUsed = Math.min(dto.store_credit_paisa, balancePaisa);
      await promotionsService.applyStoreCredit(undefined, {
        customerId,
        orderId: ord.id,
        amountPaisa: storeCreditUsed,
      });

      const { ordersRepo } = await import("@/modules/orders/repo");
      await ordersRepo.updateOrder(undefined, ord.id, {
        storeCreditAppliedPaisa: (ord.storeCreditAppliedPaisa || 0) + storeCreditUsed,
        paidTotalPaisa: (ord.paidTotalPaisa || 0) + storeCreditUsed,
        updatedAt: new Date(),
      });
    }

    const netBalance = balancePaisa - storeCreditUsed;

    if (netBalance === 0) {
      // Fully paid by store credit!
      const updated = await ordersService.transitionOrder(
        undefined as unknown as Tx,
        ord.id,
        "BALANCE_PAID",
        { id: customerId, type: "customer" },
        "Pre-order balance fully settled via store credit"
      );

      return {
        order_number: ord.orderNumber,
        status: updated.status,
        balance_paid: true,
        store_credit_applied_paisa: storeCreditUsed,
        payable_paisa: 0,
      };
    }

    if (dto.mode === "ONLINE") {
      const tranId = generateTransactionId();
      const { ordersRepo } = await import("@/modules/orders/repo");
      await ordersRepo.createPaymentTransaction(undefined, {
        orderId: ord.id,
        customerId,
        tranId,
        purpose: "BALANCE",
        method: "SSLCOMMERZ",
        amountPaisa: netBalance,
        currency: "BDT",
        status: "INITIATED",
      });

      const customer = await authService.findCustomerById(customerId);
      const session = await paymentsService.initSslCommerzSession({
        orderId: ord.id,
        orderNumber: ord.orderNumber,
        tranId,
        amountPaisa: netBalance,
        currency: "BDT",
        customerName: customer?.fullName || "Valued Customer",
        customerPhone: customer?.phone || "+8801700000000",
        customerEmail: customer?.email,
        address: ord.addressSnapshot?.addressLine,
      });

      return {
        order_number: ord.orderNumber,
        status: "PENDING_PAYMENT",
        payment_redirect_url: session.paymentRedirectUrl,
        payable_paisa: netBalance,
        tran_id: tranId,
      };
    }

    if (dto.mode === "COD") {
      // Cap check: ৳30,000 = 3,000,000 paisa
      if (netBalance > PREORDER_COD_BALANCE_MAX_PAISA) {
        throw new BusinessError(
          "ERR_COD_NOT_ALLOWED",
          "COD balance cannot exceed ৳30,000",
          {
            balancePaisa: netBalance,
            maxAllowedPaisa: PREORDER_COD_BALANCE_MAX_PAISA,
          },
          422
        );
      }

      // Check COD block
      const customer = await authService.findCustomerById(customerId);
      if (customer?.codBlocked) {
        throw new BusinessError(
          "ERR_COD_NOT_ALLOWED",
          "Cash on Delivery is blocked for this account",
          {},
          422
        );
      }

      const { ordersRepo } = await import("@/modules/orders/repo");
      await ordersRepo.updateOrder(undefined, ord.id, {
        codAmountPaisa: netBalance,
        paymentMode: "COD",
        updatedAt: new Date(),
      });

      const updated = await ordersService.transitionOrder(
        undefined as unknown as Tx,
        ord.id,
        "BALANCE_COD_SCHEDULED",
        { id: customerId, type: "customer" },
        "Pre-order balance scheduled for Cash on Delivery collection"
      );

      return {
        order_number: ord.orderNumber,
        status: updated.status,
        payment_mode: "COD",
        cod_amount_collectible_paisa: netBalance,
      };
    }

    if (dto.mode === "COUNTER") {
      const { ordersRepo } = await import("@/modules/orders/repo");
      await ordersRepo.updateOrder(undefined, ord.id, {
        paymentMode: "PAY_AT_COUNTER",
        fulfillmentChannel: "PICKUP",
        codAmountPaisa: netBalance,
        updatedAt: new Date(),
      });

      const updated = await ordersService.transitionOrder(
        undefined as unknown as Tx,
        ord.id,
        "BALANCE_COUNTER_SCHEDULED",
        { id: customerId, type: "customer" },
        "Pre-order balance scheduled for showroom counter pickup & payment"
      );

      return {
        order_number: ord.orderNumber,
        status: updated.status,
        fulfillment_channel: "PICKUP",
        mode: "COUNTER",
        payable_paisa: netBalance,
      };
    }

    throw new ValidationError(`Unsupported balance payment mode: ${dto.mode}`);
  },

  /**
   * 11. Active flash deal lookup for pricing engine and catalog.
   */
  async getActiveFlashDeal(skuId: string, now: Date = new Date()) {
    return preorderRepo.getActiveFlashDealForSku(skuId, now);
  },

  /**
   * 12. Day-8 Forfeiture Job (daily 00:05):
   * QC_VERIFIED_BALANCE_DUE with forfeiture_date <= today (Day 8)
   * -> DEPOSIT_FORFEITED_CANCELLED; ledger PREORDER_DEPOSIT_FORFEITED (Dr 2010 / Cr 4030);
   * move units from QC_HOLD to GODOWN_NAWABPUR (PREORDER_FORFEIT_RECEIPT);
   * create flash_deals record so it sells as physical stock.
   */
  async runForfeitureJob(today: Date = new Date()): Promise<number> {
    const { orders } = await ordersService.listPreOrders({
      status: "QC_VERIFIED_BALANCE_DUE",
    });

    let forfeitedCount = 0;
    const systemActor: Actor = {
      id: "00000000-0000-0000-0000-000000000000",
      type: "staff",
      roles: ["SUPER_ADMIN", "GODOWN_MANAGER"],
    };

    for (const order of orders) {
      const preOrder = order.preOrder;
      if (!preOrder || !preOrder.forfeitureDate) continue;

      if (preOrder.forfeitureDate.getTime() <= today.getTime()) {
        try {
          // 1. Transition order to DEPOSIT_FORFEITED_CANCELLED
          await ordersService.transitionOrder(
            undefined as unknown as Tx,
            order.id,
            "DEPOSIT_FORFEITED_CANCELLED",
            systemActor,
            "Day 8 balance forfeiture deadline exceeded"
          );

          // 2. Post ledger PREORDER_DEPOSIT_FORFEITED (Dr 2010 / Cr 4030)
          const lines = postingRules.PREORDER_DEPOSIT_FORFEITED({
            amountPaisa: preOrder.depositPaisa,
            orderId: order.id,
          });

          await ledgerService.post(
            undefined,
            {
              eventType: "PREORDER_DEPOSIT_FORFEITED",
              sourceType: "ORDER",
              sourceId: order.id,
              description: `Pre-order deposit forfeited on Day 8 (${order.orderNumber})`,
              lines,
            },
            systemActor
          );

          // 3. Move units from QC_HOLD to GODOWN_NAWABPUR (PREORDER_FORFEIT_RECEIPT)
          for (const item of order.items) {
            await inventoryService.transfer(
              undefined,
              {
                skuId: item.skuId,
                fromLocationCode: "QC_HOLD",
                toLocationCode: "GODOWN_NAWABPUR",
                qty: item.qty,
                reason: "PREORDER_FORFEIT_RECEIPT",
                refType: "ORDER",
                refId: order.id,
              },
              systemActor
            );

            // 4. Mark SKU unit as Flash Deal in flash_deals table
            const landedPrice = item.unitCostPaisa ?? item.unitPricePaisa;
            await preorderRepo.createFlashDeal({
              skuId: item.skuId,
              qty: item.qty,
              pricePaisa: landedPrice,
              startsAt: today,
              endsAt: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days flash deal
              status: "ACTIVE",
            });
          }

          // 5. Emit outbox event
          await emitOutbox(undefined, {
            type: "preorder.deposit_forfeited",
            aggregateType: "order",
            aggregateId: order.id,
            payload: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              depositPaisa: preOrder.depositPaisa,
            },
          });

          forfeitedCount++;
        } catch (err) {
          console.error("RUN_FORFEITURE_ERR:", err);
          // Continue to next order
        }
      }
    }

    return forfeitedCount;
  },

  /**
   * 13. Batch Threshold Job (daily 01:00):
   * For products with preorder_batch_threshold N:
   * Batches older than 30 days with fewer than N paid deposits ->
   * Cancel & refund customers (and TODO: expedited fee path).
   */
  async runBatchThresholdJob(now: Date = new Date()): Promise<number> {
    const { orders } = await ordersService.listPreOrders({
      status: "DEPOSIT_PAID",
    });

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const batchMap = new Map<string, typeof orders>();

    for (const o of orders) {
      if (o.preOrder?.batchKey) {
        const list = batchMap.get(o.preOrder.batchKey) ?? [];
        list.push(o);
        batchMap.set(o.preOrder.batchKey, list);
      }
    }

    let refundedBatchesCount = 0;
    const systemActor: Actor = {
      id: "00000000-0000-0000-0000-000000000000",
      type: "staff",
      roles: ["SUPER_ADMIN"],
    };

    for (const [batchKey, batchOrders] of batchMap.entries()) {
      if (batchOrders.length === 0) continue;

      const oldestPlacedAt = Math.min(
        ...batchOrders.map((o) => o.placedAt.getTime())
      );
      const isOlderThan30Days = now.getTime() - oldestPlacedAt >= thirtyDaysMs;

      if (!isOlderThan30Days) continue;

      // Check product threshold
      const firstOrder = batchOrders[0];
      if (!firstOrder) continue;
      const sampleItem = firstOrder.items[0];
      if (!sampleItem) continue;

      const product = await catalogService.getProductById(sampleItem.productId);
      const threshold = product?.preorderBatchThreshold ?? 10;

      if (batchOrders.length < threshold) {
        // Unmet threshold after 30 days -> refund path
        for (const order of batchOrders) {
          try {
            await ordersService.transitionOrder(
              undefined as unknown as Tx,
              order.id,
              "CANCELLED_REFUNDED",
              systemActor,
              `Batch threshold of ${threshold} not met after 30 days (${batchKey})`
            );

            if (order.paidTotalPaisa > 0) {
              await emitOutbox(undefined, {
                type: "refund.requested",
                aggregateType: "order",
                aggregateId: order.id,
                payload: {
                  orderId: order.id,
                  customerId: order.customerId,
                  amountPaisa: order.paidTotalPaisa,
                  reason: "PREORDER_BATCH_THRESHOLD_UNMET",
                  autoApproved: true,
                },
              });
            }
          } catch {
            // Continue
          }
        }

        // TODO: Admin-handled expedited fee path
        await emitOutbox(undefined, {
          type: "preorder.batch_threshold_unmet",
          aggregateType: "preorder_batch",
          aggregateId: batchKey,
          payload: {
            batchKey,
            threshold,
            paidCount: batchOrders.length,
            // Admin can offer individual expedited import fee
          },
        });

        refundedBatchesCount++;
      }
    }

    return refundedBatchesCount;
  },

  /**
   * 14. Delay Job (daily 09:00):
   * Finds pre-orders not ARRIVED by eta_date + 7 days ->
   * sets delay_option OFFERED, notifies customer valid for 24h.
   */
  async runDelayJob(now: Date = new Date()): Promise<number> {
    const { orders } = await ordersService.listPreOrders({
      status: "SOURCED_IN_TRANSIT",
    });

    let offeredCount = 0;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    for (const order of orders) {
      const preOrder = order.preOrder;
      if (!preOrder || preOrder.arrivedAt) continue;

      if (
        preOrder.delayOption === "NONE" &&
        now.getTime() > preOrder.etaDate.getTime() + sevenDaysMs
      ) {
        await ordersService.updatePreOrder(undefined, order.id, {
          delayOption: "OFFERED",
          delayOfferedAt: now,
          updatedAt: now,
        });

        await emitOutbox(undefined, {
          type: "notification.preorder_delayed_choice_offered",
          aggregateType: "order",
          aggregateId: order.id,
          payload: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerId: order.customerId,
            delayOfferedAt: now,
            optionsValidHours: 24,
          },
        });

        offeredCount++;
      }
    }

    return offeredCount;
  },

  /**
   * 15. Balance Reminders Job (daily 10:00):
   * Class B reminders on Day 1, 4 and 7 after QC.
   * Day 7 also creates a Support call task (support_tasks table).
   */
  async runBalanceReminderJob(now: Date = new Date()): Promise<number> {
    const { orders } = await ordersService.listPreOrders({
      status: "QC_VERIFIED_BALANCE_DUE",
    });

    let reminderCount = 0;

    for (const order of orders) {
      const preOrder = order.preOrder;
      if (!preOrder || !preOrder.qcVerifiedAt) continue;

      const diffDays = Math.floor(
        (now.getTime() - preOrder.qcVerifiedAt.getTime()) / (24 * 60 * 60 * 1000)
      );

      if (diffDays === 1 || diffDays === 4 || diffDays >= 7) {
        await emitOutbox(undefined, {
          type: "notification.preorder_balance_reminder",
          aggregateType: "order",
          aggregateId: order.id,
          payload: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerId: order.customerId,
            balancePaisa: preOrder.balancePaisa,
            balanceDueDate: preOrder.balanceDueDate,
            day: diffDays,
          },
        });

        if (diffDays >= 7) {
          // Create support task for phone call
          await preorderRepo.createSupportTask({
            type: "PREORDER_BALANCE_CALL",
            orderId: order.id,
            dueAt: now,
            status: "PENDING",
            metadata: {
              customerId: order.customerId,
              orderNumber: order.orderNumber,
              balancePaisa: preOrder.balancePaisa,
              forfeitureDate: preOrder.forfeitureDate,
            },
          });
        }

        reminderCount++;
      }
    }

    return reminderCount;
  },

  /**
   * 16. Spot Repricing 48h Timeout Job (hourly/cron):
   * Cancels & refunds orders where repricing deadline expired without customer response.
   */
  async runRepricingTimeoutJob(now: Date = new Date()): Promise<number> {
    const { orders } = await ordersService.listPreOrders({
      status: "REPRICING_PENDING",
    });

    let timedOutCount = 0;
    const systemActor: Actor = {
      id: "00000000-0000-0000-0000-000000000000",
      type: "staff",
      roles: ["SUPER_ADMIN"],
    };

    for (const order of orders) {
      const preOrder = order.preOrder;
      if (
        preOrder &&
        preOrder.repricingDeadline &&
        now.getTime() > preOrder.repricingDeadline.getTime()
      ) {
        await ordersService.updatePreOrder(undefined, order.id, {
          repricingStatus: "REJECTED",
          updatedAt: now,
        });

        await ordersService.transitionOrder(
          undefined as unknown as Tx,
          order.id,
          "CANCELLED_REFUNDED",
          systemActor,
          "Spot repricing 48h deadline expired without customer response"
        );

        if (order.paidTotalPaisa > 0) {
          await emitOutbox(undefined, {
            type: "refund.requested",
            aggregateType: "order",
            aggregateId: order.id,
            payload: {
              orderId: order.id,
              customerId: order.customerId,
              amountPaisa: order.paidTotalPaisa,
              reason: "REPRICING_TIMEOUT_48H",
              autoApproved: true,
            },
          });
        }

        timedOutCount++;
      }
    }

    return timedOutCount;
  },
};
