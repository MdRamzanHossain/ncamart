import crypto from "node:crypto";
import { describe, it, expect, beforeEach } from "vitest";
import { Actor } from "@/lib/http/route";
import { clearMemoryStorageForTesting } from "@/lib/storage";
import { clearMemoryOutboxForTesting } from "@/lib/outbox";
import { ledgerService } from "@/modules/ledger";
import { logisticsRepo, clearMemoryLogisticsForTesting } from "@/modules/logistics/repo";
import { ordersRepo, clearMemoryOrdersForTesting } from "@/modules/orders/repo";
import { sourcingRepo } from "@/modules/sourcing/repo";
import { refundsRepo } from "@/modules/payments/repo";
import { promotionsRepo } from "@/modules/promotions/repo";
import {
  reportsService,
  renderReportToFormat,
  setCustomKpiFixturesForTesting,
  financeService,
} from "../index";
import { financeRepo, clearMemoryFinanceForTesting } from "../repo";


const financeOfficerActor: Actor = {
  id: "01920000-0000-7000-8000-0000000000f1",
  type: "staff",
  roles: ["FINANCE_OFFICER"],
  permissions: ["ledger.read", "reports.export"],
};

const unauthorizedStaffActor: Actor = {
  id: "01920000-0000-7000-8000-0000000000u1",
  type: "staff",
  roles: ["FIELD_RUNNER"],
  permissions: ["runner.task.own"],
};

