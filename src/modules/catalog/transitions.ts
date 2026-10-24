import { ProductStatus } from "./schema";
import { BusinessError } from "@/lib/errors";

/**
 * Product lifecycle status transitions.
 * Declared strictly as data and enforced centrally.
 * PRD §3.15.1: draft → pending_review → approved / rejected → published → archived.
 */
export const PRODUCT_STATUS_TRANSITIONS: Record<ProductStatus, readonly ProductStatus[]> = {
  DRAFT: ["PENDING_REVIEW", "ARCHIVED"],
  PENDING_REVIEW: ["APPROVED", "REJECTED", "DRAFT"],
  APPROVED: ["PUBLISHED", "REJECTED", "DRAFT"],
  REJECTED: ["DRAFT", "PENDING_REVIEW", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED", "DRAFT"],
  ARCHIVED: ["DRAFT", "PUBLISHED"],
};

export function canTransitionProductStatus(
  from: ProductStatus,
  to: ProductStatus
): boolean {
  if (from === to) return true;
  return PRODUCT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertCanTransitionProductStatus(
  from: ProductStatus,
  to: ProductStatus
): void {
  if (!canTransitionProductStatus(from, to)) {
    throw new BusinessError(
      "ERR_ILLEGAL_TRANSITION",
      `Cannot transition product from status '${from}' to '${to}'`
    );
  }
}
