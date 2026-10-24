import { Actor } from "@/lib/http/route";
import { ForbiddenError } from "@/lib/errors";
import { assertCan } from "@/modules/identity/policies";

export const ledgerPolicies = {
  /**
   * Asserts actor has permission to read the general ledger (FINANCE_OFFICER, SUPER_ADMIN).
   */
  async assertCanReadLedger(actor: Actor | null): Promise<void> {
    if (!actor) {
      throw new ForbiddenError("Authentication required");
    }

    const isFinanceOrSuperAdmin = (actor.roles ?? []).some(
      (r) => r === "FINANCE_OFFICER" || r === "SUPER_ADMIN"
    );

    if (!isFinanceOrSuperAdmin) {
      await assertCan(actor, "ledger.read");
    }
  },
};
