import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import {
  priceCart,
  unitDepositPaisa,
  orderDepositPaisa,
  paymentPlan,
  marginCheck,
  refundableAmountForLines,
  type CartLineInput,
  type CouponRule,
  type MarginCheckInput,
  type RefundableOrder,
} from "../index";
import { AppError } from "@/lib/errors";

describe("P15 — Pricing Engine (Pure Functions)", () => {
  // --------------------------------------------------------------------------
  // 1. priceCart
  // --------------------------------------------------------------------------
  describe("1. priceCart", () => {
    const regularLine1: CartLineInput = {
      skuId: "sku-cable-01",
      qty: 2,
      unitPricePaisa: 50000, // ৳500
      vatRateBp: 1500, // 15%
      tier: "AUTHENTIC",
      categoryId: "cat-cables",
      fulfillmentType: "REGULAR_DROP_PACK",
      weightGrams: 200,
    };

    const regularLine2: CartLineInput = {
      skuId: "sku-charger-02",
      qty: 1,
      unitPricePaisa: 120000, // ৳1,200
      vatRateBp: 1500, // 15%
      tier: "BUDGET_SMART",
      categoryId: "cat-chargers",
      fulfillmentType: "REGULAR_DROP_PACK",
      weightGrams: 300,
    };

    const preOrderLine: CartLineInput = {
      skuId: "sku-thermal-cam",
      qty: 1,
      unitPricePaisa: 8000000, // ৳80,000
      vatRateBp: 1500,
      tier: "AUTHENTIC",
      categoryId: "cat-pro-tools",
      fulfillmentType: "PRE_ORDER",
      weightGrams: 1500,
    };

    it("1.a rejects mixed carts containing both regular and pre-order items with ERR_MIXED_CART_DISALLOWED (422)", () => {
      expect(() => {
        priceCart({
          lines: [regularLine1, preOrderLine],
          channel: "COURIER",
          deliveryZone: "INSIDE_DHAKA",
        });
      }).toThrowError(AppError);

      try {
        priceCart({
          lines: [regularLine1, preOrderLine],
          channel: "COURIER",
          deliveryZone: "INSIDE_DHAKA",
        });
      } catch (err: unknown) {
        const appErr = err as AppError;
        expect(appErr.code).toBe("ERR_MIXED_CART_DISALLOWED");
        expect(appErr.status).toBe(422);
        expect(appErr.details).toHaveProperty("rejected_skus");
        expect(appErr.details.rejected_skus).toContain("sku-thermal-cam");
      }
    });

    it("1.b calculates line gross amounts (prices are VAT-inclusive)", () => {
      const result = priceCart({
        lines: [regularLine1, regularLine2],
        channel: "PICKUP",
      });

      // Line 1: 50000 * 2 = 100000 paisa (৳1,000)
      expect(result.lines[0]!.grossPaisa).toBe(100000);
      // Line 2: 120000 * 1 = 120000 paisa (৳1,200)
      expect(result.lines[1]!.grossPaisa).toBe(120000);
      expect(result.totals.subtotalPaisa).toBe(220000); // ৳2,200
    });

    it("1.c evaluates fixed coupon discount and allocates pro-rata via largestRemainderAllocate", () => {
      const coupon: CouponRule = {
        code: "FLAT300",
        type: "FIXED",
        value: 30000, // ৳300
      };

      const result = priceCart({
        lines: [regularLine1, regularLine2],
        coupon,
        channel: "PICKUP",
      });

      expect(result.totals.discountPaisa).toBe(30000);
      // Line 1 gross = 100000 (45.45%), Line 2 gross = 120000 (54.55%)
      // 30000 * 100/220 = 13636.36 -> 13636 paisa
      // 30000 * 120/220 = 16363.64 -> 16364 paisa
      const sumLineDiscounts = result.lines[0]!.discountPaisa + result.lines[1]!.discountPaisa;
      expect(sumLineDiscounts).toBe(30000);
      expect(result.lines[0]!.discountPaisa).toBe(13636);
      expect(result.lines[1]!.discountPaisa).toBe(16364);
      expect(result.lines[0]!.netPaisa).toBe(100000 - 13636);
      expect(result.lines[1]!.netPaisa).toBe(120000 - 16364);
    });

    it("1.c evaluates percentage coupon with max discount cap and tier scope restriction", () => {
      const coupon: CouponRule = {
        code: "AUTHENTIC10",
        type: "PERCENTAGE",
        value: 1000, // 10%
        maxDiscountPaisa: 8000, // ৳80 cap
        scope: {
          tiers: ["AUTHENTIC"],
        },
      };

      const result = priceCart({
        lines: [regularLine1, regularLine2], // line 1 is AUTHENTIC (gross 100,000), line 2 is BUDGET_SMART (gross 120,000)
        coupon,
        channel: "PICKUP",
      });

      // Line 1 is eligible: 10% of 100,000 = 10,000, capped at maxDiscountPaisa = 8,000
      expect(result.lines[0]!.discountPaisa).toBe(8000);
      // Line 2 is ineligible: discount = 0
      expect(result.lines[1]!.discountPaisa).toBe(0);
      expect(result.totals.discountPaisa).toBe(8000);
    });

    it("1.c respects minimum order value condition on coupon", () => {
      const coupon: CouponRule = {
        code: "BIGORDER",
        type: "FIXED",
        value: 50000,
        minOrderValuePaisa: 500000, // ৳5,000 min order
      };

      const result = priceCart({
        lines: [regularLine1, regularLine2], // Subtotal is 220000 (৳2,200) < ৳5,000
        coupon,
        channel: "PICKUP",
      });

      expect(result.totals.discountPaisa).toBe(0);
      expect(result.lines[0]!.discountPaisa).toBe(0);
      expect(result.lines[1]!.discountPaisa).toBe(0);
    });

    it("1.d calculates VAT split per line on net amounts with vatFromInclusive", () => {
      const result = priceCart({
        lines: [
          {
            skuId: "sku-1",
            qty: 1,
            unitPricePaisa: 11500, // ৳115 with 15% VAT
            vatRateBp: 1500,
            tier: "AUTHENTIC",
            categoryId: "c1",
            fulfillmentType: "REGULAR_DROP_PACK",
            weightGrams: 500,
          },
        ],
        channel: "PICKUP",
      });

      // 11500 gross: vat = 11500 * 1500 / 11500 = 1500 paisa (৳15). ex-VAT net = 10000 (৳100).
      expect(result.lines[0]!.vatPaisa).toBe(1500);
      expect(result.lines[0]!.exVatPaisa).toBe(10000);
      expect(result.lines[0]!.effectiveUnitPricePaisa).toBe(11500);
      expect(result.totals.vatTotalPaisa).toBe(1500);
    });

    it("1.e calculates courier delivery fee with base fee and weight surcharge", () => {
      // 1. Inside Dhaka, 700g total weight (under 1000g)
      const insideUnder1Kg = priceCart({
        lines: [regularLine1, regularLine2], // 2*200 + 300 = 700g
        channel: "COURIER",
        deliveryZone: "INSIDE_DHAKA",
      });
      expect(insideUnder1Kg.delivery.baseFeePaisa).toBe(8000); // ৳80
      expect(insideUnder1Kg.delivery.weightSurchargePaisa).toBe(0);
      expect(insideUnder1Kg.totals.deliveryFeePaisa).toBe(8000);

      // 2. Outside Dhaka, 2500g total weight
      const heavyOutside = priceCart({
        lines: [
          {
            ...regularLine1,
            qty: 5, // 5 * 500g = 2500g
            weightGrams: 500,
          },
        ],
        channel: "COURIER",
        deliveryZone: "OUTSIDE_DHAKA",
      });
      // Base: ৳150 (15000 paisa)
      // Extra weight = 2500 - 1000 = 1500g -> ceil(1.5) = 2 kg
      // Surcharge = 2 * 2000 = 4000 paisa (৳40)
      expect(heavyOutside.delivery.baseFeePaisa).toBe(15000);
      expect(heavyOutside.delivery.weightSurchargePaisa).toBe(4000);
      expect(heavyOutside.totals.deliveryFeePaisa).toBe(19000); // ৳190

      // 3. Pickup / Walk-in has zero delivery fee
      const pickup = priceCart({
        lines: [regularLine1],
        channel: "PICKUP",
      });
      expect(pickup.totals.deliveryFeePaisa).toBe(0);
    });

    it("1.f applies store credit capped at product amount and never to delivery fee", () => {
      // Product net = 100,000 (৳1,000), Delivery = 8,000 (৳80), Total Payable = 108,000 (৳1,080)
      // Store credit requested = 150,000 (৳1,500)
      const result = priceCart({
        lines: [regularLine1],
        channel: "COURIER",
        deliveryZone: "INSIDE_DHAKA",
        storeCreditPaisa: 150000,
      });

      // Capped at product net (100000 paisa); never covers 8000 delivery fee
      expect(result.totals.storeCreditAppliedPaisa).toBe(100000);
      expect(result.totals.totalPayablePaisa).toBe(108000);
      expect(result.totals.amountDuePaisa).toBe(8000); // Delivery fee remains payable!
    });
  });

  // --------------------------------------------------------------------------
  // 2. unitDepositPaisa & orderDepositPaisa
  // --------------------------------------------------------------------------
  describe("2. unitDepositPaisa & orderDepositPaisa (architechture.md §8.4, PRD §3.3.2)", () => {
    it("matches the exact PRD progressive deposit table without cliff", () => {
      // ৳30,000 → ৳6,000 (20%)
      expect(unitDepositPaisa(3000000)).toBe(600000);

      // ৳50,000 → ৳10,000 (20%)
      expect(unitDepositPaisa(5000000)).toBe(1000000);

      // ৳80,000 → ৳13,000 (16.25% rounded up)
      expect(unitDepositPaisa(8000000)).toBe(1300000);

      // ৳150,000 → ৳20,000 (13.33% rounded up)
      expect(unitDepositPaisa(15000000)).toBe(2000000);

      // ৳300,000 → ৳35,000 (11.67% rounded up)
      expect(unitDepositPaisa(30000000)).toBe(3500000);
    });

    it("rounds up to nearest ৳10 (1000 paisa)", () => {
      // Unit price ৳30,001 (3000100 paisa)
      // 20% of 3000100 = 600020 paisa -> ceil(600020 / 1000) * 1000 = 601000 paisa (৳6,010)
      expect(unitDepositPaisa(3000100)).toBe(601000);
    });

    it("caps deposit at unit price for very low-priced items", () => {
      // If an item is ৳5 (500 paisa):
      // 20% = 100 paisa -> rounded up to ৳10 (1000 paisa) -> capped at 500 paisa
      expect(unitDepositPaisa(500)).toBe(500);
    });

    it("calculates orderDepositPaisa as sum of (unit deposit * qty)", () => {
      const lines = [
        { unitPricePaisa: 3000000, qty: 2 }, // 2 * ৳6,000 = ৳12,000 (1200000 paisa)
        { unitPricePaisa: 8000000, qty: 1 }, // 1 * ৳13,000 = ৳13,000 (1300000 paisa)
      ];
      expect(orderDepositPaisa(lines)).toBe(2500000); // ৳25,000
    });
  });

  // --------------------------------------------------------------------------
  // 3. paymentPlan
  // --------------------------------------------------------------------------
  describe("3. paymentPlan", () => {
    const regularTotals = {
      subtotalNetPaisa: 100000, // ৳1,000
      deliveryFeePaisa: 8000, // ৳80
      baseDeliveryFeePaisa: 8000,
      weightSurchargePaisa: 0,
      totalPayablePaisa: 108000, // ৳1,080
      storeCreditAppliedPaisa: 0,
      amountDuePaisa: 108000,
    };

    it("3.a REGULAR + COD for FULL_COD customer: advance = 0, COD = amount due", () => {
      const plan = paymentPlan({
        orderType: "REGULAR_DROP_PACK",
        channel: "COURIER",
        paymentMode: "COD",
        codEligibility: "FULL_COD",
        totals: regularTotals,
      });

      expect(plan.advanceRequiredPaisa).toBe(0);
      expect(plan.advancePurpose).toBeNull();
      expect(plan.codCollectiblePaisa).toBe(108000);
      expect(plan.allowedModes).toContain("COD");
      expect(plan.allowedModes).toContain("ONLINE_FULL");
    });

    it("3.a REGULAR + COD for ADVANCE_FEE_REQUIRED customer: advance = base zone fee (৳80), COD = rest", () => {
      const plan = paymentPlan({
        orderType: "REGULAR_DROP_PACK",
        channel: "COURIER",
        paymentMode: "COD",
        codEligibility: "ADVANCE_FEE_REQUIRED",
        totals: regularTotals,
      });

      expect(plan.advanceRequiredPaisa).toBe(8000);
      expect(plan.advancePurpose).toBe("ADVANCE_FEE");
      expect(plan.codCollectiblePaisa).toBe(100000); // 108,000 - 8,000
      expect(plan.advanceRequiredPaisa + plan.codCollectiblePaisa).toBe(regularTotals.amountDuePaisa);
    });

    it("3.a REGULAR + COD for COD_BLOCKED customer: rejects with ERR_COD_NOT_ALLOWED (422)", () => {
      expect(() => {
        paymentPlan({
          orderType: "REGULAR_DROP_PACK",
          channel: "COURIER",
          paymentMode: "COD",
          codEligibility: "COD_BLOCKED",
          totals: regularTotals,
        });
      }).toThrowError(AppError);

      try {
        paymentPlan({
          orderType: "REGULAR_DROP_PACK",
          channel: "COURIER",
          paymentMode: "COD",
          codEligibility: "COD_BLOCKED",
          totals: regularTotals,
        });
      } catch (err: unknown) {
        const appErr = err as AppError;
        expect(appErr.code).toBe("ERR_COD_NOT_ALLOWED");
        expect(appErr.status).toBe(422);
      }
    });

    it("3.b REGULAR + ONLINE_FULL: advance = amount due, cod = 0", () => {
      const plan = paymentPlan({
        orderType: "REGULAR_DROP_PACK",
        channel: "COURIER",
        paymentMode: "ONLINE_FULL",
        codEligibility: "ADVANCE_FEE_REQUIRED",
        totals: regularTotals,
      });

      expect(plan.advanceRequiredPaisa).toBe(108000);
      expect(plan.advancePurpose).toBe("FULL");
      expect(plan.codCollectiblePaisa).toBe(0);
    });

    it("3.c PICKUP + PAY_AT_COUNTER: allowed only for showroom physical stock or FULL_COD customer", () => {
      // 1. In showroom stock -> allowed
      const showroomStockPlan = paymentPlan({
        orderType: "REGULAR_DROP_PACK",
        channel: "PICKUP",
        paymentMode: "PAY_AT_COUNTER",
        codEligibility: "ADVANCE_FEE_REQUIRED",
        totals: { ...regularTotals, deliveryFeePaisa: 0, amountDuePaisa: 100000 },
        allLinesFromShowroomCounter: true,
      });
      expect(showroomStockPlan.advanceRequiredPaisa).toBe(0);
      expect(showroomStockPlan.codCollectiblePaisa).toBe(100000);

      // 2. Not in showroom stock, but repeat customer (FULL_COD) -> allowed
      const repeatCustomerPlan = paymentPlan({
        orderType: "REGULAR_DROP_PACK",
        channel: "PICKUP",
        paymentMode: "PAY_AT_COUNTER",
        codEligibility: "FULL_COD",
        totals: { ...regularTotals, deliveryFeePaisa: 0, amountDuePaisa: 100000 },
        allLinesFromShowroomCounter: false,
      });
      expect(repeatCustomerPlan.advanceRequiredPaisa).toBe(0);
      expect(repeatCustomerPlan.codCollectiblePaisa).toBe(100000);

      // 3. Not in showroom stock and first-time buyer -> rejected
      expect(() => {
        paymentPlan({
          orderType: "REGULAR_DROP_PACK",
          channel: "PICKUP",
          paymentMode: "PAY_AT_COUNTER",
          codEligibility: "ADVANCE_FEE_REQUIRED",
          totals: { ...regularTotals, deliveryFeePaisa: 0, amountDuePaisa: 100000 },
          allLinesFromShowroomCounter: false,
        });
      }).toThrowError(AppError);
    });

    it("3.d PRE_ORDER: advance = deposit (online); balance COD allowed if <= ৳30,000 and not COD-blocked", () => {
      const preOrderTotals = {
        subtotalNetPaisa: 5000000, // ৳50,000
        deliveryFeePaisa: 15000, // ৳150
        baseDeliveryFeePaisa: 15000,
        weightSurchargePaisa: 0,
        totalPayablePaisa: 5015000, // ৳50,150
        storeCreditAppliedPaisa: 0,
        amountDuePaisa: 5015000,
      };
      // ৳50,000 item deposit = ৳10,000 (1000000 paisa)
      // Balance = 5,015,000 - 1,000,000 = 4,015,000 paisa (৳40,150) > ৳30,000 max COD limit!
      expect(() => {
        paymentPlan({
          orderType: "PRE_ORDER",
          channel: "COURIER",
          paymentMode: "COD",
          codEligibility: "FULL_COD",
          totals: preOrderTotals,
          depositPaisa: 1000000,
          preorderCodBalanceMaxPaisa: 3000000,
        });
      }).toThrowError(AppError);

      // If item price is ৳30,000:
      // Total = 3,015,000 paisa. Deposit = ৳6,000 (600,000 paisa). Balance = 2,415,000 paisa (৳24,150) <= ৳30,000
      const validPreorderTotals = {
        subtotalNetPaisa: 3000000,
        deliveryFeePaisa: 15000,
        baseDeliveryFeePaisa: 15000,
        weightSurchargePaisa: 0,
        totalPayablePaisa: 3015000,
        storeCreditAppliedPaisa: 0,
        amountDuePaisa: 3015000,
      };

      const validPlan = paymentPlan({
        orderType: "PRE_ORDER",
        channel: "COURIER",
        paymentMode: "COD",
        codEligibility: "FULL_COD",
        totals: validPreorderTotals,
        depositPaisa: 600000,
        preorderCodBalanceMaxPaisa: 3000000,
      });

      expect(validPlan.advanceRequiredPaisa).toBe(600000);
      expect(validPlan.advancePurpose).toBe("DEPOSIT");
      expect(validPlan.codCollectiblePaisa).toBe(2415000);
      expect(validPlan.advanceRequiredPaisa + validPlan.codCollectiblePaisa).toBe(3015000);
    });
  });

  // --------------------------------------------------------------------------
  // 4. marginCheck
  // --------------------------------------------------------------------------
  describe("4. marginCheck (architechture.md §11.1)", () => {
    // List price ৳1,150 with 15% VAT -> List price ex-VAT = ৳1,000 (100000 paisa)
    // Base cost: ৳700 (70000 paisa)
    // Spot buffer: 500 bp (5%) -> max allowed cost = ৳735 (73500 paisa)
    // Min margin: 1500 bp (15%) -> min ex-VAT gross margin = ৳150 (cost <= ৳850)
    const baseInput: MarginCheckInput = {
      listPricePaisa: 115000,
      vatRateBp: 1500,
      baseCostPaisa: 70000,
      spotBufferBp: 500,
      minMarginBp: 1500,
      quotedUnitCostPaisa: 72000, // ৳720
    };

    it("approves when quoted cost is within buffer and meets 15% gross margin", () => {
      const result = marginCheck(baseInput);
      expect(result.allowed).toBe(true);
      expect(result.overBuffer).toBe(false);
      // Margin = (100000 - 72000) / 100000 = 28% = 2800 bp
      expect(result.marginBp).toBe(2800);
    });

    it("rejects when quoted cost exceeds spot buffer even if margin is above 15%", () => {
      const result = marginCheck({
        ...baseInput,
        quotedUnitCostPaisa: 75000, // ৳750 > ৳735 max buffer
      });
      expect(result.allowed).toBe(false);
      expect(result.overBuffer).toBe(true);
      expect(result.marginBp).toBe(2500); // 25% > 15%, but over buffer!
    });

    it("rejects when margin falls below 15% threshold", () => {
      const lowMarginInput: MarginCheckInput = {
        listPricePaisa: 115000, // ex-VAT = 100,000
        vatRateBp: 1500,
        baseCostPaisa: 85000, // ৳850
        spotBufferBp: 500,
        minMarginBp: 1500,
        quotedUnitCostPaisa: 87000, // ৳870 -> margin = 13,000 (13% < 15%)
      };
      const result = marginCheck(lowMarginInput);
      expect(result.allowed).toBe(false);
      expect(result.marginBp).toBe(1300);
    });
  });

  // --------------------------------------------------------------------------
  // 5. refundableAmountForLines
  // --------------------------------------------------------------------------
  describe("5. refundableAmountForLines (PRD §3.14.5)", () => {
    const order: RefundableOrder = {
      status: "PACKED",
      lines: [
        { id: "line-1", netPaisa: 80000 }, // ৳800
        { id: "line-2", netPaisa: 120000 }, // ৳1,200
      ],
      advanceFeePaisa: 8000, // ৳80 advance delivery fee paid
      handedToCourier: false,
    };

    it("refunds only product line net amount for partial line refunds", () => {
      const result = refundableAmountForLines(order, ["line-1"]);
      expect(result.productRefundPaisa).toBe(80000);
      expect(result.advanceFeeRefundPaisa).toBe(0);
      expect(result.totalRefundablePaisa).toBe(80000);
      expect(result.isFullOrderRefund).toBe(false);
    });

    it("refunds advance fee on full order refund before courier handover", () => {
      const result = refundableAmountForLines(order, ["line-1", "line-2"]);
      expect(result.productRefundPaisa).toBe(200000); // 80,000 + 120,000
      expect(result.advanceFeeRefundPaisa).toBe(8000);
      expect(result.totalRefundablePaisa).toBe(208000);
      expect(result.isFullOrderRefund).toBe(true);
      expect(result.handedToCourier).toBe(false);
    });

    it("withholds advance fee on full order refund after parcel was handed to courier", () => {
      const handedOrder: RefundableOrder = {
        ...order,
        status: "HANDED_TO_COURIER",
        handedToCourier: true,
      };

      const result = refundableAmountForLines(handedOrder, ["line-1", "line-2"]);
      expect(result.productRefundPaisa).toBe(200000);
      expect(result.advanceFeeRefundPaisa).toBe(0); // Courier fee NOT refundable once handed over!
      expect(result.totalRefundablePaisa).toBe(200000);
      expect(result.handedToCourier).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Property-Based Testing with fast-check
  // --------------------------------------------------------------------------
  describe("6. Property-Based Tests (fast-check)", () => {
    it("allocates coupon discounts pro-rata such that sum of line discounts equals total discount exactly with no negative amounts", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              skuId: fc.uuid(),
              qty: fc.integer({ min: 1, max: 10 }),
              unitPricePaisa: fc.integer({ min: 100, max: 500000 }), // ৳1 to ৳5,000
              vatRateBp: fc.constantFrom(0, 500, 750, 1500),
              tier: fc.constantFrom<"AUTHENTIC" | "BUDGET_SMART">("AUTHENTIC", "BUDGET_SMART"),
              categoryId: fc.constant("cat-test"),
              fulfillmentType: fc.constant<"REGULAR_DROP_PACK">("REGULAR_DROP_PACK"),
              weightGrams: fc.integer({ min: 50, max: 2000 }),
            }),
            { minLength: 1, maxLength: 6 }
          ),
          fc.integer({ min: 100, max: 200000 }), // Discount up to ৳2,000
          (lines, discountAmount) => {
            const result = priceCart({
              lines,
              coupon: {
                code: "PROPTEST",
                type: "FIXED",
                value: discountAmount,
              },
              channel: "PICKUP",
            });

            // 1. Discount sum property: sum of line discounts must equal total discount exactly
            const sumDiscounts = result.lines.reduce((s, l) => s + l.discountPaisa, 0);
            expect(sumDiscounts).toBe(result.totals.discountPaisa);

            // 2. No line net amount is negative
            for (const line of result.lines) {
              expect(line.netPaisa).toBeGreaterThanOrEqual(0);
              expect(line.grossPaisa).toBe(line.netPaisa + line.discountPaisa);
              expect(line.netPaisa).toBe(line.vatPaisa + line.exVatPaisa);
            }

            // 3. Totals arithmetic integrity
            expect(result.totals.totalPayablePaisa).toBe(
              result.totals.subtotalPaisa - result.totals.discountPaisa + result.totals.deliveryFeePaisa
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it("verifies payment plan invariants: advanceRequired + codCollectible === amountDue for COD orders", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 10000000 }), // ৳10 to ৳100,000 subtotal net
          fc.constantFrom(8000, 15000), // Base fee ৳80 or ৳150
          fc.integer({ min: 0, max: 10000 }), // Surcharge up to ৳100
          fc.constantFrom<"FULL_COD" | "ADVANCE_FEE_REQUIRED">("FULL_COD", "ADVANCE_FEE_REQUIRED"),
          (subtotalNetPaisa, baseFeePaisa, surchargePaisa, codEligibility) => {
            const deliveryFeePaisa = baseFeePaisa + surchargePaisa;
            const totalPayablePaisa = subtotalNetPaisa + deliveryFeePaisa;
            const amountDuePaisa = totalPayablePaisa;

            const plan = paymentPlan({
              orderType: "REGULAR_DROP_PACK",
              channel: "COURIER",
              paymentMode: "COD",
              codEligibility,
              totals: {
                subtotalNetPaisa,
                deliveryFeePaisa,
                baseDeliveryFeePaisa: baseFeePaisa,
                weightSurchargePaisa: surchargePaisa,
                totalPayablePaisa,
                storeCreditAppliedPaisa: 0,
                amountDuePaisa,
              },
            });

            // Invariant: advance + codCollectible === amountDue
            expect(plan.advanceRequiredPaisa + plan.codCollectiblePaisa).toBe(amountDuePaisa);
            expect(plan.advanceRequiredPaisa).toBeGreaterThanOrEqual(0);
            expect(plan.codCollectiblePaisa).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("verifies unitDepositPaisa invariants across random prices: between 10% and 20%, never exceeds unit price, and is a multiple of ৳10", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 50000000 }), // ৳10 to ৳500,000
          (pricePaisa) => {
            const deposit = unitDepositPaisa(pricePaisa);

            // Invariant 1: never more than unit price
            expect(deposit).toBeLessThanOrEqual(pricePaisa);

            // Invariant 2: non-negative
            expect(deposit).toBeGreaterThan(0);

            // Invariant 3: multiple of ৳10 (1000 paisa) unless capped at pricePaisa
            if (deposit < pricePaisa) {
              expect(deposit % 1000).toBe(0);
            }

            // Invariant 4: effective rate is at least 10% (minus rounding tolerance);
            // for prices >= ৳50 (5000 paisa), rate is at most 20% (+ rounding up to ৳10);
            // for prices < ৳50, deposit is ৳10 or capped at pricePaisa.
            const rate = deposit / pricePaisa;
            expect(rate).toBeGreaterThanOrEqual(0.099);
            if (pricePaisa >= 5000) {
              // 20% + up to ৳10 rounding
              expect(rate).toBeLessThanOrEqual(0.20 + 1000 / pricePaisa + 0.001);
            } else {
              expect(deposit).toBe(Math.min(1000, pricePaisa));
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // --------------------------------------------------------------------------
  // 7. pricingLoader
  // --------------------------------------------------------------------------
  describe("7. pricingLoader", () => {
    it("gathers SKU details, product metadata, and settings to price a cart", async () => {
      const { pricingLoader } = await import("../loader");
      const { catalogService } = await import("@/modules/catalog");

      // Spy on catalogService
      const skuSpy = vi.spyOn(catalogService, "getSkuById").mockResolvedValue({
        id: "sku-loader-1",
        productId: "prod-loader-1",
        skuCode: "NCA-LD-01",
        barcodeEan13: null,
        attributes: {},
        specs: {},
        pricePaisa: 50000, // ৳500
        compareAtPricePaisa: null,
        baseCostPaisa: 35000,
        spotBufferBp: 500,
        maxUnitPurchasePaisa: 36750,
        warrantyDays: 7,
        warrantyType: "SHOP_REPLACEMENT",
        officialDistributorName: null,
        weightGrams: 400,
        dailyOrderCap: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const prodSpy = vi.spyOn(catalogService, "getProductById").mockResolvedValue({
        id: "prod-loader-1",
        slug: "loader-cable",
        titleEn: "Loader Cable",
        titleBn: "লোডার ক্যাবল",
        descriptionEn: null,
        descriptionBn: null,
        categoryId: "cat-loader-1",
        brandId: null,
        productTier: "AUTHENTIC",
        fulfillmentType: "DROP_AND_PACK",
        comparisonGroupId: null,
        originCountry: "BD",
        hsCode: null,
        btrcStatus: "NOT_REQUIRED",
        btrcClearanceCode: null,
        vatRateBp: 1500,
        status: "PUBLISHED",
        zeroReplicaAttested: true,
        zeroReplicaAttestedBy: null,
        distributorEvidenceMediaId: null,
        comparisonPointsEn: null,
        comparisonPointsBn: null,
        seoTitle: null,
        seoDescription: null,
        preorderEtaDaysMin: null,
        preorderEtaDaysMax: null,
        preorderBatchThreshold: null,
        createdBy: null,
        submittedBy: null,
        reviewedBy: null,
        reviewNotes: null,
        publishedAt: new Date(),
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      try {
        const pricedCart = await pricingLoader.loadAndPriceCart({
          items: [{ skuId: "sku-loader-1", qty: 2 }],
          channel: "COURIER",
          deliveryZone: "INSIDE_DHAKA",
        });

        expect(pricedCart.fulfillmentType).toBe("REGULAR_DROP_PACK");
        expect(pricedCart.lines).toHaveLength(1);
        expect(pricedCart.lines[0]!.grossPaisa).toBe(100000); // 2 * 50,000
        expect(pricedCart.totals.subtotalPaisa).toBe(100000);
        expect(pricedCart.totals.deliveryFeePaisa).toBe(8000); // ৳80 inside Dhaka
        expect(pricedCart.totals.totalPayablePaisa).toBe(108000);
      } finally {
        skuSpy.mockRestore();
        prodSpy.mockRestore();
      }
    }, 15000);
  });
});

