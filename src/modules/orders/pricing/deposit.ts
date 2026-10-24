const BREAK = 5_000_000; // ৳50,000 in paisa

/**
 * Calculates progressive pre-order deposit per unit (PRD §3.3.2, architechture.md §8.4).
 * Formula: 20% of first ৳50,000 + 10% of remaining amount.
 * Rounded UP to the nearest ৳10 (1000 paisa) and capped at unitPricePaisa.
 *
 * Effective rate strictly stays between 10% and 20% with zero cliff.
 */
export function unitDepositPaisa(unitPricePaisa: number): number {
  if (unitPricePaisa <= 0) return 0;

  // 20% of the first ৳50,000 + 10% of the rest, computed in integer hundredths
  const scaled = Math.min(unitPricePaisa, BREAK) * 20 + Math.max(unitPricePaisa - BREAK, 0) * 10;
  const deposit = Math.ceil(scaled / 100); // paisa
  const roundedUp10Taka = Math.ceil(deposit / 1000) * 1000; // ৳10 = 1000 paisa
  return Math.min(roundedUp10Taka, unitPricePaisa);
}

/**
 * Calculates total pre-order deposit across all order lines.
 * unitPricePaisa must be the effective unit price after allocated discount:
 * floor(line net after allocated discount / qty).
 */
export function orderDepositPaisa(lines: { unitPricePaisa: number; qty: number }[]): number {
  return lines.reduce((sum, l) => sum + unitDepositPaisa(l.unitPricePaisa) * l.qty, 0);
}
