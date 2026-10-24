import { Actor } from "@/lib/http/route";
import { ForbiddenError, BusinessError } from "@/lib/errors";
import { assertCan, can } from "@/modules/identity/policies";

export const promotionsPolicies = {
  /**
   * Asserts actor can draft or edit a draft coupon (CATALOG_MANAGER, SUPER_ADMIN).
   */
  async assertCanDraftCoupon(actor: Actor | null): Promise<void> {
    await assertCan(actor, "coupon.draft");
  },

  /**
   * Asserts actor can activate a coupon (SUPER_ADMIN, four-eyes rule: not the creator).
   */
  async assertCanActivateCoupon(actor: Actor | null, creatorId: string): Promise<void> {
    if (!actor) {
      throw new ForbiddenError("Authentication required");
    }

    await assertCan(actor, "coupon.activate");

    // Four-eyes rule: Creator cannot activate their own coupon
    if (actor.id === creatorId) {
      throw new BusinessError(
        "ERR_FOUR_EYES_VIOLATION",
        "Four-eyes policy violation: Creator cannot activate their own coupon",
        { creatorId, actorId: actor.id },
        403
      );
    }
  },

  /**
   * Asserts actor can pause an active coupon (SUPER_ADMIN).
   */
  async assertCanPauseCoupon(actor: Actor | null): Promise<void> {
    await assertCan(actor, "coupon.activate");
  },

  /**
   * Asserts actor can issue store credit with amount limits:
   * - Support staff: <= ৳1,000 (100,000 paisa)
   * - Finance officer: <= ৳20,000 (2,000,000 paisa)
   * - Super Admin: unrestricted
   */
  async assertCanIssueStoreCredit(actor: Actor | null, amountPaisa: number): Promise<void> {
    await assertCan(actor, "store_credit.issue", { amountPaisa });
  },

  /**
   * Asserts actor can execute a store credit withdrawal (FINANCE_OFFICER, SUPER_ADMIN).
   */
  async assertCanWithdrawStoreCredit(actor: Actor | null): Promise<void> {
    if (!actor) {
      throw new ForbiddenError("Authentication required");
    }

    const hasPerm =
      (await can(actor, "refund.execute")) ||
      (actor.roles ?? []).some((r) => r === "FINANCE_OFFICER" || r === "SUPER_ADMIN");

    if (!hasPerm) {
      throw new ForbiddenError("Only Finance Officers and Super Admins can withdraw store credit");
    }
  },
};
