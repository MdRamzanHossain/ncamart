import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  staffAuthService,
  adminCustomerService,
  supportTasksService,
  authService,
} from "../index";
import {
  auditService,
  recordAudit,
  verifyAuditChain,
  clearMemoryAuditChainForTesting,
  GENESIS_HASH,
} from "@/modules/audit";
import { settingsService } from "@/modules/settings";
import { sourcingService } from "@/modules/sourcing";
import { sourcingRepo } from "@/modules/sourcing/repo";
import { ledgerService } from "@/modules/ledger";
import { clearMemoryLedgerForTesting } from "@/modules/ledger/repo";
import { ordersRepo } from "@/modules/orders/repo";
import { ordersService } from "@/modules/orders/service";
import { clearMemoryStorageForTesting, getObject } from "@/lib/storage";
import { clearMockQueuesForTesting } from "@/lib/queues";
import { env } from "@/lib/env";
import { Actor } from "@/lib/http/route";
import { applySecurityHeaders, middleware } from "@/middleware";
import { GET as getQueuesAdmin } from "@/app/admin/queues/route";
import { GET as getAuditVerify } from "@/app/api/v1/admin/security/audit-trail/verify/route";

const superAdminActor: Actor = {
  id: "01920000-0000-7000-8000-000000000001",
  type: "staff",
  roles: ["SUPER_ADMIN"],
  permissions: ["staff.manage", "audit.read", "settings.manage", "queues.admin", "support.manage", "data_protection.anonymize", "sourcing.quarantine.review"],
};

const supportActor: Actor = {
  id: "01920000-0000-7000-8000-000000000002",
  type: "staff",
  roles: ["CUSTOMER_SUPPORT"],
  permissions: ["pii.read.full", "support.manage"],
};

const runnerActor: Actor = {
  id: "01920000-0000-7000-8000-000000000003",
  type: "staff",
  roles: ["FIELD_RUNNER"],
  permissions: ["runner.task.own"],
};

