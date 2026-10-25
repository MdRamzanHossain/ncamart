import { z } from "zod";
import { ReviewStatus, StockAlertStatus } from "./schema";

// --------------------------------------------------------------------------
// Review DTOs & Validation Schemas
// --------------------------------------------------------------------------
export const createReviewSchema = z.object({
  order_item_id: z.string().uuid("Invalid order_item_id format"),
  rating: z.coerce.number().int().min(1, "Rating must be between 1 and 5").max(5, "Rating must be between 1 and 5"),
  title: z.string().trim().max(120, "Title cannot exceed 120 characters").optional(),
  body: z.string().trim().min(5, "Review body must be at least 5 characters").max(2000, "Review body cannot exceed 2000 characters"),
  media_ids: z.array(z.string().uuid()).max(5, "Maximum 5 photos per review").optional().default([]),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const moderateReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().max(500).optional(),
});

export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;

export interface ReviewDto {
  id: string;
  order_item_id: string;
  customer_id: string;
  customer_name?: string; // e.g. "Tanvir A." or "Verified Buyer"
  product_id: string;
  sku_id: string;
  tier: "AUTHENTIC" | "BUDGET_SMART";
  rating: number;
  title: string | null;
  body: string;
  media_ids: string[];
  status: ReviewStatus;
  moderated_by?: string | null;
  moderated_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
}

export interface RatingSummaryDto {
  average_rating: number; // e.g. 4.8
  total_reviews: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface ProductReviewsResponseDto {
  product_id: string;
  product_slug: string;
  rating_summary: RatingSummaryDto;
  reviews: ReviewDto[];
}

// --------------------------------------------------------------------------
// Wishlist DTOs & Validation Schemas
// --------------------------------------------------------------------------
export const addWishlistSchema = z.object({
  product_id: z.string().uuid("Invalid product_id format"),
  sku_id: z.string().uuid("Invalid sku_id format").nullable().optional(),
});

export type AddWishlistInput = z.infer<typeof addWishlistSchema>;

export interface WishlistItemDto {
  id: string;
  customer_id: string;
  product_id: string;
  sku_id?: string | null;
  created_at: string;
  product?: {
    id: string;
    slug: string;
    title_en: string;
    title_bn: string;
    tier: string;
    primary_image_url?: string | null;
  };
  sku?: {
    id: string;
    sku_code: string;
    price_paisa: number;
    availability?: string;
  };
}

// --------------------------------------------------------------------------
// Stock Alert DTOs
// --------------------------------------------------------------------------
export interface StockAlertSubscriptionDto {
  id: string;
  customer_id: string;
  sku_id: string;
  status: StockAlertStatus;
  created_at: string;
  notified_at?: string | null;
}

// --------------------------------------------------------------------------
// Cart DTOs & Validation Schemas
// --------------------------------------------------------------------------
export const cartItemInputSchema = z.object({
  sku_id: z.string().uuid("Invalid sku_id format"),
  quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
  added_at: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateCartSchema = z.object({
  items: z.array(cartItemInputSchema).max(50, "Cart cannot exceed 50 distinct items"),
});

export type UpdateCartInput = z.infer<typeof updateCartSchema>;

export interface CartItemDto {
  sku_id: string;
  quantity: number;
  added_at?: string;
  metadata?: Record<string, unknown>;
}

export interface CartDto {
  customer_id: string;
  items: CartItemDto[];
  updated_at: string;
  reminded_at?: string | null;
}
