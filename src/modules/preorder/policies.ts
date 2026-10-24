import { Actor } from "@/lib/http/route";
import { ForbiddenError } from "@/lib/errors";

export const preorderPolicies = {
  assertCanViewPreorders(actor: Actor): void {
    if (actor.type !== "staff") {
      throw new ForbiddenError("Staff access required to view pre-orders");
    }
    const allowedRoles = ["SOURCING_MANAGER", "GODOWN_MANAGER", "SUPER_ADMIN"];
    const roles = actor.roles ?? [];
    if (!roles.some((r) => allowedRoles.includes(r))) {
      throw new ForbiddenError("Insufficient permissions to view pre-orders");
    }
  },

  assertCanManageSourcing(actor: Actor): void {
    if (actor.type !== "staff") {
      throw new ForbiddenError("Staff access required to manage pre-order sourcing");
    }
    const allowedRoles = ["SOURCING_MANAGER", "SUPER_ADMIN"];
    const roles = actor.roles ?? [];
    if (!roles.some((r) => allowedRoles.includes(r))) {
      throw new ForbiddenError("Only Sourcing Managers or Super Admins can manage pre-order sourcing");
    }
  },

  assertCanManageArrival(actor: Actor): void {
    if (actor.type !== "staff") {
      throw new ForbiddenError("Staff access required to manage godown arrival and QC");
    }
    const allowedRoles = ["GODOWN_MANAGER", "SOURCING_MANAGER", "SUPER_ADMIN"];
    const roles = actor.roles ?? [];
    if (!roles.some((r) => allowedRoles.includes(r))) {
      throw new ForbiddenError("Godown Manager or Sourcing Manager required for arrival/QC");
    }
  },

  assertCanReprice(actor: Actor): void {
    if (actor.type !== "staff") {
      throw new ForbiddenError("Staff access required to reprice pre-orders");
    }
    const allowedRoles = ["SOURCING_MANAGER", "SUPER_ADMIN"];
    const roles = actor.roles ?? [];
    if (!roles.some((r) => allowedRoles.includes(r))) {
      throw new ForbiddenError("Only Sourcing Managers or Super Admins can trigger spot repricing");
    }
  },
};
