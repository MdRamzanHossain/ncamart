import { Actor } from "@/lib/http/route";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { WarrantyClaimRow } from "./schema";

/**
 * RBAC permission assertions for RMA module.
 */
export const rmaPolicies = {
  assertCanSubmitClaim(actor: Actor): void {
    if (!actor || !actor.id) {
      throw new UnauthorizedError("Authentication required to submit warranty claim");
    }
  },

  assertCanAdjudicateRma(actor: Actor): void {
    if (!actor || !actor.id) {
      throw new UnauthorizedError("Authentication required");
    }
    if (actor.type !== "staff") {
      throw new ForbiddenError("Staff authorization required for RMA adjudication");
    }
    const hasRole =
      actor.roles?.includes("SUPER_ADMIN") ||
      actor.roles?.includes("CUSTOMER_SUPPORT");
    const hasPerm = actor.permissions?.includes("rma.adjudicate");
    if (!hasRole && !hasPerm) {
      throw new ForbiddenError(
        "CUSTOMER_SUPPORT role or 'rma.adjudicate' permission required"
      );
    }
  },

  assertCanReceiveRma(actor: Actor): void {
    if (!actor || !actor.id) {
      throw new UnauthorizedError("Authentication required");
    }
    if (actor.type !== "staff") {
      throw new ForbiddenError("Staff authorization required for RMA receipt");
    }
    const hasRole =
      actor.roles?.includes("SUPER_ADMIN") ||
      actor.roles?.includes("QC_TECHNICIAN") ||
      actor.roles?.includes("GODOWN_MANAGER") ||
      actor.roles?.includes("DISPATCH_STAFF");
    const hasPerm =
      actor.permissions?.includes("returns.receive") ||
      actor.permissions?.includes("qc.execute");
    if (!hasRole && !hasPerm) {
      throw new ForbiddenError(
        "QC_TECHNICIAN or GODOWN_MANAGER role required to receive RMA parcel"
      );
    }
  },

  assertCanInspectRma(actor: Actor): void {
    if (!actor || !actor.id) {
      throw new UnauthorizedError("Authentication required");
    }
    if (actor.type !== "staff") {
      throw new ForbiddenError("Staff authorization required for RMA QC inspection");
    }
    const hasRole =
      actor.roles?.includes("SUPER_ADMIN") ||
      actor.roles?.includes("QC_TECHNICIAN") ||
      actor.roles?.includes("GODOWN_MANAGER");
    const hasPerm = actor.permissions?.includes("qc.execute");
    if (!hasRole && !hasPerm) {
      throw new ForbiddenError(
        "QC_TECHNICIAN role or 'qc.execute' permission required for RMA inspection"
      );
    }
  },

  assertCanLiaisonRma(actor: Actor): void {
    if (!actor || !actor.id) {
      throw new UnauthorizedError("Authentication required");
    }
    if (actor.type !== "staff") {
      throw new ForbiddenError("Staff authorization required for distributor liaison");
    }
    const hasRole =
      actor.roles?.includes("SUPER_ADMIN") ||
      actor.roles?.includes("CUSTOMER_SUPPORT") ||
      actor.roles?.includes("QC_TECHNICIAN");
    const hasPerm =
      actor.permissions?.includes("rma.adjudicate") ||
      actor.permissions?.includes("qc.execute");
    if (!hasRole && !hasPerm) {
      throw new ForbiddenError(
        "CUSTOMER_SUPPORT or QC_TECHNICIAN role required for distributor liaison"
      );
    }
  },

  assertCanViewClaim(actor: Actor, claim: WarrantyClaimRow): void {
    if (!actor || !actor.id) {
      throw new UnauthorizedError("Authentication required");
    }

    // Owner customer can view own claim
    if (actor.type === "customer" && actor.id === claim.customerId) {
      return;
    }

    // Staff with appropriate permissions can view
    if (actor.type === "staff") {
      const isSupportOrQc =
        actor.roles?.includes("SUPER_ADMIN") ||
        actor.roles?.includes("CUSTOMER_SUPPORT") ||
        actor.roles?.includes("QC_TECHNICIAN") ||
        actor.roles?.includes("GODOWN_MANAGER");
      const hasPerm =
        actor.permissions?.includes("rma.adjudicate") ||
        actor.permissions?.includes("pii.read.full") ||
        actor.permissions?.includes("qc.execute");
      if (isSupportOrQc || hasPerm) {
        return;
      }
    }

    throw new ForbiddenError("You are not authorized to view this warranty claim");
  },
};
