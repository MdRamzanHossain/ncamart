import { describe, it, expect, beforeEach } from "vitest";
import { Actor } from "@/lib/http/route";
import { financeService } from "../service";
import { financeRepo } from "../repo";
import { logisticsRepo, clearMemoryLogisticsForTesting } from "@/modules/logistics/repo";
import { ordersRepo } from "@/modules/orders/repo";
import { ordersService } from "@/modules/orders/service";
import { ledgerService, clearMemoryLedgerForTesting } from "@/modules/ledger";
import { posRepo } from "@/modules/pos/repo";
import { sourcingRepo } from "@/modules/sourcing/repo";
import { refundsRepo } from "@/modules/payments/repo";
import { getMemoryOutbox, clearMemoryOutboxForTesting } from "@/lib/outbox";

const financeOfficerActor: Actor = {
  id: "01920000-0000-7000-8000-0000000000f1",
  type: "staff",
  roles: ["FINANCE_OFFICER"],
  permissions: ["settlement.reconcile", "ledger.read"],
};

const unauthorizedStaffActor: Actor = {
  id: "01920000-0000-7000-8000-0000000000u1",
  type: "staff",
  roles: ["FIELD_RUNNER"],
  permissions: ["runner.task.own"],
};

describe("P34 — Courier COD & Gateway Settlement Reconciliation", () => {
  beforeEach(async () => {
    financeService.clearMemoryForTesting();
    clearMemoryLogisticsForTesting();
    clearMemoryLedgerForTesting();
    ordersService.clearMemoryForTesting();
    posRepo.clearMemoryForTesting();
    sourcingRepo.clearMemoryForTesting();
    refundsRepo.clearMemoryForTesting();
    clearMemoryOutboxForTesting();
    await ledgerService.seedChartOfAccounts();
  });

  // --------------------------------------------------------------------------
  // 1. Courier CSV Reconciliation (Matched, Short-Paid, Unknown Consignment)
  // --------------------------------------------------------------------------
  describe("1. Courier CSV Reconciliation & Matching", () => {
    it("matches exact lines, records short-paid & unknown exceptions, and posts balanced COURIER_PAYOUT_MATCHED journal entries", async () => {
      const orderId1 = crypto.randomUUID();
      const orderId2 = crypto.randomUUID();

      // Seed shipment 1: Expected COD ৳2,000 (200,000 paisa)
      await logisticsRepo.createShipment({
        id: crypto.randomUUID(),
        orderId: orderId1,
        courier: "STEADFAST",
        consignmentNo: "STF-1001",
        status: "DELIVERED",
        weightGrams: 500,
        expectedCodPaisa: 200_000,
      });

      // Seed shipment 2: Expected COD ৳3,000 (300,000 paisa)
      await logisticsRepo.createShipment({
        id: crypto.randomUUID(),
        orderId: orderId2,
        courier: "STEADFAST",
        consignmentNo: "STF-1002",
        status: "DELIVERED",
        weightGrams: 800,
        expectedCodPaisa: 300_000,
      });

      // CSV Content:
      // Row 1: STF-1001 exact match (received 200,000 paisa, delivery 10,000, cod 2,000, return 0) -> Net 188,000
      // Row 2: STF-1002 short paid (received 250,000 paisa vs 300,000 expected, delivery 10,000, cod 2,500, return 0) -> Net 237,500
      // Row 3: STF-9999 unknown consignment (received 150,000 paisa, delivery 8,000, cod 1,500, return 0)
      const csvContent = [
        "consignment_no,collected_paisa,delivery_charge_paisa,cod_charge_paisa,return_charge_paisa",
        "STF-1001,200000,10000,2000,0",
        "STF-1002,250000,10000,2500,0",
        "STF-9999,150000,8000,1500,0",
      ].join("\n");

      const payoutRef = "STF-PAY-OCT26-001";

      const res = await financeService.reconcileCourierCsv(
        {
          courierPartner: "STEADFAST",
          csvContent,
          payoutRef,
        },
        financeOfficerActor
      );

      // Verify response summary conforming to api-spec §14.2
      expect(res.matched_consignments).toBe(1);
      expect(res.short_paid_exceptions.length).toBe(1);
      expect(res.short_paid_exceptions[0]).toEqual({
        tracking_code: "STF-1002",
        expected_paisa: 300_000,
        received_paisa: 250_000,
        variance_paisa: 50_000,
      });
      expect(res.unknown_consignments?.length).toBe(1);
      expect(res.unknown_consignments?.[0]).toEqual({
        tracking_code: "STF-9999",
        received_paisa: 150_000,
      });
      expect(res.total_remitted_paisa).toBe(600_000); // 200k + 250k + 150k
      expect(res.total_charges_paisa).toBe(34_000); // (10k+2k) + (10k+2.5k) + (8k+1.5k)
      expect(res.net_paisa).toBe(566_000);
      expect(res.status).toBe("HAS_EXCEPTIONS");

      // Verify shipment 1 charges updated
      const updatedShipment1 = await logisticsRepo.getShipmentByConsignmentNo("STF-1001");
      expect(updatedShipment1?.collectedCodPaisa).toBe(200_000);
      expect(updatedShipment1?.deliveryChargePaisa).toBe(10_000);
      expect(updatedShipment1?.codChargePaisa).toBe(2_000);

      // Verify exceptions in exception table
      const { items: exceptions } = await financeRepo.listExceptions(undefined, {
        limit: 10,
        offset: 0,
      });
      expect(exceptions.length).toBe(2);

      const shortException = exceptions.find((e) => e.kind === "SHORT_PAID");
      expect(shortException).toBeDefined();
      expect(shortException?.amountPaisa).toBe(50_000);
      expect(shortException?.status).toBe("OPEN");

      const unknownException = exceptions.find((e) => e.kind === "UNKNOWN_CONSIGNMENT");
      expect(unknownException).toBeDefined();
      expect(unknownException?.amountPaisa).toBe(150_000);
      expect(unknownException?.status).toBe("OPEN");

      // Verify ledger trial balance is balanced (Debits = Credits)
      const trialBalance = await ledgerService.getTrialBalance();
      expect(trialBalance.isBalanced).toBe(true);
      expect(trialBalance.totalDebitsPaisa).toBe(trialBalance.totalCreditsPaisa);

      // Verify Bank Account 1030 received net payout
      const bankStmt = await ledgerService.getAccountStatement("1030");
      expect(bankStmt.netBalancePaisa).toBeGreaterThan(0);

      // Verify Delivery Fee Expense Account 5100
      const delExpenseStmt = await ledgerService.getAccountStatement("5100");
      expect(delExpenseStmt.netBalancePaisa).toBe(20_000); // 10k + 10k from matched & short
    });

    it("rejects unauthorized actor without settlement.reconcile permission", async () => {
      const csvContent = "consignment_no,collected_paisa\nSTF-1,1000";
      await expect(
        financeService.reconcileCourierCsv(
          { courierPartner: "STEADFAST", csvContent },
          unauthorizedStaffActor
        )
      ).rejects.toThrow(/Insufficient permissions/i);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Idempotency Test
  // --------------------------------------------------------------------------
  describe("2. Idempotency: Re-importing same payout_ref", () => {
    it("re-importing the same payout_ref is a strict no-op returning the existing summary", async () => {
      await logisticsRepo.createShipment({
        id: crypto.randomUUID(),
        orderId: crypto.randomUUID(),
        courier: "PATHAO",
        consignmentNo: "PTH-5555",
        status: "DELIVERED",
        weightGrams: 500,
        expectedCodPaisa: 120_000,
      });

      const csvContent =
        "consignment_no,collected_paisa,delivery_charge_paisa,cod_charge_paisa,return_charge_paisa\n" +
        "PTH-5555,120000,6000,1200,0";
      const payoutRef = "PTH-BATCH-20261025";

      // First Import
      const firstRes = await financeService.reconcileCourierCsv(
        { courierPartner: "PATHAO", csvContent, payoutRef },
        financeOfficerActor
      );
      expect(firstRes.matched_consignments).toBe(1);
      expect(firstRes.status).toBe("MATCHED");

      const trialBalance1 = await ledgerService.getTrialBalance();
      const debitTotal1 = trialBalance1.totalDebitsPaisa;

      // Second Import with identical payout_ref
      const secondRes = await financeService.reconcileCourierCsv(
        { courierPartner: "PATHAO", csvContent, payoutRef },
        financeOfficerActor
      );

      // Output matches perfectly
      expect(secondRes.settlement_id).toBe(firstRes.settlement_id);
      expect(secondRes.matched_consignments).toBe(firstRes.matched_consignments);
      expect(secondRes.total_remitted_paisa).toBe(firstRes.total_remitted_paisa);

      // Ledger was NOT duplicated
      const trialBalance2 = await ledgerService.getTrialBalance();
      expect(trialBalance2.totalDebitsPaisa).toBe(debitTotal1);
    });
  });

  // --------------------------------------------------------------------------
  // 3. MISSING Detection Job After 7 Days & Class A Alerts
  // --------------------------------------------------------------------------
  describe("3. MISSING Detection Job & 7-Day Aging Buckets", () => {
    it("flags delivered shipments older than 7 days as MISSING exceptions and triggers Class A internal alert", async () => {
      const now = new Date();
      const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      // Shipment 1: Delivered 8 days ago, unreconciled (expected COD ৳1,500)
      const oldShipment = await logisticsRepo.createShipment({
        id: crypto.randomUUID(),
        orderId: crypto.randomUUID(),
        courier: "STEADFAST",
        consignmentNo: "STF-OLD-8D",
        status: "DELIVERED",
        weightGrams: 500,
        expectedCodPaisa: 150_000,
        deliveredAt: eightDaysAgo,
        createdAt: eightDaysAgo,
      });

      // Shipment 2: Delivered 2 days ago, unreconciled (expected COD ৳800)
      await logisticsRepo.createShipment({
        id: crypto.randomUUID(),
        orderId: crypto.randomUUID(),
        courier: "STEADFAST",
        consignmentNo: "STF-RECENT-2D",
        status: "DELIVERED",
        weightGrams: 500,
        expectedCodPaisa: 80_000,
        deliveredAt: twoDaysAgo,
        createdAt: twoDaysAgo,
      });

      // Run missing detection job
      const report = await financeService.detectMissingShipments(now);

      expect(report.missingCreatedCount).toBe(1);
      expect(report.older7dCount).toBe(1);
      expect(report.agingBuckets.bucket_0_7_days_paisa).toBe(80_000);
      expect(report.agingBuckets.bucket_8_15_days_paisa).toBe(150_000);
      expect(report.agingBuckets.total_receivable_paisa).toBe(230_000);

      // Verify MISSING exception created
      const { items: exceptions } = await financeRepo.listExceptions(undefined, {
        kind: "MISSING",
      });
      expect(exceptions.length).toBe(1);
      expect(exceptions[0].amountPaisa).toBe(150_000);
      expect(exceptions[0].ageDays).toBe(8);
      expect(exceptions[0].status).toBe("OPEN");

      // Verify Class A alert emitted to outbox
      const outboxEntries = getMemoryOutbox();
      const overdueAlert = outboxEntries.find(
        (e) => e.type === "finance.courier_receivable_overdue"
      );
      expect(overdueAlert).toBeDefined();
      expect(overdueAlert?.notificationClass).toBe("A");
      expect(overdueAlert?.aggregateId).toBe(oldShipment.id);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Exception Workflow: Resolve & Write-Off
  // --------------------------------------------------------------------------
  describe("4. Exception Workflow & Write-Off Ledger Postings", () => {
    it("resolves an exception via write-off by posting an expense entry to Cash Variance (5310)", async () => {
      // Create a short-paid exception
      const exception = await financeRepo.createException(undefined, {
        kind: "SHORT_PAID",
        refIds: { courier: "STEADFAST", consignmentNo: "STF-WO-01" },
        amountPaisa: 25_000,
        status: "OPEN",
      });

      // Resolve via WRITE_OFF
      const resolved = await financeService.resolveException(
        exception.id,
        {
          resolution: "WRITE_OFF",
          notes: "Approved by Finance Manager: small irrecoverable shortfall",
        },
        financeOfficerActor
      );

      expect(resolved.status).toBe("WRITTEN_OFF");
      expect(resolved.resolution).toBe("WRITE_OFF");
      expect(resolved.resolvedBy).toBe(financeOfficerActor.id);

      // Verify ledger posting: Dr 5310 Cash Variance / Cr 1110 Courier COD Receivable
      const trialBalance = await ledgerService.getTrialBalance();
      expect(trialBalance.isBalanced).toBe(true);

      const varianceStmt = await ledgerService.getAccountStatement("5310");
      expect(varianceStmt.netBalancePaisa).toBe(25_000);
    });

    it("resolves an exception via RECEIVED_LATER without extra write-off expense", async () => {
      const exception = await financeRepo.createException(undefined, {
        kind: "SHORT_PAID",
        refIds: { courier: "STEADFAST", consignmentNo: "STF-RL-01" },
        amountPaisa: 10_000,
        status: "OPEN",
      });

      const resolved = await financeService.resolveException(
        exception.id,
        {
          resolution: "RECEIVED_LATER",
          notes: "Received in supplementary courier payout batch",
        },
        financeOfficerActor
      );

      expect(resolved.status).toBe("RESOLVED");
      expect(resolved.resolution).toBe("RECEIVED_LATER");
    });
  });

  // --------------------------------------------------------------------------
  // 5. Gateway Settlements & Fee Postings
  // --------------------------------------------------------------------------
  describe("5. Gateway Settlement Reconciliation (SSLCommerz)", () => {
    it("reconciles SSLCommerz CSV, matches transaction by tran_id, and posts GATEWAY_SETTLEMENT_MATCHED (Dr 1030 + 5200 / Cr 1100)", async () => {
      const tranIdMatched = "TRAN-SSL-99881";
      const customerId = crypto.randomUUID();
      const orderId = crypto.randomUUID();

      // Seed a payment transaction in ordersRepo: ৳5,000 (500,000 paisa)
      await ordersRepo.createPaymentTransaction(undefined, {
        id: crypto.randomUUID(),
        tranId: tranIdMatched,
        orderId,
        customerId,
        purpose: "FULL",
        method: "SSLCOMMERZ",
        amountPaisa: 500_000,
        currency: "BDT",
        status: "PAID",
        bankTranId: "BANK-VAL-1122",
        cardType: "VISA-CityBank",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Gateway Settlement CSV:
      // Row 1: TRAN-SSL-99881 (Matched: Amount 500,000, Fee 12,500 [2.5%], Net 487,500)
      // Row 2: TRAN-SSL-UNKNOWN (Unmatched: Amount 100,000, Fee 2,500, Net 97,500)
      const csvContent = [
        "tran_id,amount_paisa,fee_paisa,net_paisa",
        `${tranIdMatched},500000,12500,487500`,
        "TRAN-SSL-UNKNOWN,100000,2500,97500",
      ].join("\n");

      const result = await financeService.reconcileGatewaySettlement(
        {
          csvContent,
          payoutRef: "SSL-SETTLE-20261025",
        },
        financeOfficerActor
      );

      expect(result.matched_count).toBe(1);
      expect(result.unmatched_count).toBe(1);
      expect(result.status).toBe("HAS_EXCEPTIONS");
      expect(result.gross_amount_paisa).toBe(600_000);
      expect(result.total_fee_paisa).toBe(15_000);
      expect(result.net_paisa).toBe(585_000);

      // Verify GATEWAY_UNMATCHED exception created
      const { items: exceptions } = await financeRepo.listExceptions(undefined, {
        kind: "GATEWAY_UNMATCHED",
      });
      expect(exceptions.length).toBe(1);
      expect(exceptions[0].amountPaisa).toBe(100_000);
      expect(exceptions[0].refIds?.tranId).toBe("TRAN-SSL-UNKNOWN");

      // Verify Ledger Postings:
      // Dr 1030 Bank Net: 487,500
      // Dr 5200 Gateway Fee: 12,500
      // Cr 1100 SSLCommerz Clearing: 500,000
      const trialBalance = await ledgerService.getTrialBalance();
      expect(trialBalance.isBalanced).toBe(true);

      const feeStmt = await ledgerService.getAccountStatement("5200");
      expect(feeStmt.netBalancePaisa).toBe(12_500);

      const bankStmt = await ledgerService.getAccountStatement("1030");
      expect(bankStmt.netBalancePaisa).toBe(487_500);

      const clearingStmt = await ledgerService.getAccountStatement("1100");
      // Account 1100 normal debit side, credited with 500,000 paisa -> net balance is -500,000
      expect(clearingStmt.creditPaisa).toBe(500_000);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Finance Dashboard Endpoint
  // --------------------------------------------------------------------------
  describe("6. Finance Dashboard Counts", () => {
    it("returns aggregated open exceptions, receivable aging, unreconciled gateway total, float sessions, drawers, and pending refunds", async () => {
      // Seed an open exception
      await financeRepo.createException(undefined, {
        kind: "SHORT_PAID",
        refIds: {},
        amountPaisa: 5_000,
        status: "OPEN",
      });

      // Seed an open float session
      await sourcingRepo.createFloatSession({
        runnerId: crypto.randomUUID(),
        issuedFloatPaisa: 50_000,
        status: "OPEN",
        supplierRefundsPaisa: 0,
        approvedTotalPaisa: 0,
        issuedBy: financeOfficerActor.id,
      });

      // Seed an open drawer session
      await posRepo.createDrawerSession({
        staffId: crypto.randomUUID(),
        openingFloatPaisa: 10_000,
        cashSalesPaisa: 0,
        expectedCashPaisa: 10_000,
        status: "OPEN",
      });

      const dashboard = await financeService.getDashboardCounts(financeOfficerActor);

      expect(dashboard.open_exceptions.total).toBeGreaterThanOrEqual(1);
      expect(dashboard.open_exceptions.by_kind.SHORT_PAID).toBeGreaterThanOrEqual(1);
      expect(dashboard.open_float_sessions).toBe(1);
      expect(dashboard.open_drawers).toBe(1);
      expect(dashboard.receivable_aging).toBeDefined();
      expect(dashboard.unreconciled_gateway_total_paisa).toBeGreaterThanOrEqual(0);
    });
  });
});
