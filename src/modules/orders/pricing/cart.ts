import { assertPaisa, sumPaisa, type Paisa } from "@/lib/money";
import { largestRemainderAllocate } from "@/lib/allocation";
import { vatFromInclusive } from "@/lib/vat";
import { BusinessError, ValidationError } from "@/lib/errors";
import {
  PriceCartInput,
  PricedCart,
  PricedCartLine,
  CartLineInput,
  CouponScope,
} from "./types";

export const DEFAULT_PRICING_CONFIG = {
  deliveryBaseDhakaPaisa: 8000, // ৳80
  deliveryBaseOutsidePaisa: 15000, // ৳150
  deliveryBaseWeightGrams: 1000, // 1 kg
  deliverySurchargePerKgPaisa: 2000, // ৳20
  preorderCodBalanceMaxPaisa: 3000000, // ৳30,000
} as const;

/**
 * Checks whether a cart line matches the scope criteria of a coupon.
 */
export function isLineEligibleForCoupon(line: CartLineInput, scope?: CouponScope): boolean {
  if (!scope) return true;
  if (scope.tiers && scope.tiers.length > 0 && !scope.tiers.includes(line.tier)) {
    return false;
  }
  if (scope.categoryIds && scope.categoryIds.length > 0 && !scope.categoryIds.includes(line.categoryId)) {
    return false;
  }
  if (scope.skuIds && scope.skuIds.length > 0 && !scope.skuIds.includes(line.skuId)) {
    return false;
  }
  return true;
}

/**
 * Pure calculation function for pricing a cart of lines.
 * Enforces single fulfillment type, applies coupons pro-rata across eligible lines,
 * calculates delivery fees by zone and weight, applies store credit, and breaks down VAT.
 */
