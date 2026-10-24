import { type Paisa } from "@/lib/money";
import { type CodEligibility } from "@/modules/orders/policies";

export type FulfillmentType = "REGULAR_DROP_PACK" | "PRE_ORDER";
export type ProductTier = "AUTHENTIC" | "BUDGET_SMART";
export type DeliveryZone = "INSIDE_DHAKA" | "OUTSIDE_DHAKA";
export type Channel = "COURIER" | "PICKUP" | "WALK_IN";
export type PaymentMode = "COD" | "ONLINE_FULL" | "PAY_AT_COUNTER";
export type AdvancePurpose = "FULL" | "ADVANCE_FEE" | "DEPOSIT" | null;
export type CouponDiscountType = "FIXED" | "PERCENTAGE";

export interface CouponScope {
  tiers?: ProductTier[];
  categoryIds?: string[];
  skuIds?: string[];
}

export interface CouponRule {
  code: string;
  type: CouponDiscountType;
  /** Fixed discount in integer Paisa, or percentage discount in basis points (e.g. 1000 = 10%) */
  value: number;
  /** Minimum qualifying gross subtotal in Paisa */
  minOrderValuePaisa?: number;
  /** Cap on maximum discount in Paisa (applicable to percentage or fixed) */
  maxDiscountPaisa?: number;
  /** Scope restrictions by tier, category, or specific SKUs */
  scope?: CouponScope;
}

export interface CartLineInput {
  skuId: string;
  qty: number;
  /** VAT-inclusive unit selling price in Paisa */
  unitPricePaisa: number;
  /** VAT rate in basis points (e.g. 1500 for 15% standard, 750 for 7.5%) */
  vatRateBp: number;
  tier: ProductTier;
  categoryId: string;
  fulfillmentType: FulfillmentType;
  /** Item weight in grams (used for parcel delivery surcharge) */
  weightGrams: number;
}

export interface CustomerRiskInput {
  rtoCount12m?: number;
  codBlocked?: boolean;
  deliveredCount?: number;
}

export interface PricingConfigOverrides {
  deliveryBaseDhakaPaisa?: number; // default 8000 (৳80)
  deliveryBaseOutsidePaisa?: number; // default 15000 (৳150)
  deliveryBaseWeightGrams?: number; // default 1000g (1 kg)
  deliverySurchargePerKgPaisa?: number; // default 2000 (৳20)
  preorderCodBalanceMaxPaisa?: number; // default 3000000 (৳30,000)
}

export interface PriceCartInput {
  lines: CartLineInput[];
  coupon?: CouponRule;
  deliveryZone?: DeliveryZone;
  channel: Channel;
  storeCreditPaisa?: number;
  customerRisk?: CustomerRiskInput;
  config?: PricingConfigOverrides;
}

export interface PricedCartLine {
  skuId: string;
  qty: number;
  unitPricePaisa: Paisa;
  vatRateBp: number;
  tier: ProductTier;
  categoryId: string;
  fulfillmentType: FulfillmentType;
  weightGrams: number;
  grossPaisa: Paisa;
  discountPaisa: Paisa;
  netPaisa: Paisa;
  vatPaisa: Paisa;
  exVatPaisa: Paisa;
  /** Effective unit price after allocated discount: floor(netPaisa / qty) */
  effectiveUnitPricePaisa: Paisa;
}

export interface PricedCartTotals {
  subtotalPaisa: Paisa;
  discountPaisa: Paisa;
  deliveryFeePaisa: Paisa;
  vatTotalPaisa: Paisa;
  totalPayablePaisa: Paisa;
  storeCreditAppliedPaisa: Paisa;
  amountDuePaisa: Paisa;
}

export interface PricedDeliveryBreakdown {
  channel: Channel;
  zone?: DeliveryZone;
  totalWeightGrams: number;
  baseFeePaisa: Paisa;
  weightSurchargePaisa: Paisa;
  totalDeliveryFeePaisa: Paisa;
}

export interface PricedCart {
  fulfillmentType: FulfillmentType;
  lines: PricedCartLine[];
  couponApplied?: {
    code: string;
    discountPaisa: Paisa;
  };
  delivery: PricedDeliveryBreakdown;
  totals: PricedCartTotals;
}

export interface PaymentPlanTotalsInput {
  totalPayablePaisa: number;
  amountDuePaisa: number;
  deliveryFeePaisa: number;
  storeCreditAppliedPaisa: number;
  baseDeliveryFeePaisa?: number;
  weightSurchargePaisa?: number;
  subtotalNetPaisa: number;
}

export interface PaymentPlanInput {
  orderType: FulfillmentType;
  channel: Channel;
  paymentMode: PaymentMode;
  codEligibility: CodEligibility;
  totals: PaymentPlanTotalsInput;
  depositPaisa?: number;
  preorderCodBalanceMaxPaisa?: number;
  allLinesFromShowroomCounter?: boolean;
}

export interface PaymentPlan {
  advanceRequiredPaisa: number;
  advancePurpose: AdvancePurpose;
  codCollectiblePaisa: number;
  allowedModes: PaymentMode[];
}

export interface MarginCheckInput {
  /** VAT-inclusive list selling price */
  listPricePaisa: number;
  /** VAT rate in basis points */
  vatRateBp: number;
  /** Actual cost quoted by wholesaler or runner */
  quotedUnitCostPaisa: number;
  /** SKU base cost */
  baseCostPaisa: number;
  /** Spot price tolerance buffer in basis points (default 500 = 5%) */
  spotBufferBp: number;
  /** Minimum acceptable gross margin in basis points (default 1500 = 15%) */
  minMarginBp: number;
}

export interface MarginCheckResult {
  allowed: boolean;
  marginBp: number;
  overBuffer: boolean;
}

export interface RefundableOrderLine {
  id: string;
  netPaisa: number;
}

export interface RefundableOrder {
  status: string;
  lines: RefundableOrderLine[];
  advanceFeePaisa?: number;
  handedToCourier?: boolean;
}
