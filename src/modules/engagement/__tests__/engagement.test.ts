import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { Actor } from "@/lib/http/route";
import { notificationsRepo, notificationsService, clearMemoryNotificationsForTesting } from "@/modules/notifications";
import {
  engagementService,
  engagementRepo,
  isWithinDhakaAllowedWindow,
} from "../index";
import { POST as reviewsRoutePost } from "@/app/api/v1/reviews/route";
import { GET as productReviewsRouteGet } from "@/app/api/v1/catalog/products/[slug]/reviews/route";
import { POST as moderateRoutePost } from "@/app/api/v1/admin/reviews/[id]/moderate/route";
import {
  GET as wishlistRouteGet,
  POST as wishlistRoutePost,
  DELETE as wishlistRouteDelete,
} from "@/app/api/v1/customer/wishlist/route";
import { POST as notifyMeRoutePost } from "@/app/api/v1/catalog/skus/[skuId]/notify-me/route";
import { GET as cartRouteGet, PUT as cartRoutePut } from "@/app/api/v1/cart/route";

describe("P38 — Reviews, Wishlist, Back-in-Stock & Abandoned Cart", () => {
  const customerId = "018f0000-0000-7000-8000-000000000001";
  const otherCustomerId = "018f0000-0000-7000-8000-000000000002";
  const productId = "018f0000-0000-7000-8000-000000000010";
  const skuId = "018f0000-0000-7000-8000-000000000020";

  const customerActor: Actor = {
    id: customerId,
    type: "customer",
    roles: [],
    permissions: ["catalog.read", "order.place"],
  };

  const supportStaffActor: Actor = {
    id: "018f0000-0000-7000-8000-000000000099",
    type: "staff",
    roles: ["CUSTOMER_SUPPORT"],
    permissions: ["reviews.moderate"],
  };

  const nonSupportStaffActor: Actor = {
    id: "018f0000-0000-7000-8000-000000000098",
    type: "staff",
    roles: ["FIELD_RUNNER"],
    permissions: ["runner.task.own"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    engagementRepo.clearMemoryEngagementForTesting();
    clearMemoryNotificationsForTesting();
  });

  // =========================================================================
  // 1. Review Eligibility
  // =========================================================================
  describe("1. Verified Reviews Eligibility", () => {
    it("allows reviewing an order item when the order is DELIVERED", async () => {
      const orderItemId = "018f0000-0000-7000-8000-000000000101";
      engagementRepo.setMockOrderItem({
        id: orderItemId,
        orderId: "order-1",
        customerId,
        productId,
        skuId,
        tier: "AUTHENTIC",
        orderStatus: "DELIVERED",
      });

      const review = await engagementService.submitReview(customerActor, {
        order_item_id: orderItemId,
        rating: 5,
        title: "Genuine product!",
        body: "Authentic Anker charger verified with holographic seal.",
        media_ids: [],
      });

      expect(review.id).toBeDefined();
      expect(review.order_item_id).toBe(orderItemId);
      expect(review.customer_id).toBe(customerId);
      expect(review.status).toBe("PENDING");
      expect(review.rating).toBe(5);
      expect(review.tier).toBe("AUTHENTIC");
    });

    it("allows reviewing an order item when the order is DELIVERED_COUNTER (POS walk-in / pickup)", async () => {
      const orderItemId = "018f0000-0000-7000-8000-000000000102";
      engagementRepo.setMockOrderItem({
        id: orderItemId,
        orderId: "order-pos-1",
        customerId,
        productId,
        skuId,
        tier: "BUDGET_SMART",
        orderStatus: "DELIVERED_COUNTER",
      });

      const review = await engagementService.submitReview(customerActor, {
        order_item_id: orderItemId,
        rating: 4,
        body: "Works great for the price. Picked up from showroom.",
      });

      expect(review.status).toBe("PENDING");
      expect(review.tier).toBe("BUDGET_SMART");
    });

    it("rejects review if the order is not yet delivered (e.g. HANDED_TO_COURIER / SOURCING)", async () => {
      const orderItemId = "018f0000-0000-7000-8000-000000000103";
      engagementRepo.setMockOrderItem({
        id: orderItemId,
        orderId: "order-in-transit-1",
        customerId,
        productId,
        skuId,
        tier: "AUTHENTIC",
        orderStatus: "HANDED_TO_COURIER",
      });

      await expect(
        engagementService.submitReview(customerActor, {
          order_item_id: orderItemId,
          rating: 5,
          body: "Trying to review early before delivery arrives.",
        })
      ).rejects.toThrowError(/Only delivered items can be reviewed/);
    });

    it("rejects review if the item belongs to another customer (403)", async () => {
      const orderItemId = "018f0000-0000-7000-8000-000000000104";
      engagementRepo.setMockOrderItem({
        id: orderItemId,
        orderId: "order-other-1",
        customerId: otherCustomerId,
        productId,
        skuId,
        tier: "AUTHENTIC",
        orderStatus: "DELIVERED",
      });

      await expect(
        engagementService.submitReview(customerActor, {
          order_item_id: orderItemId,
          rating: 1,
          body: "Trying to review someone else's order item.",
        })
      ).rejects.toThrowError(/You can only review items from your own delivered orders/);
    });

    it("rejects duplicate review for the same order_item_id (409 Conflict)", async () => {
      const orderItemId = "018f0000-0000-7000-8000-000000000105";
      engagementRepo.setMockOrderItem({
        id: orderItemId,
        orderId: "order-dup-1",
        customerId,
        productId,
        skuId,
        tier: "AUTHENTIC",
        orderStatus: "DELIVERED",
      });

      // 1st review succeeds
      await engagementService.submitReview(customerActor, {
        order_item_id: orderItemId,
        rating: 5,
        body: "First review submission.",
      });

      // 2nd review for the same order item fails with 409
      await expect(
        engagementService.submitReview(customerActor, {
          order_item_id: orderItemId,
          rating: 4,
          body: "Second attempt to review same item.",
        })
      ).rejects.toThrowError(/A review has already been submitted for this order item/);
    });
  });

  // =========================================================================
  // 2. Review Moderation & Rating Summary
  // =========================================================================
  describe("2. Review Moderation & Rating Summary", () => {
    it("allows CUSTOMER_SUPPORT to moderate reviews, updating product rating summary", async () => {
      const item1 = "018f0000-0000-7000-8000-000000000201";
      const item2 = "018f0000-0000-7000-8000-000000000202";

      engagementRepo.setMockOrderItem({
        id: item1,
        orderId: "ord-1",
        customerId,
        productId,
        skuId,
        tier: "AUTHENTIC",
        orderStatus: "DELIVERED",
      });
      engagementRepo.setMockOrderItem({
        id: item2,
        orderId: "ord-2",
        customerId: otherCustomerId,
        productId,
        skuId,
        tier: "AUTHENTIC",
        orderStatus: "DELIVERED",
      });

      const rev1 = await engagementService.submitReview(customerActor, {
        order_item_id: item1,
        rating: 5,
        body: "Outstanding build quality and real charging speeds.",
      });

      const otherActor: Actor = { ...customerActor, id: otherCustomerId };
      const rev2 = await engagementService.submitReview(otherActor, {
        order_item_id: item2,
        rating: 4,
        body: "Good product, minor packaging scratch.",
      });

      // Before approval: public reviews return 0
      const initialPublic = await engagementService.getProductReviews(productId);
      expect(initialPublic.reviews).toHaveLength(0);
      expect(initialPublic.rating_summary.total_reviews).toBe(0);

      // Support staff approves rev1 (5 stars) and rev2 (4 stars)
      const approvedRev1 = await engagementService.moderateReview(supportStaffActor, rev1.id, {
        status: "APPROVED",
      });
      expect(approvedRev1.status).toBe("APPROVED");
      expect(approvedRev1.moderated_by).toBe(supportStaffActor.id);

      const approvedRev2 = await engagementService.moderateReview(supportStaffActor, rev2.id, {
        status: "APPROVED",
      });
      expect(approvedRev2.status).toBe("APPROVED");

      // Public reviews now return both approved reviews with rating summary (4.5 average)
      const updatedPublic = await engagementService.getProductReviews(productId);
      expect(updatedPublic.reviews).toHaveLength(2);
      expect(updatedPublic.rating_summary.total_reviews).toBe(2);
      expect(updatedPublic.rating_summary.average_rating).toBe(4.5);
      expect(updatedPublic.rating_summary.distribution[5]).toBe(1);
      expect(updatedPublic.rating_summary.distribution[4]).toBe(1);
      expect(updatedPublic.rating_summary.distribution[1]).toBe(0);
    });

    it("excludes REJECTED reviews from public product reviews", async () => {
      const item = "018f0000-0000-7000-8000-000000000203";
      engagementRepo.setMockOrderItem({
        id: item,
        orderId: "ord-rej-1",
        customerId,
        productId,
        skuId,
        tier: "BUDGET_SMART",
        orderStatus: "DELIVERED",
      });

      const rev = await engagementService.submitReview(customerActor, {
        order_item_id: item,
        rating: 1,
        body: "Spam / inappropriate content in review body.",
      });

      await engagementService.moderateReview(supportStaffActor, rev.id, {
        status: "REJECTED",
        reason: "Violates community guidelines",
      });

      const publicReviews = await engagementService.getProductReviews(productId);
      expect(publicReviews.reviews).toHaveLength(0);
      expect(publicReviews.rating_summary.total_reviews).toBe(0);
    });

    it("prevents non-support staff from moderating reviews (403)", async () => {
      await expect(
        engagementService.moderateReview(nonSupportStaffActor, "dummy-id", {
          status: "APPROVED",
        })
      ).rejects.toThrowError(/Missing permission to moderate product reviews/);
    });
  });

  // =========================================================================
  // 3. Wishlist
  // =========================================================================
  describe("3. Wishlist Management", () => {
    it("adds products and specific SKU variants to customer wishlist", async () => {
      const item1 = await engagementService.addToWishlist(customerId, {
        product_id: productId,
      });

      expect(item1.product_id).toBe(productId);
      expect(item1.sku_id).toBeNull();

      const item2 = await engagementService.addToWishlist(customerId, {
        product_id: productId,
        sku_id: skuId,
      });

      expect(item2.sku_id).toBe(skuId);

      const wishlist = await engagementService.getWishlist(customerId);
      expect(wishlist).toHaveLength(2);
    });

    it("removes items from wishlist cleanly", async () => {
      await engagementService.addToWishlist(customerId, {
        product_id: productId,
        sku_id: skuId,
      });

      let wishlist = await engagementService.getWishlist(customerId);
      expect(wishlist).toHaveLength(1);

      await engagementService.removeFromWishlist(customerId, productId, skuId);

      wishlist = await engagementService.getWishlist(customerId);
      expect(wishlist).toHaveLength(0);
    });
  });

  // =========================================================================
  // 4. Back-in-Stock Alerts (fires strictly once)
  // =========================================================================
  describe("4. Back-in-Stock Alerts", () => {
    it("subscribes customer and fires Class C alert ONCE when inventory becomes AVAILABLE", async () => {
      // Opt-in customer for marketing notifications
      await notificationsRepo.upsertPreferences(undefined, customerId, {
        marketingOptIn: true,
      });

      const sendSpy = vi.spyOn(notificationsService, "notify");

      // 1. Customer subscribes
      const sub = await engagementService.subscribeStockAlert(customerId, skuId);
      expect(sub.status).toBe("ACTIVE");
      expect(sub.notified_at).toBeNull();

      // 2. Inventory changes to IN_STOCK -> triggers notification
      const result1 = await engagementService.handleAvailabilityChanged(skuId, "IN_STOCK");
      expect(result1.notifiedCount).toBe(1);
      expect(sendSpy).toHaveBeenCalledTimes(1);

      // Verify template type promotions.back_in_stock was dispatched
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "promotions.back_in_stock",
          payload: expect.objectContaining({
            customerId,
            skuId,
          }),
        }),
        expect.any(Date)
      );

      // 3. Subsequent inventory change (e.g. stock updated again to AVAILABLE)
      // Must NOT fire a second time ("back-in-stock fires once")
      const result2 = await engagementService.handleAvailabilityChanged(skuId, "AVAILABLE");
      expect(result2.notifiedCount).toBe(0);
      expect(sendSpy).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it("skips notification if customer has not opted in to marketing (Class C requirement)", async () => {
      // Customer opted-out / default false
      await notificationsRepo.upsertPreferences(undefined, customerId, {
        marketingOptIn: false,
      });

      const sendSpy = vi.spyOn(notificationsService, "notify");

      await engagementService.subscribeStockAlert(customerId, skuId);
      const result = await engagementService.handleAvailabilityChanged(skuId, "IN_STOCK");

      expect(result.notifiedCount).toBe(0);
      expect(result.skippedOptOutCount).toBe(1);
      expect(sendSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. Abandoned Cart Reminders (opt-in & quiet hours)
  // =========================================================================
  describe("5. Abandoned Cart Reminders", () => {
    it("syncs and retrieves customer server-side cart", async () => {
      const cart = await engagementService.syncCart(customerId, {
        items: [
          { sku_id: skuId, quantity: 2 },
          { sku_id: "018f0000-0000-7000-8000-000000000021", quantity: 1 },
        ],
      });

      expect(cart.customer_id).toBe(customerId);
      expect(cart.items).toHaveLength(2);
      expect(cart.items[0].quantity).toBe(2);

      const fetched = await engagementService.getCart(customerId);
      expect(fetched.items).toHaveLength(2);
    });

    it("sends reminder for cart updated 3 hours ago during allowed daytime window (e.g. 14:00 Dhaka)", async () => {
      await notificationsRepo.upsertPreferences(undefined, customerId, {
        marketingOptIn: true,
      });

      const sendSpy = vi.spyOn(notificationsService, "notify");

      // 14:00 Asia/Dhaka = 08:00 UTC
      const nowDhakaDaytime = new Date(Date.UTC(2026, 9, 25, 8, 0, 0));
      const threeHoursAgo = new Date(nowDhakaDaytime.getTime() - 3 * 60 * 60 * 1000);

      // Create cart updated 3h ago
      await engagementRepo.upsertCart(customerId, [{ skuId, quantity: 1 }]);
      // Manually adjust updatedAt for test
      const cart = await engagementRepo.getCart(customerId);
      if (cart) cart.updatedAt = threeHoursAgo;

      const result = await engagementService.processAbandonedCarts(nowDhakaDaytime);

      expect(result.processed).toBe(1);
      expect(result.sent).toBe(1);
      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "promotions.abandoned_cart",
          payload: expect.objectContaining({
            customerId,
          }),
        }),
        expect.any(Date)
      );

      // Cart now has remindedAt set
      const updatedCart = await engagementRepo.getCart(customerId);
      expect(updatedCart?.remindedAt).not.toBeNull();
    });

    it("defers reminder during quiet hours (23:30 Dhaka wall clock)", async () => {
      await notificationsRepo.upsertPreferences(undefined, customerId, {
        marketingOptIn: true,
      });

      const sendSpy = vi.spyOn(notificationsService, "notify");

      // 23:30 Asia/Dhaka = 17:30 UTC
      const nowDhakaNight = new Date(Date.UTC(2026, 9, 25, 17, 30, 0));
      const threeHoursAgo = new Date(nowDhakaNight.getTime() - 3 * 60 * 60 * 1000);

      expect(isWithinDhakaAllowedWindow(nowDhakaNight)).toBe(false);

      await engagementRepo.upsertCart(customerId, [{ skuId, quantity: 1 }]);
      const cart = await engagementRepo.getCart(customerId);
      if (cart) cart.updatedAt = threeHoursAgo;

      const result = await engagementService.processAbandonedCarts(nowDhakaNight);

      expect(result.processed).toBe(1);
      expect(result.sent).toBe(0);
      expect(result.skippedQuietHours).toBe(1);
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it("skips reminder if customer has not opted in (marketingOptIn = false)", async () => {
      await notificationsRepo.upsertPreferences(undefined, customerId, {
        marketingOptIn: false,
      });

      const sendSpy = vi.spyOn(notificationsService, "notify");

      const nowDaytime = new Date(Date.UTC(2026, 9, 25, 8, 0, 0)); // 14:00 Dhaka
      const threeHoursAgo = new Date(nowDaytime.getTime() - 3 * 60 * 60 * 1000);

      await engagementRepo.upsertCart(customerId, [{ skuId, quantity: 1 }]);
      const cart = await engagementRepo.getCart(customerId);
      if (cart) cart.updatedAt = threeHoursAgo;

      const result = await engagementService.processAbandonedCarts(nowDaytime);

      expect(result.processed).toBe(1);
      expect(result.sent).toBe(0);
      expect(result.skippedOptOut).toBe(1);
      expect(sendSpy).not.toHaveBeenCalled();
    });

    it("stops abandoned cart reminders when cart is cleared on order placement", async () => {
      await notificationsRepo.upsertPreferences(undefined, customerId, {
        marketingOptIn: true,
      });

      const sendSpy = vi.spyOn(notificationsService, "notify");
      const nowDaytime = new Date(Date.UTC(2026, 9, 25, 8, 0, 0)); // 14:00 Dhaka

      // Customer had a cart
      await engagementService.syncCart(customerId, {
        items: [{ sku_id: skuId, quantity: 1 }],
      });

      // Customer places order -> cart is cleared
      await engagementService.clearCart(customerId);

      const result = await engagementService.processAbandonedCarts(nowDaytime);
      expect(result.processed).toBe(0);
      expect(sendSpy).not.toHaveBeenCalled();
    });
  });
});
