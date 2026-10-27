export interface JournalEntryLine {
  id: string;
  accountCode: string;
  accountName: string;
  debitPaisa: number;
  creditPaisa: number;
  memo?: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  timestamp: string;
  eventType:
    | "ORDER_PLACED"
    | "RUNNER_PURCHASE"
    | "SEAL_QC_PASSED"
    | "COURIER_DISPATCH"
    | "COD_SETTLEMENT"
    | "STORE_CREDIT_ISSUED";
  referenceNumber: string;
  description: string;
  lines: JournalEntryLine[];
  totalDebitPaisa: number;
  totalCreditPaisa: number;
  isBalanced: boolean;
}

export interface ReconciledParcel {
  orderNumber: string;
  consignmentId: string;
  deliveryDate: string;
  codAmountPaisa: number;
  courierFeePaisa: number;
  netRemittedPaisa: number;
  daysOutstanding: number;
  status: "MATCHED" | "DISCREPANCY" | "UNRECONCILED_OVERDUE";
}

export interface CourierRemittanceBatch {
  id: string;
  batchNumber: string;
  courier: "Pathao" | "Steadfast";
  remittanceDate: string;
  bankAccount: string;
  totalCodPaisa: number;
  totalFeesPaisa: number;
  netRemittedPaisa: number;
  status: "BALANCED" | "DISCREPANCY_FLAGGED";
  parcels: ReconciledParcel[];
}

export interface TrialBalanceRow {
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  debitPaisa: number;
  creditPaisa: number;
}
