import { Actor } from "@/lib/http/route";
import { ForbiddenError } from "@/lib/errors";
import { settingsService } from "@/modules/settings";
import { Permission, permissionsForRoles } from "./permissions";

export interface PermissionContext {
  amountPaisa?: number;
  entityId?: string;
  [key: string]: unknown;
}

/**
 * Check whether an authenticated actor has a specific permission,
 * enforcing dynamic amount limits from the settings table where applicable.
 */
export async function can(
  actor: Actor | null,
  permission: Permission,
  context?: PermissionContext
): Promise<boolean> {
  if (!actor) return false;

  const roles = actor.roles ?? [];
  const grantedPermissions = permissionsForRoles(roles);

  if (!grantedPermissions.has(permission)) {
    return false;
  }

  // Super admins have unrestricted access without amount caps
  if (roles.includes("SUPER_ADMIN")) {
    return true;
  }

  // Evaluate amount-limited permissions (refund.approve, store_credit.issue)
  if (context?.amountPaisa !== undefined) {
    const amount = context.amountPaisa;

    if (permission === "refund.approve" || permission === "store_credit.issue") {
      if (roles.includes("FINANCE_OFFICER")) {
        const financeLimit = await settingsService.get("REFUND_LIMIT_FINANCE_PAISA");
        return amount <= financeLimit;
      }

      if (roles.includes("CUSTOMER_SUPPORT")) {
        const supportLimit = await settingsService.get("REFUND_LIMIT_SUPPORT_PAISA");
        return amount <= supportLimit;
      }
    }
  }

  return true;
}

/**
 * Assert that an actor holds the required permission, throwing ForbiddenError if not.
 */
export async function assertCan(
  actor: Actor | null,
  permission: Permission,
  context?: PermissionContext
): Promise<void> {
  const allowed = await can(actor, permission, context);
  if (!allowed) {
    if (context?.amountPaisa !== undefined) {
      throw new ForbiddenError(
        `Permission ${permission} denied: amount of ৳${(context.amountPaisa / 100).toFixed(2)} exceeds authorized approval threshold`
      );
    }
    throw new ForbiddenError(`Missing required permission: ${permission}`);
  }
}
