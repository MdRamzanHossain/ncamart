import crypto from "node:crypto";
import { Tx } from "@/lib/db";
import { logger } from "@/lib/logger";
import { emitOutbox } from "@/lib/outbox";
import { Actor } from "@/lib/http/route";
import { BusinessError, NotFoundError } from "@/lib/errors";
import { settingsService } from "@/modules/settings";
import {
  CouponRow,
  InsertCouponRow,
  CouponRedemptionRow,
  StoreCreditEntryRow,
  StoreCreditReason,
} from "./schema";
import {
  CreateCouponDto,
  UpdateCouponDto,
  ListCouponsFilterDto,
  WithdrawStoreCreditDto,
  StoreCreditBalanceSummary,
} from "./dto";
import { promotionsRepo, clearMemoryPromotionsForTesting } from "./repo";
import { promotionsPolicies } from "./policies";
import { ledgerService, postingRules } from "@/modules/ledger";

class AsyncKeyLock {
  private queues = new Map<string, Promise<unknown>>();

  async acquire<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const current = this.queues.get(key) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.queues.set(
      key,
      current.then(() => next).catch(() => next)
    );

    try {
      await current;
      return await fn();
    } finally {
      release();
      if (this.queues.get(key) === next) {
        this.queues.delete(key);
      }
    }
  }

  clear(): void {
    this.queues.clear();
  }
}

const couponLock = new AsyncKeyLock();

