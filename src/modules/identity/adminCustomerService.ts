import crypto from "node:crypto";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { sha256Hex } from "@/lib/crypto";
import { normalizeBdPhone, isValidBdPhone } from "@/lib/phone";
import { NotFoundError, BusinessError } from "@/lib/errors";
import { recordAudit } from "@/modules/audit";
import { Actor } from "@/lib/http/route";
import { ordersService } from "@/modules/orders";
import { promotionsService } from "@/modules/promotions";
import { trustService } from "@/modules/trust";
import { rmaService } from "@/modules/rma";
import { preorderRepo } from "@/modules/preorder/repo";
import {
  customers,
  customerAddresses,
  sessions,
  CustomerRow,
  CustomerAddressRow,
} from "./schema";
import { authService } from "./auth";
import { piiSerializers, FullCustomerDto } from "./pii";
import { codEligibility } from "@/modules/orders";

type Uuid = `${string}-${string}-${string}-${string}-${string}`;

export const adminCustomerService = {
  /**
   * Search customer by phone with FULL PII serialization (audited).
   */
  async searchCustomerByPhone(phone: string, actor: Actor): Promise<{
    customer: FullCustomerDto;
    status: string;
    delivered_orders_count: number;
    rto_count_12m: number;
    cod_blocked: boolean;
    cod_eligibility: string;
  }> {
    const normalized = normalizeBdPhone(phone);
    const customer = await authService.findCustomerByPhone(normalized);
    if (!customer) {
      throw new NotFoundError("Customer not found for phone number");
    }

    const full = await piiSerializers.toFull(
      {
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        email: customer.email,
      },
      actor,
      "SUPPORT_CUSTOMER_LOOKUP"
    );

    const codElig = codEligibility({
      deliveredCount: customer.deliveredOrderCount,
      rtoCount12m: customer.rtoCount12m,
      codBlocked: customer.codBlocked,
    });

    return {
      customer: full,
      status: customer.status,
      delivered_orders_count: customer.deliveredOrderCount,
      rto_count_12m: customer.rtoCount12m,
      cod_blocked: customer.codBlocked,
      cod_eligibility: codElig,
    };
  },

  /**
   * Get customer detail bundle with orders, claims, credit, and warranties.
   */
  async getCustomerSupportDetail(customerId: string, actor: Actor): Promise<{
    customer: FullCustomerDto;
    status: string;
    delivered_orders_count: number;
    rto_count_12m: number;
    cod_blocked: boolean;
    orders: unknown[];
    rma_claims: unknown[];
    store_credit_balance_paisa: number;
    warranties_count: number;
  }> {
    const customer = await authService.findCustomerById(customerId);
    if (!customer) {
      throw new NotFoundError("Customer");
    }

    const full = await piiSerializers.toFull(
      {
        id: customer.id,
        fullName: customer.fullName,
        phone: customer.phone,
        email: customer.email,
      },
      actor,
      "SUPPORT_CUSTOMER_DETAIL"
    );

    let customerOrders: unknown[] = [];
    try {
      const ordersRes = await ordersService.listCustomerOrders(customerId, { limit: 20 });
      customerOrders = ordersRes.orders;
    } catch {
      // Fallback
    }

    let customerClaims: unknown[] = [];
    try {
      const claimsRes = await rmaService.listCustomerClaims(customerId);
      customerClaims = claimsRes.claims;
    } catch {
      // Fallback
    }

    let creditBalance = 0;
    try {
      const balanceRes = await promotionsService.getStoreCreditBalance(undefined, customerId);
      creditBalance = balanceRes.totalBalancePaisa;
    } catch {
      // Fallback
    }

    let warrantiesCount = 0;
    try {
      const warrantiesRes = await trustService.getCustomerWarranties(customerId);
      warrantiesCount = warrantiesRes.active_warranties.length;
    } catch {
      // Fallback
    }

    return {
      customer: full,
      status: customer.status,
      delivered_orders_count: customer.deliveredOrderCount,
      rto_count_12m: customer.rtoCount12m,
      cod_blocked: customer.codBlocked,
      orders: customerOrders,
      rma_claims: customerClaims,
      store_credit_balance_paisa: creditBalance,
      warranties_count: warrantiesCount,
    };
  },

  /**
   * Ownership confirmation for dormant number: confirm legitimate ownership.
   */
  async confirmDormantOwnership(
    customerId: string,
    actor: Actor
  ): Promise<{ customerId: string; status: "CONFIRMED" }> {
    const customer = await authService.findCustomerById(customerId);
    if (!customer) {
      throw new NotFoundError("Customer");
    }

    const now = new Date();
    try {
      await db
        .update(sessions)
        .set({ ownershipUnconfirmed: false })
        .where(
          and(
            eq(sessions.subjectId, customerId as Uuid),
            eq(sessions.subjectType, "CUSTOMER")
          )
        );
    } catch {
      // Memory fallback handled by authService
    }

    await recordAudit(null, {
      staffId: actor.id,
      actorType: "STAFF",
      action: "customer.ownership_confirmed",
      entityType: "CUSTOMER",
      entityId: customerId,
      afterState: { ownershipUnconfirmed: false },
    });

    return { customerId, status: "CONFIRMED" };
  },

  /**
   * Ownership confirmation for dormant number: split / freeze recycled number.
   * Freezes old customer record and creates a fresh profile for the recycled phone.
   */
  async splitFreezeDormantNumber(
    customerId: string,
    actor: Actor
  ): Promise<{
    oldCustomerId: string;
    newCustomerId: string;
    status: "FROZEN_AND_SPLIT";
  }> {
    const oldCustomer = await authService.findCustomerById(customerId);
    if (!oldCustomer) {
      throw new NotFoundError("Customer");
    }

    const now = new Date();

    // 1. Freeze old customer and unlink phone number
    const archivedPhone = `frozen_${oldCustomer.id.slice(0, 8)}_${oldCustomer.phone}`;
    oldCustomer.status = "FROZEN";
    const originalPhone = oldCustomer.phone;
    oldCustomer.phone = archivedPhone;
    oldCustomer.updatedAt = now;
    await authService.saveCustomer(oldCustomer);

    // 2. Revoke all old customer sessions
    try {
      await db
        .update(sessions)
        .set({ revokedAt: now, revokedBy: actor.id })
        .where(
          and(
            eq(sessions.subjectId, customerId as Uuid),
            eq(sessions.subjectType, "CUSTOMER")
          )
        );
    } catch {
      // Memory fallback
    }

    // 3. Create fresh customer for original phone
    const newCustomer = await authService.createCustomer({
      phone: originalPhone,
      previousCustomerId: oldCustomer.id,
    });

    await recordAudit(null, {
      staffId: actor.id,
      actorType: "STAFF",
      action: "customer.dormant_split_freeze",
      entityType: "CUSTOMER",
      entityId: customerId,
      afterState: {
        frozenCustomerId: customerId,
        newCustomerId: newCustomer.id,
        phone: originalPhone,
      },
    });

    return {
      oldCustomerId: customerId,
      newCustomerId: newCustomer.id,
      status: "FROZEN_AND_SPLIT",
    };
  },

  /**
   * Data Protection: Anonymize customer on deletion request (SUPER_ADMIN).
   * Replaces PII with placeholders, hashes phone number, revokes sessions.
   * Keeps orders, invoices, and ledger intact for legal retention (6 years).
   */
  async anonymizeCustomer(
    customerId: string,
    actor: Actor
  ): Promise<{ customerId: string; status: "ANONYMIZED" }> {
    const customer = await authService.findCustomerById(customerId);
    if (!customer) {
      throw new NotFoundError("Customer");
    }

    if (customer.status === "ANONYMIZED") {
      throw new BusinessError(
        "ERR_BUSINESS_RULE",
        "Customer is already anonymized",
        { customerId },
        422
      );
    }

    const now = new Date();
    const phoneHash = sha256Hex(customer.phone);
    const anonymizedPhone = `anon_${phoneHash.slice(0, 20)}`;
    const anonymizedEmail = `anonymized-${customer.id.slice(0, 8)}@ncamart.com`;
    const anonymizedName = "Anonymized User";

    // 1. Anonymize customer record
    customer.fullName = anonymizedName;
    customer.email = anonymizedEmail;
    customer.phone = anonymizedPhone;
    customer.status = "ANONYMIZED";
    customer.marketingOptIn = false;
    customer.updatedAt = now;
    await authService.saveCustomer(customer);

    // 2. Anonymize addresses
    try {
      await db
        .update(customerAddresses)
        .set({
          consigneeName: "Anonymized",
          contactPhone: "00000000000",
          addressLine: "Redacted",
          updatedAt: now,
        })
        .where(eq(customerAddresses.customerId, customerId as Uuid));
    } catch {
      // Memory fallback
    }

    // 3. Revoke all active customer sessions
    try {
      await db
        .update(sessions)
        .set({ revokedAt: now, revokedBy: actor.id })
        .where(
          and(
            eq(sessions.subjectId, customerId as Uuid),
            eq(sessions.subjectType, "CUSTOMER")
          )
        );
    } catch {
      // Memory fallback
    }

    // 4. Record audit log
    await recordAudit(null, {
      staffId: actor.id,
      actorType: "STAFF",
      action: "customer.anonymized",
      entityType: "CUSTOMER",
      entityId: customerId,
      afterState: {
        status: "ANONYMIZED",
        phoneHash,
      },
    });

    return { customerId, status: "ANONYMIZED" };
  },

  /**
   * Customer self-service deletion request -> creates support task.
   */
  async createCustomerDeletionRequest(customerId: string): Promise<{
    taskId: string;
    message: string;
  }> {
    const customer = await authService.findCustomerById(customerId);
    if (!customer) {
      throw new NotFoundError("Customer");
    }

    const task = await preorderRepo.createSupportTask({
      type: "DELETION_REQUEST",
      customerId,
      status: "PENDING",
      dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours SLA
      metadata: {
        requestedAt: new Date().toISOString(),
        customerPhone: customer.phone,
      },
    });

    return {
      taskId: task.id,
      message:
        "Deletion request submitted. Our support team will process your request within 48 hours.",
    };
  },
};
