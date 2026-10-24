import crypto from "node:crypto";
import { Tx } from "@/lib/db";
import { BusinessError, ValidationError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/ratelimit";
import { Actor } from "@/lib/http/route";
import { catalogService } from "@/modules/catalog";
import { sourcingService } from "@/modules/sourcing";
import { inventoryService } from "@/modules/inventory";
import { promotionsService } from "@/modules/promotions";
import { authService } from "@/modules/identity";
import { priceCart, DEFAULT_PRICING_CONFIG } from "./pricing/cart";
import { CouponRule } from "./pricing/types";
import { orderDepositPaisa } from "./pricing/deposit";
import { codEligibility, CodEligibility } from "./policies";
import { ordersRepo } from "./repo";
import {
  CartValidateInputDto,
  CartValidateInputSchema,
  CartReserveInputDto,
  CartReserveInputSchema,
} from "./dto";
import { CartHoldRow } from "./schema";

export const PRD_MODAL_MESSAGES = {
  ERR_MIXED_CART_DISALLOWED_EN:
    "Pre-order items require a separate advance deposit and have different delivery timelines. Please checkout regular items first or clear your cart.",
  ERR_MIXED_CART_DISALLOWED_BN:
    "প্রি-অর্ডার আইটেমগুলোর জন্য অগ্রিম ডিপোজিট প্রয়োজন এবং এগুলোর ডেলিভারি সময়সীমা ভিন্ন। অনুগ্রহ করে নিয়মিত পণ্যগুলো আগে চেকআউট করুন অথবা আপনার কার্ট পরিবর্তন করুন।",
} as const;

export type LineUnavailabilityReason =
  | "NOT_FOUND"
  | "UNPUBLISHED"
  | "OUT_OF_STOCK"
  | "QTY_EXCEEDS_CAP";

export interface AllocationPreview {
  source: "PHYSICAL" | "VIRTUAL" | "UNAVAILABLE";
  location_code?: string;
  available_qty?: number;
}

export interface ValidatedCartLine {
  sku_id: string;
  title_en: string;
  quantity: number;
  unit_price_paisa: number;
  allocated_discount_paisa: number;
  total_price_paisa: number;
  available: true;
  allocation_preview: AllocationPreview;
}

export interface UnavailableCartLine {
  sku_id: string;
  quantity: number;
  available: false;
  reason: LineUnavailabilityReason;
  available_qty?: number;
}

export interface CartValidationResult {
  order_type: "REGULAR_DROP_PACK" | "PRE_ORDER";
  items: ValidatedCartLine[];
  unavailable_items: UnavailableCartLine[];
  coupon: {
    applied: boolean;
    code: string | null;
    discount_paisa: number;
    reason_if_not: string | null;
  };
  financial_breakup: {
    subtotal_paisa: number;
    discount_paisa: number;
    delivery_fee_dhaka_paisa: number;
    delivery_fee_nationwide_paisa: number;
    delivery_fee_selected_paisa: number;
    vat_total_paisa: number;
    payable_subtotal_paisa: number;
    total_payable_paisa: number;
  };
  pre_order?: {
    deposit_paisa: number;
    balance_paisa: number;
    balance_cod_allowed: boolean;
    eta_range: {
      min_days: number;
      max_days: number;
      estimated_delivery_from: string;
      estimated_delivery_to: string;
    };
  };
  customer_context?: {
    cod_eligibility: CodEligibility;
    allowed_payment_modes: string[];
    store_credit_balance_paisa: number;
  };
}

/**
 * Calculates delivery fee for a given zone and total weight.
 */
export function calculateDeliveryFee(
  zone: "INSIDE_DHAKA" | "OUTSIDE_DHAKA",
  totalWeightGrams: number,
  channel: "COURIER" | "PICKUP" | "WALK_IN" = "COURIER"
): number {
  if (channel !== "COURIER") {
    return 0;
  }

  const base =
    zone === "INSIDE_DHAKA"
      ? DEFAULT_PRICING_CONFIG.deliveryBaseDhakaPaisa
      : DEFAULT_PRICING_CONFIG.deliveryBaseOutsidePaisa;

  const baseWeight = DEFAULT_PRICING_CONFIG.deliveryBaseWeightGrams;
  if (totalWeightGrams > baseWeight) {
    const extraKg = Math.ceil((totalWeightGrams - baseWeight) / 1000);
    return base + extraKg * DEFAULT_PRICING_CONFIG.deliverySurchargePerKgPaisa;
  }

  return base;
}

/**
 * Validates a cart statelessly (PRD §3.3.1, §3.6.3; api-spec §5.1).
 * Zero client trust: Authoritative SKU loading, real-time availability & allocation preview,
 * mixed-cart rejection, server-side pricing, and coupon verification.
 */
export async function validateCart(
  tx: Tx | undefined,
  rawInput: CartValidateInputDto,
  actor?: Actor
): Promise<CartValidationResult> {
  const input = CartValidateInputSchema.parse(rawInput);

  if (!input.items || input.items.length === 0) {
    throw new ValidationError("Cart must contain at least one item");
  }

  const validatedLines: Array<{
    sku: Awaited<ReturnType<typeof catalogService.getSkuById>> & object;
    product: NonNullable<Awaited<ReturnType<typeof catalogService.getProductById>>>;
    quantity: number;
    allocation: AllocationPreview;
  }> = [];

  const unavailableLines: UnavailableCartLine[] = [];

  // 1. Authoritative SKU Loading & Availability Checking
  for (const item of input.items) {
    if (!item.sku_id || item.quantity <= 0) {
      unavailableLines.push({
        sku_id: item.sku_id,
        quantity: item.quantity,
        available: false,
        reason: "QTY_EXCEEDS_CAP",
      });
      continue;
    }

    let sku = await catalogService.getSkuById(item.sku_id);
    if (!sku) {
      sku = await catalogService.getSkuByCode(item.sku_id);
    }

    if (!sku) {
      unavailableLines.push({
        sku_id: item.sku_id,
        quantity: item.quantity,
        available: false,
        reason: "NOT_FOUND",
      });
      continue;
    }

    if (!sku.isActive) {
      unavailableLines.push({
        sku_id: item.sku_id,
        quantity: item.quantity,
        available: false,
        reason: "UNPUBLISHED",
      });
      continue;
    }

    const product = await catalogService.getProductById(sku.productId);
    if (!product || product.status !== "PUBLISHED") {
      unavailableLines.push({
        sku_id: item.sku_id,
        quantity: item.quantity,
        available: false,
        reason: "UNPUBLISHED",
      });
      continue;
    }

    if (sku.dailyOrderCap && item.quantity > sku.dailyOrderCap) {
      unavailableLines.push({
        sku_id: item.sku_id,
        quantity: item.quantity,
        available: false,
        reason: "QTY_EXCEEDS_CAP",
        available_qty: sku.dailyOrderCap,
      });
      continue;
    }

    // Availability / Sourcing logic
    const isPreOrderProduct = product.fulfillmentType === "PRE_ORDER";
    if (!isPreOrderProduct) {
      // Check physical balances across sellable locations
      const sellableBalances = await inventoryService.getSellableBalancesForSkus(
        [sku.id],
        tx
      );
      const sellableOnHand = sellableBalances[0]?.sellableOnHand ?? 0;
      const sellableReserved = sellableBalances[0]?.sellableReserved ?? 0;
      const physicalAvailable = Math.max(0, sellableOnHand - sellableReserved);

      if (physicalAvailable >= item.quantity) {
        // Physical stock available
        const channelPref = input.fulfillment_channel ?? "COURIER";
        const locCode =
          channelPref === "PICKUP" || channelPref === "WALK_IN"
            ? "SHOWROOM_COUNTER"
            : "GODOWN_NAWABPUR";

        validatedLines.push({
          sku,
          product,
          quantity: item.quantity,
          allocation: {
            source: "PHYSICAL",
            location_code: locCode,
            available_qty: physicalAvailable,
          },
        });
      } else {
        // Fallback: check virtual sourcing
        const isVirtual = await sourcingService.isSkuVirtuallyAvailable(sku.id);
        if (isVirtual) {
          validatedLines.push({
            sku,
            product,
            quantity: item.quantity,
            allocation: {
              source: "VIRTUAL",
              available_qty: physicalAvailable,
            },
          });
        } else if (physicalAvailable > 0) {
          unavailableLines.push({
            sku_id: item.sku_id,
            quantity: item.quantity,
            available: false,
            reason: "QTY_EXCEEDS_CAP",
            available_qty: physicalAvailable,
          });
        } else {
          unavailableLines.push({
            sku_id: item.sku_id,
            quantity: item.quantity,
            available: false,
            reason: "OUT_OF_STOCK",
            available_qty: 0,
          });
        }
      }
    } else {
      // PRE_ORDER fulfillment
      validatedLines.push({
        sku,
        product,
        quantity: item.quantity,
        allocation: {
          source: "PHYSICAL", // Flash deal or factory order
          available_qty: 999,
        },
      });
    }
  }

  // 2. Mixed Cart Check across valid lines (PRD §3.3.1)
  if (validatedLines.length > 0) {
    const hasPreOrder = validatedLines.some(
      (l) => l.product.fulfillmentType === "PRE_ORDER"
    );
    const hasRegular = validatedLines.some(
      (l) => l.product.fulfillmentType !== "PRE_ORDER"
    );

    if (hasPreOrder && hasRegular) {
      const rejectedSkus = validatedLines
        .filter((l) => l.product.fulfillmentType === "PRE_ORDER")
        .map((l) => l.sku.id);

      throw new BusinessError(
        "ERR_MIXED_CART_DISALLOWED",
        PRD_MODAL_MESSAGES.ERR_MIXED_CART_DISALLOWED_EN,
        {
          message_en: PRD_MODAL_MESSAGES.ERR_MIXED_CART_DISALLOWED_EN,
          message_bn: PRD_MODAL_MESSAGES.ERR_MIXED_CART_DISALLOWED_BN,
          rejected_skus: rejectedSkus,
        }
      );
    }
  }

  // If no lines could be validated, subtotal is 0
  const orderType: "REGULAR_DROP_PACK" | "PRE_ORDER" =
    validatedLines.some((l) => l.product.fulfillmentType === "PRE_ORDER")
      ? "PRE_ORDER"
      : "REGULAR_DROP_PACK";

  // 3. Coupon Verification
  let couponRule: CouponRule | undefined = undefined;
  let couponApplied = false;
  let couponDiscountPaisa = 0;
  let couponReasonIfNot: string | null = null;
  const couponCode = input.coupon_code ? input.coupon_code.toUpperCase().trim() : null;

  if (couponCode) {
    const foundCoupon = await promotionsService.getCouponByCode(couponCode);
    const now = new Date();

    if (!foundCoupon) {
      couponReasonIfNot = "NOT_FOUND";
    } else if (foundCoupon.status !== "ACTIVE") {
      couponReasonIfNot = "INACTIVE";
    } else if (now < foundCoupon.startsAt || now > foundCoupon.endsAt) {
      couponReasonIfNot = "EXPIRED";
    } else if (
      foundCoupon.usageLimit &&
      foundCoupon.usageLimit > 0
    ) {
      const totalUsage = await promotionsService.countCouponUsage(
        tx,
        foundCoupon.id
      );
      if (totalUsage >= foundCoupon.usageLimit) {
        couponReasonIfNot = "USAGE_LIMIT_EXCEEDED";
      }
    }

    if (!couponReasonIfNot && foundCoupon) {
      // Check customer phone limit if actor is customer
      if (actor && actor.type === "customer") {
        const customer = await authService.findCustomerById(actor.id);
        if (customer) {
          const phoneUsage = await promotionsService.countPhoneCouponUsage(
            tx,
            foundCoupon.id,
            customer.phone
          );
          if (phoneUsage >= foundCoupon.perPhoneLimit) {
            couponReasonIfNot = "PER_PHONE_LIMIT_EXCEEDED";
          }
        }
      }
    }

    if (!couponReasonIfNot && foundCoupon) {
      couponRule = {
        code: foundCoupon.code,
        type: foundCoupon.type === "PERCENT" ? "PERCENTAGE" : "FIXED",
        value: foundCoupon.value,
        minOrderValuePaisa: foundCoupon.minOrderPaisa ?? 0,
        maxDiscountPaisa: foundCoupon.maxDiscountPaisa ?? undefined,
        scope: {
          tiers:
            foundCoupon.scopeType === "TIER" && foundCoupon.scopeValues
              ? (foundCoupon.scopeValues as Array<"AUTHENTIC" | "BUDGET_SMART">)
              : undefined,
          categoryIds:
            foundCoupon.scopeType === "CATEGORY" && foundCoupon.scopeValues
              ? foundCoupon.scopeValues
              : undefined,
          skuIds:
            foundCoupon.scopeType === "SKU" && foundCoupon.scopeValues
              ? foundCoupon.scopeValues
              : undefined,
        },
      };
    }
  }

  // 4. Server-Side Pricing (Pure Function priceCart)
  let pricedItems: ValidatedCartLine[] = [];
  let subtotalPaisa = 0;
  let totalDiscountPaisa = 0;
  let vatTotalPaisa = 0;
  let payableSubtotalPaisa = 0;
  let totalWeightGrams = 0;

  if (validatedLines.length > 0) {
    const pricingLines = validatedLines.map((vl) => {
      totalWeightGrams += (vl.sku.weightGrams || 0) * vl.quantity;
      return {
        skuId: vl.sku.id,
        qty: vl.quantity,
        unitPricePaisa: vl.sku.pricePaisa, // Server authoritative!
        vatRateBp: vl.product.vatRateBp,
        tier: vl.product.productTier as "AUTHENTIC" | "BUDGET_SMART",
        categoryId: vl.product.categoryId,
        fulfillmentType: (vl.product.fulfillmentType === "PRE_ORDER"
          ? "PRE_ORDER"
          : "REGULAR_DROP_PACK") as "REGULAR_DROP_PACK" | "PRE_ORDER",
        weightGrams: vl.sku.weightGrams,
      };
    });

    const pricedCart = priceCart({
      lines: pricingLines,
      coupon: couponRule,
      channel: (input.fulfillment_channel as "COURIER" | "PICKUP" | "WALK_IN") ?? "COURIER",
      deliveryZone: input.delivery_zone ?? "INSIDE_DHAKA",
      storeCreditPaisa: input.store_credit_paisa ?? 0,
    });

    subtotalPaisa = pricedCart.totals.subtotalPaisa;
    totalDiscountPaisa = pricedCart.totals.discountPaisa;
    vatTotalPaisa = pricedCart.totals.vatTotalPaisa;
    payableSubtotalPaisa = pricedCart.totals.subtotalPaisa - pricedCart.totals.discountPaisa;

    if (couponRule) {
      if (pricedCart.totals.discountPaisa > 0) {
        couponApplied = true;
        couponDiscountPaisa = pricedCart.totals.discountPaisa;
      } else {
        couponApplied = false;
        couponReasonIfNot = "NO_ELIGIBLE_ITEMS";
      }
    }

    pricedItems = validatedLines.map((vl, idx) => {
      const pl = pricedCart.lines[idx]!;
      return {
        sku_id: vl.sku.id,
        title_en: vl.product.titleEn,
        quantity: vl.quantity,
        unit_price_paisa: vl.sku.pricePaisa,
        allocated_discount_paisa: pl.discountPaisa,
        total_price_paisa: pl.netPaisa,
        available: true,
        allocation_preview: vl.allocation,
      };
    });
  }

  // 5. Dual Delivery Fees (Dhaka & Nationwide)
  const deliveryFeeDhaka = calculateDeliveryFee(
    "INSIDE_DHAKA",
    totalWeightGrams,
    input.fulfillment_channel ?? "COURIER"
  );
  const deliveryFeeNationwide = calculateDeliveryFee(
    "OUTSIDE_DHAKA",
    totalWeightGrams,
    input.fulfillment_channel ?? "COURIER"
  );

  const selectedZone = input.delivery_zone ?? "INSIDE_DHAKA";
  const selectedDeliveryFee =
    selectedZone === "INSIDE_DHAKA" ? deliveryFeeDhaka : deliveryFeeNationwide;

  const totalPayablePaisa = payableSubtotalPaisa + selectedDeliveryFee;

  // 6. Pre-Order Calculations
  let preOrderInfo: CartValidationResult["pre_order"] = undefined;
  if (orderType === "PRE_ORDER" && pricedItems.length > 0) {
    const depositLines = pricedItems.map((pi) => ({
      unitPricePaisa: Math.floor(pi.total_price_paisa / pi.quantity),
      qty: pi.quantity,
    }));
    const depositPaisa = orderDepositPaisa(depositLines);
    const balancePaisa = Math.max(0, totalPayablePaisa - depositPaisa);

    const minDays = Math.max(
      ...validatedLines.map((vl) => vl.product.preorderEtaDaysMin ?? 14)
    );
    const maxDays = Math.max(
      ...validatedLines.map((vl) => vl.product.preorderEtaDaysMax ?? 21)
    );

    const now = new Date();
    const etaFrom = new Date(now.getTime() + minDays * 86400 * 1000);
    const etaTo = new Date(now.getTime() + maxDays * 86400 * 1000);

    const balanceCodAllowed =
      balancePaisa <= DEFAULT_PRICING_CONFIG.preorderCodBalanceMaxPaisa;

    preOrderInfo = {
      deposit_paisa: depositPaisa,
      balance_paisa: balancePaisa,
      balance_cod_allowed: balanceCodAllowed,
      eta_range: {
        min_days: minDays,
        max_days: maxDays,
        estimated_delivery_from: etaFrom.toISOString(),
        estimated_delivery_to: etaTo.toISOString(),
      },
    };
  }

  // 7. Logged-in Customer Context
  let customerContext: CartValidationResult["customer_context"] = undefined;
  if (actor && actor.type === "customer") {
    const customer = await authService.findCustomerById(actor.id);
    if (customer) {
      const codElig = codEligibility({
        deliveredCount: customer.deliveredOrderCount,
        rtoCount12m: customer.rtoCount12m,
        codBlocked: customer.codBlocked,
      });

      const allowedPaymentModes: string[] = ["ONLINE_FULL"];
      if (orderType === "REGULAR_DROP_PACK") {
        if (codElig !== "COD_BLOCKED") {
          allowedPaymentModes.push("COD");
        }
      } else {
        // Pre-order allows COD for balance only if under max threshold and not blocked
        if (
          codElig !== "COD_BLOCKED" &&
          preOrderInfo &&
          preOrderInfo.balance_cod_allowed
        ) {
          allowedPaymentModes.push("COD");
        }
      }

      if (input.fulfillment_channel === "PICKUP" || input.fulfillment_channel === "WALK_IN") {
        allowedPaymentModes.push("PAY_AT_COUNTER");
      }

      let storeCreditBalancePaisa = 0;
      try {
        const bal = await promotionsService.getStoreCreditBalance(
          tx,
          customer.id
        );
        storeCreditBalancePaisa = bal.totalBalancePaisa;
      } catch {
        // Fallback
      }

      customerContext = {
        cod_eligibility: codElig,
        allowed_payment_modes: allowedPaymentModes,
        store_credit_balance_paisa: storeCreditBalancePaisa,
      };
    }
  }

  return {
    order_type: orderType,
    items: pricedItems,
    unavailable_items: unavailableLines,
    coupon: {
      applied: couponApplied,
      code: couponCode,
      discount_paisa: couponDiscountPaisa,
      reason_if_not: couponReasonIfNot,
    },
    financial_breakup: {
      subtotal_paisa: subtotalPaisa,
      discount_paisa: totalDiscountPaisa,
      delivery_fee_dhaka_paisa: deliveryFeeDhaka,
      delivery_fee_nationwide_paisa: deliveryFeeNationwide,
      delivery_fee_selected_paisa: selectedDeliveryFee,
      vat_total_paisa: vatTotalPaisa,
      payable_subtotal_paisa: payableSubtotalPaisa,
      total_payable_paisa: totalPayablePaisa,
    },
    pre_order: preOrderInfo,
    customer_context: customerContext,
  };
}

/**
 * Pre-checkout stock reservation (cart hold) for physical items (PRD §3.6.3; api-spec §5.2).
 * Rate limit: 30 requests/minute per device.
 * Creates cart_holds record with 10-minute (600s) expiry and atomic stock_reservations.
 */
export async function reserveCart(
  tx: Tx | undefined,
  rawInput: CartReserveInputDto,
  deviceId: string,
  actor?: Actor
): Promise<{
  success: boolean;
  reservation_id: string;
  expires_at: string;
  duration_seconds: number;
}> {
  const input = CartReserveInputSchema.parse(rawInput);

  if (!deviceId || deviceId.trim().length === 0) {
    throw new ValidationError("Device ID is required for cart hold reservation");
  }

  // Rate Limiting: 30 requests/minute per device
  const rl = await checkRateLimit(`cart_reserve:${deviceId}`, 30, 60);
  if (!rl.allowed) {
    throw new BusinessError(
      "ERR_RATE_LIMITED",
      "Too many stock reservation requests. Please try again later.",
      { retry_after_sec: rl.retryAfterSec }
    );
  }

  // Check physical stock sufficiency for each item
  const insufficientItems: Array<{
    sku_id: string;
    requested_qty: number;
    available_qty: number;
  }> = [];

  const locationPrefs: Array<"GODOWN_NAWABPUR" | "SHOWROOM_COUNTER"> =
    input.fulfillment_channel === "PICKUP" || input.fulfillment_channel === "WALK_IN"
      ? ["SHOWROOM_COUNTER", "GODOWN_NAWABPUR"]
      : ["GODOWN_NAWABPUR", "SHOWROOM_COUNTER"];

  for (const item of input.items) {
    let sku = await catalogService.getSkuById(item.sku_id);
    if (!sku) {
      sku = await catalogService.getSkuByCode(item.sku_id);
    }
    if (!sku) {
      insufficientItems.push({
        sku_id: item.sku_id,
        requested_qty: item.quantity,
        available_qty: 0,
      });
      continue;
    }

    const balances = await inventoryService.getSellableBalancesForSkus([sku.id], tx);
    const onHand = balances[0]?.sellableOnHand ?? 0;
    const reserved = balances[0]?.sellableReserved ?? 0;
    const available = Math.max(0, onHand - reserved);

    if (available < item.quantity) {
      insufficientItems.push({
        sku_id: item.sku_id,
        requested_qty: item.quantity,
        available_qty: available,
      });
    }
  }

  if (insufficientItems.length > 0) {
    throw new BusinessError(
      "ERR_INSUFFICIENT_STOCK",
      `Only ${insufficientItems[0]?.available_qty ?? 0} units available for reservation`,
      { items: insufficientItems }
    );
  }

  // Create Cart Hold Record
  const holdId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 600 * 1000); // 10 minutes = 600s
  const customerId = actor && actor.type === "customer" ? actor.id : null;

  const cartHold = await ordersRepo.createCartHold(tx, {
    id: holdId,
    deviceId,
    customerId,
    expiresAt,
    status: "ACTIVE",
  });

  // Acquire stock reservations linked to cart_hold_id
  for (const item of input.items) {
    let sku = await catalogService.getSkuById(item.sku_id);
    if (!sku) {
      sku = await catalogService.getSkuByCode(item.sku_id);
    }
    if (!sku) continue;

    const res = await inventoryService.reserve(tx, {
      cartHoldId: cartHold.id,
      skuId: sku.id,
      qty: item.quantity,
      locationPreference: locationPrefs,
    });

    if (!res) {
      // Rollback reservation if a concurrent reservation raced us
      await inventoryService.release(tx, { cartHoldId: cartHold.id });
      await ordersRepo.updateCartHold(tx, cartHold.id, { status: "RELEASED" });
      throw new BusinessError(
        "ERR_INSUFFICIENT_STOCK",
        "Insufficient stock available during reservation lock",
        { skuId: sku.id }
      );
    }
  }

  return {
    success: true,
    reservation_id: cartHold.id,
    expires_at: cartHold.expiresAt.toISOString(),
    duration_seconds: 600,
  };
}

