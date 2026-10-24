// Public boundary for module: identity
// ONLY export service, events, policies, and DTOs. Never export schema or repo.
import { setGlobalSessionResolver, setGlobalPermissionChecker } from "@/lib/http/route";
import { authService } from "./auth";
import { staffAuthService } from "./staffAuth";
import { can, PermissionContext } from "./policies";
import { Permission, permissionsForRoles } from "./permissions";

// Wire authentication session resolution to withRoute
setGlobalSessionResolver(async (token: string) => {
  // 1. Resolve session via authService
  const resolved = await authService.resolveSession(token);
  if (resolved) {
    if (resolved.session.subjectType === "STAFF") {
      const roles = await staffAuthService.getStaffRoles(resolved.session.subjectId);
      const perms = Array.from(permissionsForRoles(roles));
      return {
        id: resolved.session.subjectId,
        type: "staff" as const,
        sessionId: resolved.session.id,
        roles,
        permissions: perms,
      };
    }

    return {
      id: resolved.session.subjectId,
      type: "customer" as const,
      sessionId: resolved.session.id,
      ownershipUnconfirmed: resolved.session.ownershipUnconfirmed,
      roles: [],
      permissions: ["catalog.read", "order.place"],
    };
  }

  // 2. Fallback to memory staff store for unit tests / offline mock mode
  const staffSess = staffAuthService.resolveMemoryStaffSession(token);
  if (staffSess) {
    const roles = staffAuthService.getMemoryStaffRoles(staffSess.subjectId);
    const perms = Array.from(permissionsForRoles(roles));
    return {
      id: staffSess.subjectId,
      type: "staff" as const,
      sessionId: staffSess.id,
      roles,
      permissions: perms,
    };
  }

  return null;
});

// Wire assertCan / can into withRoute's permission option
setGlobalPermissionChecker(async (actor, permission, context) => {
  return await can(actor, permission as Permission, context as PermissionContext | undefined);
});

export * from "./service";
export * from "./auth";
export * from "./staffAuth";
export * from "./customer";
export * from "./permissions";
export * from "./policies";
export * from "./pii";
export * from "./events";
export * from "./dto";
