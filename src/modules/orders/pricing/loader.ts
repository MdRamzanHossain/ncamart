import { catalogService } from "@/modules/catalog";
import { settingsService } from "@/modules/settings";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { priceCart } from "./cart";
import {
  PricedCart,
  CartLineInput,
  Channel,
  DeliveryZone,
  CouponRule,
  CustomerRiskInput,
  FulfillmentType,
} from "./types";

export interface LoadAndPriceCartItem {
  skuId: string;
  qty: number;
}

export interface LoadAndPriceCartInput {
  items: LoadAndPriceCartItem[];
  coupon?: CouponRule;
  deliveryZone?: DeliveryZone;
  channel: Channel;
  storeCreditPaisa?: number;
  customerRisk?: CustomerRiskInput;
}

export const pricingLoader = {
  /**
   * Thin database/service loader:
   * 1. Gathers active SKU and product details from catalogService
   * 2. Gathers dynamic pricing settings from settingsService
   * 3. Invokes the pure priceCart engine
   */
  async loadAndPriceCart(input: LoadAndPriceCartInput): Promise<PricedCart> {
    if (!input.items || input.items.length === 0) {
      throw new ValidationError("Cart must contain at least one item");
    }

    // 1. Gather SKU and product details
    const lines: CartLineInput[] = [];

    for (const item of input.items) {
      const sku = await catalogService.getSkuById(item.skuId);
      if (!sku) {
        throw new NotFoundError(`SKU with id '${item.skuId}' not found`);
      }
      if (!sku.isActive) {
        throw new ValidationError(`SKU '${sku.skuCode}' is inactive and cannot be purchased`);
      }

      const product = await catalogService.getProductById(sku.productId);
      if (!product) {
        throw new NotFoundError(`Product for SKU '${item.skuId}' not found`);
      }

      // Map catalog fulfillment type (DROP_AND_PACK -> REGULAR_DROP_PACK)
      const fulfillmentType: FulfillmentType =
        product.fulfillmentType === "DROP_AND_PACK"
          ? "REGULAR_DROP_PACK"
          : (product.fulfillmentType as FulfillmentType);

      // Check if there is an active flash deal for physical units
      let effectiveUnitPrice = sku.pricePaisa;
      try {
        const { preorderService } = await import("@/modules/preorder");
        const flashDeal = await preorderService.getActiveFlashDeal(sku.id);
        if (flashDeal) {
          effectiveUnitPrice = flashDeal.pricePaisa;
        }
      } catch {
        // Fallback to regular SKU price
      }

      lines.push({
        skuId: sku.id,
        qty: item.qty,
        unitPricePaisa: effectiveUnitPrice,
        vatRateBp: product.vatRateBp,
        tier: product.productTier as "AUTHENTIC" | "BUDGET_SMART",
        categoryId: product.categoryId,
        fulfillmentType,
        weightGrams: sku.weightGrams,
      });
    }

    // 2. Gather settings
    const [
      deliveryBaseDhakaPaisa,
      deliveryBaseOutsidePaisa,
      deliveryBaseWeightGrams,
      deliverySurchargePerKgPaisa,
      preorderCodBalanceMaxPaisa,
    ] = await Promise.all([
      settingsService.get("DELIVERY_BASE_DHAKA_PAISA"),
      settingsService.get("DELIVERY_BASE_OUTSIDE_PAISA"),
      settingsService.get("DELIVERY_BASE_WEIGHT_GRAMS"),
      settingsService.get("DELIVERY_SURCHARGE_PER_KG_PAISA"),
      settingsService.get("PREORDER_COD_BALANCE_MAX_PAISA"),
    ]);

    // 3. Delegate to pure pricing engine
    return priceCart({
      lines,
      coupon: input.coupon,
      deliveryZone: input.deliveryZone,
      channel: input.channel,
      storeCreditPaisa: input.storeCreditPaisa,
      customerRisk: input.customerRisk,
      config: {
        deliveryBaseDhakaPaisa,
        deliveryBaseOutsidePaisa,
        deliveryBaseWeightGrams,
        deliverySurchargePerKgPaisa,
        preorderCodBalanceMaxPaisa,
      },
    });
  },
};
