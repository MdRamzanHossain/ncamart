import { Actor } from "@/lib/http/route";

// RBAC permission checks and policies for module: payments
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
};
