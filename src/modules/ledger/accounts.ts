import { AccountType, NormalSide } from "./schema";

export interface AccountDefinition {
  code: string;
  name: string;
  type: AccountType;
  normalSide: NormalSide;
  isContra: boolean;
  requiresSubLedger: boolean;
}

export const CHART_OF_ACCOUNTS: AccountDefinition[] = [
  // 1000–1999: ASSETS (Normal side: DEBIT)
  {
    code: "1000",
    name: "Cash – Office",
    type: "ASSET",
    normalSide: "DEBIT",
    isContra: false,
    requiresSubLedger: false,
  },
  {
    code: "1010",
    name: "Cash – Showroom Drawer",
    type: "ASSET",
    normalSide: "DEBIT",
    isContra: false,
    requiresSubLedger: true,
  },
  {
    code: "1020",
    name: "Cash – Runner Float",
    type: "ASSET",
    normalSide: "DEBIT",
    isContra: false,
    requiresSubLedger: true,
  },
  {
    code: "1030",
    name: "Bank",
    type: "ASSET",
    normalSide: "DEBIT",
    isContra: false,
    requiresSubLedger: false,
  },
  {
    code: "1040",
    name: "bKash/Nagad Merchant Wallet",
    type: "ASSET",
    normalSide: "DEBIT",
    isContra: false,
    requiresSubLedger: false,
  },
  {
    code: "1100",
    name: "SSLCommerz Clearing",
    type: "ASSET",
    normalSide: "DEBIT",
    isContra: false,
    requiresSubLedger: false,
  },
  {
    code: "1110",
    name: "Courier COD Receivable",
    type: "ASSET",
    normalSide: "DEBIT",
    isContra: false,
    requiresSubLedger: true,
  },
  {
    code: "1200",
    name: "Inventory",
    type: "ASSET",
    normalSide: "DEBIT",
    isContra: false,
    requiresSubLedger: false,
  },

  // 2000–2999: LIABILITIES (Normal side: CREDIT)
  {
    code: "2000",
    name: "Customer Advances",
    type: "LIABILITY",
    normalSide: "CREDIT",
    isContra: false,
    requiresSubLedger: true,
  },
  {
    code: "2010",
    name: "Customer Deposits – Pre-Order",
    type: "LIABILITY",
    normalSide: "CREDIT",
    isContra: false,
    requiresSubLedger: true,
  },
  {
    code: "2020",
    name: "Store Credit",
    type: "LIABILITY",
    normalSide: "CREDIT",
    isContra: false,
    requiresSubLedger: true,
  },
  {
    code: "2100",
    name: "VAT Payable",
    type: "LIABILITY",
    normalSide: "CREDIT",
    isContra: false,
    requiresSubLedger: false,
  },
  {
    code: "2200",
    name: "Supplier Payable",
    type: "LIABILITY",
    normalSide: "CREDIT",
    isContra: false,
    requiresSubLedger: true,
  },

  // 3000–3999: EQUITY (Normal side: CREDIT)
  {
    code: "3000",
    name: "Owner's Equity",
    type: "EQUITY",
    normalSide: "CREDIT",
    isContra: false,
    requiresSubLedger: false,
  },

  // 4000–4999: INCOME (Normal side: CREDIT, contra: DEBIT)
  {
    code: "4000",
    name: "Sales Revenue",
    type: "INCOME",
    normalSide: "CREDIT",
    isContra: false,
    requiresSubLedger: false,
  },
  {
    code: "4010",
    name: "Sales Discounts",
    type: "INCOME",
    normalSide: "DEBIT",
    isContra: true,
    requiresSubLedger: false,
  },
  {
    code: "4020",
    name: "Delivery Fee Revenue",
    type: "INCOME",
    normalSide: "CREDIT",
    isContra: false,
    requiresSubLedger: false,
  },
  {
    code: "4030",
    name: "Forfeited Deposit Income",
    type: "INCOME",
    normalSide: "CREDIT",
    isContra: false,
    requiresSubLedger: false,
  },
  {
    code: "4040",
    name: "Sales Returns",
    type: "INCOME",
    normalSide: "DEBIT",
    isContra: true,
    requiresSubLedger: false,
  },

  // 5000–5999: EXPENSES (Normal side: DEBIT)
  {
    code: "5000",
    name: "Cost of Goods Sold",
    type: "EXPENSE",
    normalSide: "DEBIT",
    isContra: false,
    requiresSubLedger: false,
  },
  {
    code: "5100",
    name: "Courier Delivery Charges",
    type: "EXPENSE",
    normalSide: "DEBIT",
    isContra: false,
    requiresSubLedger: false,
  },
  {
    code: "5110",
    name: "COD Charges",
    type: "EXPENSE",
    normalSide: "DEBIT",
    isContra: false,
    requiresSubLedger: false,
  },
  {
    code: "5120",
    name: "Return / RTO Charges",
    type: "EXPENSE",
    normalSide: "DEBIT",
    isContra: false,
    requiresSubLedger: false,
  },
  {
    code: "5200",
    name: "Gateway Fees",
    type: "EXPENSE",
    normalSide: "DEBIT",
    isContra: false,
    requiresSubLedger: false,
  },
  {
    code: "5300",
    name: "Inventory Write-off & Damage",
    type: "EXPENSE",
    normalSide: "DEBIT",
    isContra: false,
    requiresSubLedger: false,
  },
  {
    code: "5310",
    name: "Cash Variance",
    type: "EXPENSE",
    normalSide: "DEBIT",
    isContra: false,
    requiresSubLedger: false,
  },
  {
    code: "5400",
    name: "Goodwill & Vouchers",
    type: "EXPENSE",
    normalSide: "DEBIT",
    isContra: false,
    requiresSubLedger: false,
  },
];
