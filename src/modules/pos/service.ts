import crypto from "node:crypto";
import { Actor } from "@/lib/http/route";
import {
  NotFoundError,
  ValidationError,
  BusinessError,
  ForbiddenError,
} from "@/lib/errors";
import { logger } from "@/lib/logger";
import { emitOutbox } from "@/lib/outbox";
import { maskPhone, normalizeBdPhone } from "@/lib/phone";
import { recordAudit } from "@/modules/audit";
import { ordersRepo } from "@/modules/orders/repo";
import { ordersService } from "@/modules/orders";
import { trustRepo } from "@/modules/trust/repo";
import { catalogService } from "@/modules/catalog";
import { inventoryRepo } from "@/modules/inventory/repo";
import { ledgerService, postingRules } from "@/modules/ledger";
import { customerService, authService } from "@/modules/identity";
import { piiSerializers } from "@/modules/identity/pii";
import { posRepo } from "./repo";
import {
  CashDrawerSessionRow,
  InsertCashDrawerSessionRow,
  DrawerStatus,
} from "./schema";
import {
  OpenDrawerDto,
  CloseDrawerDto,
  ReconcileDrawerDto,
  VerifyPickupPinDto,
  PickupHandoverDto,
  WalkInSaleDto,
  ReceiptPayloadDto,
  ReceiptItemDto,
  ShowroomStockItemDto,
} from "./dto";
import {
  assertCanOperatePos,
  assertCanCountDrawer,
  assertCanReconcileDrawer,
  assertCanResetPickupPin,
} from "./policies";
import { buildThermalReceipt } from "./receipt";

// --------------------------------------------------------------------------
// Constants & HMAC Helpers
// --------------------------------------------------------------------------
const PICKUP_PIN_PEPPER =
  process.env.PICKUP_PIN_PEPPER || "nawabpur-pickup-pin-secret-pepper-2026";

export function hashPickupPin(orderId: string, pin: string): string {
  return crypto
    .createHmac("sha256", PICKUP_PIN_PEPPER)
    .update(`${orderId}:${pin}`)
    .digest("hex");
}

