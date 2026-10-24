import { JournalLineInput } from "./dto";

/**
 * Double-Entry Accounting Posting Rules Registry.
 * Translates domain events into balanced debits and credits
 * conforming strictly to architechture.md §10.3 and PRD §3.13.
 */
export const postingRules = {
  /**
   * 1. Online payment validated (full/balance/advance fee)
   * Dr 1100 (SSLCommerz Clearing) / Cr 2000 (Customer Advances)
   */
  ONLINE_PAYMENT_VALIDATED(input: {
    amountPaisa: number;
    orderId: string;
  }): JournalLineInput[] {
    return [
      { accountCode: "1100", debitPaisa: input.amountPaisa, creditPaisa: 0 },
      {
        accountCode: "2000",
        debitPaisa: 0,
        creditPaisa: input.amountPaisa,
        subLedgerType: "ORDER",
        subLedgerRef: input.orderId,
      },
    ];
  },

  /**
   * 2. Pre-order deposit validated
   * Dr 1100 (SSLCommerz Clearing) / Cr 2010 (Customer Deposits – Pre-Order)
   */
  PREORDER_DEPOSIT_VALIDATED(input: {
    amountPaisa: number;
    orderId: string;
  }): JournalLineInput[] {
    return [
      { accountCode: "1100", debitPaisa: input.amountPaisa, creditPaisa: 0 },
      {
        accountCode: "2010",
        debitPaisa: 0,
        creditPaisa: input.amountPaisa,
        subLedgerType: "ORDER",
        subLedgerRef: input.orderId,
      },
    ];
  },

  /**
   * 3. Store credit applied to order
   * Dr 2020 (Store Credit) / Cr 2000 or 2010 (Customer Advances / Pre-Order)
   */
  STORE_CREDIT_APPLIED(input: {
    amountPaisa: number;
    customerId: string;
    orderId: string;
    isPreOrder?: boolean;
  }): JournalLineInput[] {
    const targetAccount = input.isPreOrder ? "2010" : "2000";
    return [
      {
        accountCode: "2020",
        debitPaisa: input.amountPaisa,
        creditPaisa: 0,
        subLedgerType: "CUSTOMER",
        subLedgerRef: input.customerId,
      },
      {
        accountCode: targetAccount,
        debitPaisa: 0,
        creditPaisa: input.amountPaisa,
        subLedgerType: "ORDER",
        subLedgerRef: input.orderId,
      },
    ];
  },

  /**
   * 4. Delivered / counter handover — revenue recognition
   * Dr 2000 & 2010 (prepaid) + 1110 (courier COD) or 1010/1040/1030 (counter) + 4010 (discount)
   * Cr 4000 (net ex-VAT merchandise + discount) + 2100 (VAT) + 4020 (delivery fee)
   */
  REVENUE_RECOGNIZED_DELIVERY(input: {
    orderId: string;
    prepaidAdvancesPaisa?: number;
    prepaidPreorderDepositsPaisa?: number;
    courierCodPaisa?: number;
    courierId?: string;
    counterCashPaisa?: number;
    counterWalletPaisa?: number;
    counterBankPaisa?: number;
    drawerId?: string;
    discountPaisa?: number;
    revenueExVatPaisa: number;
    vatPaisa: number;
    deliveryFeePaisa?: number;
  }): JournalLineInput[] {
    const lines: JournalLineInput[] = [];

    // Debits (Settlement & Contra Revenue)
    if (input.prepaidAdvancesPaisa && input.prepaidAdvancesPaisa > 0) {
      lines.push({
        accountCode: "2000",
        debitPaisa: input.prepaidAdvancesPaisa,
        creditPaisa: 0,
        subLedgerType: "ORDER",
        subLedgerRef: input.orderId,
      });
    }

    if (input.prepaidPreorderDepositsPaisa && input.prepaidPreorderDepositsPaisa > 0) {
      lines.push({
        accountCode: "2010",
        debitPaisa: input.prepaidPreorderDepositsPaisa,
        creditPaisa: 0,
        subLedgerType: "ORDER",
        subLedgerRef: input.orderId,
      });
    }

    if (input.courierCodPaisa && input.courierCodPaisa > 0) {
      lines.push({
        accountCode: "1110",
        debitPaisa: input.courierCodPaisa,
        creditPaisa: 0,
        subLedgerType: "COURIER",
        subLedgerRef: input.courierId,
      });
    }

    if (input.counterCashPaisa && input.counterCashPaisa > 0) {
      lines.push({
        accountCode: "1010",
        debitPaisa: input.counterCashPaisa,
        creditPaisa: 0,
        subLedgerType: "DRAWER",
        subLedgerRef: input.drawerId,
      });
    }

    if (input.counterWalletPaisa && input.counterWalletPaisa > 0) {
      lines.push({
        accountCode: "1040",
        debitPaisa: input.counterWalletPaisa,
        creditPaisa: 0,
      });
    }

    if (input.counterBankPaisa && input.counterBankPaisa > 0) {
      lines.push({
        accountCode: "1030",
        debitPaisa: input.counterBankPaisa,
        creditPaisa: 0,
      });
    }

    if (input.discountPaisa && input.discountPaisa > 0) {
      lines.push({
        accountCode: "4010",
        debitPaisa: input.discountPaisa,
        creditPaisa: 0,
      });
    }

    // Credits (Revenue & Tax)
    if (input.revenueExVatPaisa > 0) {
      lines.push({
        accountCode: "4000",
        debitPaisa: 0,
        creditPaisa: input.revenueExVatPaisa,
      });
    }

    if (input.vatPaisa > 0) {
      lines.push({
        accountCode: "2100",
        debitPaisa: 0,
        creditPaisa: input.vatPaisa,
      });
    }

    if (input.deliveryFeePaisa && input.deliveryFeePaisa > 0) {
      lines.push({
        accountCode: "4020",
        debitPaisa: 0,
        creditPaisa: input.deliveryFeePaisa,
      });
    }

    return lines;
  },

  /**
   * 5. Cost of Goods Sold recognized
   * Dr 5000 (Cost of Goods Sold) / Cr 1200 (Inventory)
   */
  COGS_RECOGNIZED(input: { costPaisa: number }): JournalLineInput[] {
    return [
      { accountCode: "5000", debitPaisa: input.costPaisa, creditPaisa: 0 },
      { accountCode: "1200", debitPaisa: 0, creditPaisa: input.costPaisa },
    ];
  },

  /**
   * 6. Walk-in POS sale (Revenue + Cost in one compound transaction)
   * Dr 1010/1040/1030, Dr 4010 / Cr 4000, Cr 2100; Plus Dr 5000 / Cr 1200
   */
  POS_WALKIN_SALE(input: {
    cashPaisa?: number;
    walletPaisa?: number;
    bankPaisa?: number;
    drawerId?: string;
    discountPaisa?: number;
    revenueExVatPaisa: number;
    vatPaisa: number;
    costPaisa?: number;
  }): JournalLineInput[] {
    const lines: JournalLineInput[] = [];

    if (input.cashPaisa && input.cashPaisa > 0) {
      lines.push({
        accountCode: "1010",
        debitPaisa: input.cashPaisa,
        creditPaisa: 0,
        subLedgerType: "DRAWER",
        subLedgerRef: input.drawerId,
      });
    }

    if (input.walletPaisa && input.walletPaisa > 0) {
      lines.push({
        accountCode: "1040",
        debitPaisa: input.walletPaisa,
        creditPaisa: 0,
      });
    }

    if (input.bankPaisa && input.bankPaisa > 0) {
      lines.push({
        accountCode: "1030",
        debitPaisa: input.bankPaisa,
        creditPaisa: 0,
      });
    }

    if (input.discountPaisa && input.discountPaisa > 0) {
      lines.push({
        accountCode: "4010",
        debitPaisa: input.discountPaisa,
        creditPaisa: 0,
      });
    }

    if (input.revenueExVatPaisa > 0) {
      lines.push({
        accountCode: "4000",
        debitPaisa: 0,
        creditPaisa: input.revenueExVatPaisa,
      });
    }

    if (input.vatPaisa > 0) {
      lines.push({
        accountCode: "2100",
        debitPaisa: 0,
        creditPaisa: input.vatPaisa,
      });
    }

    if (input.costPaisa && input.costPaisa > 0) {
      lines.push({
        accountCode: "5000",
        debitPaisa: input.costPaisa,
        creditPaisa: 0,
      });
      lines.push({
        accountCode: "1200",
        debitPaisa: 0,
        creditPaisa: input.costPaisa,
      });
    }

    return lines;
  },

  /**
   * 7. Runner cash purchase
   * Dr 1200 (Inventory) / Cr 1020 (Runner Float)
   */
  RUNNER_CASH_PURCHASE(input: {
    amountPaisa: number;
    runnerId: string;
  }): JournalLineInput[] {
    return [
      { accountCode: "1200", debitPaisa: input.amountPaisa, creditPaisa: 0 },
      {
        accountCode: "1020",
        debitPaisa: 0,
        creditPaisa: input.amountPaisa,
        subLedgerType: "RUNNER",
        subLedgerRef: input.runnerId,
      },
    ];
  },

  /**
   * 8. Supplier credit purchase
   * Dr 1200 (Inventory) / Cr 2200 (Supplier Payable)
   */
  SUPPLIER_CREDIT_PURCHASE(input: {
    amountPaisa: number;
    supplierId: string;
  }): JournalLineInput[] {
    return [
      { accountCode: "1200", debitPaisa: input.amountPaisa, creditPaisa: 0 },
      {
        accountCode: "2200",
        debitPaisa: 0,
        creditPaisa: input.amountPaisa,
        subLedgerType: "SUPPLIER",
        subLedgerRef: input.supplierId,
      },
    ];
  },

  /**
   * 9. Supplier paid
   * Dr 2200 (Supplier Payable) / Cr 1030 (Bank) or 1000 (Office Cash)
   */
  SUPPLIER_PAID(input: {
    amountPaisa: number;
    supplierId: string;
    method?: "BANK" | "CASH";
  }): JournalLineInput[] {
    const creditAccount = input.method === "CASH" ? "1000" : "1030";
    return [
      {
        accountCode: "2200",
        debitPaisa: input.amountPaisa,
        creditPaisa: 0,
        subLedgerType: "SUPPLIER",
        subLedgerRef: input.supplierId,
      },
      { accountCode: creditAccount, debitPaisa: 0, creditPaisa: input.amountPaisa },
    ];
  },

  /**
   * 10. Float issued
   * Dr 1020 (Runner Float) / Cr 1000 (Cash – Office)
   */
  FLOAT_ISSUED(input: {
    amountPaisa: number;
    runnerId: string;
  }): JournalLineInput[] {
    return [
      {
        accountCode: "1020",
        debitPaisa: input.amountPaisa,
        creditPaisa: 0,
        subLedgerType: "RUNNER",
        subLedgerRef: input.runnerId,
      },
      { accountCode: "1000", debitPaisa: 0, creditPaisa: input.amountPaisa },
    ];
  },

  /**
   * 11. Float returned
   * Dr 1000 (Cash – Office) / Cr 1020 (Runner Float)
   */
  FLOAT_RETURNED(input: {
    amountPaisa: number;
    runnerId: string;
  }): JournalLineInput[] {
    return [
      { accountCode: "1000", debitPaisa: input.amountPaisa, creditPaisa: 0 },
      {
        accountCode: "1020",
        debitPaisa: 0,
        creditPaisa: input.amountPaisa,
        subLedgerType: "RUNNER",
        subLedgerRef: input.runnerId,
      },
    ];
  },

  /**
   * 12. Cash shortage (runner or drawer)
   * Dr 5310 (Cash Variance) / Cr 1020 (Runner Float) or 1010 (Showroom Drawer)
   */
  CASH_SHORTAGE(input: {
    amountPaisa: number;
    location: "RUNNER" | "DRAWER";
    refId: string;
  }): JournalLineInput[] {
    const targetAccount = input.location === "RUNNER" ? "1020" : "1010";
    const subLedgerType = input.location === "RUNNER" ? "RUNNER" : "DRAWER";
    return [
      { accountCode: "5310", debitPaisa: input.amountPaisa, creditPaisa: 0 },
      {
        accountCode: targetAccount,
        debitPaisa: 0,
        creditPaisa: input.amountPaisa,
        subLedgerType,
        subLedgerRef: input.refId,
      },
    ];
  },

  /**
   * 13. Cash overage (runner or drawer)
   * Dr 1020 or 1010 / Cr 5310 (Cash Variance - credited as offset per DECISIONS.md)
   */
  CASH_OVERAGE(input: {
    amountPaisa: number;
    location: "RUNNER" | "DRAWER";
    refId: string;
  }): JournalLineInput[] {
    const targetAccount = input.location === "RUNNER" ? "1020" : "1010";
    const subLedgerType = input.location === "RUNNER" ? "RUNNER" : "DRAWER";
    return [
      {
        accountCode: targetAccount,
        debitPaisa: input.amountPaisa,
        creditPaisa: 0,
        subLedgerType,
        subLedgerRef: input.refId,
      },
      { accountCode: "5310", debitPaisa: 0, creditPaisa: input.amountPaisa },
    ];
  },

  /**
   * 14. Courier payout matched
   * Dr 1030 (Bank net) + Dr 5100 + Dr 5110 + Dr 5120 / Cr 1110 (Courier COD Receivable)
   */
  COURIER_PAYOUT_MATCHED(input: {
    netPayoutPaisa: number;
    deliveryFeePaisa: number;
    codFeePaisa?: number;
    rtoFeePaisa?: number;
    courierId: string;
  }): JournalLineInput[] {
    const codFee = input.codFeePaisa ?? 0;
    const rtoFee = input.rtoFeePaisa ?? 0;
    const totalGrossCod = input.netPayoutPaisa + input.deliveryFeePaisa + codFee + rtoFee;

    const lines: JournalLineInput[] = [];

    if (input.netPayoutPaisa > 0) {
      lines.push({ accountCode: "1030", debitPaisa: input.netPayoutPaisa, creditPaisa: 0 });
    }

    if (input.deliveryFeePaisa > 0) {
      lines.push({ accountCode: "5100", debitPaisa: input.deliveryFeePaisa, creditPaisa: 0 });
    }

    if (codFee > 0) {
      lines.push({ accountCode: "5110", debitPaisa: codFee, creditPaisa: 0 });
    }

    if (rtoFee > 0) {
      lines.push({ accountCode: "5120", debitPaisa: rtoFee, creditPaisa: 0 });
    }

    if (totalGrossCod > 0) {
      lines.push({
        accountCode: "1110",
        debitPaisa: 0,
        creditPaisa: totalGrossCod,
        subLedgerType: "COURIER",
        subLedgerRef: input.courierId,
      });
    }

    return lines;
  },

  /**
   * 15. Gateway settlement matched
   * Dr 1030 (Bank net) + Dr 5200 (Gateway Fees) / Cr 1100 (SSLCommerz Clearing)
   */
  GATEWAY_SETTLEMENT_MATCHED(input: {
    netSettlementPaisa: number;
    feePaisa: number;
  }): JournalLineInput[] {
    const totalClearing = input.netSettlementPaisa + input.feePaisa;
    const lines: JournalLineInput[] = [];

    if (input.netSettlementPaisa > 0) {
      lines.push({ accountCode: "1030", debitPaisa: input.netSettlementPaisa, creditPaisa: 0 });
    }

    if (input.feePaisa > 0) {
      lines.push({ accountCode: "5200", debitPaisa: input.feePaisa, creditPaisa: 0 });
    }

    if (totalClearing > 0) {
      lines.push({ accountCode: "1100", debitPaisa: 0, creditPaisa: totalClearing });
    }

    return lines;
  },

  /**
   * 16. Refund before delivery
   * Dr 2000 or 2010 (Customer Advances/Pre-Order) / Cr 1100 (gateway), 1040/1030 (manual), or 2020 (credit)
   */
  REFUND_BEFORE_DELIVERY(input: {
    amountPaisa: number;
    orderId: string;
    isPreOrder?: boolean;
    method: "GATEWAY" | "MANUAL" | "STORE_CREDIT";
    customerId?: string;
  }): JournalLineInput[] {
    const debitAccount = input.isPreOrder ? "2010" : "2000";
    let creditAccount = "1100";
    if (input.method === "MANUAL") {
      creditAccount = "1040";
    } else if (input.method === "STORE_CREDIT") {
      creditAccount = "2020";
    }

    const lines: JournalLineInput[] = [
      {
        accountCode: debitAccount,
        debitPaisa: input.amountPaisa,
        creditPaisa: 0,
        subLedgerType: "ORDER",
        subLedgerRef: input.orderId,
      },
    ];

    if (input.method === "STORE_CREDIT") {
      lines.push({
        accountCode: creditAccount,
        debitPaisa: 0,
        creditPaisa: input.amountPaisa,
        subLedgerType: "CUSTOMER",
        subLedgerRef: input.customerId,
      });
    } else {
      lines.push({
        accountCode: creditAccount,
        debitPaisa: 0,
        creditPaisa: input.amountPaisa,
      });
    }

    return lines;
  },

  /**
   * 17. Refund after delivery (RMA)
   * Dr 4040 (Sales Returns) + Dr 2100 (VAT) / Cr 1100/1040/1030/2020;
   * Returned unit: Dr 1200 (Inventory) / Cr 5000 (COGS) at cost
   */
  REFUND_AFTER_DELIVERY(input: {
    returnRevenueExVatPaisa: number;
    returnVatPaisa: number;
    method: "GATEWAY" | "MANUAL" | "STORE_CREDIT";
    customerId?: string;
    returnedUnitCostPaisa?: number;
  }): JournalLineInput[] {
    const totalRefund = input.returnRevenueExVatPaisa + input.returnVatPaisa;
    let creditAccount = "1100";
    if (input.method === "MANUAL") {
      creditAccount = "1040";
    } else if (input.method === "STORE_CREDIT") {
      creditAccount = "2020";
    }

    const lines: JournalLineInput[] = [];

    if (input.returnRevenueExVatPaisa > 0) {
      lines.push({
        accountCode: "4040",
        debitPaisa: input.returnRevenueExVatPaisa,
        creditPaisa: 0,
      });
    }

    if (input.returnVatPaisa > 0) {
      lines.push({
        accountCode: "2100",
        debitPaisa: input.returnVatPaisa,
        creditPaisa: 0,
      });
    }

    if (totalRefund > 0) {
      if (input.method === "STORE_CREDIT") {
        lines.push({
          accountCode: creditAccount,
          debitPaisa: 0,
          creditPaisa: totalRefund,
          subLedgerType: "CUSTOMER",
          subLedgerRef: input.customerId,
        });
      } else {
        lines.push({
          accountCode: creditAccount,
          debitPaisa: 0,
          creditPaisa: totalRefund,
        });
      }
    }

    if (input.returnedUnitCostPaisa && input.returnedUnitCostPaisa > 0) {
      lines.push({
        accountCode: "1200",
        debitPaisa: input.returnedUnitCostPaisa,
        creditPaisa: 0,
      });
      lines.push({
        accountCode: "5000",
        debitPaisa: 0,
        creditPaisa: input.returnedUnitCostPaisa,
      });
    }

    return lines;
  },

  /**
   * 18. Pre-order deposit forfeited
   * Dr 2010 (Customer Deposits – Pre-Order) / Cr 4030 (Forfeited Deposit Income)
   */
  PREORDER_DEPOSIT_FORFEITED(input: {
    amountPaisa: number;
    orderId: string;
  }): JournalLineInput[] {
    return [
      {
        accountCode: "2010",
        debitPaisa: input.amountPaisa,
        creditPaisa: 0,
        subLedgerType: "ORDER",
        subLedgerRef: input.orderId,
      },
      { accountCode: "4030", debitPaisa: 0, creditPaisa: input.amountPaisa },
    ];
  },

  /**
   * 19. RTO received — advance fee retained
   * Dr 2000 (Customer Advances) / Cr 4020 (Delivery Fee Revenue)
   */
  RTO_ADVANCE_FEE_RETAINED(input: {
    amountPaisa: number;
    orderId: string;
  }): JournalLineInput[] {
    return [
      {
        accountCode: "2000",
        debitPaisa: input.amountPaisa,
        creditPaisa: 0,
        subLedgerType: "ORDER",
        subLedgerRef: input.orderId,
      },
      { accountCode: "4020", debitPaisa: 0, creditPaisa: input.amountPaisa },
    ];
  },

  /**
   * 20. Goodwill store credit / delay voucher issued
   * Dr 5400 (Goodwill & Vouchers) / Cr 2020 (Store Credit)
   */
  GOODWILL_CREDIT_ISSUED(input: {
    amountPaisa: number;
    customerId: string;
  }): JournalLineInput[] {
    return [
      { accountCode: "5400", debitPaisa: input.amountPaisa, creditPaisa: 0 },
      {
        accountCode: "2020",
        debitPaisa: 0,
        creditPaisa: input.amountPaisa,
        subLedgerType: "CUSTOMER",
        subLedgerRef: input.customerId,
      },
    ];
  },

  /**
   * 21. Withdrawable store credit paid out
   * Dr 2020 (Store Credit) / Cr 1040 (Wallet) or 1030 (Bank)
   */
  STORE_CREDIT_WITHDRAWN(input: {
    amountPaisa: number;
    customerId: string;
    method?: "BKASH" | "NAGAD" | "BANK";
  }): JournalLineInput[] {
    const creditAccount = input.method === "BANK" ? "1030" : "1040";
    return [
      {
        accountCode: "2020",
        debitPaisa: input.amountPaisa,
        creditPaisa: 0,
        subLedgerType: "CUSTOMER",
        subLedgerRef: input.customerId,
      },
      { accountCode: creditAccount, debitPaisa: 0, creditPaisa: input.amountPaisa },
    ];
  },

  /**
   * 22. Stock write-off (approved)
   * Dr 5300 (Inventory Write-off & Damage) / Cr 1200 (Inventory)
   */
  STOCK_WRITE_OFF(input: { costPaisa: number }): JournalLineInput[] {
    return [
      { accountCode: "5300", debitPaisa: input.costPaisa, creditPaisa: 0 },
      { accountCode: "1200", debitPaisa: 0, creditPaisa: input.costPaisa },
    ];
  },

  /**
   * 23. Supplier refunds rejected batch in cash
   * Dr 1020 (Runner Float) or 1000 (Office Cash) / Cr 1200 (Inventory)
   */
  SUPPLIER_CASH_REFUND(input: {
    amountPaisa: number;
    destination?: "FLOAT" | "OFFICE";
    runnerId?: string;
  }): JournalLineInput[] {
    const isFloat = input.destination !== "OFFICE";
    const debitAccount = isFloat ? "1020" : "1000";
    const debitLine: JournalLineInput = {
      accountCode: debitAccount,
      debitPaisa: input.amountPaisa,
      creditPaisa: 0,
    };
    if (isFloat && input.runnerId) {
      debitLine.subLedgerType = "RUNNER";
      debitLine.subLedgerRef = input.runnerId;
    }

    return [
      debitLine,
      { accountCode: "1200", debitPaisa: 0, creditPaisa: input.amountPaisa },
    ];
  },

  /**
   * 24. Store credit expired
   * Dr 2020 (Store Credit) / Cr 5400 (Goodwill Reversal)
   */
  STORE_CREDIT_EXPIRED(input: {
    amountPaisa: number;
    customerId: string;
  }): JournalLineInput[] {
    return [
      {
        accountCode: "2020",
        debitPaisa: input.amountPaisa,
        creditPaisa: 0,
        subLedgerType: "CUSTOMER",
        subLedgerRef: input.customerId,
      },
      { accountCode: "5400", debitPaisa: 0, creditPaisa: input.amountPaisa },
    ];
  },

  /**
   * 25. Supplier credit note (refund against payables)
   * Dr 2200 (Supplier Payable) / Cr 1200 (Inventory)
   */
  SUPPLIER_CREDIT_NOTE(input: {
    amountPaisa: number;
    supplierId: string;
  }): JournalLineInput[] {
    return [
      {
        accountCode: "2200",
        debitPaisa: input.amountPaisa,
        creditPaisa: 0,
        subLedgerType: "SUPPLIER",
        subLedgerRef: input.supplierId,
      },
      { accountCode: "1200", debitPaisa: 0, creditPaisa: input.amountPaisa },
    ];
  },
};