describe("P35 — Financial Reports & Exports", () => {
  beforeEach(async () => {
    clearMemoryFinanceForTesting();
    clearMemoryLogisticsForTesting();
    ledgerService.clearMemoryForTesting();
    clearMemoryOrdersForTesting();
    sourcingRepo.clearMemoryForTesting();
    refundsRepo.clearMemoryForTesting();
    clearMemoryStorageForTesting();
    clearMemoryOutboxForTesting();
    setCustomKpiFixturesForTesting(null);
    await ledgerService.seedChartOfAccounts();
  });

  // --------------------------------------------------------------------------
  // Test 1: Trial Balance Totals Equal
  // --------------------------------------------------------------------------
  describe("1. Trial Balance Report", () => {
    it("ensures trial balance totals equal (sum of debits == sum of credits, difference is 0)", async () => {
      const now = new Date();

      // Post multiple realistic journal entries
      // Entry 1: Sale of goods (Cash received ৳10,000, Sales Revenue ৳8,695.65, VAT ৳1,304.35)
      await ledgerService.post(undefined, {
        eventType: "ORDER_DELIVERED",
        sourceType: "ORDER",
        sourceId: "order-tb-1",
        description: "Customer counter sale",
        postedAt: now,
        lines: [
          { accountCode: "1000", debitPaisa: 1000000, creditPaisa: 0 },
          { accountCode: "4000", debitPaisa: 0, creditPaisa: 869565 },
          { accountCode: "2100", debitPaisa: 0, creditPaisa: 130435 },
        ],
      });

      // Entry 2: Pre-order customer advance deposit (Bank ৳5,000, Customer Deposit 2010 ৳5,000)
      await ledgerService.post(undefined, {
        eventType: "PREORDER_DEPOSIT_COLLECTED",
        sourceType: "PRE_ORDER",
        sourceId: "preorder-tb-1",
        description: "HIKMICRO Thermal Camera pre-order deposit",
        postedAt: now,
        lines: [
          { accountCode: "1030", debitPaisa: 500000, creditPaisa: 0 },
          { accountCode: "2010", subLedgerType: "ORDER", subLedgerRef: "ord-pre-1", debitPaisa: 0, creditPaisa: 500000 },
        ],
      });

      // Entry 3: Sourcing inventory on supplier credit (Inventory ৳6,000, Supplier Payable 2200 ৳6,000)
      await ledgerService.post(undefined, {
        eventType: "SUPPLIER_PURCHASE_CREDIT",
        sourceType: "RUNNER_TASK",
        sourceId: "task-tb-1",
        description: "Sundarban Square cable batch",
        postedAt: now,
        lines: [
          { accountCode: "1200", debitPaisa: 600000, creditPaisa: 0 },
          { accountCode: "2200", subLedgerType: "SUPPLIER", subLedgerRef: "sup-sundarban-1", debitPaisa: 0, creditPaisa: 600000 },
        ],
      });

      // Generate Trial Balance Report
      const report = await reportsService.getTrialBalanceReport(now);

      // Verify Debits equal Credits
      expect(report.totalDebitPaisa).toBeGreaterThan(0);
      expect(report.totalCreditPaisa).toBeGreaterThan(0);
      expect(report.totalDebitPaisa).toEqual(report.totalCreditPaisa);
      expect(report.differencePaisa).toBe(0);
      expect(report.isBalanced).toBe(true);

      // Verify specific accounts
      const cashAcc = report.accounts.find((a) => a.accountCode === "1000");
      expect(cashAcc).toBeDefined();
      expect(cashAcc?.debitPaisa).toBe(1000000);
      expect(cashAcc?.netBalancePaisa).toBe(1000000);

      const revenueAcc = report.accounts.find((a) => a.accountCode === "4000");
      expect(revenueAcc).toBeDefined();
      expect(revenueAcc?.creditPaisa).toBe(869565);
      expect(revenueAcc?.netBalancePaisa).toBe(869565);

      const depositAcc = report.accounts.find((a) => a.accountCode === "2010");
      expect(depositAcc).toBeDefined();
      expect(depositAcc?.creditPaisa).toBe(500000);
      expect(depositAcc?.netBalancePaisa).toBe(500000);
    });
  });

  // --------------------------------------------------------------------------
  // Test 2: P&L Ties to Ledger Balances in Seeded Scenario
  // --------------------------------------------------------------------------
  describe("2. Profit and Loss Report", () => {
    it("ties strictly to ledger balances in a seeded scenario (Revenue, Contra Revenue, COGS, Gross Margin, Expenses, Net Profit)", async () => {
      const from = new Date("2026-03-01T00:00:00.000Z");
      const to = new Date("2026-03-31T23:59:59.999Z");
      const postedAt = new Date("2026-03-15T12:00:00.000Z");

      // 1. Post Sales Revenue (4000: ৳150,000 / 15,000,000 paisa)
      await ledgerService.post(undefined, {
        eventType: "ORDER_DELIVERED",
        sourceType: "ORDER",
        sourceId: "ord-pl-rev-1",
        description: "Authentic Accessories Delivered",
        postedAt,
        lines: [
          { accountCode: "1000", debitPaisa: 15000000, creditPaisa: 0 },
          { accountCode: "4000", debitPaisa: 0, creditPaisa: 15000000 },
        ],
      });

      // 2. Post Delivery Fee Revenue (4020: ৳5,000 / 500,000 paisa)
      await ledgerService.post(undefined, {
        eventType: "DELIVERY_FEE_COLLECTED",
        sourceType: "ORDER",
        sourceId: "ord-pl-rev-2",
        description: "Courier delivery fee charged to customer",
        postedAt,
        lines: [
          { accountCode: "1000", debitPaisa: 500000, creditPaisa: 0 },
          { accountCode: "4020", debitPaisa: 0, creditPaisa: 500000 },
        ],
      });

      // 3. Post Forfeited Pre-order Deposit (4030: ৳2,000 / 200,000 paisa)
      await ledgerService.post(undefined, {
        eventType: "PREORDER_DEPOSIT_FORFEITED",
        sourceType: "PRE_ORDER",
        sourceId: "ord-pl-rev-3",
        description: "Customer defaulted on pre-order balance after 14 days",
        postedAt,
        lines: [
          { accountCode: "2010", subLedgerType: "ORDER", subLedgerRef: "ord-def-1", debitPaisa: 200000, creditPaisa: 0 },
          { accountCode: "4030", debitPaisa: 0, creditPaisa: 200000 },
        ],
      });

      // 4. Post Sales Discounts (4010: ৳3,000 / 300,000 paisa)
      await ledgerService.post(undefined, {
        eventType: "COUPON_DISCOUNT_APPLIED",
        sourceType: "ORDER",
        sourceId: "ord-pl-disc-1",
        description: "Coupon PROMO20 applied",
        postedAt,
        lines: [
          { accountCode: "4010", debitPaisa: 300000, creditPaisa: 0 },
          { accountCode: "1000", debitPaisa: 0, creditPaisa: 300000 },
        ],
      });

      // 5. Post Sales Returns (4040: ৳2,000 / 200,000 paisa)
      await ledgerService.post(undefined, {
        eventType: "CUSTOMER_RETURN_PROCESSED",
        sourceType: "ORDER",
        sourceId: "ord-pl-ret-1",
        description: "Customer returned sealed item within 7 days",
        postedAt,
        lines: [
          { accountCode: "4040", debitPaisa: 200000, creditPaisa: 0 },
          { accountCode: "1000", debitPaisa: 0, creditPaisa: 200000 },
        ],
      });

      // 6. Post Cost of Goods Sold (5000: ৳90,000 / 9,000,000 paisa)
      await ledgerService.post(undefined, {
        eventType: "COGS_RECOGNIZED",
        sourceType: "ORDER",
        sourceId: "ord-pl-cogs-1",
        description: "Cost of accessories sold and delivered",
        postedAt,
        lines: [
          { accountCode: "5000", debitPaisa: 9000000, creditPaisa: 0 },
          { accountCode: "1200", debitPaisa: 0, creditPaisa: 9000000 },
        ],
      });

      // 7. Post Operating Expenses
      // 5100 Courier Delivery: ৳4,000 / 400,000 paisa
      // 5110 COD Charges: ৳1,500 / 150,000 paisa
      // 5120 Return Charges: ৳500 / 50,000 paisa
      // 5200 Gateway Fees: ৳2,500 / 250,000 paisa
      // 5310 Cash Variance: ৳200 / 20,000 paisa
      // 5400 Goodwill Vouchers: ৳1,000 / 100,000 paisa
      await ledgerService.post(undefined, {
        eventType: "OPERATING_EXPENSES_BOOKED",
        sourceType: "SETTLEMENT",
        sourceId: "set-pl-exp-1",
        description: "Courier and gateway fees booked during settlement",
        postedAt,
        lines: [
          { accountCode: "5100", debitPaisa: 400000, creditPaisa: 0 },
          { accountCode: "5110", debitPaisa: 150000, creditPaisa: 0 },
          { accountCode: "5120", debitPaisa: 50000, creditPaisa: 0 },
          { accountCode: "5200", debitPaisa: 250000, creditPaisa: 0 },
          { accountCode: "5310", debitPaisa: 20000, creditPaisa: 0 },
          { accountCode: "5400", debitPaisa: 100000, creditPaisa: 0 },
          { accountCode: "1030", debitPaisa: 0, creditPaisa: 970000 },
        ],
      });

      // Fetch Profit and Loss statement
      const pl = await reportsService.getProfitAndLossReport(from, to);

      // Verify Revenue breakdown
      expect(pl.revenue.salesRevenuePaisa).toBe(15000000); // ৳150,000
      expect(pl.revenue.deliveryFeeRevenuePaisa).toBe(500000); // ৳5,000
      expect(pl.revenue.forfeitedDepositRevenuePaisa).toBe(200000); // ৳2,000
      expect(pl.revenue.grossRevenuePaisa).toBe(15700000); // ৳157,000

      // Verify Contra Revenue
      expect(pl.contraRevenue.salesDiscountsPaisa).toBe(300000); // ৳3,000
      expect(pl.contraRevenue.salesReturnsPaisa).toBe(200000); // ৳2,000
      expect(pl.contraRevenue.totalContraRevenuePaisa).toBe(500000); // ৳5,000

      // Verify Net Revenue
      expect(pl.netRevenuePaisa).toBe(15200000); // ৳152,000

      // Verify COGS & Gross Margin
      expect(pl.cogsPaisa).toBe(9000000); // ৳90,000
      expect(pl.grossMarginPaisa).toBe(6200000); // ৳62,000
      expect(pl.grossMarginPercentage).toBeCloseTo(40.789, 2);

      // Verify Expenses breakdown
      expect(pl.expenses.courierDeliveryChargesPaisa).toBe(400000);
      expect(pl.expenses.codChargesPaisa).toBe(150000);
      expect(pl.expenses.rtoChargesPaisa).toBe(50000);
      expect(pl.expenses.gatewayFeesPaisa).toBe(250000);
      expect(pl.expenses.cashVariancePaisa).toBe(20000);
      expect(pl.expenses.goodwillVouchersPaisa).toBe(100000);
      expect(pl.expenses.totalExpensesPaisa).toBe(970000); // ৳9,700

      // Verify Net Profit: 6,200,000 - 970,000 = 5,230,000 (৳52,300)
      expect(pl.netProfitPaisa).toBe(5230000);
    });
  });

  // --------------------------------------------------------------------------
  // Test 3: CSV Encoding of Bangla Names with UTF-8 BOM
  // --------------------------------------------------------------------------
  describe("3. CSV Export Encoding & Bangla Safety", () => {
    it("renders CSV with UTF-8 BOM (\\uFEFF) and accurately preserves Bangla text without mojibake", async () => {
      const from = new Date("2026-04-01T00:00:00.000Z");
      const to = new Date("2026-04-30T23:59:59.999Z");

      // Seed an invoice containing Bangla text
      await financeRepo.createInvoice(undefined, {
        orderId: crypto.randomUUID(),
        invoiceNo: "INV-2026-00441",
        type: "MUSHAK_6_3",
        mushakSerial: "MUSHAK-6.3-2026-00123",
        fiscalYear: "2025-2026",
        buyerName: "মেসার্স রহিম ইলেকট্রনিক্স (নবাবপুর)",
        buyerBin: "1234567890123",
        sellerBin: "9876543210987",
        lines: [
          {
            skuId: crypto.randomUUID(),
            skuCode: "SKU-UGR-100W",
            titleEn: "UGREEN USB-C Fast Charging Cable 100W",
            titleBn: "ইউগ্রিন ইউএসবি-সি কেবল ১০০ ওয়াট",
            qty: 5,
            unitPricePaisa: 80000,
            vatRateBp: 1500,
            vatPaisa: 60000,
            lineTotalPaisa: 460000,
          },
        ],
        subtotalPaisa: 400000,
        vatPaisa: 60000,
        totalPaisa: 460000,
        issuedAt: new Date("2026-04-10T14:30:00.000Z"),
      });

      const reportData = await reportsService.getVatSalesRegisterReport(from, to);
      const rendered = renderReportToFormat("vat-sales-register", reportData, "csv");

      expect(rendered.contentType).toBe("text/csv; charset=utf-8");
      expect(rendered.filename).toContain("vat-sales-register");

      // Verify Byte Order Mark: \uFEFF is 0xEF, 0xBB, 0xBF in UTF-8
      const buffer = rendered.buffer;
      expect(buffer[0]).toBe(0xef);
      expect(buffer[1]).toBe(0xbb);
      expect(buffer[2]).toBe(0xbf);

      // Verify decoded string
      const csvString = buffer.toString("utf8");
      expect(csvString.charCodeAt(0)).toBe(0xfeff); // Starts with BOM

      // Verify Bangla strings exist without corruption
      expect(csvString).toContain("মেসার্স রহিম ইলেকট্রনিক্স (নবাবপুর)");
      expect(csvString).toContain("INV-2026-00441");
      expect(csvString).toContain("MUSHAK-6.3-2026-00123");
      expect(csvString).toContain("1234567890123");
      expect(csvString).toContain("4000.00"); // ৳4,000 subtotal
      expect(csvString).toContain("600.00"); // ৳600 vat

      // Test XLSX format generator for the same Bangla data
      const xlsxRendered = renderReportToFormat("vat-sales-register", reportData, "xlsx");
      expect(xlsxRendered.contentType).toBe("application/vnd.ms-excel; charset=utf-8");
      const xlsxString = xlsxRendered.buffer.toString("utf8");
      expect(xlsxString).toContain("মেসার্স রহিম ইলেকট্রনিক্স (নবাবপুর)");
      expect(xlsxString).toContain("<Workbook");
      expect(xlsxString).toContain("</Workbook>");
    });
  });

  // --------------------------------------------------------------------------
  // Test 4: KPI Formulas on Fixtures
  // --------------------------------------------------------------------------
  describe("4. Operations KPIs Report Formulas", () => {
    it("computes all 11 operational KPI formulas accurately against test fixtures", async () => {
      const from = new Date("2026-05-01T00:00:00.000Z");
      const to = new Date("2026-05-31T23:59:59.999Z");

      // Seed suppliers with different defect rates
      await sourcingRepo.createSupplier({
        name: "সোহেল ট্রেডার্স (সুন্দরবন স্কয়ার)",
        proprietorName: "সোহেল রানা",
        market: "SUNDARBAN_SQUARE",
        stallNo: "A-24",
        floor: "2nd",
        phone: "01811223344",
        acceptedPaymentModes: ["CASH", "SUPPLIER_CREDIT"],
        totalUnitsSourced: 500,
        qcFailedUnits: 5, // 1.0% < 3% -> Active
        defectRateBp: 100,
      });

      await sourcingRepo.createSupplier({
        name: "নবাবপুর হার্ডওয়্যার মার্ট",
        proprietorName: "আনোয়ার হোসেন",
        market: "NAWABPUR_COMPLEX",
        stallNo: "B-12",
        floor: "Ground",
        phone: "01755667788",
        acceptedPaymentModes: ["CASH"],
        totalUnitsSourced: 200,
        qcFailedUnits: 10, // 5.0% > 3% -> Suspended
        defectRateBp: 500,
      });

      // Configure explicit test fixtures
      setCustomKpiFixturesForTesting({
        totalSessions: 20000,
        authenticViews: 12000,
        authenticOrders: 240, // 2.0%
        budgetViews: 8000,
        budgetOrders: 160, // 2.0%
        authenticDelivered: 1000,
        authenticReturned: 18, // 1.8% <= 2.0%
        budgetDelivered: 800,
        budgetReturned: 32, // 4.0% <= 5.0%
        totalDeliveredUnits: 1800,
        doaUnits: 5, // 0.28% < 0.5%
        dispatchedCodOrders: 1200,
        rtoOrders: 84, // 7.0% <= 8.0%
        avgDhakaDeliveryHours: 21.4, // <= 24h
        rmaTatDhakaHours: 48.0, // <= 72h
        rmaTatNationwideHours: 96.0, // <= 120h
        preOrderDepositsTaken: 100,
        preOrdersDelivered: 97, // 97.0% >= 95%
        deliveredOrdersCount: 1500,
        sealLookupsCount: 450, // 30.0% >= 25%
        dropPackOrdersCount: 800,
        dropPackGrossMarginPercent: 21.0, // 15%–25%
      });

      const kpis = await reportsService.getKpiOperationsReport(from, to);

      // 1. Conversion rates
      expect(kpis.conversion.authenticConversionRate).toBe(2.0);
      expect(kpis.conversion.budgetConversionRate).toBe(2.0);
      expect(kpis.conversion.overallConversionRate).toBe(2.0);

      // 2. Return / replacement rates per tier
      expect(kpis.returnReplacementRate.authenticTier.ratePercent).toBe(1.8);
      expect(kpis.returnReplacementRate.authenticTier.targetPercent).toBe(2.0);
      expect(kpis.returnReplacementRate.budgetSmartTier.ratePercent).toBe(4.0);
      expect(kpis.returnReplacementRate.budgetSmartTier.targetPercent).toBe(5.0);

      // 3. DOA rate
      expect(kpis.doaRate.ratePercent).toBe(0.28);
      expect(kpis.doaRate.targetPercent).toBe(0.5);

      // 4. RTO rate
      expect(kpis.rtoRate.ratePercent).toBe(7.0);
      expect(kpis.rtoRate.targetPercent).toBe(8.0);

      // 5. Avg Dhaka delivery time
      expect(kpis.avgDhakaDeliveryTimeHours).toBe(21.4);

      // 6. RMA TAT
      expect(kpis.rmaTatHours.dhakaAvgHours).toBe(48.0);
      expect(kpis.rmaTatHours.targetDhakaHours).toBe(72);

      // 7. Pre-order fulfilment rate
      expect(kpis.preOrderFulfilmentRate.ratePercent).toBe(97.0);
      expect(kpis.preOrderFulfilmentRate.targetPercent).toBe(95.0);

      // 8. Verification engagement rate
      expect(kpis.verificationEngagementRate.ratePercent).toBe(30.0);
      expect(kpis.verificationEngagementRate.targetPercent).toBe(25.0);

      // 9. Gross margin per Drop-and-Pack order
      expect(kpis.grossMarginPerDropPackOrder.avgGrossMarginPercent).toBe(21.0);
      expect(kpis.grossMarginPerDropPackOrder.targetRange).toBe("15%-25%");

      // 10. Supplier defect scores
      const goodVendor = kpis.supplierDefectScores.find((s) => s.stallNo === "A-24");
      expect(goodVendor).toBeDefined();
      expect(goodVendor?.defectRatePercent).toBe(1.0);
      expect(goodVendor?.isSuspended).toBe(false);

      const badVendor = kpis.supplierDefectScores.find((s) => s.stallNo === "B-12");
      expect(badVendor).toBeDefined();
      expect(badVendor?.defectRatePercent).toBe(5.0);
      expect(badVendor?.isSuspended).toBe(true); // Exceeds 3% -> suspended
    });
  });

  // --------------------------------------------------------------------------
  // Test 5: Heavy Export Background Job (> 90 days range)
  // --------------------------------------------------------------------------
  describe("5. Heavy Reports Background Export Job (> 90 days)", () => {
    it("creates an asynchronous export job, saves the rendered file to private R2 storage, and returns a signed download URL", async () => {
      // Range: 180 days (> 90 days threshold)
      const from = "2026-01-01";
      const to = "2026-06-30";

      const jobResponse = await reportsService.createExportJob(
        {
          reportType: "profit-and-loss",
          format: "csv",
          queryParams: { from, to },
        },
        financeOfficerActor
      );

      expect(jobResponse.id).toBeDefined();
      expect(jobResponse.reportType).toBe("profit-and-loss");
      expect(jobResponse.format).toBe("csv");
      expect(jobResponse.status).toBe("COMPLETED");
      expect(jobResponse.fileKey).toContain("exports/finance/");
      expect(jobResponse.fileSizeBytes).toBeGreaterThan(0);
      expect(jobResponse.downloadUrl).toBeDefined();

      // Retrieve via GET /exports/:id signed URL endpoint
      const signedUrlResponse = await reportsService.getExportSignedUrl(
        jobResponse.id,
        financeOfficerActor
      );

      expect(signedUrlResponse.id).toBe(jobResponse.id);
      expect(signedUrlResponse.status).toBe("COMPLETED");
      expect(signedUrlResponse.downloadUrl).toBeDefined();
      expect(signedUrlResponse.downloadUrl).toContain(jobResponse.fileKey!);
    });

    it("rejects unauthorized actors without reports.export or ledger.read", async () => {
      await expect(
        reportsService.createExportJob(
          {
            reportType: "trial-balance",
            format: "json",
            queryParams: {},
          },
          unauthorizedStaffActor
        )
      ).rejects.toThrow(/Insufficient permissions/);

      await expect(
        reportsService.getExportSignedUrl(crypto.randomUUID(), unauthorizedStaffActor)
      ).rejects.toThrow(/Insufficient permissions/);
    });
  });

  // --------------------------------------------------------------------------
  // Test 6: All 10 Reports Functional Coverage
  // --------------------------------------------------------------------------
  describe("6. All 10 Reports Functional Verification", () => {
    it("generates Courier Receivable Aging report by courier buckets", async () => {
      const aging = await reportsService.getCourierReceivableAgingReport();
      expect(aging.asOf).toBeDefined();
      expect(aging.summary).toBeDefined();
      expect(Array.isArray(aging.byCourier)).toBe(true);
    });

    it("generates Customer Deposits report (Account 2010)", async () => {
      const deposits = await reportsService.getCustomerDepositsReport();
      expect(deposits.asOf).toBeDefined();
      expect(typeof deposits.totalDepositsHeldPaisa).toBe("number");
      expect(Array.isArray(deposits.items)).toBe(true);
    });

    it("generates Store Credit Liability report (Account 2020)", async () => {
      const liability = await reportsService.getStoreCreditLiabilityReport();
      expect(liability.asOf).toBeDefined();
      expect(typeof liability.totalLiabilityPaisa).toBe("number");
      expect(typeof liability.totalWithdrawablePaisa).toBe("number");
      expect(typeof liability.totalGoodwillPaisa).toBe("number");
    });

    it("generates Runner Float Status report", async () => {
      const from = new Date("2026-06-01");
      const to = new Date("2026-06-30");
      const floats = await reportsService.getRunnerFloatStatusReport(from, to);
      expect(floats.from).toBe("2026-06-01");
      expect(floats.to).toBe("2026-06-30");
      expect(typeof floats.totalIssuedPaisa).toBe("number");
    });

    it("generates Supplier Payables report (Account 2200)", async () => {
      const payables = await reportsService.getSupplierPayablesReport();
      expect(payables.asOf).toBeDefined();
      expect(typeof payables.totalPayablePaisa).toBe("number");
    });

    it("generates Refunds Register report with SLA tracking", async () => {
      const from = new Date("2026-06-01");
      const to = new Date("2026-06-30");
      const refunds = await reportsService.getRefundsRegisterReport(from, to);
      expect(refunds.from).toBe("2026-06-01");
      expect(typeof refunds.totalRefunds).toBe("number");
      expect(typeof refunds.slaBreachesCount).toBe("number");
    });
  });
});
