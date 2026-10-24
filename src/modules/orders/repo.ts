import { eq, and, sql, lte, gte, inArray, desc } from "drizzle-orm";
import { Tx, db as defaultDb } from "@/lib/db";
import {
  orders,
  orderItems,
  orderItemUnits,
  orderStatusHistory,
  preOrders,
  paymentTransactions,
  cartHolds,
  orderNotes,
  OrderRow,
  InsertOrderRow,
  OrderItemRow,
  InsertOrderItemRow,
  OrderItemUnitRow,
  InsertOrderItemUnitRow,
  OrderStatusHistoryRow,
  InsertOrderStatusHistoryRow,
  PreOrderRow,
  InsertPreOrderRow,
  PaymentTransactionRow,
  InsertPaymentTransactionRow,
  CartHoldRow,
  InsertCartHoldRow,
  OrderNoteRow,
  InsertOrderNoteRow,
  OrderStatus,
  OrderType,
  OrderChannel,
  AddressSnapshot,
} from "./schema";

// In-Memory Fallback Store for offline mode / unit testing
const memOrders = new Map<string, OrderRow>();
const memOrderItems = new Map<string, OrderItemRow>();
const memOrderItemUnits = new Map<string, OrderItemUnitRow>();
const memHistory = new Map<string, OrderStatusHistoryRow>();
const memPreOrders = new Map<string, PreOrderRow>();
const memPaymentTxs = new Map<string, PaymentTransactionRow>();
const memCartHolds = new Map<string, CartHoldRow>();
const memOrderNotes = new Map<string, OrderNoteRow>();

/**
 * Clear in-memory state for test isolation.
 */
export function clearMemoryOrdersForTesting(): void {
  memOrders.clear();
  memOrderItems.clear();
  memOrderItemUnits.clear();
  memHistory.clear();
  memPreOrders.clear();
  memPaymentTxs.clear();
  memCartHolds.clear();
  memOrderNotes.clear();
}

export interface CreateOrderInput {
  order: InsertOrderRow;
  items: Array<
    Omit<InsertOrderItemRow, "orderId"> & {
      units?: Array<Omit<InsertOrderItemUnitRow, "orderItemId" | "unitIndex">>;
    }
  >;
  preOrder?: Omit<InsertPreOrderRow, "orderId">;
}

export interface OrderWithDetails extends OrderRow {
  items: Array<OrderItemRow & { units: OrderItemUnitRow[] }>;
  preOrder?: PreOrderRow | null;
  history?: OrderStatusHistoryRow[];
  transactions?: PaymentTransactionRow[];
  notes?: OrderNoteRow[];
}

