import { Actor } from "@/lib/http/route";

export const engagementPolicies = {
  canSubmitReview(actor: Actor | null): boolean {
    return Boolean(actor && actor.type === "customer");
  },

  canModerateReview(actor: Actor | null): boolean {
    if (!actor || actor.type !== "staff") return false;
    if (actor.roles?.includes("SUPER_ADMIN") || actor.roles?.includes("CUSTOMER_SUPPORT")) {
      return true;
    }
    return Boolean(actor.permissions?.includes("reviews.moderate"));
  },

  canManageWishlist(actor: Actor | null, targetCustomerId: string): boolean {
    if (!actor || actor.type !== "customer") return false;
    return actor.id === targetCustomerId;
  },

  canManageCart(actor: Actor | null, targetCustomerId: string): boolean {
    if (!actor || actor.type !== "customer") return false;
    return actor.id === targetCustomerId;
  },
};
