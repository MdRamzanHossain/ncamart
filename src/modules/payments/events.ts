// Outbox event definitions for module: payments & refunds

export const REFUND_EVENTS = {
  REQUESTED: "refund.requested",
  APPROVED: "refund.approved",
  REJECTED: "refund.rejected",
  PROCESSING: "refund.processing",
  COMPLETED: "refund.completed",
  FAILED: "refund.failed",
  SLA_ALERT: "refund.sla_alert",
  SLA_ESCALATION: "refund.sla_escalation",
} as const;

export type RefundEventType = (typeof REFUND_EVENTS)[keyof typeof REFUND_EVENTS];

export interface RefundRequestedPayload {
  refundId: string;
  refundNumber: string;
  orderId: string;
  amountPaisa: number;
  reason: string;
  method: string;
  isBeforeDelivery: boolean;
  requestedByType: string;
  requestedById?: string | null;
}

export interface RefundApprovedPayload {
  refundId: string;
  refundNumber: string;
  orderId: string;
  amountPaisa: number;
  method: string;
  approvedBy: string;
  approvedAt: string;
  dueBy: string | null;
}

export interface RefundRejectedPayload {
  refundId: string;
  refundNumber: string;
  orderId: string;
  rejectedBy: string;
  reason: string;
}

export interface RefundCompletedPayload {
  refundId: string;
  refundNumber: string;
  orderId: string;
  amountPaisa: number;
  method: string;
  executedBy: string;
  executedAt: string;
  externalRef?: string | null;
  orderPaymentStatus: string;
}

export interface RefundFailedPayload {
  refundId: string;
  refundNumber: string;
  orderId: string;
  amountPaisa: number;
  method: string;
  errorReason: string;
}
