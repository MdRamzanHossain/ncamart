export const ENGAGEMENT_EVENTS = {
  REVIEW_SUBMITTED: "review.submitted",
  REVIEW_APPROVED: "review.approved",
  REVIEW_REJECTED: "review.rejected",
  STOCK_ALERT_SUBSCRIBED: "stock_alert.subscribed",
  STOCK_ALERT_NOTIFIED: "stock_alert.notified",
  CART_UPDATED: "cart.updated",
  CART_REMINDED: "cart.reminded",
  REVIEW_INVITATION_SENT: "review.invitation_sent",
} as const;

export type EngagementEventName = (typeof ENGAGEMENT_EVENTS)[keyof typeof ENGAGEMENT_EVENTS];
