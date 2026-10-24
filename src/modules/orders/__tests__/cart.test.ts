import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import { Actor } from "@/lib/http/route";
import { BusinessError } from "@/lib/errors";
import { catalogService } from "@/modules/catalog";
import { inventoryService } from "@/modules/inventory";
import { sourcingService } from "@/modules/sourcing";
import { promotionsService } from "@/modules/promotions";
import {
  validateCart,
  reserveCart,
  convertCartHoldToOrder,
} from "../index";
import { ordersRepo, clearMemoryOrdersForTesting } from "../repo";

const staffActor: Actor = {
  id: "01920000-0000-7000-8000-000000000001",
  type: "staff",
  roles: ["SUPER_ADMIN"],
};

const approverStaffActor: Actor = {
  id: "01920000-0000-7000-8000-000000000099",
  type: "staff",
  roles: ["SUPER_ADMIN"],
};

describe("P19 — Cart Validation & Stock Reservation Endpoints", () => {
  let categoryId: string;
  let regularProduct: Awaited<ReturnType<typeof catalogService.createProduct>>;
  let regularSku: Awaited<ReturnType<typeof catalogService.createSku>>;
  let preOrderProduct: Awaited<ReturnType<typeof catalogService.createProduct>>;
  let preOrderSku: Awaited<ReturnType<typeof catalogService.createSku>>;

  beforeEach(async () => {
    catalogService.clearMemoryCatalogForTesting();
    inventoryService.clearMemoryForTesting();
    sourcingService.clearMemoryForTesting();
    promotionsService.clearMemoryForTesting();
    clearMemoryOrdersForTesting();

    // 1. Create Category
    const category = await catalogService.createCategory({
      slug: "chargers",
      nameEn: "Chargers",
      nameBn: "চার্জার",
      level: 1,
    });
    categoryId = category.id;

    // 2. Create Regular Published Product & SKU
    regularProduct = await catalogService.createProduct(
      {
        slug: "ugreen-65w-charger",
        titleEn: "UGREEN Nexode 65W GaN Charger",
        titleBn: "ইউগ্রিন ৬৫ ওয়াট চার্জার",
        categoryId,
        productTier: "AUTHENTIC",
        fulfillmentType: "DROP_AND_PACK",
        vatRateBp: 750,
      },
      staffActor
    );

    regularSku = await catalogService.createSku(
      {
        productId: regularProduct.id,
        skuCode: "UGR-65W-BLK",
        pricePaisa: 250000, // ৳2,500
        baseCostPaisa: 180000,
        weightGrams: 200,
        warrantyType: "OFFICIAL_DISTRIBUTOR",
        warrantyDays: 730,
        dailyOrderCap: 10,
      },
      staffActor
    );
    catalogService.setProductStatusForTesting(regularProduct.id, "PUBLISHED");

    // 3. Create Pre-Order Published Product & SKU
    preOrderProduct = await catalogService.createProduct(
      {
        slug: "samsung-s25-ultra-preorder",
        titleEn: "Samsung Galaxy S25 Ultra (Pre-Order)",
        titleBn: "স্যামসাং গ্যালাক্সি এস২৫ আল্ট্রা (প্রি-অর্ডার)",
        categoryId,
        productTier: "AUTHENTIC",
        fulfillmentType: "PRE_ORDER",
        vatRateBp: 500,
        preorderEtaDaysMin: 14,
        preorderEtaDaysMax: 21,
      },
      staffActor
    );

    preOrderSku = await catalogService.createSku(
      {
        productId: preOrderProduct.id,
        skuCode: "S25U-512GB-BLK",
        pricePaisa: 15000000, // ৳150,000
        baseCostPaisa: 12000000,
        weightGrams: 500,
        warrantyType: "OFFICIAL_DISTRIBUTOR",
        warrantyDays: 365,
      },
      staffActor
    );
    catalogService.setProductStatusForTesting(preOrderProduct.id, "PUBLISHED");

    // 4. Seed physical stock for regular SKU (50 units in Nawabpur Godown)
    await inventoryService.receive(
      undefined,
      {
        skuId: regularSku.id,
        locationCode: "GODOWN_NAWABPUR",
        qty: 50,
        unitCostPaisa: 180000,
        reason: "PURCHASE_RECEIPT",
        refId: "PO-2026-CART-SEED",
      },
      staffActor
    );
  });

  describe("1. Mixed Cart Rejection (422 ERR_MIXED_CART_DISALLOWED)", () => {
    it("rejects mixed cart combining regular and pre-order items with bilingual modal message", async () => {
      try {
        await validateCart(undefined, {
          items: [
            { sku_id: regularSku.id, quantity: 1 },
            { sku_id: preOrderSku.id, quantity: 1 },
          ],
        });
        expect.unreachable("Should have thrown ERR_MIXED_CART_DISALLOWED");
      } catch (error: unknown) {
        const err = error as BusinessError;
        expect(err).toBeInstanceOf(BusinessError);
        expect(err.code).toBe("ERR_MIXED_CART_DISALLOWED");
        expect(err.status).toBe(422);

        // PRD §3.3.1 Modal Message in en and bn
        expect(err.details?.message_en).toBe(
          "Pre-order items require a separate advance deposit and have different delivery timelines. Please checkout regular items first or clear your cart."
        );
        expect(err.details?.message_bn).toBe(
          "প্রি-অর্ডার আইটেমগুলোর জন্য অগ্রিম ডিপোজিট প্রয়োজন এবং এগুলোর ডেলিভারি সময়সীমা ভিন্ন। অনুগ্রহ করে নিয়মিত পণ্যগুলো আগে চেকআউট করুন অথবা আপনার কার্ট পরিবর্তন করুন।"
        );
        expect(err.details?.rejected_skus).toContain(preOrderSku.id);
      }
    });
  });

  describe("2. Server-Side Price Isolation (Price Tampering Immune)", () => {
    it("completely ignores client-supplied pricing and evaluates authoritative DB prices", async () => {
      // Client cannot provide prices in validateCart input schema
      const result = await validateCart(undefined, {
        items: [{ sku_id: regularSku.id, quantity: 2 }],
        delivery_zone: "INSIDE_DHAKA",
      });

      expect(result.order_type).toBe("REGULAR_DROP_PACK");
      expect(result.items).toHaveLength(1);
      const line = result.items[0]!;
      expect(line.sku_id).toBe(regularSku.id);
      expect(line.quantity).toBe(2);
      expect(line.unit_price_paisa).toBe(250000); // ৳2,500 from DB
      expect(line.total_price_paisa).toBe(500000); // 2 * ৳2,500 = ৳5,000

      // Financial breakup
      expect(result.financial_breakup.subtotal_paisa).toBe(500000);
      expect(result.financial_breakup.discount_paisa).toBe(0);
      expect(result.financial_breakup.delivery_fee_dhaka_paisa).toBe(8000); // ৳80
      expect(result.financial_breakup.delivery_fee_nationwide_paisa).toBe(15000); // ৳150
      expect(result.financial_breakup.delivery_fee_selected_paisa).toBe(8000);
      expect(result.financial_breakup.total_payable_paisa).toBe(508000);
    });
  });

  describe("3. Unavailability & Per-Line Reporting", () => {
    it("reports NOT_FOUND for unknown SKU IDs without throwing hard error", async () => {
      const nonExistentSkuId = crypto.randomUUID();
      const result = await validateCart(undefined, {
        items: [
          { sku_id: regularSku.id, quantity: 1 },
          { sku_id: nonExistentSkuId, quantity: 1 },
        ],
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.sku_id).toBe(regularSku.id);

      expect(result.unavailable_items).toHaveLength(1);
      expect(result.unavailable_items[0]?.sku_id).toBe(nonExistentSkuId);
      expect(result.unavailable_items[0]?.reason).toBe("NOT_FOUND");
    });

    it("reports UNPUBLISHED for inactive SKUs or unapproved products", async () => {
      // Create unpublished draft product
      const draftProd = await catalogService.createProduct(
        {
          slug: "draft-cable",
          titleEn: "Draft Cable",
          titleBn: "ড্রাফট ক্যাবল",
          categoryId,
          productTier: "BUDGET_SMART",
          fulfillmentType: "DROP_AND_PACK",
        },
        staffActor
      );
      const draftSku = await catalogService.createSku(
        {
          productId: draftProd.id,
          skuCode: "DRAFT-CBL-01",
          pricePaisa: 50000,
          baseCostPaisa: 30000,
          weightGrams: 50,
          warrantyType: "SHOP_REPLACEMENT",
          warrantyDays: 7,
        },
        staffActor
      );

      const result = await validateCart(undefined, {
        items: [{ sku_id: draftSku.id, quantity: 1 }],
      });

      expect(result.items).toHaveLength(0);
      expect(result.unavailable_items).toHaveLength(1);
      expect(result.unavailable_items[0]?.reason).toBe("UNPUBLISHED");
    });

    it("reports QTY_EXCEEDS_CAP when requested qty exceeds daily order cap", async () => {
      const result = await validateCart(undefined, {
        items: [{ sku_id: regularSku.id, quantity: 15 }], // cap is 10
      });

      expect(result.items).toHaveLength(0);
      expect(result.unavailable_items).toHaveLength(1);
      expect(result.unavailable_items[0]?.reason).toBe("QTY_EXCEEDS_CAP");
      expect(result.unavailable_items[0]?.available_qty).toBe(10);
    });

    it("reports OUT_OF_STOCK when physical stock is 0 and no virtual sourcing is available", async () => {
      const outProd = await catalogService.createProduct(
        {
          slug: "out-of-stock-headset",
          titleEn: "Out of Stock Headset",
          titleBn: "স্টকহীন হেডসেট",
          categoryId,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
        },
        staffActor
      );
      const outSku = await catalogService.createSku(
        {
          productId: outProd.id,
          skuCode: "OUT-HD-01",
          pricePaisa: 300000,
          baseCostPaisa: 200000,
          weightGrams: 200,
          warrantyType: "SHOP_REPLACEMENT",
          warrantyDays: 7,
        },
        staffActor
      );
      catalogService.setProductStatusForTesting(outProd.id, "PUBLISHED");

      const result = await validateCart(undefined, {
        items: [{ sku_id: outSku.id, quantity: 1 }],
      });

      expect(result.items).toHaveLength(0);
      expect(result.unavailable_items).toHaveLength(1);
      expect(result.unavailable_items[0]?.reason).toBe("OUT_OF_STOCK");
    });
  });

  describe("4. Coupon Evaluation & Rejection Reasons", () => {
    it("reports reason when coupon is not found", async () => {
      const result = await validateCart(undefined, {
        items: [{ sku_id: regularSku.id, quantity: 1 }],
        coupon_code: "NONEXISTENT",
      });

      expect(result.coupon.applied).toBe(false);
      expect(result.coupon.code).toBe("NONEXISTENT");
      expect(result.coupon.discount_paisa).toBe(0);
      expect(result.coupon.reason_if_not).toBe("NOT_FOUND");
    });

    it("reports reason when coupon is inactive or expired", async () => {
      const pastStart = new Date(Date.now() - 20 * 86400 * 1000);
      const pastEnd = new Date(Date.now() - 10 * 86400 * 1000);

      const expiredCoupon = await promotionsService.createCoupon(
        {
          code: "EXPIRED50",
          type: "FIXED",
          value: 5000,
          startsAt: pastStart,
          endsAt: pastEnd,
        },
        staffActor
      );
      await promotionsService.activateCoupon(expiredCoupon.id, approverStaffActor);

      const result = await validateCart(undefined, {
        items: [{ sku_id: regularSku.id, quantity: 1 }],
        coupon_code: "EXPIRED50",
      });

      expect(result.coupon.applied).toBe(false);
      expect(result.coupon.reason_if_not).toBe("EXPIRED");
    });

    it("successfully applies active coupon and calculates line and cart discount", async () => {
      const now = new Date();
      const activeCoupon = await promotionsService.createCoupon(
        {
          code: "SAVE200",
          type: "FIXED",
          value: 20000, // ৳200
          minOrderPaisa: 100000, // ৳1,000
          startsAt: new Date(now.getTime() - 86400 * 1000),
          endsAt: new Date(now.getTime() + 86400 * 1000),
        },
        staffActor
      );
      await promotionsService.activateCoupon(activeCoupon.id, approverStaffActor);

      const result = await validateCart(undefined, {
        items: [{ sku_id: regularSku.id, quantity: 1 }],
        coupon_code: "SAVE200",
      });

      expect(result.coupon.applied).toBe(true);
      expect(result.coupon.code).toBe("SAVE200");
      expect(result.coupon.discount_paisa).toBe(20000);
      expect(result.coupon.reason_if_not).toBeNull();

      expect(result.financial_breakup.discount_paisa).toBe(20000);
      expect(result.financial_breakup.payable_subtotal_paisa).toBe(230000);
    });
  });

  describe("5. Pre-Order Cart Calculations", () => {
    it("computes progressive deposit, balance, COD eligibility, and ETA range for PRE_ORDER", async () => {
      const result = await validateCart(undefined, {
        items: [{ sku_id: preOrderSku.id, quantity: 1 }],
        delivery_zone: "INSIDE_DHAKA",
      });

      expect(result.order_type).toBe("PRE_ORDER");
      expect(result.pre_order).toBeDefined();

      // For ৳150,000:
      // Deposit: 20% of first ৳50,000 (৳10,000) + 10% of remaining ৳100,000 (৳10,000) = ৳20,000 (2,000,000 paisa)
      expect(result.pre_order?.deposit_paisa).toBe(2000000);

      // Total payable = ৳150,000 + ৳80 delivery = 15,008,000 paisa
      // Balance = 15,008,000 - 2,000,000 = 13,008,000 paisa (৳130,080)
      expect(result.pre_order?.balance_paisa).toBe(13008000);

      // Balance ৳130,080 exceeds ৳30,000 max COD limit -> balance_cod_allowed should be false
      expect(result.pre_order?.balance_cod_allowed).toBe(false);

      // ETA range
      expect(result.pre_order?.eta_range.min_days).toBe(14);
      expect(result.pre_order?.eta_range.max_days).toBe(21);
      expect(result.pre_order?.eta_range.estimated_delivery_from).toBeDefined();
      expect(result.pre_order?.eta_range.estimated_delivery_to).toBeDefined();
    });
  });

  describe("6. Cart Stock Reservation (POST /api/v1/cart/reserve)", () => {
    const deviceId = "device-test-12345";

    it("creates a 10-minute cart hold and reserves physical stock", async () => {
      const res = await reserveCart(
        undefined,
        {
          items: [{ sku_id: regularSku.id, quantity: 5 }],
          fulfillment_channel: "COURIER",
        },
        deviceId
      );

      expect(res.success).toBe(true);
      expect(res.reservation_id).toBeDefined();
      expect(res.duration_seconds).toBe(600); // 10 minutes

      const expiryDate = new Date(res.expires_at);
      expect(expiryDate.getTime()).toBeGreaterThan(Date.now() + 590 * 1000);

      // Verify physical stock balance updated in Nawabpur Godown
      const balances = await inventoryService.getSellableBalancesForSkus([regularSku.id]);
      expect(balances[0]?.sellableOnHand).toBe(50);
      expect(balances[0]?.sellableReserved).toBe(5);

      // Verify cart hold record
      const hold = await ordersRepo.getCartHoldById(undefined, res.reservation_id);
      expect(hold).toBeDefined();
      expect(hold?.status).toBe("ACTIVE");
      expect(hold?.deviceId).toBe(deviceId);
    });

    it("returns 409 ERR_INSUFFICIENT_STOCK if requested quantity exceeds available physical stock", async () => {
      await expect(
        reserveCart(
          undefined,
          {
            items: [{ sku_id: regularSku.id, quantity: 100 }], // only 50 in stock
            fulfillment_channel: "COURIER",
          },
          "device-unique-2"
        )
      ).rejects.toThrow(BusinessError);

      try {
        await reserveCart(
          undefined,
          {
            items: [{ sku_id: regularSku.id, quantity: 100 }],
            fulfillment_channel: "COURIER",
          },
          "device-unique-2"
        );
      } catch (error: unknown) {
        const err = error as BusinessError;
        expect(err.code).toBe("ERR_INSUFFICIENT_STOCK");
        expect(err.status).toBe(409);
        const details = err.details as { items?: Array<{ available_qty: number }> };
        expect(details?.items?.[0]?.available_qty).toBe(50);
      }
    });

    it("enforces rate limit of 30 requests/minute per device", async () => {
      const spamDevice = "spam-device-999";

      // 30 valid requests succeed
      for (let i = 0; i < 30; i++) {
        await reserveCart(
          undefined,
          {
            items: [{ sku_id: regularSku.id, quantity: 1 }],
          },
          spamDevice
        );
      }

      // 31st request triggers rate limit error (429)
      await expect(
        reserveCart(
          undefined,
          {
            items: [{ sku_id: regularSku.id, quantity: 1 }],
          },
          spamDevice
        )
      ).rejects.toThrow(BusinessError);

      try {
        await reserveCart(
          undefined,
          {
            items: [{ sku_id: regularSku.id, quantity: 1 }],
          },
          spamDevice
        );
      } catch (error: unknown) {
        const err = error as BusinessError;
        expect(err.code).toBe("ERR_RATE_LIMITED");
        expect(err.status).toBe(429);
      }
    });
  });

  describe("7. Reservation to Checkout Conversion & Expiry", () => {
    it("converts cart hold reservations to order without dropping physical stock lock", async () => {
      const holdRes = await reserveCart(
        undefined,
        {
          items: [{ sku_id: regularSku.id, quantity: 3 }],
        },
        "device-conversion-test"
      );

      const orderId = crypto.randomUUID();
      const conversion = await convertCartHoldToOrder(
        undefined,
        holdRes.reservation_id,
        orderId
      );

      expect(conversion.convertedCount).toBe(1);
      expect(conversion.hold.status).toBe("CONVERTED");

      // Verify the reservation is now linked to orderId and cart_hold_id is null
      const orderReservations = await inventoryService.getReservationsByCartHoldId(
        holdRes.reservation_id
      );
      expect(orderReservations).toHaveLength(0); // No longer attached to cartHoldId

      // Stock is still held (reserved is still 3)
      const balances = await inventoryService.getSellableBalancesForSkus([regularSku.id]);
      expect(balances[0]?.sellableReserved).toBe(3);
    });

    it("releases expired cart-hold stock back to sellable balance during 1-minute expiry job", async () => {
      await reserveCart(
        undefined,
        {
          items: [{ sku_id: regularSku.id, quantity: 4 }],
        },
        "device-expiry-test"
      );

      let balances = await inventoryService.getSellableBalancesForSkus([regularSku.id]);
      expect(balances[0]?.sellableReserved).toBe(4);

      // Fast forward time by 11 minutes (past 600s TTL)
      const futureTime = new Date(Date.now() + 660 * 1000);

      // Run expiry job (P14 CTE)
      const expiryResult = await inventoryService.expireReservations(futureTime);
      expect(expiryResult.expiredCount).toBeGreaterThanOrEqual(1);

      // Verify reserved balance is decremented back to 0
      balances = await inventoryService.getSellableBalancesForSkus([regularSku.id]);
      expect(balances[0]?.sellableReserved).toBe(0);
    });
  });
});
