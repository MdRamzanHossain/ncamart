export const ANALYTICS_EVENTS = {
  EVENT_CAPTURED: "analytics.event_captured",
  FEED_GENERATED: "analytics.feed_generated",
  FEED_FAILED: "analytics.feed_failed",
} as const;

export const OUTBOX_TO_ANALYTICS_EVENT_MAP: Record<string, string> = {
  "order.placed": "order_placed",
  "order.confirmed": "order_placed",
  "payment.succeeded": "payment_succeeded",
  "payment.failed": "payment_failed",
  "trust.seal_verified": "verify_lookup",
  "verify.lookup": "verify_lookup",
  "trust.qr_scanned": "qr_scan",
  "rma.claim_submitted": "rma_submitted",
  "rma.status_changed": "rma_submitted",
  "logistics.rto_in_transit": "rto",
  "courier.rto": "rto",
  "preorder.milestone_reached": "preorder_milestone",
  "preorder.sourced_in_transit": "preorder_milestone",
};
