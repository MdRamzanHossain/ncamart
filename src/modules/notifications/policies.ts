import { Actor } from "@/lib/http/route";

export const notificationsPolicies = {
  /**
   * Support agent or admin can view dead-letter logs.
   */
  canViewDeadLetter(actor: Actor | null | undefined): boolean {
    if (!actor) return false;
    if (actor.roles?.includes("SUPER_ADMIN")) return true;
    if (actor.roles?.includes("CUSTOMER_SUPPORT") || actor.roles?.includes("ADMIN")) return true;
    return Boolean(
      actor.permissions?.includes("notifications.read") ||
        actor.permissions?.includes("admin.support")
    );
  },

  /**
   * Support agent or admin can retry dead-letter notifications.
   */
  canRetryDeadLetter(actor: Actor | null | undefined): boolean {
    if (!actor) return false;
    if (actor.roles?.includes("SUPER_ADMIN")) return true;
    if (actor.roles?.includes("CUSTOMER_SUPPORT") || actor.roles?.includes("ADMIN")) return true;
    return Boolean(
      actor.permissions?.includes("notifications.retry") ||
        actor.permissions?.includes("admin.support")
    );
  },

  /**
   * Customer can manage their own preferences; Admin can manage any.
   */
  canManagePreferences(actor: Actor | null | undefined, customerId: string): boolean {
    if (!actor) return false;
    if (actor.roles?.includes("SUPER_ADMIN")) return true;
    if (actor.id === customerId) return true;
    return false;
  },
};
