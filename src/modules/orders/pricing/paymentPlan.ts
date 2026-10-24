import { BusinessError } from "@/lib/errors";
import { PaymentPlanInput, PaymentPlan, PaymentMode } from "./types";
import { DEFAULT_PRICING_CONFIG } from "./cart";

/**
 * Evaluates payment breakdown and determines advance required, advance purpose,
 * COD collectible amount, and allowed payment modes for checkout.
 */
export function paymentPlan(input: PaymentPlanInput): PaymentPlan {
  const {
    orderType,
    channel,
    paymentMode,
    codEligibility,
    totals,
    depositPaisa = 0,
    preorderCodBalanceMaxPaisa = DEFAULT_PRICING_CONFIG.preorderCodBalanceMaxPaisa,
    allLinesFromShowroomCounter = false,
  } = input;

  // 1. Determine allowed modes based on order type, channel, stock location, and customer risk
  const allowedModes: PaymentMode[] = [];

  if (channel === "WALK_IN") {
    allowedModes.push("PAY_AT_COUNTER");
  } else if (channel === "PICKUP") {
    allowedModes.push("ONLINE_FULL");
    if (orderType === "REGULAR_DROP_PACK") {
      if (allLinesFromShowroomCounter || codEligibility === "FULL_COD") {
        allowedModes.push("PAY_AT_COUNTER");
      }
    } else {
      // PRE_ORDER PICKUP allows paying balance at counter on pickup
      allowedModes.push("PAY_AT_COUNTER");
    }
  } else {
    // COURIER
    allowedModes.push("ONLINE_FULL");
    if (orderType === "REGULAR_DROP_PACK") {
      if (codEligibility !== "COD_BLOCKED") {
        allowedModes.push("COD");
      }
    } else {
      // PRE_ORDER COURIER
      const preorderBalance = Math.max(
        0,
        totals.totalPayablePaisa - depositPaisa - totals.storeCreditAppliedPaisa
      );
      if (codEligibility !== "COD_BLOCKED" && preorderBalance <= preorderCodBalanceMaxPaisa) {
        allowedModes.push("COD");
      }
    }
  }

  // 2. Compute plan for the requested paymentMode
  let advanceRequiredPaisa = 0;
  let advancePurpose: PaymentPlan["advancePurpose"] = null;
  let codCollectiblePaisa = 0;

  if (orderType === "REGULAR_DROP_PACK") {
    if (paymentMode === "COD") {
      if (channel !== "COURIER") {
        throw new BusinessError(
          "ERR_BUSINESS_RULE",
          "Cash on Delivery is only available for courier delivery",
          { channel }
        );
      }
      if (codEligibility === "COD_BLOCKED") {
        throw new BusinessError(
          "ERR_COD_NOT_ALLOWED",
          "Cash on Delivery is not allowed for this customer account",
          { codEligibility }
        );
      }

      if (codEligibility === "FULL_COD") {
        advanceRequiredPaisa = 0;
        advancePurpose = null;
        codCollectiblePaisa = totals.amountDuePaisa;
      } else {
        // ADVANCE_FEE_REQUIRED: customer pays BASE delivery fee online; rest via COD
        const baseFee = totals.baseDeliveryFeePaisa ?? (totals.deliveryFeePaisa > 0 ? 8000 : 0);
        advanceRequiredPaisa = Math.min(baseFee, totals.amountDuePaisa);
        advancePurpose = "ADVANCE_FEE";
        codCollectiblePaisa = totals.amountDuePaisa - advanceRequiredPaisa;
      }
    } else if (paymentMode === "ONLINE_FULL") {
      advanceRequiredPaisa = totals.amountDuePaisa;
      advancePurpose = "FULL";
      codCollectiblePaisa = 0;
    } else if (paymentMode === "PAY_AT_COUNTER") {
      if (channel === "COURIER") {
        throw new BusinessError(
          "ERR_BUSINESS_RULE",
          "Pay at counter is not available for courier delivery",
          { channel }
        );
      }
      if (channel === "PICKUP" && !allLinesFromShowroomCounter && codEligibility !== "FULL_COD") {
        throw new BusinessError(
          "ERR_BUSINESS_RULE",
          "Pay at counter pickup requires showroom counter stock availability or verified repeat customer status",
          { allLinesFromShowroomCounter, codEligibility }
        );
      }
      advanceRequiredPaisa = 0;
      advancePurpose = null;
      codCollectiblePaisa = totals.amountDuePaisa;
    } else {
      throw new BusinessError("ERR_BUSINESS_RULE", `Unsupported payment mode: ${paymentMode}`);
    }
  } else {
    // PRE_ORDER
    const deposit = depositPaisa;
    const balance = Math.max(
      0,
      totals.totalPayablePaisa - deposit - totals.storeCreditAppliedPaisa
    );

    if (paymentMode === "COD") {
      if (channel !== "COURIER") {
        throw new BusinessError(
          "ERR_BUSINESS_RULE",
          "Cash on Delivery is only available for courier delivery",
          { channel }
        );
      }
      if (codEligibility === "COD_BLOCKED") {
        throw new BusinessError(
          "ERR_COD_NOT_ALLOWED",
          "Cash on Delivery is not allowed for this customer account",
          { codEligibility }
        );
      }
      if (balance > preorderCodBalanceMaxPaisa) {
        throw new BusinessError(
          "ERR_COD_NOT_ALLOWED",
          `Pre-order balance exceeds maximum COD limit of ৳${preorderCodBalanceMaxPaisa / 100}`,
          { balancePaisa: balance, maxCodPaisa: preorderCodBalanceMaxPaisa }
        );
      }

      advanceRequiredPaisa = deposit;
      advancePurpose = "DEPOSIT";
      codCollectiblePaisa = balance;
    } else if (paymentMode === "ONLINE_FULL") {
      // Pre-order initial checkout collects progressive deposit online
      advanceRequiredPaisa = deposit;
      advancePurpose = "DEPOSIT";
      codCollectiblePaisa = 0; // Balance paid online prior to dispatch
    } else if (paymentMode === "PAY_AT_COUNTER") {
      if (channel === "COURIER") {
        throw new BusinessError(
          "ERR_BUSINESS_RULE",
          "Pay at counter is not available for courier delivery",
          { channel }
        );
      }
      advanceRequiredPaisa = deposit;
      advancePurpose = "DEPOSIT";
      codCollectiblePaisa = balance;
    } else {
      throw new BusinessError("ERR_BUSINESS_RULE", `Unsupported payment mode: ${paymentMode}`);
    }
  }

  return {
    advanceRequiredPaisa,
    advancePurpose,
    codCollectiblePaisa,
    allowedModes,
  };
}