/**
 * Converts a Cart Hold into an Order (P20 Checkout integration).
 * Reassigns all active reservations from cartHoldId to orderId without releasing inventory locks.
 */
export async function convertCartHoldToOrder(
  tx: Tx | undefined,
  cartHoldId: string,
  orderId: string
): Promise<{ convertedCount: number; hold: CartHoldRow }> {
  const hold = await ordersRepo.getCartHoldById(tx, cartHoldId);
  if (!hold) {
    throw new BusinessError("ERR_NOT_FOUND", "Cart hold not found", { cartHoldId });
  }

  if (hold.status !== "ACTIVE") {
    throw new BusinessError(
      "ERR_BUSINESS_RULE",
      `Cannot convert cart hold in status '${hold.status}'`,
      { status: hold.status }
    );
  }

  if (hold.expiresAt < new Date()) {
    await ordersRepo.updateCartHold(tx, cartHoldId, { status: "EXPIRED" });
    throw new BusinessError(
      "ERR_BUSINESS_RULE",
      "Cart hold reservation has expired",
      { expiresAt: hold.expiresAt }
    );
  }

  const converted = await inventoryService.convertCartHoldReservations(
    cartHoldId,
    orderId,
    tx
  );

  const updatedHold = await ordersRepo.updateCartHold(tx, cartHoldId, {
    status: "CONVERTED",
  });

  return {
    convertedCount: converted.length,
    hold: updatedHold,
  };
}

/**
 * Releases a cart hold and frees all held stock.
 */
export async function releaseCartHold(
  tx: Tx | undefined,
  cartHoldId: string
): Promise<{ releasedCount: number }> {
  const releasedCount = await inventoryService.release(tx, { cartHoldId });
  try {
    await ordersRepo.updateCartHold(tx, cartHoldId, { status: "RELEASED" });
  } catch {
    // If already removed or not found
  }
  return { releasedCount };
}