export const ordersRepo = {
  /**
   * Create an order along with its line items, individual physical units, and optional pre-order metadata.
   */
  async createOrder(
    tx: Tx | undefined,
    input: CreateOrderInput
  ): Promise<OrderWithDetails> {
    const client = tx ?? defaultDb;
    const orderId = input.order.id ?? crypto.randomUUID();
    const orderToInsert: InsertOrderRow = {
      ...input.order,
      id: orderId,
    };

    try {
      const [createdOrder] = await client
        .insert(orders)
        .values(orderToInsert)
        .returning();

      if (!createdOrder) {
        throw new Error("Failed to insert order");
      }

      const createdItemsWithUnits: Array<
        OrderItemRow & { units: OrderItemUnitRow[] }
      > = [];

      for (const itemInput of input.items) {
        const itemId = crypto.randomUUID();
        const [createdItem] = await client
          .insert(orderItems)
          .values({
            ...itemInput,
            id: itemId,
            orderId,
          })
          .returning();

        if (!createdItem) {
          throw new Error("Failed to insert order item");
        }

        // Generate 1 row per physical unit (qty rows)
        const unitRowsToInsert: InsertOrderItemUnitRow[] = [];
        for (let u = 1; u <= createdItem.qty; u++) {
          const customUnit = itemInput.units?.[u - 1];
          unitRowsToInsert.push({
            id: crypto.randomUUID(),
            orderItemId: itemId,
            unitIndex: u,
            sealId: customUnit?.sealId ?? null,
            manufacturerSerial: customUnit?.manufacturerSerial ?? null,
            status: customUnit?.status ?? "PENDING",
          });
        }

        let createdUnits: OrderItemUnitRow[] = [];
        if (unitRowsToInsert.length > 0) {
          createdUnits = await client
            .insert(orderItemUnits)
            .values(unitRowsToInsert)
            .returning();
        }

        createdItemsWithUnits.push({
          ...createdItem,
          units: createdUnits,
        });
      }

      let createdPreOrder: PreOrderRow | null = null;
      if (input.preOrder) {
        const [pOrder] = await client
          .insert(preOrders)
          .values({
            ...input.preOrder,
            orderId,
          })
          .returning();
        createdPreOrder = pOrder ?? null;
      }

      return {
        ...createdOrder,
        items: createdItemsWithUnits,
        preOrder: createdPreOrder,
      };
    } catch {
      // Memory Fallback
      const row: OrderRow = {
        ...orderToInsert,
        id: orderId,
        addressSnapshot: (orderToInsert.addressSnapshot ?? null) as AddressSnapshot | null,
        buyerCompanyName: orderToInsert.buyerCompanyName ?? null,
        buyerBin: orderToInsert.buyerBin ?? null,
        pickupPinHash: orderToInsert.pickupPinHash ?? null,
        pickupPinExpiresAt: orderToInsert.pickupPinExpiresAt ?? null,
        confirmedAt: orderToInsert.confirmedAt ?? null,
        cancelledAt: orderToInsert.cancelledAt ?? null,
        cancelReason: orderToInsert.cancelReason ?? null,
        couponId: orderToInsert.couponId ?? null,
        deliveryZone: orderToInsert.deliveryZone ?? null,
        advancePurpose: orderToInsert.advancePurpose ?? null,
        paymentStatus: orderToInsert.paymentStatus ?? "UNPAID",
        discountPaisa: orderToInsert.discountPaisa ?? 0,
        deliveryFeePaisa: orderToInsert.deliveryFeePaisa ?? 0,
        vatTotalPaisa: orderToInsert.vatTotalPaisa ?? 0,
        storeCreditAppliedPaisa: orderToInsert.storeCreditAppliedPaisa ?? 0,
        advanceRequiredPaisa: orderToInsert.advanceRequiredPaisa ?? 0,
        advancePaidPaisa: orderToInsert.advancePaidPaisa ?? 0,
        codAmountPaisa: orderToInsert.codAmountPaisa ?? 0,
        paidTotalPaisa: orderToInsert.paidTotalPaisa ?? 0,
        refundedTotalPaisa: orderToInsert.refundedTotalPaisa ?? 0,
        mushakRequested: orderToInsert.mushakRequested ?? false,
        pickupPinAttempts: orderToInsert.pickupPinAttempts ?? 0,
        pickupPinLocked: orderToInsert.pickupPinLocked ?? false,
        placedAt: orderToInsert.placedAt ?? new Date(),
        createdAt: orderToInsert.createdAt ?? new Date(),
        updatedAt: orderToInsert.updatedAt ?? new Date(),
      };
      memOrders.set(orderId, row);

      const itemsWithUnits: Array<
        OrderItemRow & { units: OrderItemUnitRow[] }
      > = [];

      for (const itemInput of input.items) {
        const itemId = crypto.randomUUID();
        const itemRow: OrderItemRow = {
          ...itemInput,
          id: itemId,
          orderId,
          allocatedDiscountPaisa: itemInput.allocatedDiscountPaisa ?? 0,
          unitCostPaisa: itemInput.unitCostPaisa ?? null,
          sourceLocationId: itemInput.sourceLocationId ?? null,
          status: itemInput.status ?? "ACTIVE",
          createdAt: new Date(),
        };
        memOrderItems.set(itemId, itemRow);

        const unitsList: OrderItemUnitRow[] = [];
        for (let u = 1; u <= itemRow.qty; u++) {
          const customUnit = itemInput.units?.[u - 1];
          const unitId = crypto.randomUUID();
          const unitRow: OrderItemUnitRow = {
            id: unitId,
            orderItemId: itemId,
            unitIndex: u,
            sealId: customUnit?.sealId ?? null,
            manufacturerSerial: customUnit?.manufacturerSerial ?? null,
            status: customUnit?.status ?? "PENDING",
            createdAt: new Date(),
          };
          memOrderItemUnits.set(unitId, unitRow);
          unitsList.push(unitRow);
        }

        itemsWithUnits.push({
          ...itemRow,
          units: unitsList,
        });
      }

      let memPreOrder: PreOrderRow | null = null;
      if (input.preOrder) {
        memPreOrder = {
          ...input.preOrder,
          orderId,
          arrivedAt: input.preOrder.arrivedAt ?? null,
          qcVerifiedAt: input.preOrder.qcVerifiedAt ?? null,
          balanceDueDate: input.preOrder.balanceDueDate ?? null,
          forfeitureDate: input.preOrder.forfeitureDate ?? null,
          repricingStatus: input.preOrder.repricingStatus ?? "NONE",
          repricingNewTotalPaisa: input.preOrder.repricingNewTotalPaisa ?? null,
          repricingDeadline: input.preOrder.repricingDeadline ?? null,
          delayOption: input.preOrder.delayOption ?? "NONE",
          delayOfferedAt: input.preOrder.delayOfferedAt ?? null,
          batchKey: input.preOrder.batchKey ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        memPreOrders.set(orderId, memPreOrder);
      }

      return {
        ...row,
        items: itemsWithUnits,
        preOrder: memPreOrder,
      };
    }
  },

  /**
   * Get order by ID (with row lock if in transaction).
   */
  async getOrderForUpdate(
    tx: Tx | undefined,
    id: string
  ): Promise<OrderRow | null> {
    if (tx) {
      try {
        const [order] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, id))
          .for("update");
        if (order) return order;
      } catch {
        // Fall back to memory
      }
    }
    return memOrders.get(id) ?? null;
  },

  /**
   * Get order by ID.
   */
  async getOrderById(
    tx: Tx | undefined,
    id: string
  ): Promise<OrderRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [order] = await client
        .select()
        .from(orders)
        .where(eq(orders.id, id));
      if (order) return order;
    } catch {
      // Memory Fallback
    }
    return memOrders.get(id) ?? null;
  },

  /**
   * Get order by orderNumber.
   */
  async getOrderByNumber(
    tx: Tx | undefined,
    orderNumber: string
  ): Promise<OrderRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [order] = await client
        .select()
        .from(orders)
        .where(eq(orders.orderNumber, orderNumber));
      if (order) return order;
    } catch {
      // Memory Fallback
    }
    for (const order of memOrders.values()) {
      if (order.orderNumber === orderNumber) {
        return order;
      }
    }
    return null;
  },

  /**
   * Get order with items, units, pre-order, and transactions.
   */
  async getOrderWithDetails(
    tx: Tx | undefined,
    id: string
  ): Promise<OrderWithDetails | null> {
    const client = tx ?? defaultDb;
    try {
      const [order] = await client
        .select()
        .from(orders)
        .where(eq(orders.id, id));
      if (order) {
        const items = await client
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, id));

        const itemsWithUnits: Array<
          OrderItemRow & { units: OrderItemUnitRow[] }
        > = [];

        for (const item of items) {
          const units = await client
            .select()
            .from(orderItemUnits)
            .where(eq(orderItemUnits.orderItemId, item.id));
          itemsWithUnits.push({ ...item, units });
        }

        const [pOrder] = await client
          .select()
          .from(preOrders)
          .where(eq(preOrders.orderId, id));

        const history = await client
          .select()
          .from(orderStatusHistory)
          .where(eq(orderStatusHistory.orderId, id))
          .orderBy(orderStatusHistory.createdAt);

        const txs = await client
          .select()
          .from(paymentTransactions)
          .where(eq(paymentTransactions.orderId, id))
          .orderBy(paymentTransactions.createdAt);

        const notes = await client
          .select()
          .from(orderNotes)
          .where(eq(orderNotes.orderId, id))
          .orderBy(orderNotes.createdAt);

        return {
          ...order,
          items: itemsWithUnits,
          preOrder: pOrder ?? null,
          history,
          transactions: txs,
          notes,
        };
      }
    } catch {
      // Memory Fallback
    }

    const order = memOrders.get(id);
    if (!order) return null;

    const items = Array.from(memOrderItems.values()).filter(
      (it) => it.orderId === id
    );
    const itemsWithUnits = items.map((it) => {
      const units = Array.from(memOrderItemUnits.values()).filter(
        (u) => u.orderItemId === it.id
      );
      return { ...it, units };
    });

    const pOrder = memPreOrders.get(id) ?? null;
    const history = Array.from(memHistory.values())
      .filter((h) => h.orderId === id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const txs = Array.from(memPaymentTxs.values())
      .filter((t) => t.orderId === id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const notes = Array.from(memOrderNotes.values())
      .filter((n) => n.orderId === id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return {
      ...order,
      items: itemsWithUnits,
      preOrder: pOrder,
      history,
      transactions: txs,
      notes,
    };
  },

  /**
   * Get order with details by orderNumber.
   */
  async getOrderByNumberWithDetails(
    tx: Tx | undefined,
    orderNumber: string
  ): Promise<OrderWithDetails | null> {
    const order = await this.getOrderByNumber(tx, orderNumber);
    if (!order) return null;
    return this.getOrderWithDetails(tx, order.id);
  },

  /**
   * Update order item fields (e.g. source, status).
   */
  async updateOrderItem(
    tx: Tx | undefined,
    id: string,
    updates: Partial<InsertOrderItemRow>
  ): Promise<OrderItemRow> {
    const client = tx ?? defaultDb;
    try {
      const [updated] = await client
        .update(orderItems)
        .set(updates)
        .where(eq(orderItems.id, id))
        .returning();
      if (updated) {
        memOrderItems.set(id, updated);
        return updated;
      }
    } catch {
      // Memory fallback
    }

    const existing = memOrderItems.get(id);
    if (!existing) {
      throw new Error(`Order item '${id}' not found`);
    }

    const updated: OrderItemRow = {
      ...existing,
      ...updates,
    } as OrderItemRow;

    memOrderItems.set(id, updated);
    return updated;
  },

  /**
   * Update order fields.
   */
  async updateOrder(
    tx: Tx | undefined,
    id: string,
    updates: Partial<InsertOrderRow>
  ): Promise<OrderRow> {
    const client = tx ?? defaultDb;
    try {
      const [updated] = await client
        .update(orders)
        .set(updates)
        .where(eq(orders.id, id))
        .returning();
      if (updated) {
        memOrders.set(id, updated);
        return updated;
      }
    } catch {
      // Memory Fallback
    }

    const existing = memOrders.get(id);
    if (!existing) {
      throw new Error(`Order '${id}' not found`);
    }

    const updated: OrderRow = {
      ...existing,
      ...updates,
      updatedAt: updates.updatedAt ?? new Date(),
    } as OrderRow;

    memOrders.set(id, updated);
    return updated;
  },


  /**
   * Record append-only order status history row.
   */
  async createStatusHistory(
    tx: Tx | undefined,
    row: InsertOrderStatusHistoryRow
  ): Promise<OrderStatusHistoryRow> {
    const client = tx ?? defaultDb;
    const id = row.id ?? crypto.randomUUID();
    const toInsert = {
      ...row,
      id,
    };

    try {
      const [created] = await client
        .insert(orderStatusHistory)
        .values(toInsert)
        .returning();
      if (created) return created;
    } catch {
      // Memory Fallback
    }

    const historyRow: OrderStatusHistoryRow = {
      ...toInsert,
      id,
      fromStatus: toInsert.fromStatus ?? null,
      actorId: toInsert.actorId ?? null,
      reason: toInsert.reason ?? null,
      metadata: toInsert.metadata ?? {},
      createdAt: toInsert.createdAt ?? new Date(),
    };
    memHistory.set(id, historyRow);
    return historyRow;
  },

  /**
   * List history for an order.
   */
  async listStatusHistory(
    tx: Tx | undefined,
    orderId: string
  ): Promise<OrderStatusHistoryRow[]> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, orderId))
        .orderBy(orderStatusHistory.createdAt);
      if (rows.length > 0) return rows;
    } catch {
      // Memory Fallback
    }

    return Array.from(memHistory.values())
      .filter((h) => h.orderId === orderId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  /**
   * Create payment transaction.
   */
  async createPaymentTransaction(
    tx: Tx | undefined,
    row: InsertPaymentTransactionRow
  ): Promise<PaymentTransactionRow> {
    const client = tx ?? defaultDb;
    const id = row.id ?? crypto.randomUUID();
    const toInsert = {
      ...row,
      id,
    };

    try {
      const [created] = await client
        .insert(paymentTransactions)
        .values(toInsert)
        .returning();
      if (created) return created;
    } catch {
      // Memory Fallback
    }

    const txRow: PaymentTransactionRow = {
      ...toInsert,
      id,
      currency: toInsert.currency ?? "BDT",
      status: toInsert.status ?? "INITIATED",
      gatewaySessionKey: toInsert.gatewaySessionKey ?? null,
      valId: toInsert.valId ?? null,
      bankTranId: toInsert.bankTranId ?? null,
      cardType: toInsert.cardType ?? null,
      riskLevel: toInsert.riskLevel ?? null,
      riskTitle: toInsert.riskTitle ?? null,
      validatedAt: toInsert.validatedAt ?? null,
      rawIpn: (toInsert.rawIpn ?? null) as Record<string, unknown> | null,
      rawValidation: (toInsert.rawValidation ?? null) as Record<string, unknown> | null,
      externalRef: toInsert.externalRef ?? null,
      createdAt: toInsert.createdAt ?? new Date(),
      updatedAt: toInsert.updatedAt ?? new Date(),
    };
    memPaymentTxs.set(id, txRow);
    return txRow;
  },

  /**
   * Update payment transaction.
   */
  async updatePaymentTransaction(
    tx: Tx | undefined,
    id: string,
    updates: Partial<InsertPaymentTransactionRow>
  ): Promise<PaymentTransactionRow> {
    const client = tx ?? defaultDb;
    try {
      const [updated] = await client
        .update(paymentTransactions)
        .set(updates)
        .where(eq(paymentTransactions.id, id))
        .returning();
      if (updated) {
        memPaymentTxs.set(id, updated);
        return updated;
      }
    } catch {
      // Memory Fallback
    }

    const existing = memPaymentTxs.get(id);
    if (!existing) {
      throw new Error(`Payment transaction '${id}' not found`);
    }

    const updated: PaymentTransactionRow = {
      ...existing,
      ...updates,
      updatedAt: updates.updatedAt ?? new Date(),
    } as PaymentTransactionRow;

    memPaymentTxs.set(id, updated);
    return updated;
  },

  /**
   * Find payment transaction by tranId.
   */
  async getPaymentTransactionByTranId(
    tx: Tx | undefined,
    tranId: string
  ): Promise<PaymentTransactionRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [found] = await client
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.tranId, tranId));
      if (found) return found;
    } catch {
      // Memory Fallback
    }

    for (const t of memPaymentTxs.values()) {
      if (t.tranId === tranId) return t;
    }
    return null;
  },

  /**
   * Find payment transaction by tranId with optional row lock.
   */
  async getPaymentTransactionForUpdate(
    tx: Tx | undefined,
    tranId: string
  ): Promise<PaymentTransactionRow | null> {
    if (tx) {
      try {
        const [found] = await tx
          .select()
          .from(paymentTransactions)
          .where(eq(paymentTransactions.tranId, tranId))
          .for("update");
        if (found) return found;
      } catch {
        // Fall back to memory
      }
    }
    for (const t of memPaymentTxs.values()) {
      if (t.tranId === tranId) return t;
    }
    return null;
  },

  /**
   * Get PENDING / INITIATED payment transactions within reconciliation window.
   */
  async getPendingTransactionsForReconciliation(
    olderThanMs: number = 10 * 60 * 1000,
    newerThanMs: number = 24 * 60 * 60 * 1000,
    tx?: Tx
  ): Promise<PaymentTransactionRow[]> {
    const client = tx ?? defaultDb;
    const now = Date.now();
    const olderThan = new Date(now - olderThanMs);
    const newerThan = new Date(now - newerThanMs);

    try {
      const rows = await client
        .select()
        .from(paymentTransactions)
        .where(
          and(
            inArray(paymentTransactions.status, ["INITIATED", "PENDING"]),
            lte(paymentTransactions.createdAt, olderThan),
            gte(paymentTransactions.createdAt, newerThan)
          )
        );
      if (rows.length > 0) return rows;
    } catch {
      // Memory Fallback
    }

    return Array.from(memPaymentTxs.values()).filter(
      (t) =>
        (t.status === "INITIATED" || t.status === "PENDING") &&
        t.createdAt.getTime() <= olderThan.getTime() &&
        t.createdAt.getTime() >= newerThan.getTime()
    );
  },

  /**
   * Get unpaid orders older than specified hours.
   */
  async getUnpaidOrdersOlderThan(
    hours: number = 24,
    tx?: Tx
  ): Promise<OrderRow[]> {
    const client = tx ?? defaultDb;
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    try {
      const rows = await client
        .select()
        .from(orders)
        .where(
          and(
            inArray(orders.status, ["PENDING_PAYMENT", "DEPOSIT_PENDING"]),
            lte(orders.createdAt, cutoff)
          )
        );
      if (rows.length > 0) return rows;
    } catch {
      // Memory Fallback
    }

    return Array.from(memOrders.values()).filter(
      (o) =>
        (o.status === "PENDING_PAYMENT" || o.status === "DEPOSIT_PENDING") &&
        o.createdAt.getTime() <= cutoff.getTime()
    );
  },

  /**
   * List payment transactions for admin with filters and pagination.
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
    _tx?: Tx
  ): Promise<{ rows: (PaymentTransactionRow & { orderNumber?: string })[]; total: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    let all = Array.from(memPaymentTxs.values()).map((t) => {
      const order = memOrders.get(t.orderId);
      return { ...t, orderNumber: order?.orderNumber };
    });

    if (filters.status) {
      all = all.filter((t) => t.status === filters.status);
    }
    if (filters.tranId) {
      all = all.filter((t) => t.tranId.includes(filters.tranId!));
    }
    if (filters.purpose) {
      all = all.filter((t) => t.purpose === filters.purpose);
    }
    if (filters.orderNumber) {
      all = all.filter((t) => t.orderNumber?.includes(filters.orderNumber!));
    }

    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = all.length;
    const rows = all.slice(offset, offset + limit);

    return { rows, total };
  },

  /**
   * List payment transactions for an order.
   */
  async listPaymentTransactionsForOrder(
    tx: Tx | undefined,
    orderId: string
  ): Promise<PaymentTransactionRow[]> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(paymentTransactions)
        .where(eq(paymentTransactions.orderId, orderId))
        .orderBy(paymentTransactions.createdAt);
      if (rows.length > 0) return rows;
    } catch {
      // Memory Fallback
    }

    return Array.from(memPaymentTxs.values())
      .filter((t) => t.orderId === orderId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  /**
   * Get pre-order metadata.
   */
  async getPreOrder(
    tx: Tx | undefined,
    orderId: string
  ): Promise<PreOrderRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [found] = await client
        .select()
        .from(preOrders)
        .where(eq(preOrders.orderId, orderId));
      if (found) return found;
    } catch {
      // Memory Fallback
    }

    return memPreOrders.get(orderId) ?? null;
  },

  /**
   * Update pre-order metadata.
   */
  async updatePreOrder(
    tx: Tx | undefined,
    orderId: string,
    updates: Partial<InsertPreOrderRow>
  ): Promise<PreOrderRow> {
    const client = tx ?? defaultDb;
    try {
      const [updated] = await client
        .update(preOrders)
        .set(updates)
        .where(eq(preOrders.orderId, orderId))
        .returning();
      if (updated) {
        memPreOrders.set(orderId, updated);
        return updated;
      }
    } catch {
      // Memory Fallback
    }

    const existing = memPreOrders.get(orderId);
    if (!existing) {
      throw new Error(`PreOrder for order '${orderId}' not found`);
    }

    const updated: PreOrderRow = {
      ...existing,
      ...updates,
      updatedAt: updates.updatedAt ?? new Date(),
    } as PreOrderRow;

    memPreOrders.set(orderId, updated);
    return updated;
  },

  /**
   * Create a 10-minute pre-checkout cart hold record.
   */
  async createCartHold(
    tx: Tx | undefined,
    row: InsertCartHoldRow
  ): Promise<CartHoldRow> {
    const client = tx ?? defaultDb;
    const id = row.id ?? crypto.randomUUID();
    const toInsert: InsertCartHoldRow = {
      ...row,
      id,
    };

    try {
      const [created] = await client
        .insert(cartHolds)
        .values(toInsert)
        .returning();
      if (created) {
        memCartHolds.set(id, created);
        return created;
      }
    } catch {
      // Memory Fallback
    }

    const holdRow: CartHoldRow = {
      ...toInsert,
      id,
      customerId: toInsert.customerId ?? null,
      status: toInsert.status ?? "ACTIVE",
      createdAt: toInsert.createdAt ?? new Date(),
      updatedAt: toInsert.updatedAt ?? new Date(),
    };
    memCartHolds.set(id, holdRow);
    return holdRow;
  },

  /**
   * Get cart hold by ID.
   */
  async getCartHoldById(
    tx: Tx | undefined,
    id: string
  ): Promise<CartHoldRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [found] = await client
        .select()
        .from(cartHolds)
        .where(eq(cartHolds.id, id));
      if (found) return found;
    } catch {
      // Memory Fallback
    }

    return memCartHolds.get(id) ?? null;
  },

  /**
   * Update cart hold record.
   */
  async updateCartHold(
    tx: Tx | undefined,
    id: string,
    updates: Partial<InsertCartHoldRow>
  ): Promise<CartHoldRow> {
    const client = tx ?? defaultDb;
    try {
      const [updated] = await client
        .update(cartHolds)
        .set(updates)
        .where(eq(cartHolds.id, id))
        .returning();
      if (updated) {
        memCartHolds.set(id, updated);
        return updated;
      }
    } catch {
      // Memory Fallback
    }

    const existing = memCartHolds.get(id);
    if (!existing) {
      throw new Error(`Cart hold '${id}' not found`);
    }

    const updated: CartHoldRow = {
      ...existing,
      ...updates,
      updatedAt: updates.updatedAt ?? new Date(),
    } as CartHoldRow;

    memCartHolds.set(id, updated);
    return updated;
  },

  /**
   * Expire active cart holds older than now.
   */
  async expireCartHolds(
    tx: Tx | undefined,
    now: Date = new Date()
  ): Promise<CartHoldRow[]> {
    const client = tx ?? defaultDb;
    try {
      const expired = await client
        .update(cartHolds)
        .set({ status: "EXPIRED", updatedAt: now })
        .where(
          and(
            eq(cartHolds.status, "ACTIVE"),
            sql`${cartHolds.expiresAt} < ${now}`
          )
        )
        .returning();
      if (expired.length > 0) return expired;
    } catch {
      // Memory Fallback
    }

    const expiredList: CartHoldRow[] = [];
    for (const hold of memCartHolds.values()) {
      if (hold.status === "ACTIVE" && hold.expiresAt < now) {
        hold.status = "EXPIRED";
        hold.updatedAt = now;
        expiredList.push(hold);
      }
    }
    return expiredList;
  },

  /**
   * Create an internal staff note for an order.
   */
  async createOrderNote(
    tx: Tx | undefined,
    data: InsertOrderNoteRow
  ): Promise<OrderNoteRow> {
    const client = tx ?? defaultDb;
    const noteId = data.id ?? crypto.randomUUID();
    const toInsert = { ...data, id: noteId };

    try {
      const [created] = await client.insert(orderNotes).values(toInsert).returning();
      if (created) return created;
    } catch {
      // Memory Fallback
    }

    const row: OrderNoteRow = {
      ...toInsert,
      id: noteId,
      staffName: data.staffName ?? null,
      createdAt: data.createdAt ?? new Date(),
    };
    memOrderNotes.set(noteId, row);
    return row;
  },

  /**
   * List all internal staff notes for an order.
   */
  async listOrderNotes(
    tx: Tx | undefined,
    orderId: string
  ): Promise<OrderNoteRow[]> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select()
        .from(orderNotes)
        .where(eq(orderNotes.orderId, orderId))
        .orderBy(orderNotes.createdAt);
      if (rows.length > 0) return rows;
    } catch {
      // Memory Fallback
    }

    return Array.from(memOrderNotes.values())
      .filter((n) => n.orderId === orderId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  /**
   * List orders for a specific customer with optional filters and pagination.
   */
  async listCustomerOrders(
    tx: Tx | undefined,
    customerId: string,
    filter?: {
      status?: OrderStatus;
      orderType?: OrderType;
      page?: number;
      limit?: number;
    }
  ): Promise<{ orders: OrderWithDetails[]; total: number }> {
    const page = Math.max(1, filter?.page ?? 1);
    const limit = Math.max(1, Math.min(100, filter?.limit ?? 20));
    const offset = (page - 1) * limit;

    const client = tx ?? defaultDb;
    try {
      const conditions = [eq(orders.customerId, customerId)];
      if (filter?.status) conditions.push(eq(orders.status, filter.status));
      if (filter?.orderType) conditions.push(eq(orders.orderType, filter.orderType));

      const rows = await client
        .select()
        .from(orders)
        .where(and(...conditions))
        .orderBy(sql`${orders.createdAt} DESC`)
        .limit(limit)
        .offset(offset);

      const countResult = await client
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(and(...conditions));
      const total = Number(countResult[0]?.count ?? rows.length);

      const detailedOrders: OrderWithDetails[] = [];
      for (const row of rows) {
        const detail = await this.getOrderWithDetails(tx, row.id);
        if (detail) detailedOrders.push(detail);
      }

      return { orders: detailedOrders, total };
    } catch {
      // Memory Fallback
    }

    let all = Array.from(memOrders.values()).filter(
      (o) => o.customerId === customerId
    );
    if (filter?.status) {
      all = all.filter((o) => o.status === filter.status);
    }
    if (filter?.orderType) {
      all = all.filter((o) => o.orderType === filter.orderType);
    }

    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = all.length;
    const slice = all.slice(offset, offset + limit);

    const detailedOrders: OrderWithDetails[] = [];
    for (const row of slice) {
      const detail = await this.getOrderWithDetails(tx, row.id);
      if (detail) detailedOrders.push(detail);
    }

    return { orders: detailedOrders, total };
  },

  /**
   * List orders for staff/admin with filters and pagination.
   */
  async listAdminOrders(
    tx: Tx | undefined,
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
  ): Promise<{ orders: OrderWithDetails[]; total: number }> {
    const page = Math.max(1, filter?.page ?? 1);
    const limit = Math.max(1, Math.min(100, filter?.limit ?? 20));
    const offset = (page - 1) * limit;

    const client = tx ?? defaultDb;
    try {
      const conditions = [];
      if (filter?.status) conditions.push(eq(orders.status, filter.status));
      if (filter?.orderType) conditions.push(eq(orders.orderType, filter.orderType));
      if (filter?.channel) conditions.push(eq(orders.channel, filter.channel));
      if (filter?.fromDate) conditions.push(gte(orders.createdAt, filter.fromDate));
      if (filter?.toDate) conditions.push(lte(orders.createdAt, filter.toDate));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await client
        .select()
        .from(orders)
        .where(whereClause)
        .orderBy(sql`${orders.createdAt} DESC`)
        .limit(limit)
        .offset(offset);

      const countResult = await client
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(whereClause);
      const total = Number(countResult[0]?.count ?? rows.length);

      const detailedOrders: OrderWithDetails[] = [];
      for (const row of rows) {
        const detail = await this.getOrderWithDetails(tx, row.id);
        if (detail) {
          if (filter?.phone) {
            const addrPhone = detail.addressSnapshot?.phone ?? "";
            if (addrPhone.includes(filter.phone)) {
              detailedOrders.push(detail);
            }
          } else {
            detailedOrders.push(detail);
          }
        }
      }

      return { orders: detailedOrders, total };
    } catch {
      // Memory Fallback
    }

    let all = Array.from(memOrders.values());
    if (filter?.status) {
      all = all.filter((o) => o.status === filter.status);
    }
    if (filter?.orderType) {
      all = all.filter((o) => o.orderType === filter.orderType);
    }
    if (filter?.channel) {
      all = all.filter((o) => o.channel === filter.channel);
    }
    if (filter?.fromDate) {
      all = all.filter((o) => o.createdAt >= filter.fromDate!);
    }
    if (filter?.toDate) {
      all = all.filter((o) => o.createdAt <= filter.toDate!);
    }
    if (filter?.phone) {
      all = all.filter((o) => {
        const addrPhone = o.addressSnapshot?.phone ?? "";
        return addrPhone.includes(filter.phone!);
      });
    }

    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = all.length;
    const slice = all.slice(offset, offset + limit);

    const detailedOrders: OrderWithDetails[] = [];
    for (const row of slice) {
      const detail = await this.getOrderWithDetails(tx, row.id);
      if (detail) detailedOrders.push(detail);
    }

    return { orders: detailedOrders, total };
  },

  /**
   * List pre-orders with filtering by status, sku, overdue ETA, batchKey.
   */
  async listPreOrders(
    tx: Tx | undefined,
    filter?: {
      status?: OrderStatus;
      sku?: string;
      etaOverdue?: boolean;
      batchKey?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ orders: OrderWithDetails[]; total: number }> {
    const page = Math.max(1, filter?.page ?? 1);
    const limit = Math.max(1, Math.min(100, filter?.limit ?? 20));
    const offset = (page - 1) * limit;

    const client = tx ?? defaultDb;
    try {
      const conditions = [eq(orders.orderType, "PRE_ORDER")];
      if (filter?.status) conditions.push(eq(orders.status, filter.status));
      if (filter?.batchKey) conditions.push(eq(preOrders.batchKey, filter.batchKey));
      if (filter?.etaOverdue) {
        conditions.push(
          sql`${preOrders.etaDate} < NOW() AND ${preOrders.arrivedAt} IS NULL AND ${orders.status} NOT IN ('ARRIVED_GODOWN', 'QC_VERIFIED_BALANCE_DUE', 'BALANCE_PAID', 'BALANCE_COD_SCHEDULED', 'PACKED', 'HANDED_TO_COURIER', 'DELIVERED', 'DELIVERED_COUNTER', 'CANCELLED', 'CANCELLED_REFUNDED')`
        );
      }
      if (filter?.sku) {
        conditions.push(
          sql`EXISTS (SELECT 1 FROM ${orderItems} WHERE ${orderItems.orderId} = ${orders.id} AND (${orderItems.skuCode} = ${filter.sku} OR ${orderItems.skuId} = ${filter.sku}))`
        );
      }

      const rows = await client
        .select({ id: orders.id })
        .from(orders)
        .leftJoin(preOrders, eq(orders.id, preOrders.orderId))
        .where(and(...conditions))
        .orderBy(sql`${orders.createdAt} DESC`)
        .limit(limit)
        .offset(offset);

      if (rows.length > 0) {
        const countResult = await client
          .select({ count: sql<number>`count(*)` })
          .from(orders)
          .leftJoin(preOrders, eq(orders.id, preOrders.orderId))
          .where(and(...conditions));
        const total = Number(countResult[0]?.count ?? rows.length);

        const detailedOrders: OrderWithDetails[] = [];
        for (const row of rows) {
          const detail = await this.getOrderWithDetails(tx, row.id);
          if (detail) detailedOrders.push(detail);
        }

        return { orders: detailedOrders, total };
      }
    } catch {
      // Memory Fallback
    }

    let all = Array.from(memOrders.values()).filter(
      (o) => o.orderType === "PRE_ORDER"
    );

    if (filter?.status) {
      all = all.filter((o) => o.status === filter.status);
    }
    if (filter?.batchKey) {
      all = all.filter((o) => {
        const po = memPreOrders.get(o.id);
        return po?.batchKey === filter.batchKey;
      });
    }
    if (filter?.etaOverdue) {
      const now = Date.now();
      all = all.filter((o) => {
        const po = memPreOrders.get(o.id);
        if (!po || po.arrivedAt) return false;
        const isCompleted = [
          "ARRIVED_GODOWN",
          "QC_VERIFIED_BALANCE_DUE",
          "BALANCE_PAID",
          "BALANCE_COD_SCHEDULED",
          "PACKED",
          "HANDED_TO_COURIER",
          "DELIVERED",
          "DELIVERED_COUNTER",
          "CANCELLED",
          "CANCELLED_REFUNDED",
        ].includes(o.status);
        return !isCompleted && po.etaDate.getTime() < now;
      });
    }
    if (filter?.sku) {
      all = all.filter((o) => {
        const items = Array.from(memOrderItems.values()).filter(
          (i) => i.orderId === o.id
        );
        return items.some(
          (i) => i.skuCode === filter.sku || i.skuId === filter.sku
        );
      });
    }

    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = all.length;
    const slice = all.slice(offset, offset + limit);

    const detailedOrders: OrderWithDetails[] = [];
    for (const row of slice) {
      const detail = await this.getOrderWithDetails(tx, row.id);
      if (detail) detailedOrders.push(detail);
    }

    return { orders: detailedOrders, total };
  },

  async getOrderItemUnitById(
    tx: Tx | undefined,
    id: string
  ): Promise<OrderItemUnitRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [row] = await client
        .select()
        .from(orderItemUnits)
        .where(eq(orderItemUnits.id, id))
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }
    return memOrderItemUnits.get(id) ?? null;
  },

  async updateOrderItemUnit(
    tx: Tx | undefined,
    id: string,
    updates: Partial<InsertOrderItemUnitRow>
  ): Promise<OrderItemUnitRow | null> {
    const client = tx ?? defaultDb;
    const existing = await this.getOrderItemUnitById(tx, id);
    if (!existing) return null;

    const merged: OrderItemUnitRow = {
      ...existing,
      ...updates,
    };

    try {
      const [row] = await client
        .update(orderItemUnits)
        .set(updates)
        .where(eq(orderItemUnits.id, id))
        .returning();
      if (row) {
        memOrderItemUnits.set(id, row);
        return row;
      }
    } catch {
      // Memory fallback
    }

    memOrderItemUnits.set(id, merged);
    return merged;
  },

  async getOrderItemById(
    tx: Tx | undefined,
    id: string
  ): Promise<OrderItemRow | null> {
    const client = tx ?? defaultDb;
    try {
      const [row] = await client
        .select()
        .from(orderItems)
        .where(eq(orderItems.id, id))
        .limit(1);
      if (row) return row;
    } catch {
      // Memory fallback
    }
    return memOrderItems.get(id) ?? null;
  },

  async listOrderItemUnitsByOrderId(
    tx: Tx | undefined,
    orderId: string
  ): Promise<OrderItemUnitRow[]> {
    const detail = await this.getOrderWithDetails(tx, orderId);
    if (!detail) return [];
    return detail.items.flatMap((i) => i.units ?? []);
  },

  async listOrdersByStatuses(
    tx: Tx | undefined,
    statuses: OrderStatus[]
  ): Promise<OrderWithDetails[]> {
    const client = tx ?? defaultDb;
    try {
      const rows = await client
        .select({ id: orders.id })
        .from(orders)
        .where(inArray(orders.status, statuses))
        .orderBy(desc(orders.createdAt));

      if (rows.length > 0) {
        const results: OrderWithDetails[] = [];
        for (const r of rows) {
          const detail = await this.getOrderWithDetails(tx, r.id);
          if (detail) results.push(detail);
        }
        return results;
      }
    } catch {
      // Memory Fallback
    }

    const matches = Array.from(memOrders.values()).filter((o) =>
      statuses.includes(o.status)
    );
    matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const results: OrderWithDetails[] = [];
    for (const m of matches) {
      const detail = await this.getOrderWithDetails(tx, m.id);
      if (detail) results.push(detail);
    }
    return results;
  },
};

