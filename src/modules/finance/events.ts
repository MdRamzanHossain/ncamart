// Outbox event definitions for module: finance
export type FinanceEvent =
  | {
      type: "finance.system_invoice_created";
      aggregateType: "invoice";
      aggregateId: string;
      payload: {
        invoiceId: string;
        invoiceNo: string;
        orderId: string;
        orderNumber: string;
        totalPaisa: number;
      };
    }
  | {
      type: "finance.mushak_6_3_issued";
      aggregateType: "invoice";
      aggregateId: string;
      payload: {
        invoiceId: string;
        invoiceNo: string;
        mushakSerial: string;
        orderId: string;
        orderNumber: string;
        totalPaisa: number;
      };
    }
  | {
      type: "finance.supplier_paid";
      aggregateType: "supplier";
      aggregateId: string;
      payload: {
        supplierId: string;
        amountPaisa: number;
        method?: string;
        entryId: string;
      };
    }
  | {
      type: "finance.supplier_refund_recorded";
      aggregateType: "supplier";
      aggregateId: string;
      payload: {
        supplierId: string;
        amountPaisa: number;
        destination: string;
        entryId: string;
      };
    }
  | {
      type: "finance.courier_settlement_reconciled";
      aggregateType: "courier_settlement";
      aggregateId: string;
      payload: {
        settlementId: string;
        payoutRef: string;
        courier: string;
        matchedCount: number;
        hasExceptions: boolean;
        netPaisa: number;
      };
    }
  | {
      type: "finance.courier_receivable_overdue";
      aggregateType: "shipment";
      aggregateId: string;
      payload: {
        shipmentId: string;
        consignmentNo?: string | null;
        courier?: string | null;
        ageDays: number;
        amountPaisa?: number;
        alert?: string;
      };
    }
  | {
      type: "finance.settlement_exception_resolved";
      aggregateType: "settlement_exception";
      aggregateId: string;
      payload: {
        exceptionId: string;
        resolution: string;
        amountPaisa: number;
        resolvedBy: string;
      };
    }
  | {
      type: "finance.gateway_settlement_reconciled";
      aggregateType: "gateway_settlement";
      aggregateId: string;
      payload: {
        settlementId: string;
        payoutRef: string;
        matchedCount: number;
        unmatchedCount: number;
        netPaisa: number;
      };
    };
