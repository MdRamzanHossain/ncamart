import { Actor } from "@/lib/http/route";
import { ForbiddenError } from "@/lib/errors";
import { RefundRow } from "./schema";

// --------------------------------------------------------------------------
// RBAC Permission Checks and Policies for Module: Payments & Refunds (P33)
// --------------------------------------------------------------------------

export const paymentsPolicies = {
  canReviewPayment: (actor: Actor): boolean => {
    if (actor.type !== "staff") return false;
    const roles = actor.roles ?? [];
    return roles.includes("CUSTOMER_SUPPORT") || roles.includes("SUPER_ADMIN");
  },

  canViewPayments: (actor: Actor): boolean => {
    if (actor.type !== "staff") return false;
    const roles = actor.roles ?? [];
    return (
      roles.includes("FINANCE_OFFICER") ||
      roles.includes("CUSTOMER_SUPPORT") ||
      roles.includes("SUPER_ADMIN")
    );
  },

  /**
   * Only Support, Finance, Super Admin or system can request refunds.
   */
  assertCanRequestRefund(actor: Actor): void {
    if (actor.type === "system") return;
    if (actor.type !== "staff") {
      throw new ForbiddenError("Only staff or system can request refunds");
    }

    const roles = actor.roles ?? [];
    const perms = actor.permissions ?? [];
    const hasRole =
      roles.includes("CUSTOMER_SUPPORT") ||
      roles.includes("FINANCE_OFFICER") ||
      roles.includes("SUPER_ADMIN");
    const hasPerm = perms.includes("refund.request");

    if (!hasRole && !hasPerm) {
      throw new ForbiddenError(
        "Staff role CUSTOMER_SUPPORT, FINANCE_OFFICER, or SUPER_ADMIN required to request refunds"
      );
    }
  },

  /**
   * PRD §3.14.2 & Flow 13 Approval limits:
   * Support ≤ ৳1,000 (100,000 paisa)
   * Finance ≤ ৳20,000 (2,000,000 paisa)
   * Super Admin above ৳20,000 (unlimited)
   */
  assertCanApproveRefund(actor: Actor, amountPaisa: number): void {
    if (actor.type === "system") return;
    if (actor.type !== "staff") {
      throw new ForbiddenError("Staff authentication required to approve refunds");
    }

    const roles = actor.roles ?? [];
    const perms = actor.permissions ?? [];

    const hasApprovePerm =
      perms.includes("refund.approve") ||
      roles.includes("CUSTOMER_SUPPORT") ||
      roles.includes("FINANCE_OFFICER") ||
      roles.includes("SUPER_ADMIN");

    if (!hasApprovePerm) {
      throw new ForbiddenError("Permission 'refund.approve' required to approve refunds");
    }

    // Super Admin has unlimited approval authority
    if (roles.includes("SUPER_ADMIN")) {
      return;
    }

    // Finance Officer is capped at ৳20,000 (2,000,000 paisa)
    if (roles.includes("FINANCE_OFFICER")) {
      if (amountPaisa > 2000000) {
        throw new ForbiddenError(
          `Refund amount of ৳${(amountPaisa / 100).toFixed(
            2
          )} exceeds Finance Officer limit of ৳20,000. Super Admin approval required.`
        );
      }
      return;
    }

    // Customer Support is capped at ৳1,000 (100,000 paisa)
    if (roles.includes("CUSTOMER_SUPPORT")) {
      if (amountPaisa > 100000) {
        throw new ForbiddenError(
          `Refund amount of ৳${(amountPaisa / 100).toFixed(
            2
          )} exceeds Customer Support limit of ৳1,000. Finance approval required.`
        );
      }
      return;
    }

    // Other staff roles
    throw new ForbiddenError(
      "Staff role CUSTOMER_SUPPORT, FINANCE_OFFICER, or SUPER_ADMIN required to approve refunds"
    );
  },

  /**
   * Only Finance Officer, Super Admin or system can execute manual refund payouts.
   */
  assertCanExecuteRefund(actor: Actor): void {
    if (actor.type === "system") return;
    if (actor.type !== "staff") {
      throw new ForbiddenError("Staff authentication required to execute payouts");
    }

    const roles = actor.roles ?? [];
    const perms = actor.permissions ?? [];
    const hasRole =
      roles.includes("FINANCE_OFFICER") || roles.includes("SUPER_ADMIN");
    const hasPerm = perms.includes("refund.execute");

    if (!hasRole && !hasPerm) {
      throw new ForbiddenError(
        "FINANCE_OFFICER or SUPER_ADMIN role required to execute manual refund payouts"
      );
    }
  },

  /**
   * View access: staff (Support, Finance, Admin) or customer who owns the order.
   */
  assertCanViewRefund(
    actor: Actor,
    refund: RefundRow,
    orderCustomerId?: string | null
  ): void {
    if (actor.type === "system") return;

    if (actor.type === "staff") {
      const roles = actor.roles ?? [];
      if (
        roles.includes("CUSTOMER_SUPPORT") ||
        roles.includes("FINANCE_OFFICER") ||
        roles.includes("SUPER_ADMIN")
      ) {
        return;
      }
      throw new ForbiddenError("Insufficient staff permissions to view refund");
    }

    if (actor.type === "customer") {
      if (orderCustomerId && orderCustomerId === actor.id) {
        return;
      }
      throw new ForbiddenError("Customers can only view refunds for their own orders");
    }

    throw new ForbiddenError("Authentication required to view refund");
  },
};
