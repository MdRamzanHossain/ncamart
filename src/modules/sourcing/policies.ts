import { Actor } from "@/lib/http/route";
import { ForbiddenError } from "@/lib/errors";

export function canManageSuppliers(actor: Actor | null): boolean {
  if (!actor || actor.type !== "staff") return false;
  const roles = actor.roles ?? [];
  return roles.includes("SUPER_ADMIN") || roles.includes("SOURCING_MANAGER");
}

export function canReadSuppliers(actor: Actor | null): boolean {
  if (!actor || actor.type !== "staff") return false;
  const roles = actor.roles ?? [];
  return (
    roles.includes("SUPER_ADMIN") ||
    roles.includes("SOURCING_MANAGER") ||
    roles.includes("GODOWN_MANAGER")
  );
}

export function assertCanManageSuppliers(actor: Actor | null): void {
  if (!canManageSuppliers(actor)) {
    throw new ForbiddenError("Insufficient permissions: requires SOURCING_MANAGER or SUPER_ADMIN");
  }
}

export function assertCanReadSuppliers(actor: Actor | null): void {
  if (!canReadSuppliers(actor)) {
    throw new ForbiddenError(
      "Insufficient permissions: requires SOURCING_MANAGER, GODOWN_MANAGER, or SUPER_ADMIN"
    );
  }
}

export function canAccessRunnerTasks(actor: Actor | null): boolean {
  if (!actor || actor.type !== "staff") return false;
  const roles = actor.roles ?? [];
  return (
    roles.includes("FIELD_RUNNER") ||
    roles.includes("SOURCING_MANAGER") ||
    roles.includes("SUPER_ADMIN") ||
    roles.includes("GODOWN_MANAGER") ||
    roles.includes("QC_TECHNICIAN")
  );
}

export function assertCanAccessRunnerTasks(actor: Actor | null): void {
  if (!canAccessRunnerTasks(actor)) {
    throw new ForbiddenError(
      "Insufficient permissions: requires FIELD_RUNNER, SOURCING_MANAGER, GODOWN_MANAGER, QC_TECHNICIAN, or SUPER_ADMIN"
    );
  }
}

export function canManageSourcingTasks(actor: Actor | null): boolean {
  if (!actor || actor.type !== "staff") return false;
  const roles = actor.roles ?? [];
  return roles.includes("SOURCING_MANAGER") || roles.includes("SUPER_ADMIN");
}

export function assertCanManageSourcingTasks(actor: Actor | null): void {
  if (!canManageSourcingTasks(actor)) {
    throw new ForbiddenError(
      "Insufficient permissions: requires SOURCING_MANAGER or SUPER_ADMIN"
    );
  }
}

export function canManageFloat(actor: Actor | null): boolean {
  if (!actor || actor.type !== "staff") return false;
  const roles = actor.roles ?? [];
  return roles.includes("FINANCE_OFFICER") || roles.includes("SUPER_ADMIN");
}

export function assertCanManageFloat(actor: Actor | null): void {
  if (!canManageFloat(actor)) {
    throw new ForbiddenError(
      "Insufficient permissions: requires FINANCE_OFFICER or SUPER_ADMIN"
    );
  }
}

export function canReadFloat(actor: Actor | null): boolean {
  if (!actor || actor.type !== "staff") return false;
  const roles = actor.roles ?? [];
  return (
    roles.includes("FINANCE_OFFICER") ||
    roles.includes("SOURCING_MANAGER") ||
    roles.includes("SUPER_ADMIN")
  );
}

export function assertCanReadFloat(actor: Actor | null): void {
  if (!canReadFloat(actor)) {
    throw new ForbiddenError(
      "Insufficient permissions: requires FINANCE_OFFICER, SOURCING_MANAGER, or SUPER_ADMIN"
    );
  }
}

export function canSignoffFloat(actor: Actor | null): boolean {
  if (!actor || actor.type !== "staff") return false;
  const roles = actor.roles ?? [];
  return (
    roles.includes("SOURCING_MANAGER") ||
    roles.includes("FINANCE_OFFICER") ||
    roles.includes("SUPER_ADMIN")
  );
}

export function assertCanSignoffFloat(actor: Actor | null): void {
  if (!canSignoffFloat(actor)) {
    throw new ForbiddenError(
      "Insufficient permissions: requires SOURCING_MANAGER, FINANCE_OFFICER, or SUPER_ADMIN"
    );
  }
}

export function canRunRunner(actor: Actor | null): boolean {
  if (!actor || actor.type !== "staff") return false;
  const roles = actor.roles ?? [];
  return roles.includes("FIELD_RUNNER") || roles.includes("SUPER_ADMIN");
}

export function assertCanRunRunner(actor: Actor | null): void {
  if (!canRunRunner(actor)) {
    throw new ForbiddenError(
      "Insufficient permissions: requires FIELD_RUNNER or SUPER_ADMIN"
    );
  }
}

export function canReceiveGodown(actor: Actor | null): boolean {
  if (!actor || actor.type !== "staff") return false;
  const roles = actor.roles ?? [];
  return (
    roles.includes("GODOWN_MANAGER") ||
    roles.includes("QC_TECHNICIAN") ||
    roles.includes("SUPER_ADMIN")
  );
}

export function assertCanReceiveGodown(actor: Actor | null): void {
  if (!canReceiveGodown(actor)) {
    throw new ForbiddenError(
      "Insufficient permissions: requires GODOWN_MANAGER, QC_TECHNICIAN, or SUPER_ADMIN"
    );
  }
}

export function canApprovePurchase(actor: Actor | null): boolean {
  if (!actor || actor.type !== "staff") return false;
  const roles = actor.roles ?? [];
  return roles.includes("SOURCING_MANAGER") || roles.includes("SUPER_ADMIN");
}

export function assertCanApprovePurchase(actor: Actor | null): void {
  if (!canApprovePurchase(actor)) {
    throw new ForbiddenError(
      "Insufficient permissions: requires SOURCING_MANAGER or SUPER_ADMIN"
    );
  }
}


