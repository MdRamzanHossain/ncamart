import { Actor } from "@/lib/http/route";
import { ForbiddenError } from "@/lib/errors";

export function canOperatePos(actor: Actor | null): boolean {
  if (!actor) return false;
  if (actor.roles?.includes("SUPER_ADMIN")) return true;
  if (actor.roles?.includes("SHOWROOM_POS_STAFF")) return true;
  return actor.permissions?.includes("pos.operate") ?? false;
}

export function assertCanOperatePos(actor: Actor | null): void {
  if (!canOperatePos(actor)) {
    throw new ForbiddenError("Staff lacks permission to operate Showroom POS counter");
  }
}

export function canCountDrawer(actor: Actor | null): boolean {
  if (!actor) return false;
  if (actor.roles?.includes("SUPER_ADMIN")) return true;
  if (actor.roles?.includes("SHOWROOM_POS_STAFF")) return true;
  return actor.permissions?.includes("drawer.count") ?? false;
}

export function assertCanCountDrawer(actor: Actor | null): void {
  if (!canCountDrawer(actor)) {
    throw new ForbiddenError("Staff lacks permission to count cash drawer session");
  }
}

export function canReconcileDrawer(actor: Actor | null): boolean {
  if (!actor) return false;
  if (actor.roles?.includes("SUPER_ADMIN")) return true;
  if (actor.roles?.includes("FINANCE_OFFICER")) return true;
  return actor.permissions?.includes("drawer.reconcile") ?? false;
}

export function assertCanReconcileDrawer(actor: Actor | null): void {
  if (!canReconcileDrawer(actor)) {
    throw new ForbiddenError("Staff lacks permission to reconcile cash drawer sessions");
  }
}

export function canResetPickupPin(actor: Actor | null): boolean {
  if (!actor) return false;
  if (actor.roles?.includes("SUPER_ADMIN")) return true;
  if (actor.roles?.includes("CUSTOMER_SUPPORT")) return true;
  return false;
}

export function assertCanResetPickupPin(actor: Actor | null): void {
  if (!canResetPickupPin(actor)) {
    throw new ForbiddenError("Staff lacks permission to reset customer pickup PIN");
  }
}
