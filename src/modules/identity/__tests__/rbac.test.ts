import { describe, it, expect, beforeEach } from "vitest";
import {
  ROLE_PERMISSION_MATRIX,
  permissionsForRoles,
  assertCan,
  piiSerializers,
  CustomerRawData,
} from "../index";
import { Actor } from "@/lib/http/route";
import { ForbiddenError } from "@/lib/errors";
import { clearMemoryAuditChainForTesting, getRecentMemoryAuditEntries } from "@/modules/audit";

describe("RBAC Permissions, Matrix Snapshot, and PII Serialization (P07)", () => {
  beforeEach(() => {
    clearMemoryAuditChainForTesting();
  });

  it("mirrors the PRD §3.9 role → permission matrix exactly (Snapshot Test)", () => {
    expect(ROLE_PERMISSION_MATRIX).toMatchInlineSnapshot(`
      {
        "CATALOG_MANAGER": [
          "catalog.read",
          "catalog.draft",
          "coupon.draft",
        ],
        "CUSTOMER_SUPPORT": [
          "catalog.read",
          "pii.read.full",
          "rma.adjudicate",
          "refund.approve",
          "store_credit.issue",
        ],
        "DISPATCH_STAFF": [
          "catalog.read",
          "dispatch.pack",
          "dispatch.book",
          "returns.receive",
          "pii.read.shipping",
        ],
        "FIELD_RUNNER": [
          "catalog.read",
          "runner.task.own",
          "sourcing.price.input",
          "float.own",
        ],
        "FINANCE_OFFICER": [
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
        "GODOWN_MANAGER": [
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
        "QC_TECHNICIAN": [
          "catalog.read",
          "qc.execute",
          "seal.print",
          "returns.receive",
        ],
        "SHOWROOM_POS_STAFF": [
          "catalog.read",
          "pos.operate",
          "drawer.count",
          "pii.read.counter",
        ],
        "SOURCING_MANAGER": [
          "catalog.read",
          "runner.task.read",
          "runner.task.assign",
          "sourcing.price.override",
          "spot.override.approve",
          "seal.void.approve",
          "float.read",
        ],
        "SUPER_ADMIN": [
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
        ],
      }
    `);
  });

  it("correctly unions permissions additively for staff with multiple roles", () => {
    const roles = ["FIELD_RUNNER", "QC_TECHNICIAN"];
    const perms = permissionsForRoles(roles);

    expect(perms.has("runner.task.own")).toBe(true);
    expect(perms.has("sourcing.price.input")).toBe(true);
    expect(perms.has("qc.execute")).toBe(true);
    expect(perms.has("seal.print")).toBe(true);
    expect(perms.has("returns.receive")).toBe(true);
    expect(perms.has("staff.manage")).toBe(false);
  });

  describe("assertCan & amount-limited permission checks", () => {
    const supportActor: Actor = {
      id: "stf_support_1",
      type: "staff",
      roles: ["CUSTOMER_SUPPORT"],
    };

    const financeActor: Actor = {
      id: "stf_finance_1",
      type: "staff",
      roles: ["FINANCE_OFFICER"],
    };

    const adminActor: Actor = {
      id: "stf_admin_1",
      type: "staff",
      roles: ["SUPER_ADMIN"],
    };

    const runnerActor: Actor = {
      id: "stf_runner_1",
      type: "staff",
      roles: ["FIELD_RUNNER"],
    };

    it("enforces Customer Support refund approval limit of ৳1,000 (100,000 paisa)", async () => {
      // ৳1,000 (100,000 paisa) -> allowed
      await expect(
        assertCan(supportActor, "refund.approve", { amountPaisa: 100000 })
      ).resolves.not.toThrow();

      // ৳1,000.01 (100,001 paisa) -> denied
      await expect(
        assertCan(supportActor, "refund.approve", { amountPaisa: 100001 })
      ).rejects.toThrow(ForbiddenError);
    });

    it("enforces Finance Officer refund approval limit of ৳20,000 (2,000,000 paisa)", async () => {
      // ৳20,000 (2,000,000 paisa) -> allowed
      await expect(
        assertCan(financeActor, "refund.approve", { amountPaisa: 2000000 })
      ).resolves.not.toThrow();

      // ৳20,000.01 (2,000,001 paisa) -> denied
      await expect(
        assertCan(financeActor, "refund.approve", { amountPaisa: 2000001 })
      ).rejects.toThrow(ForbiddenError);
    });

    it("allows Super Admin unlimited refund approvals", async () => {
      await expect(
        assertCan(adminActor, "refund.approve", { amountPaisa: 50000000 })
      ).resolves.not.toThrow();
    });

    it("denies refund approval to roles without refund.approve permission", async () => {
      await expect(
        assertCan(runnerActor, "refund.approve", { amountPaisa: 1000 })
      ).rejects.toThrow(ForbiddenError);
    });

    it("enforces store_credit.issue thresholds identically to refund.approve", async () => {
      await expect(
        assertCan(supportActor, "store_credit.issue", { amountPaisa: 100000 })
      ).resolves.not.toThrow();

      await expect(
        assertCan(supportActor, "store_credit.issue", { amountPaisa: 100001 })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("PII Serializers (Customer DTO Builders)", () => {
    const rawCustomer: CustomerRawData = {
      id: "cst_998877",
      fullName: "Tanvir Ahmed",
      phone: "+8801712345678",
      email: "tanvir@example.com",
      addressLine: "House 12, Road 4, Sector 3",
      thanaName: "Uttara",
      districtName: "Dhaka",
      divisionName: "Dhaka",
      bin: "123456789-0101",
      invoiceNo: "INV-2026-0001",
    };

    const supportActor: Actor = {
      id: "stf_sup_42",
      type: "staff",
      roles: ["CUSTOMER_SUPPORT"],
    };

    it("serializes FULL PII for Support and writes an audit 'pii.read' log entry", async () => {
      const full = await piiSerializers.toFull(rawCustomer, supportActor, "ORDER_INQUIRY");

      expect(full.id).toBe(rawCustomer.id);
      expect(full.fullName).toBe("Tanvir Ahmed");
      expect(full.phone).toBe("+8801712345678");
      expect(full.email).toBe("tanvir@example.com");
      expect(full.addressLine).toBe("House 12, Road 4, Sector 3");

      // Verify audit entry
      const auditEntries = getRecentMemoryAuditEntries();
      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0]!.action).toBe("pii.read");
      expect(auditEntries[0]!.entityType).toBe("CUSTOMER");
      expect(auditEntries[0]!.entityId).toBe(rawCustomer.id);
      expect(auditEntries[0]!.staffId).toBe(supportActor.id);
    });

    it("serializes SHIPPING PII for dispatch parcel labels", () => {
      const shipping = piiSerializers.toShipping(rawCustomer);

      expect(shipping.id).toBe(rawCustomer.id);
      expect(shipping.consigneeName).toBe("Tanvir Ahmed");
      expect(shipping.contactPhone).toBe("+8801712345678");
      expect(shipping.addressLine).toBe("House 12, Road 4, Sector 3");
      expect(shipping.thanaName).toBe("Uttara");
    });

    it("serializes COUNTER PII for POS pickup verification with masked phone", () => {
      const counter = piiSerializers.toCounter(rawCustomer);

      expect(counter.id).toBe(rawCustomer.id);
      expect(counter.consigneeName).toBe("Tanvir Ahmed");
      expect(counter.maskedPhone).toBe("017****5678");
      expect(counter.maskedPhone).not.toBe(rawCustomer.phone);
    });

    it("serializes BILLING PII for finance VAT invoices", () => {
      const billing = piiSerializers.toBilling(rawCustomer);

      expect(billing.id).toBe(rawCustomer.id);
      expect(billing.customerName).toBe("Tanvir Ahmed");
      expect(billing.bin).toBe("123456789-0101");
      expect(billing.invoiceNo).toBe("INV-2026-0001");
    });

    it("serializes MASKED representation for field runner & QC and assert NO PII keys exist", () => {
      const masked = piiSerializers.toMasked(rawCustomer);

      // Unit test asserting the runner DTO type has no PII keys
      const keys = Object.keys(masked);
      expect(keys).toEqual(["id"]);
      expect(masked).not.toHaveProperty("fullName");
      expect(masked).not.toHaveProperty("name");
      expect(masked).not.toHaveProperty("phone");
      expect(masked).not.toHaveProperty("email");
      expect(masked).not.toHaveProperty("addressLine");
      expect(masked).not.toHaveProperty("address");
      expect(masked).not.toHaveProperty("bin");
      expect(masked).not.toHaveProperty("invoiceNo");
    });
  });
});
