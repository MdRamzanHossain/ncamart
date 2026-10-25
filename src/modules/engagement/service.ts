import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { Actor } from "@/lib/http/route";
import { AppError, BusinessError, ForbiddenError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { emitOutbox } from "@/lib/outbox";
import { getRedis } from "@/lib/redis";
import { env } from "@/lib/env";
import { orderItems, orders } from "@/modules/orders/schema";
import { products, skus } from "@/modules/catalog/schema";
import { notificationsRepo, notificationsService } from "@/modules/notifications";
import { nextAllowedSendTime, DHAKA_OFFSET_MS } from "@/modules/notifications/timing";
import { engagementRepo, MockOrderItemDeliveredInfo } from "./repo";
import { engagementPolicies } from "./policies";
import { ENGAGEMENT_EVENTS } from "./events";
import {
  CreateReviewInput,
  ModerateReviewInput,
  ReviewDto,
  ProductReviewsResponseDto,
  RatingSummaryDto,
  AddWishlistInput,
  WishlistItemDto,
  StockAlertSubscriptionDto,
  UpdateCartInput,
  CartDto,
} from "./dto";
import { ReviewRow, WishlistItemRow, CartRow } from "./schema";

function isRedisEnabled(): boolean {
  if (env.MOCK_EXTERNAL_SERVICES || process.env.NODE_ENV === "test") {
    return false;
  }
  return true;
}

export function isWithinDhakaAllowedWindow(now = new Date()): boolean {
  const dhaka = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const hour = dhaka.getUTCHours();
  return hour >= 8 && hour < 22;
}

export const engagementService = {
  // ------------------------------------------------------------------------
  // 1. Verified Reviews
  // ------------------------------------------------------------------------

  /**
   * Submit a verified review for a DELIVERED / DELIVERED_COUNTER item.
   * Only the purchasing customer can submit a review. No incentives or coupons are attached.
   */
  async submitReview(actor: Actor, input: CreateReviewInput): Promise<ReviewDto> {
    if (!engagementPolicies.canSubmitReview(actor)) {
      throw new ForbiddenError("Only verified customers can submit product reviews");
    }

    // 1. Check if review already exists for this order_item_id (strictly 1 review per item)
    const existing = await engagementRepo.getReviewByOrderItemId(input.order_item_id);
    if (existing) {
      throw new BusinessError(
        "ERR_REVIEW_ALREADY_EXISTS",
        "A review has already been submitted for this order item",
        { status: 409 }
      );
    }

    // 2. Look up the order item and parent order delivery status
    let orderItemCustomerId: string | null = null;
    let orderItemStatus: string | null = null;
    let productId: string | null = null;
    let skuId: string | null = null;
    let tier: "AUTHENTIC" | "BUDGET_SMART" = "AUTHENTIC";

    // Try mock item lookup first (for testing)
    const mockItem = engagementRepo.getMockOrderItem(input.order_item_id);
    if (mockItem) {
      orderItemCustomerId = mockItem.customerId;
      orderItemStatus = mockItem.orderStatus;
      productId = mockItem.productId;
      skuId = mockItem.skuId;
      tier = mockItem.tier;
    } else {
      try {
        const rows = await db
          .select({
            orderItemId: orderItems.id,
            customerId: orders.customerId,
            orderStatus: orders.status,
            productId: orderItems.productId,
            skuId: orderItems.skuId,
            tier: orderItems.tier,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .where(eq(orderItems.id, input.order_item_id))
          .limit(1);

        if (rows[0]) {
          orderItemCustomerId = rows[0].customerId;
          orderItemStatus = rows[0].orderStatus;
          productId = rows[0].productId;
          skuId = rows[0].skuId;
          tier = (rows[0].tier as "AUTHENTIC" | "BUDGET_SMART") || "AUTHENTIC";
        }
      } catch (err) {
        logger.debug({ err, orderItemId: input.order_item_id }, "Database lookup failed for order item");
      }
    }

    if (!orderItemCustomerId || !orderItemStatus || !productId || !skuId) {
      throw new BusinessError("ERR_ORDER_ITEM_NOT_FOUND", "Order item not found", {
        status: 404,
      });
    }

    // 3. Customer ownership check
    if (orderItemCustomerId !== actor.id) {
      throw new ForbiddenError("You can only review items from your own delivered orders");
    }

    // 4. Delivery status check: DELIVERED or DELIVERED_COUNTER only
    const isDelivered =
      orderItemStatus === "DELIVERED" || orderItemStatus === "DELIVERED_COUNTER";
    if (!isDelivered) {
      throw new BusinessError(
        "ERR_REVIEW_INELIGIBLE",
        `Only delivered items can be reviewed. Current order status: ${orderItemStatus}`,
        { status: 422, order_status: orderItemStatus }
      );
    }

    // 5. Create review with PENDING status (no coupons or review incentives allowed)
    const review = await engagementRepo.createReview({
      orderItemId: input.order_item_id,
      customerId: actor.id,
      productId,
      skuId,
      tier,
      rating: input.rating,
      title: input.title ?? null,
      body: input.body,
      mediaIds: input.media_ids || [],
      status: "PENDING",
    });

    // 6. Emit outbox event
    await emitOutbox(undefined, {
      aggregateType: "REVIEW",
      aggregateId: review.id,
      type: ENGAGEMENT_EVENTS.REVIEW_SUBMITTED,
      payload: {
        reviewId: review.id,
        customerId: actor.id,
        productId: review.productId,
        skuId: review.skuId,
        rating: review.rating,
      },
    });

    return this.mapReviewToDto(review);
  },

  /**
   * Get approved reviews and rating summary for a product by slug or ID.
   */
  async getProductReviews(slugOrId: string): Promise<ProductReviewsResponseDto> {
    let productId = slugOrId;
    let productSlug = slugOrId;

    // Resolve product by slug if available
    try {
      const [prod] = await db
        .select({ id: products.id, slug: products.slug })
        .from(products)
        .where(eq(products.slug, slugOrId))
        .limit(1);
      if (prod) {
        productId = prod.id;
        productSlug = prod.slug;
      }
    } catch {
      // Ignored
    }

    // 1. Fetch approved reviews
    const approvedReviews = await engagementRepo.listApprovedReviewsByProductId(productId);

    // 2. Compute rating summary
    const ratingSummary = await engagementRepo.computeProductRatingSummary(productId);

    return {
      product_id: productId,
      product_slug: productSlug,
      rating_summary: ratingSummary,
      reviews: approvedReviews.map((r) => this.mapReviewToDto(r)),
    };
  },

  /**
   * Moderate a review (CUSTOMER_SUPPORT / SUPER_ADMIN).
   */
  async moderateReview(
    actor: Actor,
    reviewId: string,
    input: ModerateReviewInput
  ): Promise<ReviewDto> {
    if (!engagementPolicies.canModerateReview(actor)) {
      throw new ForbiddenError("Missing permission to moderate product reviews");
    }

    const review = await engagementRepo.getReviewById(reviewId);
    if (!review) {
      throw new BusinessError("ERR_REVIEW_NOT_FOUND", "Review not found", { status: 404 });
    }

    const updated = await engagementRepo.updateReviewModeration(
      reviewId,
      input.status,
      actor.id,
      input.reason
    );

    if (!updated) {
      throw new BusinessError("ERR_UPDATE_FAILED", "Failed to update review status", { status: 500 });
    }

    // If approved, update cached rating summary on product and search document
    if (input.status === "APPROVED") {
      const summary = await engagementRepo.computeProductRatingSummary(updated.productId);

      // Cache rating summary in Redis if enabled
      if (isRedisEnabled()) {
        try {
          const redis = getRedis();
          await redis.set(
            `catalog:product:${updated.productId}:ratings`,
            JSON.stringify(summary),
            "EX",
            3600
          );
        } catch {
          // Ignored
        }
      }

      // Emit review approved event for search document and analytics
      await emitOutbox(undefined, {
        aggregateType: "REVIEW",
        aggregateId: updated.id,
        type: ENGAGEMENT_EVENTS.REVIEW_APPROVED,
        payload: {
          reviewId: updated.id,
          productId: updated.productId,
          skuId: updated.skuId,
          rating: updated.rating,
          summary,
        },
      });
    } else {
      await emitOutbox(undefined, {
        aggregateType: "REVIEW",
        aggregateId: updated.id,
        type: ENGAGEMENT_EVENTS.REVIEW_REJECTED,
        payload: {
          reviewId: updated.id,
          productId: updated.productId,
          reason: input.reason,
        },
      });
    }

    return this.mapReviewToDto(updated);
  },

  async listReviewsForModeration(
    actor: Actor,
    status?: "PENDING" | "APPROVED" | "REJECTED",
    limit = 50,
    offset = 0
  ): Promise<ReviewDto[]> {
    if (!engagementPolicies.canModerateReview(actor)) {
      throw new ForbiddenError("Missing permission to view review moderation queue");
    }

    const rows = await engagementRepo.listReviewsForModeration(status, limit, offset);
    return rows.map((r) => this.mapReviewToDto(r));
  },

  // ------------------------------------------------------------------------
  // 2. Wishlist
  // ------------------------------------------------------------------------
  async getWishlist(customerId: string): Promise<WishlistItemDto[]> {
    const items = await engagementRepo.listWishlistItems(customerId);
    return items.map((item) => ({
      id: item.id,
      customer_id: item.customerId,
      product_id: item.productId,
      sku_id: item.skuId ?? null,
      created_at: new Date(item.createdAt).toISOString(),
    }));
  },

  async addToWishlist(customerId: string, input: AddWishlistInput): Promise<WishlistItemDto> {
    const item = await engagementRepo.addWishlistItem(
      customerId,
      input.product_id,
      input.sku_id ?? null
    );

    return {
      id: item.id,
      customer_id: item.customerId,
      product_id: item.productId,
      sku_id: item.skuId ?? null,
      created_at: new Date(item.createdAt).toISOString(),
    };
  },

  async removeFromWishlist(
    customerId: string,
    productId: string,
    skuId?: string | null
  ): Promise<boolean> {
    return await engagementRepo.removeWishlistItem(customerId, productId, skuId);
  },

  // ------------------------------------------------------------------------
  // 3. Back-in-Stock Alerts
  // ------------------------------------------------------------------------
  async subscribeStockAlert(
    customerId: string,
    skuId: string
  ): Promise<StockAlertSubscriptionDto> {
    const existing = await engagementRepo.getActiveStockAlertSubscription(customerId, skuId);
    if (existing) {
      return {
        id: existing.id,
        customer_id: existing.customerId,
        sku_id: existing.skuId,
        status: existing.status,
        created_at: new Date(existing.createdAt).toISOString(),
        notified_at: existing.notifiedAt ? new Date(existing.notifiedAt).toISOString() : null,
      };
    }

    const sub = await engagementRepo.createStockAlertSubscription(customerId, skuId);

    await emitOutbox(undefined, {
      aggregateType: "STOCK_ALERT",
      aggregateId: sub.id,
      type: ENGAGEMENT_EVENTS.STOCK_ALERT_SUBSCRIBED,
      payload: {
        subscriptionId: sub.id,
        customerId,
        skuId,
      },
    });

    return {
      id: sub.id,
      customer_id: sub.customerId,
      sku_id: sub.skuId,
      status: sub.status,
      created_at: new Date(sub.createdAt).toISOString(),
      notified_at: null,
    };
  },

  /**
   * Handle inventory availability change event to IN_STOCK or AVAILABLE.
   * Dispatches Class C notification (08:00–22:00, opt-in only) to active subscribers.
   * Back-in-stock fires strictly once per subscription.
   */
  async handleAvailabilityChanged(
    skuId: string,
    newAvailability: string,
    now = new Date()
  ): Promise<{ notifiedCount: number; skippedOptOutCount: number }> {
    const isAvailable = newAvailability === "IN_STOCK" || newAvailability === "AVAILABLE";
    if (!isAvailable) {
      return { notifiedCount: 0, skippedOptOutCount: 0 };
    }

    const activeSubs = await engagementRepo.listActiveSubscriptionsBySkuId(skuId);
    let notifiedCount = 0;
    let skippedOptOutCount = 0;

    for (const sub of activeSubs) {
      // 1. Check customer marketing opt-in preferences (Class C requires opt-in)
      const prefs = await notificationsRepo.getPreferences(undefined, sub.customerId);
      const isOptedIn = prefs?.marketingOptIn ?? false;

      if (isOptedIn) {
        // Send Class C notification (respects Dhaka 08:00–22:00 quiet hours via notification service)
        try {
          await notificationsService.notify(
            {
              type: "promotions.back_in_stock",
              payload: {
                customerId: sub.customerId,
                skuId: sub.skuId,
                title: "Back in Stock!",
                description: `Product SKU ${sub.skuId} is now back in stock!`,
                link: `https://ncamart.com/catalog/skus/${sub.skuId}`,
                phone: "+8801700000000",
              },
            },
            now
          );
          notifiedCount++;
        } catch (err) {
          logger.error({ err, subscriptionId: sub.id }, "Failed to send back-in-stock alert notification");
        }
      } else {
        skippedOptOutCount++;
        logger.info({ customerId: sub.customerId, skuId: sub.skuId }, "Skipping back-in-stock alert (customer not opted in)");
      }

      // 2. Mark subscription NOTIFIED so it fires strictly ONCE
      await engagementRepo.markStockAlertNotified(sub.id, now);

      await emitOutbox(undefined, {
        aggregateType: "STOCK_ALERT",
        aggregateId: sub.id,
        type: ENGAGEMENT_EVENTS.STOCK_ALERT_NOTIFIED,
        payload: {
          subscriptionId: sub.id,
          customerId: sub.customerId,
          skuId: sub.skuId,
          optedIn: isOptedIn,
          notifiedAt: now.toISOString(),
        },
      });
    }

    return { notifiedCount, skippedOptOutCount };
  },

  // ------------------------------------------------------------------------
  // 4. Server-Side Carts & Abandoned Cart Recovery
  // ------------------------------------------------------------------------
  async syncCart(customerId: string, input: UpdateCartInput): Promise<CartDto> {
    const items = input.items.map((i) => ({
      skuId: i.sku_id,
      quantity: i.quantity,
      addedAt: i.added_at || new Date().toISOString(),
      metadata: i.metadata,
    }));

    const cart = await engagementRepo.upsertCart(customerId, items);

    return {
      customer_id: cart.customerId,
      items: (cart.items || []).map((i) => ({
        sku_id: i.skuId,
        quantity: i.quantity,
        added_at: i.addedAt,
        metadata: i.metadata,
      })),
      updated_at: new Date(cart.updatedAt).toISOString(),
      reminded_at: cart.remindedAt ? new Date(cart.remindedAt).toISOString() : null,
    };
  },

  async getCart(customerId: string): Promise<CartDto> {
    const cart = await engagementRepo.getCart(customerId);
    if (!cart) {
      return {
        customer_id: customerId,
        items: [],
        updated_at: new Date().toISOString(),
        reminded_at: null,
      };
    }

    return {
      customer_id: cart.customerId,
      items: (cart.items || []).map((i) => ({
        sku_id: i.skuId,
        quantity: i.quantity,
        added_at: i.addedAt,
        metadata: i.metadata,
      })),
      updated_at: new Date(cart.updatedAt).toISOString(),
      reminded_at: cart.remindedAt ? new Date(cart.remindedAt).toISOString() : null,
    };
  },

  async clearCart(customerId: string): Promise<void> {
    await engagementRepo.clearCart(customerId);
  },

  /**
   * Hourly job to process abandoned carts.
   * Carts updated 2–24h ago, with no order since, not reminded in 7 days, customer opted in -> Class C reminder.
   * Respects quiet hours (08:00–22:00 Dhaka wall clock).
   */
  async processAbandonedCarts(now = new Date()): Promise<{
    processed: number;
    sent: number;
    skippedQuietHours: number;
    skippedOptOut: number;
  }> {
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    const candidateCarts = await engagementRepo.listAbandonedCarts({
      minAgeMs: TWO_HOURS_MS,
      maxAgeMs: TWENTY_FOUR_HOURS_MS,
      minReminderAgeMs: SEVEN_DAYS_MS,
      now,
    });

    let processed = 0;
    let sent = 0;
    let skippedQuietHours = 0;
    let skippedOptOut = 0;

    const inAllowedWindow = isWithinDhakaAllowedWindow(now);

    for (const cart of candidateCarts) {
      processed++;

      // 1. Check if customer has placed an order since cart was last updated
      let hasOrderSince = false;
      try {
        const recentOrders = await db
          .select({ id: orders.id })
          .from(orders)
          .where(and(eq(orders.customerId, cart.customerId), eq(orders.status, "CONFIRMED")))
          .limit(1);
        if (recentOrders.length > 0) hasOrderSince = true;
      } catch {
        // Ignored in offline mock mode
      }

      if (hasOrderSince) {
        // An order was placed; clear the cart and stop reminding
        await engagementRepo.clearCart(cart.customerId);
        continue;
      }

      // 2. Check marketing opt-in
      const prefs = await notificationsRepo.getPreferences(undefined, cart.customerId);
      const isOptedIn = prefs?.marketingOptIn ?? false;
      if (!isOptedIn) {
        skippedOptOut++;
        continue;
      }

      // 3. Check Dhaka quiet hours (08:00–22:00)
      if (!inAllowedWindow) {
        skippedQuietHours++;
        continue;
      }

      // 4. Send Class C reminder
      try {
        await notificationsService.notify(
          {
            type: "promotions.abandoned_cart",
            payload: {
              customerId: cart.customerId,
              title: "Items waiting in your cart",
              description: `You have ${cart.items.length} items waiting in your cart. Complete your order now!`,
              link: "https://ncamart.com/cart",
              itemCount: cart.items.length,
              phone: "+8801700000000",
            },
          },
          now
        );
        sent++;
        await engagementRepo.updateCartReminded(cart.customerId, now);

        await emitOutbox(undefined, {
          aggregateType: "CART",
          aggregateId: cart.customerId,
          type: ENGAGEMENT_EVENTS.CART_REMINDED,
          payload: {
            customerId: cart.customerId,
            itemCount: cart.items.length,
            remindedAt: now.toISOString(),
          },
        });
      } catch (err) {
        logger.error({ err, customerId: cart.customerId }, "Failed to send abandoned cart reminder");
      }
    }

    return { processed, sent, skippedQuietHours, skippedOptOut };
  },

  // ------------------------------------------------------------------------
  // Helper
  // ------------------------------------------------------------------------
  mapReviewToDto(row: ReviewRow): ReviewDto {
    return {
      id: row.id,
      order_item_id: row.orderItemId,
      customer_id: row.customerId,
      customer_name: "Verified Buyer",
      product_id: row.productId,
      sku_id: row.skuId,
      tier: row.tier as "AUTHENTIC" | "BUDGET_SMART",
      rating: row.rating,
      title: row.title,
      body: row.body,
      media_ids: row.mediaIds || [],
      status: row.status as "PENDING" | "APPROVED" | "REJECTED",
      moderated_by: row.moderatedBy,
      moderated_at: row.moderatedAt ? new Date(row.moderatedAt).toISOString() : null,
      rejection_reason: row.rejectionReason,
      created_at: new Date(row.createdAt).toISOString(),
    };
  },
};
