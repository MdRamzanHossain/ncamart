export const STAFF_ROLES = [
  "FIELD_RUNNER",
  "QC_TECHNICIAN",
  "GODOWN_MANAGER",
  "DISPATCH_STAFF",
  "SHOWROOM_POS_STAFF",
  "SOURCING_MANAGER",
  "CATALOG_MANAGER",
  "CUSTOMER_SUPPORT",
  "FINANCE_OFFICER",
  "SUPER_ADMIN",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const ALL_PERMISSIONS = [
  "catalog.read",
  "order.place",
  "runner.task.own",
  "runner.task.read",
  "runner.task.assign",
  "sourcing.price.input",
  "sourcing.price.override",
  "qc.execute",
  "seal.print",
  "qc.sampling.audit",
  "seal.void.approve",
  "dispatch.pack",
  "dispatch.book",
  "returns.receive",
  "stock.adjust.request",
  "stock.adjust.approve",
  "pos.operate",
  "drawer.count",
  "drawer.reconcile",
  "pii.read.full",
  "pii.read.shipping",
  "pii.read.counter",
  "pii.read.billing",
  "spot.override.approve",
  "rma.adjudicate",
  "refund.approve",
  "refund.execute",
  "store_credit.issue",
  "catalog.draft",
  "catalog.publish",
  "coupon.draft",
  "coupon.activate",
  "float.own",
  "float.read",
  "float.manage",
  "settlement.reconcile",
  "ledger.read",
  "reports.export",
  "staff.manage",
  "audit.read",
  "settings.manage",
  "security.alerts.read",
  "queues.admin",
  "support.manage",
  "sourcing.quarantine.review",
  "data_protection.anonymize",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const ROLE_PERMISSION_MATRIX: Record<StaffRole, readonly Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,

  FIELD_RUNNER: [
    "catalog.read",
    "runner.task.own",
    "sourcing.price.input",
    "float.own",
  ],

  QC_TECHNICIAN: [
    "catalog.read",
    "qc.execute",
    "seal.print",
    "returns.receive",
  ],

  GODOWN_MANAGER: [
    "catalog.read",
    "runner.task.read",
    "qc.execute",
    "seal.print",
    "qc.sampling.audit",
    "seal.void.approve",
    "dispatch.pack",
    "dispatch.book",
    "returns.receive",
    "stock.adjust.request",
  ],

  DISPATCH_STAFF: [
    "catalog.read",
    "dispatch.pack",
    "dispatch.book",
    "returns.receive",
    "pii.read.shipping",
  ],

  SHOWROOM_POS_STAFF: [
    "catalog.read",
    "pos.operate",
    "drawer.count",
    "pii.read.counter",
  ],

  SOURCING_MANAGER: [
    "catalog.read",
    "runner.task.read",
    "runner.task.assign",
    "sourcing.price.override",
    "spot.override.approve",
    "seal.void.approve",
    "float.read",
    "sourcing.quarantine.review",
  ],

  CATALOG_MANAGER: [
    "catalog.read",
    "catalog.draft",
    "coupon.draft",
  ],

  CUSTOMER_SUPPORT: [
    "catalog.read",
    "pii.read.full",
    "rma.adjudicate",
    "refund.approve",
    "store_credit.issue",
    "support.manage",
  ],

  FINANCE_OFFICER: [
    "catalog.read",
    "refund.approve",
    "refund.execute",
    "store_credit.issue",
    "drawer.reconcile",
    "settlement.reconcile",
    "ledger.read",
    "reports.export",
    "pii.read.billing",
    "stock.adjust.approve",
    "float.manage",
    "float.read",
  ],
};

/**
 * Compute the additive union of permissions granted by one or more staff roles.
 */
export function permissionsForRoles(roles: string[]): Set<Permission> {
  const result = new Set<Permission>();
  for (const role of roles) {
    const perms = ROLE_PERMISSION_MATRIX[role as StaffRole];
    if (perms) {
      for (const p of perms) {
        result.add(p);
      }
    }
  }
  return result;
}
