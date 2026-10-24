import { Actor } from "@/lib/http/route";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

export function canExecuteQc(actor: Actor | null): boolean {
  if (!actor || actor.type !== "staff") return false;
  const roles = actor.roles ?? [];
  return (
    roles.includes("QC_TECHNICIAN") ||
    roles.includes("GODOWN_MANAGER") ||
    roles.includes("SUPER_ADMIN")
  );
}

export function assertCanExecuteQc(actor: Actor | null): void {
  if (!actor) throw new UnauthorizedError("Authentication required");
  if (!canExecuteQc(actor)) {
    throw new ForbiddenError(
      "Insufficient permissions: requires QC_TECHNICIAN, GODOWN_MANAGER, or SUPER_ADMIN"
    );
  }
}

export function canPrintSeal(actor: Actor | null): boolean {
  if (!actor || actor.type !== "staff") return false;
  const roles = actor.roles ?? [];
  return (
    roles.includes("QC_TECHNICIAN") ||
    roles.includes("GODOWN_MANAGER") ||
    roles.includes("SUPER_ADMIN")
  );
}

export function assertCanPrintSeal(actor: Actor | null): void {
  if (!actor) throw new UnauthorizedError("Authentication required");
  if (!canPrintSeal(actor)) {
    throw new ForbiddenError(
      "Insufficient permissions: requires QC_TECHNICIAN, GODOWN_MANAGER, or SUPER_ADMIN"
    );
  }
}

export function canApproveSealVoid(actor: Actor | null): boolean {
  if (!actor || actor.type !== "staff") return false;
  const roles = actor.roles ?? [];
  return (
    roles.includes("GODOWN_MANAGER") ||
    roles.includes("SOURCING_MANAGER") ||
    roles.includes("SUPER_ADMIN")
  );
}

export function assertCanApproveSealVoid(actor: Actor | null): void {
  if (!actor) throw new UnauthorizedError("Authentication required");
  if (!canApproveSealVoid(actor)) {
    throw new ForbiddenError(
      "Insufficient permissions: requires GODOWN_MANAGER, SOURCING_MANAGER, or SUPER_ADMIN"
    );
  }
}

export function canAuditSampling(actor: Actor | null): boolean {
  if (!actor || actor.type !== "staff") return false;
  const roles = actor.roles ?? [];
  return roles.includes("GODOWN_MANAGER") || roles.includes("SUPER_ADMIN");
}

export function assertCanAuditSampling(actor: Actor | null): void {
  if (!actor) throw new UnauthorizedError("Authentication required");
  if (!canAuditSampling(actor)) {
    throw new ForbiddenError(
      "Insufficient permissions: requires GODOWN_MANAGER or SUPER_ADMIN"
    );
  }
}
