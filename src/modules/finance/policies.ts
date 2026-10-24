import { Actor } from "@/lib/http/route";

export const financePolicies = {
  canViewMushakInvoice(actor: Actor | null, orderCustomerId: string): boolean {
    if (!actor) return false;
    if (actor.type === "customer") {
      return actor.id === orderCustomerId;
    }
    if (actor.type === "staff") {
      const roles = actor.roles ?? [];
      return (
        roles.includes("FINANCE_OFFICER") ||
        roles.includes("SUPER_ADMIN") ||
        roles.includes("CUSTOMER_SUPPORT")
      );
    }
    return false;
  },

  canViewInvoice(actor: Actor | null, orderCustomerId: string): boolean {
    if (!actor) return false;
    if (actor.type === "customer") {
      return actor.id === orderCustomerId;
    }
    if (actor.type === "staff") {
      return true; // Any staff can view system invoice for support/warehouse/order checking
    }
    return false;
  },
};
