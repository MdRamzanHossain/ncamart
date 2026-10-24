export type CodEligibility = "FULL_COD" | "ADVANCE_FEE_REQUIRED" | "COD_BLOCKED";

export interface CodEligibilityInput {
  deliveredCount: number;
  rtoCount12m: number;
  codBlocked: boolean;
}

/**
 * Pure function evaluating Cash-On-Delivery (COD) eligibility (architechture.md §9.3):
 * - delivered >= 1 && rto == 0 → FULL_COD
 * - rto >= 2 || codBlocked → COD_BLOCKED
 * - else → ADVANCE_FEE_REQUIRED
 */
export function codEligibility(input: CodEligibilityInput): CodEligibility {
  if (input.codBlocked || input.rtoCount12m >= 2) {
    return "COD_BLOCKED";
  }
  if (input.deliveredCount >= 1 && input.rtoCount12m === 0) {
    return "FULL_COD";
  }
  return "ADVANCE_FEE_REQUIRED";
}

// RBAC permission checks and policies for module: orders
export const ordersPolicies = {
  canRead: () => true,
  canWrite: () => true,
};
