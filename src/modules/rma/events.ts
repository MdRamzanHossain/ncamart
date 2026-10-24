// Outbox event definitions for module: rma

export const RMA_EVENTS = {
  CLAIM_SUBMITTED: "rma.claim_submitted",
  CLAIM_ADJUDICATED: "rma.claim_adjudicated",
  CLAIM_APPROVED: "rma.claim_approved",
  CLAIM_REJECTED: "rma.claim_rejected",
  CLAIM_RECEIVED: "rma.claim_received",
  CLAIM_INSPECTED: "rma.claim_inspected",
  CLAIM_LIAISON_DISPATCHED: "rma.claim_liaison_dispatched",
  CLAIM_LIAISON_RETURNED: "rma.claim_liaison_returned",
  CLAIM_RESOLVED: "rma.claim_resolved",
  CLAIM_CLOSED: "rma.claim_closed",
} as const;

export type RmaEventType = (typeof RMA_EVENTS)[keyof typeof RMA_EVENTS];

export interface ClaimSubmittedPayload {
  claimId: string;
  claimNumber: string;
  sealId: string;
  orderId: string;
  customerId: string;
  claimType: string;
  priority: string;
  isDoa: boolean;
  slaDueAt?: string | null;
}

export interface ClaimApprovedPayload {
  claimId: string;
  claimNumber: string;
  reverseShipmentId?: string | null;
  consignmentNo?: string | null;
  courier?: string | null;
  priority: string;
}

export interface ClaimRejectedPayload {
  claimId: string;
  claimNumber: string;
  rejectionReason: string;
  notes?: string | null;
}

export interface ClaimInspectedPayload {
  claimId: string;
  claimNumber: string;
  verifiedDefect: boolean;
  sealIntact: boolean;
  resolution?: string | null;
}

export interface ClaimResolvedPayload {
  claimId: string;
  claimNumber: string;
  resolution: string;
  replacementOrderId?: string | null;
}

export interface ClaimClosedPayload {
  claimId: string;
  claimNumber: string;
  closedAt: string;
}