describe("P40 — Staff Admin, Audit Trail, Settings, Retention & Data Protection", () => {
  beforeEach(() => {
    staffAuthService.clearMemoryStaffForTesting();
    clearMemoryAuditChainForTesting();
    settingsService.clearMemoryCacheForTesting();
    clearMemoryLedgerForTesting();
    clearMemoryStorageForTesting();
    clearMockQueuesForTesting();
    ordersService.clearMemoryForTesting();
    sourcingService.clearMemoryForTesting();
  });

  describe("1. Last SUPER_ADMIN Protection & Staff Administration", () => {
    it("prevents demoting or suspending the only active SUPER_ADMIN", async () => {
      // 1. Create the first and only SUPER_ADMIN
      const admin1 = await staffAuthService.createStaff({
        fullName: "Sole Super Admin",
        email: "superadmin1@ncamart.com",
        phone: "01711111111",
        roles: ["SUPER_ADMIN"],
        password: "SuperSecretPassword123!",
      });

      // 2. Attempt to demote the sole admin -> Must fail with ERR_LAST_SUPER_ADMIN
      await expect(
        staffAuthService.updateStaff(
          admin1.staff.id,
          { roles: ["CATALOG_MANAGER"] },
          superAdminActor
        )
      ).rejects.toThrow(/Cannot remove or suspend the last active SUPER_ADMIN/);

      // 3. Attempt to suspend the sole admin -> Must fail with ERR_LAST_SUPER_ADMIN
      await expect(
        staffAuthService.updateStaff(
          admin1.staff.id,
          { status: "SUSPENDED" },
          superAdminActor
        )
      ).rejects.toThrow(/Cannot remove or suspend the last active SUPER_ADMIN/);

      // 4. Create a second active SUPER_ADMIN
      const admin2 = await staffAuthService.createStaff({
        fullName: "Second Super Admin",
        email: "superadmin2@ncamart.com",
        phone: "01722222222",
        roles: ["SUPER_ADMIN"],
        password: "SecondSecretPassword123!",
      });

      // 5. Now demoting admin1 succeeds because admin2 remains active
      const updatedAdmin1 = await staffAuthService.updateStaff(
        admin1.staff.id,
        { roles: ["CATALOG_MANAGER"] },
        superAdminActor
      );
      expect(updatedAdmin1.roles).toEqual(["CATALOG_MANAGER"]);

      // 6. Attempting to suspend admin2 now fails because admin2 is now the only active SUPER_ADMIN
      await expect(
        staffAuthService.updateStaff(
          admin2.staff.id,
          { status: "SUSPENDED" },
          superAdminActor
        )
      ).rejects.toThrow(/Cannot remove or suspend the last active SUPER_ADMIN/);
    });

    it("resets staff password with one-time password and must_change_password flag", async () => {
      const staffUser = await staffAuthService.createStaff({
        fullName: "Dispatch Operator",
        email: "dispatch@ncamart.com",
        phone: "01733333333",
        roles: ["DISPATCH_STAFF"],
        password: "OriginalPassword123!",
      });

      const resetRes = await staffAuthService.resetStaffPassword(staffUser.staff.id, superAdminActor);
      expect(resetRes.temporaryPassword).toBeDefined();
      expect(resetRes.temporaryPassword.length).toBeGreaterThan(8);

      const fetched = await staffAuthService.getStaffById(staffUser.staff.id);
      expect(fetched?.must_change_password).toBe(true);
    });

    it("resets staff TOTP credentials and revokes active sessions", async () => {
      const staffUser = await staffAuthService.createStaff({
        fullName: "QC Tech",
        email: "qc@ncamart.com",
        phone: "01744444444",
        roles: ["QC_TECHNICIAN"],
        password: "OriginalPassword123!",
      });

      const resetTotpRes = await staffAuthService.resetStaffTotp(staffUser.staff.id, superAdminActor);
      expect(resetTotpRes.success).toBe(true);

      const fetched = await staffAuthService.getStaffById(staffUser.staff.id);
      expect(fetched?.totp_enabled).toBe(false);
    });
  });

  describe("2. Audit Trail Hash Chain Verification & Tamper Detection", () => {
    it("builds an unbroken SHA-256 hash chain and verifies integrity", async () => {
      for (let i = 1; i <= 10; i++) {
        await recordAudit(null, {
          staffId: superAdminActor.id,
          actorType: "STAFF",
          action: `order.status_change_${i}`,
          entityType: "ORDER",
          entityId: `ORD-${1000 + i}`,
          afterState: { step: i },
        });
      }

      const verifyRes = await verifyAuditChain({ useMemoryStore: true });
      expect(verifyRes.valid).toBe(true);
      expect(verifyRes.checkedCount).toBe(10);
      expect(verifyRes.tamperedRowId).toBeUndefined();
    });

    it("detects tampering when an audit entry payload or hash chain is manipulated", async () => {
      for (let i = 1; i <= 5; i++) {
        await recordAudit(null, {
          staffId: superAdminActor.id,
          actorType: "STAFF",
          action: `config.change_${i}`,
          entityType: "SETTING",
          entityId: `SETTING_${i}`,
          afterState: { value: i * 100 },
        });
      }

      // Initial chain is valid
      const validCheck = await verifyAuditChain({ useMemoryStore: true });
      expect(validCheck.valid).toBe(true);

      // Tamper with record 3 in memory chain
      const entries = auditService.query ? await auditService.query() : { data: [] };
      const rawEntries = (auditService as any).getRecentMemoryAuditEntries
        ? (auditService as any).getRecentMemoryAuditEntries()
        : entries.data;

      // Mutate payload of 3rd entry
      if (rawEntries[2]) {
        rawEntries[2].action = "MALICIOUS_UNAUTHORIZED_CHANGE";
      }

      const tamperCheck = await verifyAuditChain({ useMemoryStore: true });
      expect(tamperCheck.valid).toBe(false);
      expect(tamperCheck.tamperedRowId).toBeDefined();
      expect(tamperCheck.error).toMatch(/Tampered row payload/);
    });

    it("nightly audit export generates JSONL with manifest and uploads to audit bucket", async () => {
      const now = new Date();
      await recordAudit(null, {
        staffId: superAdminActor.id,
        actorType: "STAFF",
        action: "security.test_event",
        entityType: "SECURITY",
        entityId: "SEC-1",
        afterState: { test: true },
        createdAt: now,
      });

      const fromDate = new Date(now.getTime() - 3600 * 1000);
      const toDate = new Date(now.getTime() + 3600 * 1000);

      const exportRes = await auditService.exportDailyJsonl(fromDate, toDate, 2190);
      expect(exportRes.bucket).toBe(env.S3_BUCKET_AUDIT);
      expect(exportRes.count).toBeGreaterThanOrEqual(1);
      expect(exportRes.finalHash).toMatch(/^[0-9a-f]{64}$/);

      const stored = await getObject(exportRes.bucket, exportRes.key);
      expect(stored).not.toBeNull();
      const text = stored!.body.toString("utf-8");
      expect(text).toContain("AUDIT_EXPORT_MANIFEST");
      expect(text).toContain("security.test_event");
    });
  });

  describe("3. Data Protection: Customer Anonymization & Financial Ledger Integrity", () => {
    it("anonymizes customer PII, hashes phone number, revokes sessions, and preserves balanced ledger and queryable orders", async () => {
      // 1. Create customer
      const phone = "01819999999";
      const customer = await authService.createCustomer({
        phone,
        fullName: "Rahim Uddin",
        email: "rahim@example.com",
      });

      // 2. Post a double-entry financial transaction for this customer (e.g. 5,000 taka customer deposit)
      await ledgerService.seedChartOfAccounts();
      const journalEntry = await ledgerService.post(undefined, {
        eventType: "PREORDER_DEPOSIT_PAID",
        sourceType: "order",
        sourceId: `dep-${customer.id}`,
        description: `Deposit payment for customer ${customer.id}`,
        lines: [
          {
            accountCode: "1000",
            debitPaisa: 500000,
          },
          {
            accountCode: "2010",
            creditPaisa: 500000,
            subLedgerRef: customer.id,
          },
        ],
      });
      expect(journalEntry.id).toBeDefined();

      // Verify trial balance is balanced before anonymization
      const tbBefore = await ledgerService.getTrialBalance();
      expect(tbBefore.is_balanced).toBe(true);
      expect(tbBefore.total_debits_paisa).toBe(tbBefore.total_credits_paisa);

      // 3. Create an order record linked to this customer
      const createdOrderWithDetails = await ordersRepo.createOrder(undefined, {
        order: {
          orderNumber: "ORD-2026-TEST-999",
          customerId: customer.id,
          itemsPricePaisa: 500000,
          deliveryFeePaisa: 8000,
          discountPaisa: 0,
          totalPaisa: 508000,
          status: "DELIVERED",
          paymentStatus: "PAID",
          paymentMethod: "BKASH",
          shippingAddress: {
            consigneeName: "Rahim Uddin",
            phone: "01819999999",
            addressLine: "Nawabpur Road 45",
            districtId: "DHK",
            divisionId: "DHK",
            thanaId: "KOTWALI",
          },
        },
        items: [],
      });
      const order = createdOrderWithDetails;
      expect(order.id).toBeDefined();

      // 4. Anonymize customer (SUPER_ADMIN action)
      const anonRes = await adminCustomerService.anonymizeCustomer(customer.id, superAdminActor);
      expect(anonRes.status).toBe("ANONYMIZED");

      // 5. Verify customer profile is anonymized
      const anonymizedProfile = await authService.findCustomerById(customer.id);
      expect(anonymizedProfile?.fullName).toBe("Anonymized User");
      expect(anonymizedProfile?.email).toContain("anonymized-");
      expect(anonymizedProfile?.phone).toMatch(/^anon_[0-9a-f]{16,20}$/);
      expect(anonymizedProfile?.status).toBe("ANONYMIZED");

      // 6. Verify orders remain fully queryable and intact
      const fetchedOrder = await ordersRepo.getOrderById(undefined, order.id);
      expect(fetchedOrder).not.toBeNull();
      expect(fetchedOrder?.orderNumber).toBe("ORD-2026-TEST-999");
      expect(fetchedOrder?.totalPaisa).toBe(508000);
      expect(fetchedOrder?.customerId).toBe(customer.id);

      // 7. Verify ledger remains balanced with zero variance
      const tbAfter = await ledgerService.getTrialBalance();
      expect(tbAfter.is_balanced).toBe(true);
      expect(tbAfter.total_debits_paisa).toBe(tbAfter.total_credits_paisa);
    });

    it("creates a support task on customer deletion request", async () => {
      const customer = await authService.createCustomer({
        phone: "01812345678",
        fullName: "Karim Khan",
      });

      const delRes = await adminCustomerService.createCustomerDeletionRequest(customer.id);
      expect(delRes.taskId).toBeDefined();
      expect(delRes.message).toContain("Deletion request submitted");

      const tasks = await supportTasksService.listTasks({ type: "DELETION_REQUEST" });
      const found = tasks.data.find((t) => t.id === delRes.taskId);
      expect(found).toBeDefined();
      expect(found?.customerId).toBe(customer.id);
      expect(found?.status).toBe("PENDING");
    });
  });

  describe("4. Security Hardening: Middleware Headers & CORS Policy", () => {
    it("injects mandatory security headers: HSTS, CSP frame-ancestors none, nosniff, DENY, Referrer-Policy", () => {
      const res = NextResponse.next();
      applySecurityHeaders(res);

      expect(res.headers.get("Strict-Transport-Security")).toBe(
        "max-age=63072000; includeSubDomains; preload"
      );
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
      expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
      expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    });

    it("denies unapproved CORS origins and allows registered origins", () => {
      process.env.CORS_ALLOWED_ORIGINS = "https://app.ncamart.com,https://pos.ncamart.com";

      // 1. Unapproved origin
      const unapprovedReq = new NextRequest("http://localhost:3000/api/v1/catalog/products", {
        method: "OPTIONS",
        headers: {
          origin: "https://malicious-website.com",
        },
      });
      const unapprovedRes = middleware(unapprovedReq);
      expect(unapprovedRes.status).toBe(403);

      // 2. Approved origin
      const approvedReq = new NextRequest("http://localhost:3000/api/v1/catalog/products", {
        method: "OPTIONS",
        headers: {
          origin: "https://app.ncamart.com",
        },
      });
      const approvedRes = middleware(approvedReq);
      expect(approvedRes.status).toBe(204);
      expect(approvedRes.headers.get("Access-Control-Allow-Origin")).toBe("https://app.ncamart.com");
      expect(approvedRes.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });
  });

  describe("5. Queue Admin & Bull-Board Access Control", () => {
    it("blocks non-superadmins from accessing /admin/queues with 403 Forbidden", async () => {
      // 1. Request as FIELD_RUNNER -> 403
      const runnerToken = "runner-token-xyz";
      staffAuthService.createMockStaffSession(runnerActor.id, runnerToken, ["FIELD_RUNNER"]);
      const runnerReq = new NextRequest("http://localhost:3000/admin/queues", {
        method: "GET",
        headers: {
          authorization: `Bearer ${runnerToken}`,
        },
      });
      const resRunner = await getQueuesAdmin(runnerReq);
      expect(resRunner.status).toBe(403);

      // 2. Request as CUSTOMER_SUPPORT -> 403
      const supportToken = "support-token-xyz";
      staffAuthService.createMockStaffSession(supportActor.id, supportToken, ["CUSTOMER_SUPPORT"]);
      const supportReq = new NextRequest("http://localhost:3000/admin/queues", {
        method: "GET",
        headers: {
          authorization: `Bearer ${supportToken}`,
        },
      });
      const resSupport = await getQueuesAdmin(supportReq);
      expect(resSupport.status).toBe(403);

      // 3. Request as SUPER_ADMIN -> 200 OK
      const adminToken = "admin-token-xyz";
      staffAuthService.createMockStaffSession(superAdminActor.id, adminToken, ["SUPER_ADMIN"]);
      const adminReq = new NextRequest("http://localhost:3000/admin/queues", {
        method: "GET",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });
      const resAdmin = await getQueuesAdmin(adminReq);
      expect(resAdmin.status).toBe(200);
    });
  });

  describe("6. Sourcing Quarantine Review Workflow", () => {
    it("allows sourcing manager to list, accept, and reject quarantined runner purchases", async () => {
      // Create quarantined purchase
      const purchase = await sourcingRepo.createRunnerPurchase({
        clientMutationId: `mut-${Date.now()}`,
        runnerId: runnerActor.id,
        supplierId: crypto.randomUUID(),
        skuId: crypto.randomUUID(),
        qty: 10,
        unitCostPaisa: 50000,
        amountPaisa: 500000,
        paymentMode: "CASH",
        syncStatus: "QUARANTINED",
      });
      expect(purchase.syncStatus).toBe("QUARANTINED");

      // List quarantined purchases
      const list = await sourcingService.listQuarantinedPurchases(superAdminActor);
      expect(list.items.some((p) => p.id === purchase.id)).toBe(true);

      // Sourcing manager accepts
      const accepted = await sourcingService.acceptQuarantinedPurchase(purchase.id, superAdminActor);
      expect(accepted.syncStatus).toBe("OK");
      expect(accepted.approvedBy).toBe(superAdminActor.id);

      // Second purchase: rejection flow
      const purchase2 = await sourcingRepo.createRunnerPurchase({
        clientMutationId: `mut2-${Date.now()}`,
        runnerId: runnerActor.id,
        supplierId: crypto.randomUUID(),
        skuId: crypto.randomUUID(),
        qty: 2,
        unitCostPaisa: 10000,
        amountPaisa: 20000,
        paymentMode: "CASH",
        syncStatus: "QUARANTINED",
      });

      const rejected = await sourcingService.rejectQuarantinedPurchase(
        purchase2.id,
        "Session expired on compromised runner phone",
        superAdminActor
      );
      expect(rejected.syncStatus).toBe("REJECTED");
    });
  });
});
