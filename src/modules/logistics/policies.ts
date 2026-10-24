import { Actor } from "@/lib/http/route";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

function getActorRoles(actor: Actor): string[] {
  const roles = [...(actor.roles ?? [])];
  const legacyRole = (actor as unknown as { role?: string }).role;
  if (legacyRole && !roles.includes(legacyRole)) {
    roles.push(legacyRole);
  }
  return roles.map((r) => r.toUpperCase());
}

export function canViewDispatchQueue(actor: Actor | null): boolean {
  if (!actor) return false;
  const roles = getActorRoles(actor);
  if (roles.includes("SUPER_ADMIN")) return true;
  if (actor.permissions?.includes("pii.read.shipping")) return true;
  if (actor.permissions?.includes("dispatch.pack")) return true;
  return roles.includes("DISPATCH_STAFF") || roles.includes("GODOWN_MANAGER");
}

export function assertCanViewDispatchQueue(actor: Actor | null): void {
  if (!actor) throw new UnauthorizedError("Authentication required");
  if (!canViewDispatchQueue(actor)) {
    throw new ForbiddenError("Insufficient permissions to access packaging dispatch queue");
  }
}

export function canPackOrder(actor: Actor | null): boolean {
  if (!actor) return false;
  const roles = getActorRoles(actor);
  if (roles.includes("SUPER_ADMIN")) return true;
  if (actor.permissions?.includes("dispatch.pack")) return true;
  return roles.includes("DISPATCH_STAFF") || roles.includes("GODOWN_MANAGER");
}

export function assertCanPackOrder(actor: Actor | null): void {
  if (!actor) throw new UnauthorizedError("Authentication required");
  if (!canPackOrder(actor)) {
    throw new ForbiddenError("Insufficient permissions to pack orders");
  }
}

export function canBookCourier(actor: Actor | null): boolean {
  if (!actor) return false;
  if (actor.type.toLowerCase() === "system") return true;
  const roles = getActorRoles(actor);
  if (roles.includes("SUPER_ADMIN")) return true;
  if (actor.permissions?.includes("dispatch.book")) return true;
  return roles.includes("DISPATCH_STAFF") || roles.includes("GODOWN_MANAGER");
}

export function assertCanBookCourier(actor: Actor | null): void {
  if (!actor) throw new UnauthorizedError("Authentication required");
  if (!canBookCourier(actor)) {
    throw new ForbiddenError("Insufficient permissions to book courier consignments");
  }
}

export function canHandover(actor: Actor | null): boolean {
  if (!actor) return false;
  if (actor.type.toLowerCase() === "system") return true;
  const roles = getActorRoles(actor);
  if (roles.includes("SUPER_ADMIN")) return true;
  if (actor.permissions?.includes("dispatch.pack") || actor.permissions?.includes("dispatch.book")) return true;
  return roles.includes("DISPATCH_STAFF") || roles.includes("GODOWN_MANAGER");
}

export function assertCanHandover(actor: Actor | null): void {
  if (!actor) throw new UnauthorizedError("Authentication required");
  if (!canHandover(actor)) {
    throw new ForbiddenError("Insufficient permissions to confirm courier handover");
  }
}