export function priceCart(input: PriceCartInput): PricedCart {
  const { lines, coupon, channel, storeCreditPaisa = 0, config: userConfig } = input;

  if (!lines || lines.length === 0) {
    throw new ValidationError("Cart must contain at least one line");
  }

  const firstLine = lines[0];
  if (!firstLine) {
    throw new ValidationError("Cart must contain at least one line");
  }

  // 1. Mixed-cart check: all lines must have the same fulfillmentType
  const firstFulfillment = firstLine.fulfillmentType;
  const hasMixed = lines.some((l) => l.fulfillmentType !== firstFulfillment);
  if (hasMixed) {
    const hasPreOrder = lines.some((l) => l.fulfillmentType === "PRE_ORDER");
    const rejectedSkus = hasPreOrder
      ? lines.filter((l) => l.fulfillmentType === "PRE_ORDER").map((l) => l.skuId)
      : lines.filter((l) => l.fulfillmentType !== firstFulfillment).map((l) => l.skuId);

    throw new BusinessError(
      "ERR_MIXED_CART_DISALLOWED",
      "Pre-order items and regular drop-and-pack items cannot be checked out together in the same cart",
      { rejected_skus: rejectedSkus }
    );
  }

  const fulfillmentType = firstFulfillment;
  const config = { ...DEFAULT_PRICING_CONFIG, ...userConfig };

  // 2. Line Gross calculations
  const lineGrosses: Paisa[] = lines.map((l) => {
    if (!Number.isSafeInteger(l.qty) || l.qty <= 0) {
      throw new ValidationError(`Invalid quantity for SKU ${l.skuId}: ${l.qty}`);
    }
    if (!Number.isSafeInteger(l.unitPricePaisa) || l.unitPricePaisa < 0) {
      throw new ValidationError(`Invalid unit price for SKU ${l.skuId}: ${l.unitPricePaisa}`);
    }
    return assertPaisa(l.unitPricePaisa * l.qty);
  });

  const cartGrossSubtotal = sumPaisa(lineGrosses);

  // 3. Coupon evaluation & pro-rata allocation
  const lineDiscounts: Paisa[] = new Array(lines.length).fill(0 as Paisa);
  let totalDiscountPaisa = 0 as Paisa;

  if (coupon) {
    const eligibleIndices: number[] = [];
    let eligibleGross = 0;

    lines.forEach((line, idx) => {
      if (isLineEligibleForCoupon(line, coupon.scope)) {
        eligibleIndices.push(idx);
        eligibleGross += lineGrosses[idx] ?? 0;
      }
    });

    const minOrderMet = !coupon.minOrderValuePaisa || cartGrossSubtotal >= coupon.minOrderValuePaisa;

    if (minOrderMet && eligibleIndices.length > 0 && eligibleGross > 0) {
      let rawDiscount = 0;

      if (coupon.type === "FIXED") {
        rawDiscount = Math.min(coupon.value, eligibleGross);
      } else if (coupon.type === "PERCENTAGE") {
        rawDiscount = Math.floor((eligibleGross * coupon.value) / 10000);
      }

      if (coupon.maxDiscountPaisa !== undefined && coupon.maxDiscountPaisa >= 0) {
        rawDiscount = Math.min(rawDiscount, coupon.maxDiscountPaisa);
      }

      rawDiscount = Math.min(rawDiscount, eligibleGross);

      if (rawDiscount > 0) {
        totalDiscountPaisa = assertPaisa(rawDiscount);
        const eligibleWeights = eligibleIndices.map((idx) => lineGrosses[idx] ?? 0);
        const allocated = largestRemainderAllocate(totalDiscountPaisa, eligibleWeights);

        eligibleIndices.forEach((lineIdx, i) => {
          const alloc = allocated[i];
          if (alloc !== undefined) {
            lineDiscounts[lineIdx] = alloc;
          }
        });
      }
    }
  }

  // 4. Per-line net, VAT split, and effective unit price
  const pricedLines: PricedCartLine[] = lines.map((line, idx) => {
    const grossPaisa = lineGrosses[idx] ?? (0 as Paisa);
    const discountPaisa = lineDiscounts[idx] ?? (0 as Paisa);
    const netPaisa = assertPaisa(grossPaisa - discountPaisa);
    const vatSplit = vatFromInclusive(netPaisa, line.vatRateBp);
    const effectiveUnitPricePaisa = assertPaisa(Math.floor(netPaisa / line.qty));

    return {
      skuId: line.skuId,
      qty: line.qty,
      unitPricePaisa: assertPaisa(line.unitPricePaisa),
      vatRateBp: line.vatRateBp,
      tier: line.tier,
      categoryId: line.categoryId,
      fulfillmentType: line.fulfillmentType,
      weightGrams: line.weightGrams,
      grossPaisa,
      discountPaisa,
      netPaisa,
      vatPaisa: vatSplit.vatPaisa,
      exVatPaisa: vatSplit.netPaisa,
      effectiveUnitPricePaisa,
    };
  });

  const totalProductNetPaisa = sumPaisa(pricedLines.map((l) => l.netPaisa));
  const vatTotalPaisa = sumPaisa(pricedLines.map((l) => l.vatPaisa));

  // 5. Delivery fee calculation (COURIER only)
  let totalWeightGrams = 0;
  for (const line of lines) {
    totalWeightGrams += (line.weightGrams || 0) * line.qty;
  }

  let baseFeePaisa = 0 as Paisa;
  let weightSurchargePaisa = 0 as Paisa;
  let totalDeliveryFeePaisa = 0 as Paisa;

  if (channel === "COURIER") {
    const zone = input.deliveryZone ?? "INSIDE_DHAKA";
    baseFeePaisa = assertPaisa(
      zone === "INSIDE_DHAKA"
        ? config.deliveryBaseDhakaPaisa
        : config.deliveryBaseOutsidePaisa
    );

    const baseWeight = config.deliveryBaseWeightGrams;
    if (totalWeightGrams > baseWeight) {
      const extraGrams = totalWeightGrams - baseWeight;
      const extraKg = Math.ceil(extraGrams / 1000);
      weightSurchargePaisa = assertPaisa(extraKg * config.deliverySurchargePerKgPaisa);
    }

    totalDeliveryFeePaisa = assertPaisa(baseFeePaisa + weightSurchargePaisa);
  }

  // 6. Store credit application:
  // Capped at total product net amount; NEVER applied to delivery fee or advance fee
  const requestedCredit = Math.max(0, storeCreditPaisa);
  const storeCreditAppliedPaisa = assertPaisa(
    Math.min(requestedCredit, totalProductNetPaisa)
  );

  // 7. Totals aggregation
  const totalPayablePaisa = assertPaisa(totalProductNetPaisa + totalDeliveryFeePaisa);
  const amountDuePaisa = assertPaisa(totalPayablePaisa - storeCreditAppliedPaisa);

  return {
    fulfillmentType,
    lines: pricedLines,
    couponApplied:
      coupon && totalDiscountPaisa > 0
        ? { code: coupon.code, discountPaisa: totalDiscountPaisa }
        : undefined,
    delivery: {
      channel,
      zone: input.deliveryZone,
      totalWeightGrams,
      baseFeePaisa,
      weightSurchargePaisa,
      totalDeliveryFeePaisa,
    },
    totals: {
      subtotalPaisa: cartGrossSubtotal,
      discountPaisa: totalDiscountPaisa,
      deliveryFeePaisa: totalDeliveryFeePaisa,
      vatTotalPaisa,
      totalPayablePaisa,
      storeCreditAppliedPaisa,
      amountDuePaisa,
    },
  };
}