export const posService = {
  // --------------------------------------------------------------------------
  // 1. Cash Drawer Sessions
  // --------------------------------------------------------------------------
  async openDrawer(
    staffId: string,
    dto: OpenDrawerDto,
    actor: Actor
  ): Promise<CashDrawerSessionRow> {
    assertCanOperatePos(actor);

    // Enforce 1 open drawer per staff
    const existing = await posRepo.findOpenDrawerByStaffId(staffId);
    if (existing) {
      throw new BusinessError(
        "ERR_DRAWER_ALREADY_OPEN",
        "Staff already has an active open cash drawer session",
        { sessionId: existing.id, openedAt: existing.openedAt },
        409
      );
    }

    const session = await posRepo.createDrawerSession({
      staffId,
      openingFloatPaisa: dto.opening_float_paisa,
      cashSalesPaisa: 0,
      cashRefundsPaisa: 0,
      expectedCashPaisa: dto.opening_float_paisa,
      status: "OPEN",
      openedAt: new Date(),
      notes: dto.notes ?? null,
    });

    await recordAudit(undefined, {
      entityType: "CASH_DRAWER",
      entityId: session.id,
      action: "DRAWER_OPENED",
      actorId: actor.id,
      metadata: {
        openingFloatPaisa: dto.opening_float_paisa,
      },
    });

    return session;
  },

  async closeDrawer(
    staffId: string,
    dto: CloseDrawerDto,
    actor: Actor
  ): Promise<CashDrawerSessionRow> {
    assertCanCountDrawer(actor);

    const session = await posRepo.findOpenDrawerByStaffId(staffId);
    if (!session) {
      throw new NotFoundError("No active open cash drawer found for staff member");
    }

    const variancePaisa = dto.counted_cash_paisa - session.expectedCashPaisa;
    const nextStatus: DrawerStatus =
      variancePaisa === 0 ? "COUNTED" : "VARIANCE_REVIEW";

    const updated = await posRepo.updateDrawerSession(session.id, {
      countedCashPaisa: dto.counted_cash_paisa,
      variancePaisa,
      status: nextStatus,
      countedAt: new Date(),
      closedAt: new Date(),
      notes: dto.notes ?? session.notes,
    });

    await recordAudit(undefined, {
      entityType: "CASH_DRAWER",
      entityId: session.id,
      action: "DRAWER_CLOSED",
      actorId: actor.id,
      metadata: {
        countedCashPaisa: dto.counted_cash_paisa,
        expectedCashPaisa: session.expectedCashPaisa,
        variancePaisa,
        status: nextStatus,
      },
    });

    return updated;
  },

  async reconcileDrawer(
    drawerId: string,
    dto: ReconcileDrawerDto,
    actor: Actor
  ): Promise<CashDrawerSessionRow> {
    assertCanReconcileDrawer(actor);

    const session = await posRepo.getDrawerSessionById(drawerId);
    if (!session) {
      throw new NotFoundError(`Cash drawer session '${drawerId}' not found`);
    }

    if (session.status === "CLOSED") {
      throw new BusinessError(
        "ERR_DRAWER_ALREADY_CLOSED",
        "Cash drawer session has already been reconciled and closed",
        { status: session.status },
        409
      );
    }

    const variancePaisa = session.variancePaisa ?? 0;

    // Post Double-Entry Ledger Entry if variance exists
    if (variancePaisa !== 0) {
      if (variancePaisa < 0) {
        // Cash Shortage: Dr 5310 (Cash Variance) / Cr 1010 (Showroom Drawer)
        const shortageLines = postingRules.CASH_SHORTAGE({
          amountPaisa: Math.abs(variancePaisa),
          location: "DRAWER",
          refId: session.id,
        });
        await ledgerService.post(undefined, {
          eventType: "CASH_SHORTAGE",
          sourceType: "DRAWER_SESSION",
          sourceId: session.id,
          description: `Cash drawer shortage for session ${session.id}`,
          lines: shortageLines,
        });
      } else {
        // Cash Overage: Dr 1010 (Showroom Drawer) / Cr 5310 (Cash Variance)
        const overageLines = postingRules.CASH_OVERAGE({
          amountPaisa: variancePaisa,
          location: "DRAWER",
          refId: session.id,
        });
        await ledgerService.post(undefined, {
          eventType: "CASH_OVERAGE",
          sourceType: "DRAWER_SESSION",
          sourceId: session.id,
          description: `Cash drawer overage for session ${session.id}`,
          lines: overageLines,
        });
      }
    }

    const updated = await posRepo.updateDrawerSession(session.id, {
      status: "CLOSED",
      reconciledBy: actor.id,
      closedAt: session.closedAt ?? new Date(),
      notes: dto.notes ?? session.notes,
    });

    await recordAudit(undefined, {
      entityType: "CASH_DRAWER",
      entityId: session.id,
      action: "DRAWER_RECONCILED",
      actorId: actor.id,
      metadata: {
        variancePaisa,
        reconciledBy: actor.id,
      },
    });

    return updated;
  },

  async getOpenDrawer(staffId: string): Promise<CashDrawerSessionRow | null> {
    return posRepo.findOpenDrawerByStaffId(staffId);
  },

  // --------------------------------------------------------------------------
  // 2. Pickup PIN Generation & Verification
  // --------------------------------------------------------------------------
  async generatePickupPin(
    orderId: string,
    actor?: Actor
  ): Promise<{ pin: string; expiresAt: Date }> {
    const order = await ordersRepo.getOrderById(undefined, orderId);
    if (!order) {
      throw new NotFoundError(`Order '${orderId}' not found`);
    }

    // 6-digit random numeric PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const hash = hashPickupPin(orderId, pin);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day validity

    await ordersRepo.updateOrder(undefined, orderId, {
      pickupPinHash: hash,
      pickupPinExpiresAt: expiresAt,
      pickupPinAttempts: 0,
      pickupPinLocked: false,
    });

    // Send SMS notification via Outbox (Class B, Notification 9)
    const phone = order.addressSnapshot?.phone ?? "";
    await emitOutbox(undefined, {
      type: "notification.sms",
      aggregateType: "order",
      aggregateId: order.id,
      payload: {
        phone,
        template: "PICKUP_PIN_GENERATED",
        pin,
        orderNumber: order.orderNumber,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return { pin, expiresAt };
  },

  async resetPickupPin(
    orderId: string,
    dto?: { reason?: string },
    actor?: Actor
  ): Promise<{ success: boolean; expires_at: Date }> {
    if (actor) {
      assertCanResetPickupPin(actor);
    }

    const { expiresAt } = await this.generatePickupPin(orderId, actor);

    await recordAudit(undefined, {
      entityType: "ORDER",
      entityId: orderId,
      action: "PICKUP_PIN_RESET",
      actorId: actor?.id ?? "customer-support",
      metadata: {
        reason: dto?.reason ?? "Support override / pin reset",
      },
    });

    return { success: true, expires_at: expiresAt };
  },

  async verifyPickupPin(
    dto: VerifyPickupPinDto,
    actor: Actor
  ): Promise<{
    valid: boolean;
    order: {
      order_id: string;
      order_number: string;
      customer_name: string;
      phone_masked: string;
      payment_status: string;
      amount_due_at_counter_paisa: number;
      items: Array<{
        sku_code: string;
        title: string;
        qty: number;
        seal_id: string | null;
      }>;
    };
  }> {
    assertCanOperatePos(actor);

    const orderSummary = await ordersRepo.getOrderByNumber(undefined, dto.order_number);
    if (!orderSummary) {
      throw new NotFoundError(`Order '${dto.order_number}' not found`);
    }

    // 1. Status Check
    if (orderSummary.status !== "READY_FOR_PICKUP") {
      throw new BusinessError(
        "ERR_INVALID_ORDER_STATUS",
        `Order is not ready for pickup (current status: ${orderSummary.status})`,
        { status: orderSummary.status },
        409
      );
    }

    // 2. Lockout Check
    if (orderSummary.pickupPinLocked || orderSummary.pickupPinAttempts >= 5) {
      throw new BusinessError(
        "ERR_PIN_LOCKED",
        "PIN locked due to 5 consecutive failed attempts. Contact support to unlock.",
        { orderNumber: orderSummary.orderNumber },
        423
      );
    }

    // 3. Expiration Check
    if (
      orderSummary.pickupPinExpiresAt &&
      new Date() > orderSummary.pickupPinExpiresAt
    ) {
      throw new BusinessError(
        "ERR_PIN_EXPIRED",
        "Pickup PIN has expired. Please contact support or request a new PIN.",
        { orderNumber: orderSummary.orderNumber },
        410
      );
    }

    // 4. Constant-Time Verification
    const candidateHash = hashPickupPin(orderSummary.id, dto.pickup_pin);
    const storedHash = orderSummary.pickupPinHash || "";

    const isMatch =
      candidateHash.length === storedHash.length &&
      crypto.timingSafeEqual(
        Buffer.from(candidateHash, "hex"),
        Buffer.from(storedHash, "hex")
      );

    if (!isMatch) {
      const nextAttempts = orderSummary.pickupPinAttempts + 1;
      const isLocked = nextAttempts >= 5;

      await ordersRepo.updateOrder(undefined, orderSummary.id, {
        pickupPinAttempts: nextAttempts,
        pickupPinLocked: isLocked,
      });

      if (isLocked) {
        throw new BusinessError(
          "ERR_PIN_LOCKED",
          "PIN locked due to 5 consecutive failed attempts. Contact support to unlock.",
          { orderNumber: orderSummary.orderNumber },
          423
        );
      }

      const remaining = 5 - nextAttempts;
      throw new BusinessError(
        "ERR_INVALID_PIN",
        `Incorrect PIN. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
        { remaining_attempts: remaining },
        401
      );
    }

    // Reset attempts upon successful verification
    await ordersRepo.updateOrder(undefined, orderSummary.id, {
      pickupPinAttempts: 0,
    });

    const fullOrder = await ordersRepo.getOrderWithDetails(undefined, orderSummary.id);
    if (!fullOrder) {
      throw new NotFoundError(`Order '${orderSummary.id}' not found`);
    }

    const customerRaw = {
      id: fullOrder.customerId,
      fullName: fullOrder.addressSnapshot?.name ?? "Customer",
      phone: fullOrder.addressSnapshot?.phone ?? "",
      email: null,
    };
    const counterCustomer = piiSerializers.toCounter(customerRaw);

    const amountDueAtCounter =
      fullOrder.paymentStatus === "PAID"
        ? 0
        : Math.max(0, fullOrder.totalPaisa - (fullOrder.paidAmountPaisa || 0));

    return {
      valid: true,
      order: {
        order_id: fullOrder.id,
        order_number: fullOrder.orderNumber,
        customer_name: counterCustomer.consigneeName ?? "Customer",
        phone_masked: counterCustomer.maskedPhone,
        payment_status: fullOrder.paymentStatus,
        amount_due_at_counter_paisa: amountDueAtCounter,
        items: (fullOrder.items || []).map((item) => ({
          sku_code: item.skuCode,
          title: item.productTitle,
          qty: item.qty,
          seal_id: item.units?.[0]?.sealId ?? null,
        })),
      },
    };
  },

  // --------------------------------------------------------------------------
  // 3. Complete Pickup Handover
  // --------------------------------------------------------------------------
  async handoverPickup(
    dto: PickupHandoverDto,
    actor: Actor,
    idempotencyKey?: string
  ): Promise<{
    success: boolean;
    order_id: string;
    status: string;
    receipt: ReceiptPayloadDto;
  }> {
    assertCanOperatePos(actor);

    const order = await ordersRepo.getOrderWithDetails(undefined, dto.order_id);
    if (!order) {
      throw new NotFoundError(`Order '${dto.order_id}' not found`);
    }

    if (order.status !== "READY_FOR_PICKUP") {
      throw new BusinessError(
        "ERR_INVALID_ORDER_STATUS",
        `Order is not in READY_FOR_PICKUP status (current status: ${order.status})`,
        { status: order.status },
        409
      );
    }

    // 1. Balance Due Check
    const amountDue =
      order.paymentStatus === "PAID"
        ? 0
        : Math.max(0, order.totalPaisa - (order.paidAmountPaisa || 0));

    let openDrawer: CashDrawerSessionRow | null = null;

    if (amountDue > 0) {
      if (!dto.payment || dto.payment.amount_paisa !== amountDue) {
        throw new ValidationError(
          `Payment required at counter: expected ৳${(amountDue / 100).toFixed(2)}, received ৳${((dto.payment?.amount_paisa || 0) / 100).toFixed(2)}`
        );
      }

      // If paying by cash, require open drawer
      if (dto.payment.method === "CASH") {
        openDrawer = await posRepo.findOpenDrawerByStaffId(actor.id);
        if (!openDrawer) {
          throw new BusinessError(
            "ERR_NO_OPEN_DRAWER",
            "Cash payment requires an active open cash drawer session for this staff member",
            {},
            422
          );
        }

        // Accumulate cash into open drawer
        const newSales = openDrawer.cashSalesPaisa + dto.payment.amount_paisa;
        const newExpected = openDrawer.expectedCashPaisa + dto.payment.amount_paisa;
        openDrawer = await posRepo.updateDrawerSession(openDrawer.id, {
          cashSalesPaisa: newSales,
          expectedCashPaisa: newExpected,
        });
      }

      // Record counter payment transaction
      await ordersRepo.createPaymentTransaction(undefined, {
        orderId: order.id,
        amountPaisa: dto.payment.amount_paisa,
        paymentMethod: dto.payment.method,
        status: "PAID",
        gatewayRef: dto.payment.reference ?? `COUNTER-${Date.now()}`,
      });

      await ordersRepo.updateOrder(undefined, order.id, {
        paidAmountPaisa: (order.paidAmountPaisa || 0) + dto.payment.amount_paisa,
        paymentStatus: "PAID",
      });
    }

    // 2. Transition Order to DELIVERED_COUNTER
    try {
      await ordersService.transitionOrder(
        undefined as any,
        order.id,
        "DELIVERED_COUNTER",
        actor,
        "Customer completed bench inspection and signed handover slip"
      );
    } catch {
      await ordersRepo.updateOrder(undefined, order.id, {
        status: "DELIVERED_COUNTER",
      });
    }

    // 3. Double-Entry Revenue Recognition
    const counterCashPaisa = dto.payment?.method === "CASH" ? dto.payment.amount_paisa : 0;
    const counterWalletPaisa =
      dto.payment?.method === "BKASH_QR" || dto.payment?.method === "NAGAD_QR"
        ? dto.payment.amount_paisa
        : 0;
    const counterBankPaisa =
      dto.payment?.method === "CARD_TERMINAL" ? dto.payment.amount_paisa : 0;

    const prepaidAdvancesPaisa = order.advanceFeePaid
      ? order.advanceFeePaisa
      : Math.max(0, (order.paidAmountPaisa || 0) - (dto.payment?.amount_paisa || 0));

    const discountPaisa = order.couponDiscountPaisa || 0;
    const vatPaisa = order.taxPaisa || 0;
    const revenueExVatPaisa = Math.max(0, (order.subtotalPaisa || 0) - vatPaisa);
    const deliveryFeePaisa = order.deliveryFeePaisa || 0;

    const revenueLines = postingRules.REVENUE_RECOGNIZED_DELIVERY({
      orderId: order.id,
      counterCashPaisa,
      counterWalletPaisa,
      counterBankPaisa,
      drawerId: openDrawer?.id,
      prepaidAdvancesPaisa,
      discountPaisa,
      revenueExVatPaisa,
      vatPaisa,
      deliveryFeePaisa,
    });

    await ledgerService.post(undefined, {
      eventType: "REVENUE_RECOGNIZED_DELIVERY",
      sourceType: "ORDER",
      sourceId: order.id,
      description: `Revenue recognized for counter pickup of order ${order.orderNumber}`,
      lines: revenueLines,
    });

    // 4. COGS Recognition
    let totalCostPaisa = 0;
    for (const item of order.items) {
      totalCostPaisa += (item.unitCostPaisa || 0) * item.qty;
    }

    if (totalCostPaisa > 0) {
      await ledgerService.post(undefined, {
        eventType: "COGS_RECOGNIZED",
        sourceType: "ORDER",
        sourceId: order.id,
        description: `COGS recognized for counter pickup of order ${order.orderNumber}`,
        lines: postingRules.COGS_RECOGNIZED({ costPaisa: totalCostPaisa }),
      });
    }

    // 5. Warranty Start for All Item Seals
    const receiptItems: ReceiptItemDto[] = [];
    const now = new Date();

    for (const item of order.items) {
      for (const unit of item.units) {
        if (unit.sealId) {
          const seal = await trustRepo.getSealRecordBySealId(unit.sealId);
          if (seal) {
            const start = now;
            const end = new Date(
              start.getTime() + (seal.warrantyDays || 365) * 24 * 60 * 60 * 1000
            );
            await trustRepo.updateSealRecord(seal.id, {
              status: "ACTIVE",
              warrantyStart: start,
              warrantyEnd: end,
            });

            receiptItems.push({
              title: item.productTitle,
              sku_code: item.skuCode,
              qty: 1,
              unit_price_paisa: item.unitPricePaisa,
              line_total_paisa: item.unitPricePaisa,
              seal_id: seal.sealId,
              warranty_days: seal.warrantyDays || 365,
            });
          }
        }
      }
    }

    // 6. Build Thermal Receipt Payload
    const receipt = buildThermalReceipt({
      receiptNumber: `RCP-${order.orderNumber.replace(/^[^-]+-/, "")}`,
      orderNumber: order.orderNumber,
      orderId: order.id,
      channel: order.channel,
      fulfillment: order.fulfillmentChannel,
      customerName: order.addressSnapshot?.name ?? "Customer",
      customerPhoneMasked: maskPhone(order.addressSnapshot?.phone ?? ""),
      items: receiptItems,
      subtotalPaisa: order.subtotalPaisa,
      discountPaisa: order.couponDiscountPaisa,
      vatPaisa: order.taxPaisa,
      totalPaisa: order.totalPaisa,
      paidAmountPaisa: order.totalPaisa,
      paymentMode: dto.payment?.method ?? (order.paymentStatus === "PAID" ? "ONLINE_PREPAID" : "COUNTER"),
      paymentReference: dto.payment?.reference,
      printedAt: now,
    });

    // 7. Emit Outbox Events
    await emitOutbox(undefined, {
      type: "order.delivered_counter",
      aggregateType: "order",
      aggregateId: order.id,
      payload: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
      },
    });

    await emitOutbox(undefined, {
      type: "analytics.order_delivered",
      aggregateType: "order",
      aggregateId: order.id,
      payload: {
        orderId: order.id,
        customerId: order.customerId,
        channel: "SHOWROOM_COUNTER",
        totalPaisa: order.totalPaisa,
      },
    });

    const reviewInviteDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    await emitOutbox(undefined, {
      type: "customer.review_invitation_due",
      aggregateType: "customer",
      aggregateId: order.customerId,
      payload: {
        orderId: order.id,
        customerId: order.customerId,
        dueAt: reviewInviteDate.toISOString(),
      },
    });

    return {
      success: true,
      order_id: order.id,
      status: "DELIVERED_COUNTER",
      receipt,
    };
  },

  // --------------------------------------------------------------------------
  // 4. Walk-In POS Sale
  // --------------------------------------------------------------------------
  async executeWalkInSale(
    dto: WalkInSaleDto,
    actor: Actor,
    idempotencyKey?: string
  ): Promise<{
    success: boolean;
    order: {
      id: string;
      order_number: string;
      status: string;
      total_paisa: number;
    };
    receipt: ReceiptPayloadDto;
  }> {
    assertCanOperatePos(actor);

    // 1. If payment mode is CASH, require an active open drawer session
    let openDrawer: CashDrawerSessionRow | null = null;
    if (dto.payment_mode === "CASH") {
      openDrawer = await posRepo.findOpenDrawerByStaffId(actor.id);
      if (!openDrawer) {
        throw new BusinessError(
          "ERR_NO_OPEN_DRAWER",
          "Cash payment requires an active open cash drawer session for this staff member",
          {},
          422
        );
      }
    }

    // 2. Customer: Find or create customer
    const customer = await authService.findOrCreateCustomerByPhone(
      dto.customer_phone,
      dto.customer_name ?? "Walk-In Customer"
    );

    // 3. Item & Holographic Seal Validation
    const validatedItems: Array<{
      skuId: string;
      skuCode: string;
      productTitle: string;
      sealId: string;
      sealDbId: string;
      unitPricePaisa: number;
      unitCostPaisa: number;
      vatPaisa: number;
      warrantyDays: number;
    }> = [];

    let subtotalPaisa = 0;
    let totalCostPaisa = 0;
    let totalVatPaisa = 0;

    for (const item of dto.items) {
      const seal = await trustRepo.getSealRecordBySealId(item.seal_id);
      if (!seal) {
        throw new NotFoundError(`Seal '${item.seal_id}' not found`);
      }

      // Must be ACTIVE and not linked to any existing order
      if (seal.status !== "ACTIVE" && seal.status !== "PRINTED") {
        throw new BusinessError(
          "ERR_INVALID_SEAL_STATUS",
          `Seal '${item.seal_id}' is in ${seal.status} status and cannot be sold`,
          { sealId: item.seal_id, status: seal.status },
          422
        );
      }

      if (seal.orderItemUnitId) {
        throw new BusinessError(
          "ERR_SEAL_ALREADY_LINKED",
          `Seal '${item.seal_id}' is already linked to another order unit`,
          { sealId: item.seal_id },
          409
        );
      }

      // Check physical showroom stock balance
      const showroomLoc = await inventoryRepo.getLocationByCode("SHOWROOM_COUNTER");
      const balance = showroomLoc
        ? await inventoryRepo.getBalance(item.sku_id, showroomLoc.id)
        : null;
      const available = balance ? balance.onHand - balance.reserved : 0;
      if (available < item.quantity) {
        throw new BusinessError(
          "ERR_INSUFFICIENT_SHOWROOM_STOCK",
          `Insufficient physical stock in showroom counter for SKU '${item.sku_id}' (available: ${available})`,
          { skuId: item.sku_id, available },
          409
        );
      }

      const sku = await catalogService.getSkuById(item.sku_id);
      if (!sku) {
        throw new NotFoundError(`SKU '${item.sku_id}' not found`);
      }
      const product = await catalogService.getProductById(sku.productId);

      const unitPrice = sku.pricePaisa;
      const unitCost = sku.baseCostPaisa;
      // 15% inclusive VAT component
      const itemVat = Math.round((unitPrice * 0.15) / 1.15);

      subtotalPaisa += unitPrice * item.quantity;
      totalCostPaisa += unitCost * item.quantity;
      totalVatPaisa += itemVat * item.quantity;

      validatedItems.push({
        skuId: sku.id,
        skuCode: sku.skuCode,
        productTitle: product?.titleEn ?? "Counter Item",
        sealId: seal.sealId,
        sealDbId: seal.id,
        unitPricePaisa: unitPrice,
        unitCostPaisa: unitCost,
        vatPaisa: itemVat,
        warrantyDays: sku.warrantyDays || seal.warrantyDays || 365,
      });
    }

    const discountPaisa = 0; // Coupon discounts can be added if valid
    const totalPaisa = subtotalPaisa - discountPaisa;

    if (dto.paid_amount_paisa < totalPaisa) {
      throw new ValidationError(
        `Tendered payment insufficient: expected ৳${(totalPaisa / 100).toFixed(2)}, received ৳${(dto.paid_amount_paisa / 100).toFixed(2)}`
      );
    }

    // 4. Update Cash Drawer Session
    if (openDrawer && dto.payment_mode === "CASH") {
      const newSales = openDrawer.cashSalesPaisa + totalPaisa;
      const newExpected = openDrawer.expectedCashPaisa + totalPaisa;
      await posRepo.updateDrawerSession(openDrawer.id, {
        cashSalesPaisa: newSales,
        expectedCashPaisa: newExpected,
      });
    }

    const orderId = crypto.randomUUID();
    const orderNumber = `POS-${Date.now().toString().slice(-8)}`;
    const now = new Date();

    // 5. Decrement Physical Showroom Counter Stock (POS_SALE)
    const showroomLoc = await inventoryRepo.getLocationByCode("SHOWROOM_COUNTER");
    for (const item of validatedItems) {
      if (showroomLoc) {
        await inventoryRepo.createStockMovement({
          skuId: item.skuId,
          fromLocationId: showroomLoc.id,
          toLocationId: null,
          qty: 1,
          reason: "POS_SALE",
          refType: "ORDER",
          refId: orderId,
          unitCostPaisa: item.unitCostPaisa,
          staffId: actor.id,
        });

        const bal = await inventoryRepo.getBalance(item.skuId, showroomLoc.id);
        if (bal) {
          await inventoryRepo.upsertBalance({
            skuId: item.skuId,
            locationId: showroomLoc.id,
            onHand: Math.max(0, bal.onHand - 1),
            reserved: bal.reserved,
          });
        }
      }
    }

    // 6. Create Order directly in DELIVERED_COUNTER status
    const createdOrder = await ordersRepo.createOrder(undefined, {
      order: {
        id: orderId,
        orderNumber,
        customerId: customer.id,
        orderType: "REGULAR_DROP_PACK",
        channel: "SHOWROOM_POS",
        fulfillmentChannel: "WALK_IN",
        status: "DELIVERED_COUNTER",
        paymentStatus: "PAID",
        subtotalPaisa,
        couponDiscountPaisa: discountPaisa,
        deliveryFeePaisa: 0,
        taxPaisa: totalVatPaisa,
        totalPaisa,
        codAmountPaisa: 0,
        advanceFeePaisa: 0,
        advanceFeePaid: false,
        paidAmountPaisa: totalPaisa,
        deliveryZone: "INSIDE_DHAKA",
        addressSnapshot: {
          name: customer.fullName ?? "Walk-In Customer",
          phone: customer.phone,
          address: "Showroom Counter 24/B Nawabpur Road",
          thana: "Kotwali",
          district: "Dhaka",
          division: "Dhaka",
        },
      },
      items: validatedItems.map((v) => ({
        skuId: v.skuId,
        productTitle: v.productTitle,
        skuCode: v.skuCode,
        qty: 1,
        unitPricePaisa: v.unitPricePaisa,
        unitCostPaisa: v.unitCostPaisa,
        taxPaisa: v.vatPaisa,
        units: [
          {
            sealId: v.sealId,
            status: "DELIVERED",
          },
        ],
      })),
    });

    // 7. Link Seals & Start Warranty
    const receiptItems: ReceiptItemDto[] = [];

    for (let i = 0; i < validatedItems.length; i++) {
      const v = validatedItems[i]!;
      const unit = createdOrder.items[i]?.units[0];
      const start = now;
      const end = new Date(start.getTime() + v.warrantyDays * 24 * 60 * 60 * 1000);

      await trustRepo.updateSealRecord(v.sealDbId, {
        orderItemUnitId: unit?.id ?? null,
        status: "ACTIVE",
        warrantyStart: start,
        warrantyEnd: end,
      });

      receiptItems.push({
        title: v.productTitle,
        sku_code: v.skuCode,
        qty: 1,
        unit_price_paisa: v.unitPricePaisa,
        line_total_paisa: v.unitPricePaisa,
        seal_id: v.sealId,
        warranty_days: v.warrantyDays,
      });
    }

    // 8. Record Payment Transaction
    await ordersRepo.createPaymentTransaction(undefined, {
      orderId: createdOrder.id,
      amountPaisa: totalPaisa,
      paymentMethod: dto.payment_mode,
      status: "PAID",
      gatewayRef: dto.reference ?? `POS-REC-${Date.now()}`,
    });

    // 9. Double-Entry Accounting (POS_WALKIN_SALE)
    const cashPaisa = dto.payment_mode === "CASH" ? totalPaisa : 0;
    const walletPaisa =
      dto.payment_mode === "BKASH_QR" || dto.payment_mode === "NAGAD_QR"
        ? totalPaisa
        : 0;
    const bankPaisa = dto.payment_mode === "CARD_TERMINAL" ? totalPaisa : 0;
    const revenueExVatPaisa = subtotalPaisa - totalVatPaisa;

    const posLines = postingRules.POS_WALKIN_SALE({
      cashPaisa,
      walletPaisa,
      bankPaisa,
      drawerId: openDrawer?.id,
      discountPaisa,
      revenueExVatPaisa,
      vatPaisa: totalVatPaisa,
      costPaisa: totalCostPaisa,
    });

    await ledgerService.post(undefined, {
      eventType: "POS_WALKIN_SALE",
      sourceType: "ORDER",
      sourceId: createdOrder.id,
      description: `Walk-in POS sale ${createdOrder.orderNumber}`,
      lines: posLines,
    });

    // 10. Thermal Receipt Payload
    const receipt = buildThermalReceipt({
      receiptNumber: `RCP-${orderNumber}`,
      orderNumber,
      orderId: createdOrder.id,
      channel: "SHOWROOM_POS",
      fulfillment: "WALK_IN",
      customerName: customer.fullName ?? "Walk-In Customer",
      customerPhoneMasked: maskPhone(customer.phone),
      items: receiptItems,
      subtotalPaisa,
      discountPaisa,
      vatPaisa: totalVatPaisa,
      totalPaisa,
      paidAmountPaisa: dto.paid_amount_paisa,
      paymentMode: dto.payment_mode,
      paymentReference: dto.reference,
      printedAt: now,
    });

    // 11. Outbox Events
    await emitOutbox(undefined, {
      type: "order.pos_sale",
      aggregateType: "order",
      aggregateId: createdOrder.id,
      payload: {
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        totalPaisa,
      },
    });

    return {
      success: true,
      order: {
        id: createdOrder.id,
        order_number: createdOrder.orderNumber,
        status: createdOrder.status,
        total_paisa: createdOrder.totalPaisa,
      },
      receipt,
    };
  },

  // --------------------------------------------------------------------------
  // 5. Showroom Stock View
  // --------------------------------------------------------------------------
  async getShowroomStock(query?: string): Promise<{ items: ShowroomStockItemDto[] }> {
    const qLower = query?.toLowerCase().trim();

    // Find all ACTIVE or PRINTED seals not yet linked to an order unit
    const { items: allSeals } = await trustRepo.listSealRecords({
      status: "ACTIVE",
      limit: 100,
    });

    // Filter to unlinked counter seals
    const unlinkedSeals = allSeals.filter((s) => !s.orderItemUnitId);

    const items: ShowroomStockItemDto[] = [];

    for (const seal of unlinkedSeals) {
      const sku = await catalogService.getSkuById(seal.skuId);
      if (!sku) continue;

      const product = await catalogService.getProductById(sku.productId);

      if (
        qLower &&
        !sku.skuCode.toLowerCase().includes(qLower) &&
        !product?.titleEn.toLowerCase().includes(qLower) &&
        !seal.sealId.toLowerCase().includes(qLower)
      ) {
        continue;
      }

      items.push({
        sku_id: sku.id,
        sku_code: sku.skuCode,
        product_id: sku.productId,
        title_en: product?.titleEn ?? "Item",
        title_bn: product?.titleBn ?? "আইটেম",
        product_tier: seal.productTier,
        price_paisa: sku.pricePaisa,
        warranty_days: seal.warrantyDays,
        seal_id: seal.sealId,
        manufacturer_serial: seal.manufacturerSerial,
        status: seal.status,
      });
    }

    return { items };
  },

  // --------------------------------------------------------------------------
  // 6. Unclaimed Pickups Scheduled Job (Daily 09:30)
  // --------------------------------------------------------------------------
  async runUnclaimedPickupsJob(): Promise<{
    remindersDay3: number;
    remindersDay6: number;
    expiredDay8: number;
    prepaidDay14Tasks: number;
  }> {
    const now = new Date();
    let remindersDay3 = 0;
    let remindersDay6 = 0;
    let expiredDay8 = 0;
    let prepaidDay14Tasks = 0;

    const readyOrders = await ordersRepo.listOrdersByStatuses(undefined, [
      "READY_FOR_PICKUP",
    ]);

    for (const order of readyOrders) {
      const readyAt = order.updatedAt ?? order.placedAt;
      const ageHours = (now.getTime() - readyAt.getTime()) / (1000 * 60 * 60);
      const ageDays = ageHours / 24;
      const isPaid = order.paymentStatus === "PAID";
      const phone = order.addressSnapshot?.phone ?? "";

      // Day 3 Reminder: between 72h and 96h (3-4 days)
      if (ageDays >= 3 && ageDays < 4) {
        await emitOutbox(undefined, {
          type: "notification.sms",
          aggregateType: "order",
          aggregateId: order.id,
          payload: {
            phone,
            template: "PICKUP_REMINDER_DAY_3",
            orderNumber: order.orderNumber,
            daysRemaining: 4,
          },
        });
        remindersDay3++;
      }

      // Day 6 Urgent Reminder: between 144h and 168h (6-7 days)
      if (ageDays >= 6 && ageDays < 7) {
        await emitOutbox(undefined, {
          type: "notification.sms",
          aggregateType: "order",
          aggregateId: order.id,
          payload: {
            phone,
            template: "PICKUP_REMINDER_DAY_6",
            orderNumber: order.orderNumber,
            daysRemaining: 1,
          },
        });
        remindersDay6++;
      }

      // Day 8 Unpaid: age >= 7 days and unpaid -> PICKUP_EXPIRED -> Cancel & Restock
      if (ageDays >= 7 && !isPaid) {
        try {
          await ordersService.transitionOrder(
            undefined as any,
            order.id,
            "PICKUP_EXPIRED",
            { id: "system-job", type: "system", roles: ["SUPER_ADMIN"] },
            "Pickup expired on Day 8: customer did not claim counter pickup"
          );
        } catch {
          await ordersRepo.updateOrder(undefined, order.id, {
            status: "PICKUP_EXPIRED",
          });
        }

        // Restock units back to sellable SHOWROOM_COUNTER
        const showroomLoc = await inventoryRepo.getLocationByCode("SHOWROOM_COUNTER");
        const full = await ordersRepo.getOrderWithDetails(undefined, order.id);
        if (full && showroomLoc) {
          for (const item of full.items) {
            await inventoryRepo.createStockMovement({
              skuId: item.skuId,
              fromLocationId: null,
              toLocationId: showroomLoc.id,
              qty: item.qty,
              reason: "CANCELLATION_RECEIPT",
              refType: "ORDER",
              refId: order.id,
              unitCostPaisa: item.unitCostPaisa || 0,
              staffId: null,
            });

            const bal = await inventoryRepo.getBalance(item.skuId, showroomLoc.id);
            await inventoryRepo.upsertBalance({
              skuId: item.skuId,
              locationId: showroomLoc.id,
              onHand: (bal?.onHand ?? 0) + item.qty,
              reserved: bal?.reserved ?? 0,
            });
          }
        }

        // If any advance fee was paid, refund request
        if ((order.paidAmountPaisa || 0) > 0) {
          await emitOutbox(undefined, {
            type: "refund.requested",
            aggregateType: "order",
            aggregateId: order.id,
            payload: {
              orderId: order.id,
              customerId: order.customerId,
              amountPaisa: order.paidAmountPaisa,
              reason: "Unclaimed pickup expired Day 8",
            },
          });
        }

        expiredDay8++;
      }

      // Day 14+ Prepaid: age >= 14 days and paid -> Escalate to Customer Support Task
      if (ageDays >= 14 && isPaid) {
        await emitOutbox(undefined, {
          type: "support.unclaimed_prepaid_pickup",
          aggregateType: "order",
          aggregateId: order.id,
          payload: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerId: order.customerId,
            ageDays: Math.floor(ageDays),
            paidAmountPaisa: order.paidAmountPaisa,
            actionRequired: "Arrange courier delivery or issue refund",
          },
        });
        prepaidDay14Tasks++;
      }
    }

    return {
      remindersDay3,
      remindersDay6,
      expiredDay8,
      prepaidDay14Tasks,
    };
  },

  clearMemoryForTesting(): void {
    posRepo.clearMemoryForTesting();
  },
};
