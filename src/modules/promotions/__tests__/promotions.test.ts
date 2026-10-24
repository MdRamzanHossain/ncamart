import { describe, it, expect, beforeEach } from "vitest";
import { promotionsService } from "../service";
import { Actor } from "@/lib/http/route";
import { BusinessError, ForbiddenError } from "@/lib/errors";
import { clearMemoryOutboxForTesting } from "@/lib/outbox";

// Mock Actors
const catalogManagerActor: Actor = {
  id: "01920000-0000-7000-8000-000000000001",
  type: "staff",
  roles: ["CATALOG_MANAGER"],
};

const superAdminActor1: Actor = {
  id: "01920000-0000-7000-8000-000000000002",
  type: "staff",
  roles: ["SUPER_ADMIN"],
};

const superAdminActor2: Actor = {
  id: "01920000-0000-7000-8000-000000000003",
  type: "staff",
  roles: ["SUPER_ADMIN"],
};

const supportActor: Actor = {
  id: "01920000-0000-7000-8000-000000000004",
  type: "staff",
  roles: ["CUSTOMER_SUPPORT"],
};

const financeActor: Actor = {
  id: "01920000-0000-7000-8000-000000000005",
  type: "staff",
  roles: ["FINANCE_OFFICER"],
};

const unauthorizedActor: Actor = {
  id: "01920000-0000-7000-8000-000000000006",
  type: "staff",
  roles: ["WAREHOUSE_STAFF"],
};

