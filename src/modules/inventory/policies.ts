import { Actor } from "@/lib/http/route";
import { ForbiddenError } from "@/lib/errors";

export function canReadInventory(actor: Actor | null): boolean {
  if (!actor || actor.type !== "staff") return false;
  const roles = actor.roles ?? [];
  return (
    roles.includes("SUPER_ADMIN") ||
    roles.includes("GODOWN_MANAGER") ||
    roles.includes("SHOWROOM_POS_STAFF") ||
    roles.includes("SOURCING_MANAGER") ||
    roles.includes("FINANCE_OFFICER")
  );
}

export function canManageInventory(actor: Actor | null): boolean {
  if (!actor || actor.type !== "staff") return false;
  const roles = actor.roles ?? [];
  return (
    roles.includes("SUPER_ADMIN") ||
    roles.includes("GODOWN_MANAGER") ||
    roles.includes("QC_TECHNICIAN")
  );
}

export function canRequestAdjustment(actor: Actor | null): boolean {
  if (!actor || actor.type !== "staff") return false;
  const roles = actor.roles ?? [];
  return roles.includes("SUPER_ADMIN") || roles.includes("GODOWN_MANAGER");
}

export function canApproveAdjustment(actor: Actor | null): boolean {
  if (!actor || actor.type !== "staff") return false;
  const roles = actor.roles ?? [];
  return roles.includes("SUPER_ADMIN") || roles.includes("FINANCE_OFFICER");
}

export function assertCanReadInventory(actor: Actor | null): void {
  if (!canReadInventory(actor)) {
    throw new ForbiddenError(
      "Insufficient permissions: requires GODOWN_MANAGER, FINANCE_OFFICER, or SUPER_ADMIN"
    );
  }
}

export function assertCanManageInventory(actor: Actor | null): void {
  if (!canManageInventory(actor)) {
    throw new ForbiddenError(
      "Insufficient permissions: requires GODOWN_MANAGER or SUPER_ADMIN"
    );
  }
}

export function assertCanRequestAdjustment(actor: Actor | null): void {
  if (!canRequestAdjustment(actor)) {
    throw new ForbiddenError(
      "Insufficient permissions: requires GODOWN_MANAGER or SUPER_ADMIN"
    );
  }
}

export function assertCanApproveAdjustment(actor: Actor | null): void {
  if (!canApproveAdjustment(actor)) {
    throw new ForbiddenError(
      "Insufficient permissions: requires FINANCE_OFFICER or SUPER_ADMIN"
    );
  }
}
