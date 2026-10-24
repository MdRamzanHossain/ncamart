/**
 * Largest-remainder (Hamilton) allocation: splits an integer total into integer parts
 * proportional to weights, summing exactly to the total. Ties go to the lower index,
 * so results are deterministic.
 */
import { assertPaisa, type Paisa } from "./money";
import { ValidationError } from "./errors";

export function largestRemainderAllocate(totalPaisa: Paisa, weights: readonly number[]): Paisa[] {
  assertPaisa(totalPaisa);
  if (weights.length === 0) throw new ValidationError("At least one weight is required");
  for (const w of weights) {
    if (!Number.isSafeInteger(w) || w < 0) {
      throw new ValidationError("Weights must be non-negative integers", { weight: w });
    }
  }
  const weightSum = weights.reduce((s, w) => s + BigInt(w), 0n);
  if (weightSum === 0n) throw new ValidationError("Sum of weights must be positive");

  const total = BigInt(totalPaisa);
  const parts = weights.map((w, index) => {
    const product = total * BigInt(w);
    return { index, base: product / weightSum, remainder: product % weightSum };
  });

  let leftover = total - parts.reduce((s, p) => s + p.base, 0n);
  const order = [...parts].sort((a, b) => {
    if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
    return a.index - b.index;
  });
  const result = parts.map((p) => p.base);
  for (const p of order) {
    if (leftover === 0n) break;
    result[p.index] = (result[p.index] ?? 0n) + 1n;
    leftover -= 1n;
  }
  return result.map((v) => assertPaisa(Number(v)));
}
