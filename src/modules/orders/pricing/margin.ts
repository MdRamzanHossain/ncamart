import { assertPaisa } from "@/lib/money";
import { vatFromInclusive } from "@/lib/vat";
import { MarginCheckInput, MarginCheckResult } from "./types";

/**
 * Checks wholesaler/runner spot price tolerance and gross margin (architechture.md §11.1, PRD §3.4.2).
 *
 * Rule:
 * 1. Spot tolerance: quoted_unit_cost <= base_cost * (1 + spot_buffer_pct)
 * 2. Gross margin: (list_price_ex_vat - quoted_unit_cost) / list_price_ex_vat >= min_margin_pct (e.g. 15%)
 *
 * Margin is calculated strictly on the list price EXCLUDING VAT.
 * Coupons and delivery fees are excluded.
 */
export function marginCheck(input: MarginCheckInput): MarginCheckResult {
  const {
    listPricePaisa,
    vatRateBp,
    quotedUnitCostPaisa,
    baseCostPaisa,
    spotBufferBp,
    minMarginBp,
  } = input;

  // 1. Compute list price excluding VAT
  const { netPaisa: listPriceExVatPaisa } = vatFromInclusive(
    assertPaisa(listPricePaisa),
    vatRateBp
  );

  // 2. Buffer tolerance check: quotedUnitCost <= baseCost * (1 + spotBufferBp / 10000)
  // Cross-multiply with BigInt to eliminate floating-point imprecision
  const overBuffer =
    BigInt(quotedUnitCostPaisa) * 10000n >
    BigInt(baseCostPaisa) * BigInt(10000 + spotBufferBp);

  // 3. Margin check
  let marginBp = 0;
  if (listPriceExVatPaisa > 0) {
    const marginPaisa = listPriceExVatPaisa - quotedUnitCostPaisa;
    marginBp = Math.floor((marginPaisa * 10000) / listPriceExVatPaisa);
  }

  const passesMargin =
    listPriceExVatPaisa > 0 &&
    BigInt(listPriceExVatPaisa - quotedUnitCostPaisa) * 10000n >=
      BigInt(listPriceExVatPaisa) * BigInt(minMarginBp);

  const allowed = !overBuffer && passesMargin;

  return {
    allowed,
    marginBp,
    overBuffer,
  };
}
