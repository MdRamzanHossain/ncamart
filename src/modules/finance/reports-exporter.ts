import {
  TrialBalanceReportDto,
  ProfitAndLossReportDto,
  CourierReceivableAgingReportDto,
  CustomerDepositsReportDto,
  StoreCreditLiabilityReportDto,
  RunnerFloatStatusReportDto,
  SupplierPayablesReportDto,
  VatSalesRegisterReportDto,
  RefundsRegisterReportDto,
  KpiOperationsReportDto,
  ReportFormat,
} from "./dto";

export interface TabularReport {
  title: string;
  filenameBase: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
}

/**
 * Format paisa integer into BDT string with 2 decimal places.
 */
export function formatPaisa(paisa: number): string {
  return (paisa / 100).toFixed(2);
}

/**
 * Transforms any of the 10 domain reports into standardized tabular structure.
 */
export function reportToTabular(reportType: string, data: unknown): TabularReport {
  switch (reportType) {
    case "trial-balance": {
      const tb = data as TrialBalanceReportDto;
      const headers = [
        "Account Code",
        "Account Name",
        "Type",
        "Normal Side",
        "Debit (BDT)",
        "Credit (BDT)",
        "Net Balance (BDT)",
      ];
      const rows = tb.accounts.map((a) => [
        a.accountCode,
        a.accountName,
        a.accountType,
        a.normalSide,
        formatPaisa(a.debitPaisa),
        formatPaisa(a.creditPaisa),
        formatPaisa(a.netBalancePaisa),
      ]);
      // Append totals row
      rows.push([
        "TOTAL",
        tb.isBalanced ? "Balanced" : "UNBALANCED",
        "-",
        "-",
        formatPaisa(tb.totalDebitPaisa),
        formatPaisa(tb.totalCreditPaisa),
        formatPaisa(tb.differencePaisa),
      ]);
      return {
        title: `Trial Balance as of ${tb.asOf}`,
        filenameBase: `trial-balance-${tb.asOf}`,
        headers,
        rows,
      };
    }

    case "profit-and-loss": {
      const pl = data as ProfitAndLossReportDto;
      const headers = ["Section", "Account / Line Item", "Amount (BDT)"];
      const rows: (string | number)[][] = [
        // Revenue
        ["Revenue", "Sales Revenue (4000)", formatPaisa(pl.revenue.salesRevenuePaisa)],
        ["Revenue", "Delivery Fee Revenue (4020)", formatPaisa(pl.revenue.deliveryFeeRevenuePaisa)],
        ["Revenue", "Forfeited Pre-order Deposits (4030)", formatPaisa(pl.revenue.forfeitedDepositRevenuePaisa)],
        ["Revenue", "GROSS REVENUE", formatPaisa(pl.revenue.grossRevenuePaisa)],
        // Contra Revenue
        ["Contra Revenue", "Sales Discounts (4010)", `-${formatPaisa(pl.contraRevenue.salesDiscountsPaisa)}`],
        ["Contra Revenue", "Sales Returns (4040)", `-${formatPaisa(pl.contraRevenue.salesReturnsPaisa)}`],
        ["Contra Revenue", "TOTAL CONTRA REVENUE", `-${formatPaisa(pl.contraRevenue.totalContraRevenuePaisa)}`],
        ["Summary", "NET REVENUE", formatPaisa(pl.netRevenuePaisa)],
        // Cost of Goods Sold
        ["Cost of Goods Sold", "Cost of Goods Sold (5000)", `-${formatPaisa(pl.cogsPaisa)}`],
        ["Summary", "GROSS MARGIN", formatPaisa(pl.grossMarginPaisa)],
        ["Summary", "GROSS MARGIN %", `${pl.grossMarginPercentage.toFixed(2)}%`],
        // Operating Expenses
        ["Operating Expenses", "Courier Delivery Charges (5100)", formatPaisa(pl.expenses.courierDeliveryChargesPaisa)],
        ["Operating Expenses", "COD Charges (5110)", formatPaisa(pl.expenses.codChargesPaisa)],
        ["Operating Expenses", "Return / RTO Charges (5120)", formatPaisa(pl.expenses.rtoChargesPaisa)],
        ["Operating Expenses", "Gateway Fees (5200)", formatPaisa(pl.expenses.gatewayFeesPaisa)],
        ["Operating Expenses", "Inventory Damage & Write-offs (5300)", formatPaisa(pl.expenses.inventoryWriteOffPaisa)],
        ["Operating Expenses", "Cash Variance (5310)", formatPaisa(pl.expenses.cashVariancePaisa)],
        ["Operating Expenses", "Goodwill & Vouchers (5400)", formatPaisa(pl.expenses.goodwillVouchersPaisa)],
        ["Operating Expenses", "TOTAL EXPENSES", formatPaisa(pl.expenses.totalExpensesPaisa)],
        ["Summary", "NET PROFIT / (LOSS)", formatPaisa(pl.netProfitPaisa)],
      ];
      return {
        title: `Profit and Loss Statement (${pl.from} to ${pl.to})`,
        filenameBase: `profit-and-loss-${pl.from}-to-${pl.to}`,
        headers,
        rows,
      };
    }

    case "courier-receivable-aging": {
      const aging = data as CourierReceivableAgingReportDto;
      const headers = [
        "Courier Partner",
        "0–7 Days (BDT)",
        "8–15 Days (BDT)",
        "16–30 Days (BDT)",
        "> 30 Days (BDT)",
        "Total Receivable (BDT)",
        "Open Consignments",
      ];
      const rows = aging.byCourier.map((b) => [
        b.courier,
        formatPaisa(b.bucket_0_7_days_paisa),
        formatPaisa(b.bucket_8_15_days_paisa),
        formatPaisa(b.bucket_16_30_days_paisa),
        formatPaisa(b.bucket_30_plus_days_paisa),
        formatPaisa(b.totalReceivablePaisa),
        b.openConsignmentsCount,
      ]);
      rows.push([
        "TOTAL",
        formatPaisa(aging.summary.bucket_0_7_days_paisa),
        formatPaisa(aging.summary.bucket_8_15_days_paisa),
        formatPaisa(aging.summary.bucket_16_30_days_paisa),
        formatPaisa(aging.summary.bucket_30_plus_days_paisa),
        formatPaisa(aging.summary.totalReceivablePaisa),
        aging.summary.unreconciledOlder7dCount,
      ]);
      return {
        title: `Courier Receivable Aging as of ${aging.asOf}`,
        filenameBase: `courier-receivable-aging-${aging.asOf}`,
        headers,
        rows,
      };
    }

    case "customer-deposits": {
      const dep = data as CustomerDepositsReportDto;
      const headers = [
        "Order Number",
        "Customer Name",
        "Phone",
        "SKU Title",
        "Status",
        "Deposit Paid (BDT)",
        "Balance Due (BDT)",
        "Deposit Held (BDT)",
        "Order Date",
      ];
      const rows = dep.items.map((i) => [
        i.orderNumber,
        i.customerName,
        i.customerPhone,
        i.skuTitle ?? "-",
        i.status,
        formatPaisa(i.depositPaidPaisa),
        formatPaisa(i.balanceDuePaisa),
        formatPaisa(i.depositHeldPaisa),
        i.createdAt,
      ]);
      rows.push([
        "TOTAL DEPOSITS HELD",
        `${dep.openPreOrdersCount} Orders`,
        "-",
        "-",
        "-",
        "-",
        "-",
        formatPaisa(dep.totalDepositsHeldPaisa),
        "-",
      ]);
      return {
        title: `Customer Deposits (Account 2010) as of ${dep.asOf}`,
        filenameBase: `customer-deposits-${dep.asOf}`,
        headers,
        rows,
      };
    }

    case "store-credit-liability": {
      const sc = data as StoreCreditLiabilityReportDto;
      const headers = [
        "Customer Name",
        "Phone",
        "Withdrawable (BDT)",
        "Goodwill / Non-Withdrawable (BDT)",
        "Total Store Credit (BDT)",
      ];
      const rows = sc.customers.map((c) => [
        c.customerName,
        c.phone,
        formatPaisa(c.withdrawablePaisa),
        formatPaisa(c.goodwillPaisa),
        formatPaisa(c.totalBalancePaisa),
      ]);
      rows.push([
        "TOTAL LIABILITY (2020)",
        "-",
        formatPaisa(sc.totalWithdrawablePaisa),
        formatPaisa(sc.totalGoodwillPaisa),
        formatPaisa(sc.totalLiabilityPaisa),
      ]);
      return {
        title: `Store Credit Liability (Account 2020) as of ${sc.asOf}`,
        filenameBase: `store-credit-liability-${sc.asOf}`,
        headers,
        rows,
      };
    }

    case "runner-float-status": {
      const rf = data as RunnerFloatStatusReportDto;
      const headers = [
        "Session ID",
        "Runner Name",
        "Opened At",
        "Closed At",
        "Status",
        "Issued (BDT)",
        "Purchases (BDT)",
        "Returned (BDT)",
        "Variance (BDT)",
        "Variance Reason",
        "SM Signoff",
        "FO Signoff",
      ];
      const rows = rf.sessions.map((s) => [
        s.sessionId,
        s.runnerName,
        s.openedAt,
        s.closedAt ?? "OPEN",
        s.status,
        formatPaisa(s.issuedPaisa),
        formatPaisa(s.purchasesCashPaisa),
        formatPaisa(s.returnedPaisa),
        formatPaisa(s.variancePaisa),
        s.varianceReason ?? "-",
        s.smSignoff ? "YES" : "NO",
        s.foSignoff ? "YES" : "NO",
      ]);
      rows.push([
        "TOTAL",
        `${rf.openSessionsCount} Open Sessions`,
        "-",
        "-",
        "-",
        formatPaisa(rf.totalIssuedPaisa),
        formatPaisa(rf.totalPurchasesPaisa),
        formatPaisa(rf.totalReturnedPaisa),
        formatPaisa(rf.totalVariancePaisa),
        "-",
        "-",
        "-",
      ]);
      return {
        title: `Runner Float Status (${rf.from} to ${rf.to})`,
        filenameBase: `runner-float-status-${rf.from}-to-${rf.to}`,
        headers,
        rows,
      };
    }

    case "supplier-payables": {
      const sp = data as SupplierPayablesReportDto;
      const headers = [
        "Supplier Name",
        "Market",
        "Stall No",
        "Phone",
        "0–7 Days (BDT)",
        "8–15 Days (BDT)",
        "16–30 Days (BDT)",
        "> 30 Days (BDT)",
        "Total Payable (BDT)",
      ];
      const rows = sp.suppliers.map((s) => [
        s.supplierName,
        s.market,
        s.stallNo,
        s.phone,
        formatPaisa(s.bucket_0_7_days_paisa),
        formatPaisa(s.bucket_8_15_days_paisa),
        formatPaisa(s.bucket_16_30_days_paisa),
        formatPaisa(s.bucket_30_plus_days_paisa),
        formatPaisa(s.totalPayablePaisa),
      ]);
      rows.push([
        "TOTAL (2200)",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        formatPaisa(sp.totalPayablePaisa),
      ]);
      return {
        title: `Supplier Payables (Account 2200) as of ${sp.asOf}`,
        filenameBase: `supplier-payables-${sp.asOf}`,
        headers,
        rows,
      };
    }

    case "vat-sales-register": {
      const vat = data as VatSalesRegisterReportDto;
      const headers = [
        "Invoice Date",
        "Invoice No",
        "Mushak 6.3 No",
        "Buyer Name",
        "Buyer BIN",
        "Net Supply (BDT)",
        "VAT Rate (%)",
        "VAT Amount (BDT)",
        "Total (BDT)",
      ];
      const rows = vat.invoices.map((i) => [
        i.invoiceDate,
        i.invoiceNo,
        i.mushakNo ?? "-",
        i.buyerName,
        i.buyerBin ?? "-",
        formatPaisa(i.netSalesPaisa),
        `${i.vatRate}%`,
        formatPaisa(i.vatAmountPaisa),
        formatPaisa(i.totalAmountPaisa),
      ]);
      rows.push([
        "TOTAL",
        `${vat.totalInvoices} Invoices`,
        "-",
        "-",
        "-",
        formatPaisa(vat.totalNetSalesPaisa),
        "-",
        formatPaisa(vat.totalVatPaisa),
        formatPaisa(vat.totalGrandAmountPaisa),
      ]);
      return {
        title: `VAT Sales Register NBR Mushak 6.3 (${vat.from} to ${vat.to})`,
        filenameBase: `vat-sales-register-${vat.from}-to-${vat.to}`,
        headers,
        rows,
      };
    }

    case "refunds-register": {
      const ref = data as RefundsRegisterReportDto;
      const headers = [
        "Refund Number",
        "Order ID",
        "Customer Name",
        "Method",
        "Status",
        "Amount (BDT)",
        "Requested At",
        "Approved At",
        "Executed At",
        "24h Initiation Breached",
        "7d Completion Breached",
        "SLA Status",
      ];
      const rows = ref.refunds.map((r) => [
        r.refundNumber,
        r.orderId,
        r.customerName,
        r.method,
        r.status,
        formatPaisa(r.amountPaisa),
        r.requestedAt,
        r.approvedAt ?? "-",
        r.executedAt ?? "-",
        r.initiationBreached ? "YES" : "NO",
        r.completionBreached ? "YES" : "NO",
        r.slaStatus,
      ]);
      rows.push([
        "TOTAL",
        `${ref.totalRefunds} Refunds`,
        "-",
        "-",
        "-",
        formatPaisa(ref.totalAmountPaisa),
        "-",
        "-",
        "-",
        "-",
        "-",
        `${ref.slaBreachesCount} SLA Breaches`,
      ]);
      return {
        title: `Refunds Register & SLA Tracking (${ref.from} to ${ref.to})`,
        filenameBase: `refunds-register-${ref.from}-to-${ref.to}`,
        headers,
        rows,
      };
    }

    case "kpi-operations": {
      const k = data as KpiOperationsReportDto;
      const headers = ["Category", "Metric", "Value", "Target", "Status"];
      const rows = [
        ["Conversion", "Website Conversion Rate (Authentic)", `${k.conversion.authenticConversionRate.toFixed(2)}%`, "≥ 1.5%", k.conversion.authenticConversionRate >= 1.5 ? "MET" : "BELOW_TARGET"],
        ["Conversion", "Website Conversion Rate (Budget Smart)", `${k.conversion.budgetConversionRate.toFixed(2)}%`, "≥ 1.5%", k.conversion.budgetConversionRate >= 1.5 ? "MET" : "BELOW_TARGET"],
        ["Conversion", "Overall Website Conversion Rate", `${k.conversion.overallConversionRate.toFixed(2)}%`, "≥ 1.5%", k.conversion.overallConversionRate >= 1.5 ? "MET" : "BELOW_TARGET"],
        ["Returns", "Return/Replacement Rate (Authentic Tier)", `${k.returnReplacementRate.authenticTier.ratePercent.toFixed(2)}%`, "≤ 2.0%", k.returnReplacementRate.authenticTier.ratePercent <= 2.0 ? "MET" : "EXCEEDED"],
        ["Returns", "Return/Replacement Rate (Budget Smart Tier)", `${k.returnReplacementRate.budgetSmartTier.ratePercent.toFixed(2)}%`, "≤ 5.0%", k.returnReplacementRate.budgetSmartTier.ratePercent <= 5.0 ? "MET" : "EXCEEDED"],
        ["Quality", "Dead-on-Arrival (DOA) Rate", `${k.doaRate.ratePercent.toFixed(2)}%`, "< 0.5%", k.doaRate.ratePercent < 0.5 ? "MET" : "EXCEEDED"],
        ["Logistics", "COD Return-to-Origin (RTO) Rate", `${k.rtoRate.ratePercent.toFixed(2)}%`, "≤ 8.0%", k.rtoRate.ratePercent <= 8.0 ? "MET" : "EXCEEDED"],
        ["Fulfillment", "Avg Delivery Time Inside Dhaka", `${k.avgDhakaDeliveryTimeHours.toFixed(1)} hrs`, "≤ 24.0 hrs", k.avgDhakaDeliveryTimeHours <= 24 ? "MET" : "EXCEEDED"],
        ["Customer Support", "RMA Turnaround Time (Dhaka)", `${k.rmaTatHours.dhakaAvgHours.toFixed(1)} hrs`, "≤ 72.0 hrs", k.rmaTatHours.dhakaAvgHours <= 72 ? "MET" : "EXCEEDED"],
        ["Pre-Orders", "Pre-Order Fulfilment Rate", `${k.preOrderFulfilmentRate.ratePercent.toFixed(2)}%`, "≥ 95.0%", k.preOrderFulfilmentRate.ratePercent >= 95 ? "MET" : "BELOW_TARGET"],
        ["Trust & Verification", "Verification Engagement Rate (Lookups ÷ Delivered)", `${k.verificationEngagementRate.ratePercent.toFixed(2)}%`, "≥ 25.0%", k.verificationEngagementRate.ratePercent >= 25 ? "MET" : "BELOW_TARGET"],
        ["Finance & Margin", "Gross Margin per Drop-and-Pack Order", `${k.grossMarginPerDropPackOrder.avgGrossMarginPercent.toFixed(2)}%`, "15%–25%", (k.grossMarginPerDropPackOrder.avgGrossMarginPercent >= 15 && k.grossMarginPerDropPackOrder.avgGrossMarginPercent <= 25) ? "MET" : "OUT_OF_RANGE"],
        ["Settlements", "Unreconciled Settlements (> 7 Days)", `${k.unreconciledSettlementCount.olderThan7Days}`, "= 0", k.unreconciledSettlementCount.olderThan7Days === 0 ? "MET" : "DISCREPANCY"],
      ];
      return {
        title: `Operational KPIs Report (${k.from} to ${k.to})`,
        filenameBase: `kpi-operations-${k.from}-to-${k.to}`,
        headers,
        rows,
      };
    }

    default: {
      return {
        title: `Finance Report: ${reportType}`,
        filenameBase: `report-${reportType}`,
        headers: ["Data"],
        rows: [[JSON.stringify(data)]],
      };
    }
  }
}