export const promotionsService = {
  // --------------------------------------------------------------------------
  // Coupons Management
  // --------------------------------------------------------------------------
  async createCoupon(input: CreateCouponDto, actor: Actor): Promise<CouponRow> {
    await promotionsPolicies.assertCanDraftCoupon(actor);

    const code = input.code.toUpperCase();
    const existing = await promotionsRepo.getCouponByCode(undefined, code);
    if (existing) {
      throw new BusinessError(
        "ERR_CONFLICT",
        `Coupon with code '${code}' already exists`
      );
    }

    const row: InsertCouponRow = {
      id: crypto.randomUUID(),
      code,
      type: input.type,
      value: input.value,
      minOrderPaisa: input.minOrderPaisa ?? 0,
      maxDiscountPaisa: input.maxDiscountPaisa ?? null,
      scopeType: input.scopeType ?? "ALL",
      scopeValues: input.scopeValues ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      usageLimit: input.usageLimit ?? null,
      perPhoneLimit: input.perPhoneLimit ?? 1,
      status: "DRAFT",
      createdBy: actor.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const coupon = await promotionsRepo.createCoupon(undefined, row);

    try {
      await emitOutbox(undefined, {
        aggregateType: "coupon",
        aggregateId: coupon.id,
        type: "promotions.coupon_created",
        payload: {
          couponId: coupon.id,
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          createdBy: actor.id,
          createdAt: coupon.createdAt.toISOString(),
        },
      });
    } catch (err) {
      logger.warn({ err, couponId: coupon.id }, "Failed to emit coupon_created event");
    }

    return coupon;
  },

  async updateCoupon(
    id: string,
    input: UpdateCouponDto,
    actor: Actor
  ): Promise<CouponRow> {
    await promotionsPolicies.assertCanDraftCoupon(actor);

    const coupon = await promotionsRepo.getCouponById(undefined, id);
    if (!coupon) {
      throw new NotFoundError("Coupon not found");
    }

    if (coupon.status !== "DRAFT") {
      throw new BusinessError(
        "ERR_BUSINESS_RULE",
        `Only DRAFT coupons can be edited (current status: '${coupon.status}')`
      );
    }

    const updated = await promotionsRepo.updateCoupon(undefined, id, input);
    if (!updated) {
      throw new NotFoundError("Coupon not found after update");
    }

    return updated;
  },

  async activateCoupon(id: string, actor: Actor): Promise<CouponRow> {
    const coupon = await promotionsRepo.getCouponById(undefined, id);
    if (!coupon) {
      throw new NotFoundError("Coupon not found");
    }

    // Four-eyes check: Creator cannot activate their own coupon
    await promotionsPolicies.assertCanActivateCoupon(actor, coupon.createdBy);

    if (coupon.status !== "DRAFT" && coupon.status !== "PAUSED") {
      throw new BusinessError(
        "ERR_BUSINESS_RULE",
        `Cannot activate coupon in '${coupon.status}' status`
      );
    }

    const updated = await promotionsRepo.updateCoupon(undefined, id, {
      status: "ACTIVE",
      activatedBy: actor.id,
    });

    if (!updated) {
      throw new NotFoundError("Coupon not found after activation");
    }

    try {
      await emitOutbox(undefined, {
        aggregateType: "coupon",
        aggregateId: updated.id,
        type: "promotions.coupon_activated",
        payload: {
          couponId: updated.id,
          code: updated.code,
          activatedBy: actor.id,
          activatedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      logger.warn({ err, couponId: updated.id }, "Failed to emit coupon_activated event");
    }

    return updated;
  },

  async pauseCoupon(id: string, actor: Actor): Promise<CouponRow> {
    await promotionsPolicies.assertCanPauseCoupon(actor);

    const coupon = await promotionsRepo.getCouponById(undefined, id);
    if (!coupon) {
      throw new NotFoundError("Coupon not found");
    }

    if (coupon.status !== "ACTIVE") {
      throw new BusinessError(
        "ERR_BUSINESS_RULE",
        `Only ACTIVE coupons can be paused (current status: '${coupon.status}')`
      );
    }

    const updated = await promotionsRepo.updateCoupon(undefined, id, {
      status: "PAUSED",
    });

    if (!updated) {
      throw new NotFoundError("Coupon not found after pause");
    }

    try {
      await emitOutbox(undefined, {
        aggregateType: "coupon",
        aggregateId: updated.id,
        type: "promotions.coupon_paused",
        payload: {
          couponId: updated.id,
          code: updated.code,
          pausedBy: actor.id,
          pausedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      logger.warn({ err, couponId: updated.id }, "Failed to emit coupon_paused event");
    }

    return updated;
  },

  async listCoupons(filter: ListCouponsFilterDto): Promise<{ items: CouponRow[]; total: number }> {
    return promotionsRepo.listCoupons(undefined, filter);
  },

  async getCouponById(id: string): Promise<CouponRow | null> {
    return promotionsRepo.getCouponById(undefined, id);
  },

  async getCouponByCode(code: string): Promise<CouponRow | null> {
    return promotionsRepo.getCouponByCode(undefined, code);
  },

  /**
   * Concurrency-safe coupon reservation.
   * Acquires a row lock (FOR UPDATE) on the coupon, validates active status, validity window,
   * total usage limit, and per-phone limit before creating a RESERVED redemption.
   */
  async reserveCoupon(
    tx: Tx | undefined,
    input: {
      couponId: string;
      orderId: string;
      customerId?: string;
      phone: string;
      discountPaisa: number;
    }
  ): Promise<CouponRedemptionRow> {
    return couponLock.acquire(input.couponId, async () => {
      const now = new Date();

      // 1. Lock coupon row
      const coupon = await promotionsRepo.getCouponForUpdate(tx, input.couponId);
      if (!coupon) {
        throw new NotFoundError("Coupon not found");
      }

      if (coupon.status !== "ACTIVE") {
        throw new BusinessError(
          "ERR_BUSINESS_RULE",
          `Coupon '${coupon.code}' is not active (status: '${coupon.status}')`
        );
      }

      if (now < coupon.startsAt || now > coupon.endsAt) {
        throw new BusinessError(
          "ERR_BUSINESS_RULE",
          `Coupon '${coupon.code}' is outside its validity window`
        );
      }

      // 2. Check total usage limit
      if (coupon.usageLimit !== null) {
        const currentUsage = await promotionsRepo.countCouponUsage(tx, coupon.id);
        if (currentUsage >= coupon.usageLimit) {
          throw new BusinessError(
            "ERR_BUSINESS_RULE",
            `Coupon '${coupon.code}' total usage limit has been reached`
          );
        }
      }

      // 3. Check per-phone usage limit
      const phoneUsage = await promotionsRepo.countPhoneCouponUsage(tx, coupon.id, input.phone);
      if (phoneUsage >= coupon.perPhoneLimit) {
        throw new BusinessError(
          "ERR_BUSINESS_RULE",
          `Coupon '${coupon.code}' usage limit for phone number has been reached`
        );
      }

      // 4. Create reservation row
      const redemption = await promotionsRepo.createRedemption(tx, {
        id: crypto.randomUUID(),
        couponId: coupon.id,
        orderId: input.orderId,
        customerId: input.customerId ?? null,
        phone: input.phone,
        discountPaisa: input.discountPaisa,
        status: "RESERVED",
        createdAt: now,
        updatedAt: now,
      });

      try {
        await emitOutbox(tx, {
          aggregateType: "coupon",
          aggregateId: coupon.id,
          type: "promotions.coupon_reserved",
          payload: {
            redemptionId: redemption.id,
            couponId: coupon.id,
            orderId: input.orderId,
            phone: input.phone,
            discountPaisa: input.discountPaisa,
          },
        });
      } catch (err) {
        logger.warn({ err, redemptionId: redemption.id }, "Failed to emit coupon_reserved event");
      }

      return redemption;
    });
  },

  async confirmCoupon(tx: Tx | undefined, orderId: string): Promise<CouponRedemptionRow | null> {
    const existing = await promotionsRepo.getRedemptionByOrderId(tx, orderId);
    if (!existing || existing.status === "CONFIRMED") {
      return existing;
    }

    const updated = await promotionsRepo.updateRedemptionStatus(tx, existing.id, "CONFIRMED");

    try {
      await emitOutbox(tx, {
        aggregateType: "coupon",
        aggregateId: existing.couponId,
        type: "promotions.coupon_confirmed",
        payload: {
          redemptionId: existing.id,
          couponId: existing.couponId,
          orderId,
        },
      });
    } catch (err) {
      logger.warn({ err, orderId }, "Failed to emit coupon_confirmed event");
    }

    return updated;
  },

  async releaseCoupon(tx: Tx | undefined, orderId: string): Promise<CouponRedemptionRow | null> {
    const existing = await promotionsRepo.getRedemptionByOrderId(tx, orderId);
    if (!existing || existing.status === "RELEASED") {
      return existing;
    }

    const updated = await promotionsRepo.updateRedemptionStatus(tx, existing.id, "RELEASED");

    try {
      await emitOutbox(tx, {
        aggregateType: "coupon",
        aggregateId: existing.couponId,
        type: "promotions.coupon_released",
        payload: {
          redemptionId: existing.id,
          couponId: existing.couponId,
          orderId,
        },
      });
    } catch (err) {
      logger.warn({ err, orderId }, "Failed to emit coupon_released event");
    }

    return updated;
  },

  // --------------------------------------------------------------------------
  // Store Credit Management
  // --------------------------------------------------------------------------
  /**
   * Issues store credit to a customer.
   * Enforces staff approval caps:
   * - Support <= ৳1,000 (100,000 paisa)
   * - Finance <= ৳20,000 (2,000,000 paisa)
   * - Admin above ৳20,000
   *
   * Goodwill credit defaults to 12 months expiry and non-withdrawable.
   * Refund-as-credit never expires and is withdrawable.
   */
  async issueStoreCredit(
    tx: Tx | undefined,
    input: {
      customerId: string;
      amountPaisa: number;
      reason: StoreCreditReason;
      withdrawable?: boolean;
      expiresAt?: Date | null;
      refType?: string;
      refId?: string;
      actor?: Actor;
    }
  ): Promise<StoreCreditEntryRow> {
    if (input.actor) {
      await promotionsPolicies.assertCanIssueStoreCredit(input.actor, input.amountPaisa);
    }

    const now = new Date();

    // 1. Determine withdrawable status
    let withdrawable = input.withdrawable;
    if (withdrawable === undefined) {
      if (input.reason === "REFUND_AS_CREDIT" || input.reason === "RMA_RESOLUTION") {
        withdrawable = true;
      } else {
        withdrawable = false; // Goodwill and delay vouchers are non-withdrawable
      }
    }

    // 2. Determine expiration date
    let expiresAt = input.expiresAt;
    if (expiresAt === undefined) {
      if (input.reason === "GOODWILL" || input.reason === "PREORDER_DELAY") {
        const months = await settingsService.get("GOODWILL_CREDIT_EXPIRY_MONTHS");
        const exp = new Date(now);
        exp.setMonth(exp.getMonth() + months);
        expiresAt = exp;
      } else {
        expiresAt = null; // Refund-as-credit never expires
      }
    }

    // 3. Create entry
    const row = await promotionsRepo.insertCreditEntry(tx, {
      id: crypto.randomUUID(),
      customerId: input.customerId,
      deltaPaisa: input.amountPaisa,
      reason: input.reason,
      withdrawable,
      expiresAt,
      sourceEntryId: null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      createdBy: input.actor?.id ?? null,
      createdAt: now,
    });

    // Ledger posting hook: Dr 5400 (Goodwill Expense) / Cr 2020 (Store Credit Liability)
    if (input.reason === "GOODWILL" || input.reason === "PREORDER_DELAY") {
      try {
        await ledgerService.post(
          tx,
          {
            eventType: "GOODWILL_CREDIT_ISSUED",
            sourceType: "STORE_CREDIT",
            sourceId: row.id,
            description: `Goodwill store credit issued to customer: ${input.reason}`,
            lines: postingRules.GOODWILL_CREDIT_ISSUED({
              amountPaisa: input.amountPaisa,
              customerId: input.customerId,
            }),
            postedAt: now,
          },
          input.actor
        );
      } catch (err) {
        logger.warn({ err, entryId: row.id }, "Failed to post ledger entry for goodwill credit");
      }
    }

    try {
      await emitOutbox(tx, {
        aggregateType: "store_credit",
        aggregateId: input.customerId,
        type: "promotions.store_credit_issued",
        payload: {
          entryId: row.id,
          customerId: input.customerId,
          amountPaisa: input.amountPaisa,
          reason: input.reason,
          withdrawable,
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
          createdBy: input.actor?.id ?? null,
        },
      });
    } catch (err) {
      logger.warn({ err, entryId: row.id }, "Failed to emit store_credit_issued event");
    }

    return row;
  },

  /**
   * Retrieves full store credit balance for a customer.
   * Evaluates all positive lots minus negative consumptions, filtering out past-due lots.
   */
  async getStoreCreditBalance(
    tx: Tx | undefined,
    customerId: string,
    now = new Date()
  ): Promise<StoreCreditBalanceSummary> {
    const positiveLots = await promotionsRepo.listCustomerIssuanceLots(tx, customerId);

    let withdrawableBalancePaisa = 0;
    let nonWithdrawableBalancePaisa = 0;
    const expiringLots: StoreCreditBalanceSummary["expiringLots"] = [];

    for (const lot of positiveLots) {
      const consumed = await promotionsRepo.getConsumedAmountForLot(tx, lot.id);
      const remaining = lot.deltaPaisa - consumed;

      // Filter out lots that have expired
      const isExpired = lot.expiresAt && lot.expiresAt <= now;
      if (!isExpired && remaining > 0) {
        if (lot.withdrawable) {
          withdrawableBalancePaisa += remaining;
        } else {
          nonWithdrawableBalancePaisa += remaining;
        }

        expiringLots.push({
          lotId: lot.id,
          remainingPaisa: remaining,
          withdrawable: lot.withdrawable,
          expiresAt: lot.expiresAt,
          reason: lot.reason,
          createdAt: lot.createdAt,
        });
      }
    }

    return {
      totalBalancePaisa: withdrawableBalancePaisa + nonWithdrawableBalancePaisa,
      withdrawableBalancePaisa,
      nonWithdrawableBalancePaisa,
      expiringLots,
    };
  },

  /**
   * Applies store credit to an order.
   * Consumes lots in strict FIFO order:
   * 1. Earliest expiry date first (expires_at ASC NULLS LAST)
   * 2. Non-withdrawable (goodwill) credit consumed before withdrawable credit
   * 3. Oldest lot first (created_at ASC)
   */
  async applyStoreCredit(
    tx: Tx | undefined,
    input: { customerId: string; orderId: string; amountPaisa: number },
    now = new Date()
  ): Promise<{ appliedPaisa: number; entries: StoreCreditEntryRow[] }> {
    if (input.amountPaisa <= 0) {
      return { appliedPaisa: 0, entries: [] };
    }

    const balance = await this.getStoreCreditBalance(tx, input.customerId, now);
    if (balance.totalBalancePaisa < input.amountPaisa) {
      throw new BusinessError(
        "ERR_BUSINESS_RULE",
        `Insufficient store credit balance (requested ৳${input.amountPaisa / 100}, available ৳${balance.totalBalancePaisa / 100})`,
        { requestedPaisa: input.amountPaisa, availablePaisa: balance.totalBalancePaisa }
      );
    }

    // Sort available lots by FIFO priority:
    // 1. Non-withdrawable (goodwill) credit consumed before withdrawable credit
    // 2. Earliest expiry first (expires_at ASC NULLS LAST)
    // 3. Oldest lot first (created_at ASC)
    const sortedLots = [...balance.expiringLots].sort((a, b) => {
      // 1. Non-withdrawable (goodwill) before withdrawable
      if (a.withdrawable !== b.withdrawable) {
        return a.withdrawable ? 1 : -1; // false (goodwill) comes first
      }

      // 2. Earliest expiry first (lots with earlier expiresAt before later expiresAt, NULLS LAST)
      if (a.expiresAt && b.expiresAt) {
        if (a.expiresAt.getTime() !== b.expiresAt.getTime()) {
          return a.expiresAt.getTime() - b.expiresAt.getTime();
        }
      } else if (a.expiresAt && !b.expiresAt) {
        return -1;
      } else if (!a.expiresAt && b.expiresAt) {
        return 1;
      }

      // 3. FIFO by creation date
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    let needed = input.amountPaisa;
    const createdEntries: StoreCreditEntryRow[] = [];

    for (const lot of sortedLots) {
      if (needed <= 0) break;
      const toConsume = Math.min(lot.remainingPaisa, needed);

      const entry = await promotionsRepo.insertCreditEntry(tx, {
        id: crypto.randomUUID(),
        customerId: input.customerId,
        deltaPaisa: -toConsume, // negative delta
        reason: "APPLIED_TO_ORDER",
        withdrawable: lot.withdrawable,
        expiresAt: lot.expiresAt,
        sourceEntryId: lot.lotId,
        refType: "ORDER",
        refId: input.orderId,
        createdBy: null,
        createdAt: now,
      });

      createdEntries.push(entry);
      needed -= toConsume;
    }

    // Ledger posting hook: Dr 2020 (Store Credit) / Cr 2000 (Customer Advance)
    try {
      await ledgerService.post(tx, {
        eventType: "STORE_CREDIT_APPLIED",
        sourceType: "ORDER",
        sourceId: input.orderId,
        description: `Store credit applied to order ${input.orderId}`,
        lines: postingRules.STORE_CREDIT_APPLIED({
          amountPaisa: input.amountPaisa,
          customerId: input.customerId,
          orderId: input.orderId,
        }),
        postedAt: now,
      });
    } catch (err) {
      logger.warn({ err, orderId: input.orderId }, "Failed to post ledger entry for applied credit");
    }

    try {
      await emitOutbox(tx, {
        aggregateType: "store_credit",
        aggregateId: input.customerId,
        type: "promotions.store_credit_applied",
        payload: {
          customerId: input.customerId,
          orderId: input.orderId,
          amountPaisa: input.amountPaisa,
        },
      });
    } catch (err) {
      logger.warn({ err, orderId: input.orderId }, "Failed to emit store_credit_applied event");
    }

    return { appliedPaisa: input.amountPaisa, entries: createdEntries };
  },

  /**
   * Reverses store credit previously applied to an order (e.g. upon order cancellation).
   */
  async reverseStoreCredit(
    tx: Tx | undefined,
    input: { customerId: string; orderId: string; amountPaisa?: number; reason?: StoreCreditReason }
  ): Promise<{ reversedPaisa: number; entries: StoreCreditEntryRow[] }> {
    const customerEntries = await promotionsRepo.listCustomerCreditEntries(tx, input.customerId);
    const orderConsumptions = customerEntries.filter(
      (e) => e.refType === "ORDER" && e.refId === input.orderId && e.deltaPaisa < 0
    );

    if (orderConsumptions.length === 0) {
      return { reversedPaisa: 0, entries: [] };
    }

    const now = new Date();
    let needed = input.amountPaisa ?? Infinity;
    let reversedPaisa = 0;
    const createdEntries: StoreCreditEntryRow[] = [];

    for (const consumed of orderConsumptions) {
      if (needed <= 0) break;
      const amount = Math.min(Math.abs(consumed.deltaPaisa), needed);

      const entry = await promotionsRepo.insertCreditEntry(tx, {
        id: crypto.randomUUID(),
        customerId: input.customerId,
        deltaPaisa: amount, // positive restoration
        reason: input.reason ?? "REVERSAL",
        withdrawable: consumed.withdrawable,
        expiresAt: consumed.expiresAt,
        sourceEntryId: null,
        refType: "ORDER",
        refId: input.orderId,
        createdBy: null,
        createdAt: now,
      });

      createdEntries.push(entry);
      reversedPaisa += amount;
      needed -= amount;
    }

    try {
      await emitOutbox(tx, {
        aggregateType: "store_credit",
        aggregateId: input.customerId,
        type: "promotions.store_credit_reversed",
        payload: {
          customerId: input.customerId,
          orderId: input.orderId,
          amountPaisa: reversedPaisa,
          reason: input.reason ?? "REVERSAL",
        },
      });
    } catch (err) {
      logger.warn({ err, orderId: input.orderId }, "Failed to emit store_credit_reversed event");
    }

    return { reversedPaisa, entries: createdEntries };
  },

  /**
   * Withdraws store credit for a customer (cash out).
   * Authorized strictly for FINANCE_OFFICER or SUPER_ADMIN.
   * Can ONLY withdraw from WITHDRAWABLE credit lots.
   */
  async withdrawStoreCredit(
    tx: Tx | undefined,
    customerId: string,
    input: WithdrawStoreCreditDto,
    actor: Actor
  ): Promise<{ withdrawnPaisa: number; entries: StoreCreditEntryRow[] }> {
    await promotionsPolicies.assertCanWithdrawStoreCredit(actor);

    const now = new Date();
    const balance = await this.getStoreCreditBalance(tx, customerId, now);

    if (balance.withdrawableBalancePaisa < input.amountPaisa) {
      throw new BusinessError(
        "ERR_BUSINESS_RULE",
        `Insufficient withdrawable store credit balance (requested ৳${input.amountPaisa / 100}, available withdrawable ৳${balance.withdrawableBalancePaisa / 100})`,
        {
          requestedPaisa: input.amountPaisa,
          withdrawableBalancePaisa: balance.withdrawableBalancePaisa,
        }
      );
    }

    // Filter and sort withdrawable lots
    const withdrawableLots = balance.expiringLots
      .filter((l) => l.withdrawable)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    let needed = input.amountPaisa;
    const createdEntries: StoreCreditEntryRow[] = [];

    for (const lot of withdrawableLots) {
      if (needed <= 0) break;
      const toConsume = Math.min(lot.remainingPaisa, needed);

      const entry = await promotionsRepo.insertCreditEntry(tx, {
        id: crypto.randomUUID(),
        customerId,
        deltaPaisa: -toConsume,
        reason: "WITHDRAWAL",
        withdrawable: true,
        expiresAt: lot.expiresAt,
        sourceEntryId: lot.lotId,
        refType: "WITHDRAWAL",
        refId: input.ref,
        createdBy: actor.id,
        createdAt: now,
      });

      createdEntries.push(entry);
      needed -= toConsume;
    }

    // Ledger posting hook: Dr 2020 (Store Credit) / Cr 1040/1030 (Cash / Bank / bKash)
    try {
      await ledgerService.post(
        tx,
        {
          eventType: "STORE_CREDIT_WITHDRAWN",
          sourceType: "WITHDRAWAL",
          sourceId: input.ref,
          description: `Store credit withdrawn by customer ${customerId}: ${input.method}`,
          lines: postingRules.STORE_CREDIT_WITHDRAWN({
            amountPaisa: input.amountPaisa,
            customerId,
            method: input.method,
          }),
          postedAt: now,
        },
        actor
      );
    } catch (err) {
      logger.warn({ err, customerId }, "Failed to post ledger entry for credit withdrawal");
    }

    try {
      await emitOutbox(tx, {
        aggregateType: "store_credit",
        aggregateId: customerId,
        type: "promotions.store_credit_withdrawn",
        payload: {
          customerId,
          amountPaisa: input.amountPaisa,
          method: input.method,
          ref: input.ref,
          staffId: actor.id,
        },
      });
    } catch (err) {
      logger.warn({ err, customerId }, "Failed to emit store_credit_withdrawn event");
    }

    return { withdrawnPaisa: input.amountPaisa, entries: createdEntries };
  },

  /**
   * Daily scheduled background job (00:15 Asia/Dhaka):
   * Identifies all expired positive credit lots and inserts EXPIRY entries with negative delta.
   * Ledger: Dr 2020 / Cr 5400 reversal of goodwill.
   */
  async expireCreditLotsJob(now = new Date()): Promise<{ expiredLotsCount: number; totalExpiredPaisa: number }> {
    const expiredLots = await promotionsRepo.listAllExpiredUnconsumedLots(undefined, now);
    let totalExpiredPaisa = 0;

    for (const { lot, remainingPaisa } of expiredLots) {
      await promotionsRepo.insertCreditEntry(undefined, {
        id: crypto.randomUUID(),
        customerId: lot.customerId,
        deltaPaisa: -remainingPaisa,
        reason: "EXPIRY",
        withdrawable: lot.withdrawable,
        expiresAt: lot.expiresAt,
        sourceEntryId: lot.id,
        refType: "EXPIRY",
        refId: lot.id,
        createdBy: null,
        createdAt: now,
      });

      totalExpiredPaisa += remainingPaisa;

      // Ledger posting hook: Dr 2020 (Store Credit) / Cr 5400 (Goodwill Reversal)
      try {
        await ledgerService.post(undefined, {
          eventType: "STORE_CREDIT_EXPIRED",
          sourceType: "EXPIRY",
          sourceId: lot.id,
          description: `Store credit lot expired for customer ${lot.customerId}`,
          lines: postingRules.STORE_CREDIT_EXPIRED({
            amountPaisa: remainingPaisa,
            customerId: lot.customerId,
          }),
          postedAt: now,
        });
      } catch (err) {
        logger.warn({ err, lotId: lot.id }, "Failed to post ledger entry for store credit expiry");
      }
    }

    if (expiredLots.length > 0) {
      try {
        await emitOutbox(undefined, {
          aggregateType: "store_credit",
          aggregateId: "system",
          type: "promotions.store_credit_expired",
          payload: {
            expiredLotsCount: expiredLots.length,
            totalExpiredPaisa,
          },
        });
      } catch (err) {
        logger.warn({ err }, "Failed to emit store_credit_expired event");
      }
    }

    logger.info(
      { expiredLotsCount: expiredLots.length, totalExpiredPaisa },
      "Store credit lot expiration job completed"
    );

    return { expiredLotsCount: expiredLots.length, totalExpiredPaisa };
  },

  /**
   * Retrieves customer credit entry history.
   */
  async getCustomerCreditHistory(customerId: string): Promise<StoreCreditEntryRow[]> {
    return promotionsRepo.listCustomerCreditEntries(undefined, customerId);
  },

  /**
   * Clears memory stores for tests.
   */
  clearMemoryForTesting(): void {
    clearMemoryPromotionsForTesting();
    couponLock.clear();
  },

  async countCouponUsage(tx: Tx | undefined, couponId: string): Promise<number> {
    return promotionsRepo.countCouponUsage(tx, couponId);
  },

  async countPhoneCouponUsage(
    tx: Tx | undefined,
    couponId: string,
    phone: string
  ): Promise<number> {
    return promotionsRepo.countPhoneCouponUsage(tx, couponId, phone);
  },
};