describe("P16 — Coupons & Store Credit Unit Tests", () => {
  beforeEach(() => {
    promotionsService.clearMemoryForTesting();
    clearMemoryOutboxForTesting();
  });

  // --------------------------------------------------------------------------
  // 1. Coupon Governance & Lifecycle
  // --------------------------------------------------------------------------
  describe("1. Coupon Governance & Lifecycle", () => {
    it("allows CATALOG_MANAGER to draft a coupon and uppercases code", async () => {
      const startsAt = new Date("2026-01-01T00:00:00Z");
      const endsAt = new Date("2026-12-31T23:59:59Z");

      const coupon = await promotionsService.createCoupon(
        {
          code: "welcome100",
          type: "FIXED",
          value: 10000, // ৳100
          minOrderPaisa: 50000, // ৳500
          startsAt,
          endsAt,
          usageLimit: 50,
          perPhoneLimit: 1,
        },
        catalogManagerActor
      );

      expect(coupon.id).toBeDefined();
      expect(coupon.code).toBe("WELCOME100");
      expect(coupon.status).toBe("DRAFT");
      expect(coupon.createdBy).toBe(catalogManagerActor.id);
    });

    it("rejects duplicate coupon code creation", async () => {
      const startsAt = new Date("2026-01-01T00:00:00Z");
      const endsAt = new Date("2026-12-31T23:59:59Z");

      await promotionsService.createCoupon(
        {
          code: "SAVE20",
          type: "PERCENT",
          value: 2000,
          startsAt,
          endsAt,
        },
        catalogManagerActor
      );

      await expect(
        promotionsService.createCoupon(
          {
            code: "save20", // lowercase variant
            type: "PERCENT",
            value: 2000,
            startsAt,
            endsAt,
          },
          catalogManagerActor
        )
      ).rejects.toThrow("Coupon with code 'SAVE20' already exists");
    });

    it("allows editing DRAFT coupons and forbids editing ACTIVE coupons", async () => {
      const startsAt = new Date("2026-01-01T00:00:00Z");
      const endsAt = new Date("2026-12-31T23:59:59Z");

      const coupon = await promotionsService.createCoupon(
        {
          code: "SUMMER",
          type: "FIXED",
          value: 5000,
          startsAt,
          endsAt,
        },
        catalogManagerActor
      );

      const updated = await promotionsService.updateCoupon(
        coupon.id,
        { value: 8000 },
        catalogManagerActor
      );
      expect(updated.value).toBe(8000);

      // Activate coupon with superAdminActor1
      await promotionsService.activateCoupon(coupon.id, superAdminActor1);

      // Try editing while ACTIVE
      await expect(
        promotionsService.updateCoupon(coupon.id, { value: 10000 }, catalogManagerActor)
      ).rejects.toThrow("Only DRAFT coupons can be edited");
    });

    it("enforces four-eyes rule: creator cannot activate their own coupon", async () => {
      const startsAt = new Date("2026-01-01T00:00:00Z");
      const endsAt = new Date("2026-12-31T23:59:59Z");

      // SuperAdmin 1 drafts coupon
      const coupon = await promotionsService.createCoupon(
        {
          code: "ADMINCOUPON",
          type: "FIXED",
          value: 2000,
          startsAt,
          endsAt,
        },
        superAdminActor1
      );

      // SuperAdmin 1 attempts to activate their own coupon -> fails four-eyes check
      await expect(
        promotionsService.activateCoupon(coupon.id, superAdminActor1)
      ).rejects.toThrow(BusinessError);

      try {
        await promotionsService.activateCoupon(coupon.id, superAdminActor1);
      } catch (err: unknown) {
        const bErr = err as BusinessError;
        expect(bErr.code).toBe("ERR_FOUR_EYES_VIOLATION");
        expect(bErr.status).toBe(403);
      }

      // SuperAdmin 2 activates it -> succeeds
      const activated = await promotionsService.activateCoupon(coupon.id, superAdminActor2);
      expect(activated.status).toBe("ACTIVE");
      expect(activated.activatedBy).toBe(superAdminActor2.id);
    });

    it("allows SUPER_ADMIN to pause an ACTIVE coupon", async () => {
      const startsAt = new Date("2026-01-01T00:00:00Z");
      const endsAt = new Date("2026-12-31T23:59:59Z");

      const coupon = await promotionsService.createCoupon(
        {
          code: "PAUSETARGET",
          type: "FIXED",
          value: 2000,
          startsAt,
          endsAt,
        },
        catalogManagerActor
      );

      await promotionsService.activateCoupon(coupon.id, superAdminActor1);

      const paused = await promotionsService.pauseCoupon(coupon.id, superAdminActor1);
      expect(paused.status).toBe("PAUSED");

      // Cannot pause an already paused coupon
      await expect(
        promotionsService.pauseCoupon(coupon.id, superAdminActor1)
      ).rejects.toThrow("Only ACTIVE coupons can be paused");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Coupon Reservations & Concurrency
  // --------------------------------------------------------------------------
  describe("2. Coupon Reservations & Concurrency", () => {
    it("enforces usage_limit under concurrent reservation calls", async () => {
      const startsAt = new Date(Date.now() - 3600000); // 1 hr ago
      const endsAt = new Date(Date.now() + 86400000); // 1 day future

      const coupon = await promotionsService.createCoupon(
        {
          code: "LIMITED5",
          type: "FIXED",
          value: 1000,
          startsAt,
          endsAt,
          usageLimit: 5,
          perPhoneLimit: 10,
        },
        catalogManagerActor
      );

      await promotionsService.activateCoupon(coupon.id, superAdminActor1);

      // Launch 20 concurrent reservation requests with distinct orderIds and phones
      const parallelRequests = Array.from({ length: 20 }).map((_, i) =>
        promotionsService
          .reserveCoupon(undefined, {
            couponId: coupon.id,
            orderId: `order-${i + 1}`,
            phone: `+88017000000${i.toString().padStart(2, "0")}`,
            discountPaisa: 1000,
          })
          .then(() => ({ success: true, err: "" }))
          .catch((err) => ({ success: false, err: (err as Error).message }))
      );

      const results = await Promise.all(parallelRequests);
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      expect(successes.length).toBe(5);
      expect(failures.length).toBe(15);
      expect(failures[0]?.err).toContain("total usage limit has been reached");
    });

    it("enforces per_phone_limit under concurrent reservations for the same phone", async () => {
      const startsAt = new Date(Date.now() - 3600000);
      const endsAt = new Date(Date.now() + 86400000);

      const coupon = await promotionsService.createCoupon(
        {
          code: "ONEPERPHONE",
          type: "FIXED",
          value: 1000,
          startsAt,
          endsAt,
          usageLimit: 50,
          perPhoneLimit: 1,
        },
        catalogManagerActor
      );

      await promotionsService.activateCoupon(coupon.id, superAdminActor1);

      // Launch 10 concurrent requests for the EXACT same phone number
      const targetPhone = "+8801712345678";
      const parallelRequests = Array.from({ length: 10 }).map((_, i) =>
        promotionsService
          .reserveCoupon(undefined, {
            couponId: coupon.id,
            orderId: `phone-test-order-${i + 1}`,
            phone: targetPhone,
            discountPaisa: 1000,
          })
          .then(() => ({ success: true, err: "" }))
          .catch((err) => ({ success: false, err: (err as Error).message }))
      );

      const results = await Promise.all(parallelRequests);
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(9);
      expect(failures[0]?.err).toContain("usage limit for phone number has been reached");
    });

    it("releases coupon on order cancellation and frees up usage limit", async () => {
      const startsAt = new Date(Date.now() - 3600000);
      const endsAt = new Date(Date.now() + 86400000);

      const coupon = await promotionsService.createCoupon(
        {
          code: "SOLOCAP",
          type: "FIXED",
          value: 1000,
          startsAt,
          endsAt,
          usageLimit: 1,
          perPhoneLimit: 1,
        },
        catalogManagerActor
      );

      await promotionsService.activateCoupon(coupon.id, superAdminActor1);

      // First reservation succeeds
      const res1 = await promotionsService.reserveCoupon(undefined, {
        couponId: coupon.id,
        orderId: "order-solo-1",
        phone: "+8801700000099",
        discountPaisa: 1000,
      });
      expect(res1.status).toBe("RESERVED");

      // Second reservation immediately fails because usageLimit (1) reached
      await expect(
        promotionsService.reserveCoupon(undefined, {
          couponId: coupon.id,
          orderId: "order-solo-2",
          phone: "+8801700000088",
          discountPaisa: 1000,
        })
      ).rejects.toThrow("total usage limit has been reached");

      // Release order-solo-1
      const released = await promotionsService.releaseCoupon(undefined, "order-solo-1");
      expect(released?.status).toBe("RELEASED");

      // Now new reservation succeeds
      const res2 = await promotionsService.reserveCoupon(undefined, {
        couponId: coupon.id,
        orderId: "order-solo-2",
        phone: "+8801700000088",
        discountPaisa: 1000,
      });
      expect(res2.status).toBe("RESERVED");
    });
  });

  // --------------------------------------------------------------------------
  // 3. Store Credit Issuance & Staff Approval Limits
  // --------------------------------------------------------------------------
  describe("3. Store Credit Issuance & Staff Approval Limits", () => {
    const customerId = "01920000-0000-7000-8000-111111111111";

    it("enforces CUSTOMER_SUPPORT limit <= ৳1,000 (100,000 paisa)", async () => {
      // Support issuing ৳1,000 -> succeeds
      const entry1 = await promotionsService.issueStoreCredit(undefined, {
        customerId,
        amountPaisa: 100000,
        reason: "GOODWILL",
        actor: supportActor,
      });
      expect(entry1.deltaPaisa).toBe(100000);
      expect(entry1.reason).toBe("GOODWILL");
      expect(entry1.withdrawable).toBe(false); // Goodwill is non-withdrawable
      expect(entry1.expiresAt).toBeInstanceOf(Date); // Goodwill has 12m expiry

      // Support issuing ৳1,001 (100,100 paisa) -> fails threshold
      await expect(
        promotionsService.issueStoreCredit(undefined, {
          customerId,
          amountPaisa: 100100,
          reason: "GOODWILL",
          actor: supportActor,
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("enforces FINANCE_OFFICER limit <= ৳20,000 (2,000,000 paisa)", async () => {
      // Finance issuing ৳20,000 -> succeeds
      const entry = await promotionsService.issueStoreCredit(undefined, {
        customerId,
        amountPaisa: 2000000,
        reason: "REFUND_AS_CREDIT",
        actor: financeActor,
      });
      expect(entry.deltaPaisa).toBe(2000000);
      expect(entry.withdrawable).toBe(true); // Refund credit is withdrawable
      expect(entry.expiresAt).toBeNull(); // Refund credit never expires

      // Finance issuing ৳20,001 (2,000,100 paisa) -> fails threshold
      await expect(
        promotionsService.issueStoreCredit(undefined, {
          customerId,
          amountPaisa: 2000100,
          reason: "REFUND_AS_CREDIT",
          actor: financeActor,
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("allows SUPER_ADMIN to issue amounts above ৳20,000 unrestricted", async () => {
      const entry = await promotionsService.issueStoreCredit(undefined, {
        customerId,
        amountPaisa: 5000000, // ৳50,000
        reason: "RMA_RESOLUTION",
        actor: superAdminActor1,
      });
      expect(entry.deltaPaisa).toBe(5000000);
    });

    it("rejects issuance from unauthorized roles", async () => {
      await expect(
        promotionsService.issueStoreCredit(undefined, {
          customerId,
          amountPaisa: 50000,
          reason: "GOODWILL",
          actor: unauthorizedActor,
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // --------------------------------------------------------------------------
  // 4. FIFO Consumption Order & Balance Tracking
  // --------------------------------------------------------------------------
  describe("4. FIFO Consumption Order & Balance Tracking", () => {
    const customerId = "01920000-0000-7000-8000-222222222222";

    it("consumes store credit FIFO: earliest expiry first, non-withdrawable before withdrawable", async () => {
      const now = new Date();

      // 1. Lot 1: ৳500 Refund credit (withdrawable: true, expiresAt: null, created first)
      await promotionsService.issueStoreCredit(undefined, {
        customerId,
        amountPaisa: 50000,
        reason: "REFUND_AS_CREDIT",
        withdrawable: true,
        expiresAt: null,
      });

      // 2. Lot 2: ৳300 Goodwill credit (withdrawable: false, expires in 6 months)
      const exp6m = new Date(now.getTime() + 180 * 86400000);
      await promotionsService.issueStoreCredit(undefined, {
        customerId,
        amountPaisa: 30000,
        reason: "GOODWILL",
        withdrawable: false,
        expiresAt: exp6m,
      });

      // 3. Lot 3: ৳200 Goodwill credit (withdrawable: false, expires in 2 months -> EARLIEST EXPIRY)
      const exp2m = new Date(now.getTime() + 60 * 86400000);
      await promotionsService.issueStoreCredit(undefined, {
        customerId,
        amountPaisa: 20000,
        reason: "GOODWILL",
        withdrawable: false,
        expiresAt: exp2m,
      });

      // Verify initial balance
      const initialBalance = await promotionsService.getStoreCreditBalance(undefined, customerId, now);
      expect(initialBalance.totalBalancePaisa).toBe(100000); // ৳1,000
      expect(initialBalance.withdrawableBalancePaisa).toBe(50000); // ৳500
      expect(initialBalance.nonWithdrawableBalancePaisa).toBe(50000); // ৳500

      // Apply ৳350 (35,000 paisa) store credit to an order
      const application = await promotionsService.applyStoreCredit(
        undefined,
        {
          customerId,
          orderId: "order-fifo-1",
          amountPaisa: 35000,
        },
        now
      );

      expect(application.appliedPaisa).toBe(35000);
      expect(application.entries.length).toBe(2);

      // FIFO Check:
      // First consumed: Lot 3 (20,000 paisa, earliest expiry 2026-08-01)
      expect(application.entries[0]?.deltaPaisa).toBe(-20000);
      expect(application.entries[0]?.expiresAt).toEqual(exp2m);

      // Second consumed: Lot 2 (15,000 paisa, second earliest expiry 2026-12-01)
      expect(application.entries[1]?.deltaPaisa).toBe(-15000);
      expect(application.entries[1]?.expiresAt).toEqual(exp6m);

      // Lot 1 (withdrawable, no expiry) was NOT consumed!

      // Check balance after application
      const afterBalance = await promotionsService.getStoreCreditBalance(undefined, customerId, now);
      expect(afterBalance.totalBalancePaisa).toBe(65000); // ৳650
      expect(afterBalance.withdrawableBalancePaisa).toBe(50000); // ৳500 untouched
      expect(afterBalance.nonWithdrawableBalancePaisa).toBe(15000); // ৳150 remaining in Lot 2
    });

    it("reverses store credit on order cancellation", async () => {
      // Setup customer with credit
      await promotionsService.issueStoreCredit(undefined, {
        customerId,
        amountPaisa: 20000,
        reason: "GOODWILL",
        withdrawable: false,
      });

      // Apply credit
      await promotionsService.applyStoreCredit(undefined, {
        customerId,
        orderId: "order-reverse-test",
        amountPaisa: 15000,
      });

      let bal = await promotionsService.getStoreCreditBalance(undefined, customerId);
      expect(bal.totalBalancePaisa).toBe(5000);

      // Reverse credit
      const rev = await promotionsService.reverseStoreCredit(undefined, {
        customerId,
        orderId: "order-reverse-test",
      });

      expect(rev.reversedPaisa).toBe(15000);
      bal = await promotionsService.getStoreCreditBalance(undefined, customerId);
      expect(bal.totalBalancePaisa).toBe(20000);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Store Credit Withdrawal
  // --------------------------------------------------------------------------
  describe("5. Store Credit Withdrawal", () => {
    const customerId = "01920000-0000-7000-8000-333333333333";

    it("forbids withdrawal of non-withdrawable (goodwill) credit", async () => {
      // Customer has only goodwill credit (৳500)
      await promotionsService.issueStoreCredit(undefined, {
        customerId,
        amountPaisa: 50000,
        reason: "GOODWILL",
        withdrawable: false,
      });

      // FINANCE_OFFICER attempts to withdraw
      await expect(
        promotionsService.withdrawStoreCredit(
          undefined,
          customerId,
          {
            amountPaisa: 20000,
            method: "BKASH",
            ref: "TRX999",
          },
          financeActor
        )
      ).rejects.toThrow("Insufficient withdrawable store credit balance");
    });

    it("permits withdrawal of withdrawable credit by FINANCE_OFFICER", async () => {
      // Customer has ৳500 withdrawable credit from a refund
      await promotionsService.issueStoreCredit(undefined, {
        customerId,
        amountPaisa: 50000,
        reason: "REFUND_AS_CREDIT",
        withdrawable: true,
      });

      const res = await promotionsService.withdrawStoreCredit(
        undefined,
        customerId,
        {
          amountPaisa: 30000, // ৳300
          method: "BANK",
          ref: "TRX12345",
        },
        financeActor
      );

      expect(res.withdrawnPaisa).toBe(30000);
      expect(res.entries[0]?.deltaPaisa).toBe(-30000);
      expect(res.entries[0]?.reason).toBe("WITHDRAWAL");

      const balance = await promotionsService.getStoreCreditBalance(undefined, customerId);
      expect(balance.totalBalancePaisa).toBe(20000);
      expect(balance.withdrawableBalancePaisa).toBe(20000);
    });

    it("rejects withdrawal requests from unauthorized staff", async () => {
      await expect(
        promotionsService.withdrawStoreCredit(
          undefined,
          customerId,
          {
            amountPaisa: 10000,
            method: "BKASH",
            ref: "TRX888",
          },
          supportActor
        )
      ).rejects.toThrow("Only Finance Officers and Super Admins can withdraw store credit");
    });
  });

  // --------------------------------------------------------------------------
  // 6. Expiry Job (00:15 Asia/Dhaka)
  // --------------------------------------------------------------------------
  describe("6. Expiry Job (00:15 Asia/Dhaka)", () => {
    it("expires only past-due unconsumed lots and posts negative EXPIRY entries", async () => {
      const now = new Date("2026-10-23T00:15:00Z");
      const customerId = "01920000-0000-7000-8000-444444444444";

      // Expired lot: ৳300 expired yesterday
      const yesterday = new Date("2026-10-22T00:00:00Z");
      await promotionsService.issueStoreCredit(undefined, {
        customerId,
        amountPaisa: 30000,
        reason: "GOODWILL",
        expiresAt: yesterday,
      });

      // Valid lot: ৳500 expires next month
      const nextMonth = new Date("2026-11-23T00:00:00Z");
      await promotionsService.issueStoreCredit(undefined, {
        customerId,
        amountPaisa: 50000,
        reason: "GOODWILL",
        expiresAt: nextMonth,
      });

      // Run expiry job
      const summary = await promotionsService.expireCreditLotsJob(now);
      expect(summary.expiredLotsCount).toBe(1);
      expect(summary.totalExpiredPaisa).toBe(30000);

      // Check balance: exactly ৳500 remains
      const balance = await promotionsService.getStoreCreditBalance(undefined, customerId, now);
      expect(balance.totalBalancePaisa).toBe(50000);

      // Running job again does not expire already expired lots
      const repeatSummary = await promotionsService.expireCreditLotsJob(now);
      expect(repeatSummary.expiredLotsCount).toBe(0);
      expect(repeatSummary.totalExpiredPaisa).toBe(0);
    });
  });
});
