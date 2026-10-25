import { Actor } from "@/lib/http/route";

export const analyticsPolicies = {
  canViewAnalytics(actor: Actor | null): boolean {
    if (!actor) return false;
    if (actor.type === "staff") {
      if (actor.roles.includes("SUPER_ADMIN")) return true;
      return (
        actor.permissions.includes("analytics.read") ||
        actor.permissions.includes("reports.read") ||
        actor.permissions.includes("admin.all")
      );
    }
    return false;
  },

  canTriggerFeeds(actor: Actor | null): boolean {
    if (!actor) return false;
    if (actor.type === "staff") {
      if (actor.roles.includes("SUPER_ADMIN")) return true;
      return (
        actor.permissions.includes("catalog.manage") ||
        actor.permissions.includes("feeds.manage") ||
        actor.permissions.includes("admin.all")
      );
    }
    return false;
  },
};
