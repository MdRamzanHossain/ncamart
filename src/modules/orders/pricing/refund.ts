import { assertPaisa, sumPaisa, type Paisa } from "@/lib/money";
import { RefundableOrder } from "./types";

export const COURIER_HANDED_STATUSES = new Set([
  "HANDED_TO_COURIER",
  "DELIVERED",
  "PARTIALLY_DELIVERED",
  "RTO_IN_TRANSIT",
  "RTO_RECEIVED",
]);

export interface RefundableAmountResult {
  totalRefundablePaisa: Paisa;
  productRefundPaisa: Paisa;
  advanceFeeRefundPaisa: Paisa;
  handedToCourier: boolean;
  isFullOrderRefund: boolean;
}

/**
 * Calculates the refundable amount for specific lines of an order (PRD §3.14.5).
 * - Product refund: sum of net amounts paid for the lines after allocated discount.
 * - Advance delivery fee: refundable unless the parcel was handed to the courier,
 *   and applies when the entire order is cancelled/refunded.
 */
export function refundableAmountForLines(
  order: RefundableOrder,
  lineIds: string[]
): RefundableAmountResult {
  const handedToCourier =
    order.handedToCourier ?? COURIER_HANDED_STATUSES.has(order.status);

  const targetLineIdSet = new Set(lineIds);
  const matchedLines = order.lines.filter((l) => targetLineIdSet.has(l.id));

  const productRefundPaisa = sumPaisa(
    matchedLines.map((l) => assertPaisa(Math.max(0, l.netPaisa)))
  );

  const isFullOrderRefund =
    order.lines.length > 0 &&
    order.lines.every((l) => targetLineIdSet.has(l.id));

  let advanceFeeRefundPaisa = 0 as Paisa;
  if (!handedToCourier && isFullOrderRefund && order.advanceFeePaisa && order.advanceFeePaisa > 0) {
    advanceFeeRefundPaisa = assertPaisa(order.advanceFeePaisa);
  }

  const totalRefundablePaisa = assertPaisa(productRefundPaisa + advanceFeeRefundPaisa);

  return {
    totalRefundablePaisa,
    productRefundPaisa,
    advanceFeeRefundPaisa,
    handedToCourier,
    isFullOrderRefund,
  };
}