/**
 * Escapes a single CSV value according to RFC 4180.
 */
function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes tabular data to CSV with Bangla-safe UTF-8 Byte Order Mark (\uFEFF).
 */
export function serializeToCsv(tabular: TabularReport): Buffer {
  const lines: string[] = [];

  // Header row
  lines.push(tabular.headers.map(escapeCsvValue).join(","));

  // Data rows
  for (const row of tabular.rows) {
    lines.push(row.map(escapeCsvValue).join(","));
  }

  const csvBody = lines.join("\r\n");
  // Prepend UTF-8 BOM (\uFEFF -> 0xEF 0xBB 0xBF)
  const bom = "\uFEFF";
  return Buffer.from(bom + csvBody, "utf8");
}

/**
 * Serializes tabular data to an Excel-compatible XML Spreadsheet (SpreadsheetML).
 * Supported natively by Microsoft Excel 2003–2026, LibreOffice Calc, Apple Numbers,
 * and Google Sheets without any external npm binary dependency.
 */
export function serializeToSpreadsheetMl(tabular: TabularReport): Buffer {
  function escapeXml(val: unknown): string {
    if (val === null || val === undefined) return "";
    return String(val)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  const headerCells = tabular.headers
    .map((h) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
    .join("");

  const rowsXml = tabular.rows
    .map((r) => {
      const cells = r
        .map((cell) => {
          const isNum = typeof cell === "number" && !isNaN(cell);
          const type = isNum ? "Number" : "String";
          return `<Cell><Data ss:Type="${type}">${escapeXml(cell)}</Data></Cell>`;
        })
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(tabular.title.slice(0, 31))}">
  <Table>
   <Row ss:StyleID="Header">
    ${headerCells}
   </Row>
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;

  return Buffer.from(xml, "utf8");
}

export interface RenderedExport {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

/**
 * Main export router that renders a report in JSON, CSV, or XLSX.
 */
export function renderReportToFormat(
  reportType: string,
  data: unknown,
  format: ReportFormat
): RenderedExport {
  const tabular = reportToTabular(reportType, data);

  if (format === "csv") {
    const buffer = serializeToCsv(tabular);
    return {
      buffer,
      contentType: "text/csv; charset=utf-8",
      filename: `${tabular.filenameBase}.csv`,
    };
  }

  if (format === "xlsx") {
    const buffer = serializeToSpreadsheetMl(tabular);
    return {
      buffer,
      contentType: "application/vnd.ms-excel; charset=utf-8",
      filename: `${tabular.filenameBase}.xlsx`,
    };
  }

  // format === "json"
  const jsonString = JSON.stringify(data, null, 2);
  return {
    buffer: Buffer.from(jsonString, "utf8"),
    contentType: "application/json; charset=utf-8",
    filename: `${tabular.filenameBase}.json`,
  };
}
