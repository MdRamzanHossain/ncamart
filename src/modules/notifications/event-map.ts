import { NotificationChannel, NotificationClass } from "./schema";
import {
  nextAllowedSendTime,
  computeBalanceReminderTime,
  computeOutForDeliveryTime,
} from "./timing";

export interface PrdMatrixRowDefinition {
  rowNumber: number;
  triggerName: string;
  templateCode: string;
  class: NotificationClass;
  sms: boolean;
  whatsapp: boolean;
  email: boolean;
  deliverySla: string;
  isInternalAdmin?: boolean;
}

/**
 * Explicit canonical definition of all 12 rows from PRD §3.10.
 */
export const PRD_MATRIX_ROWS: PrdMatrixRowDefinition[] = [
  {
    rowNumber: 1,
    triggerName: "OTP Verification Code",
    templateCode: "OTP_VERIFICATION",
    class: "A",
    sms: true,
    whatsapp: false,
    email: false,
    deliverySla: "Real-time (< 15 sec)",
  },
  {
    rowNumber: 2,
    triggerName: "Order Placed (Pre/Drop)",
    templateCode: "ORDER_PLACED",
    class: "A",
    sms: true,
    whatsapp: true,
    email: true,
    deliverySla: "Instant (< 1 min)",
  },
  {
    rowNumber: 3,
    triggerName: "Payment / Advance Delivery Fee Confirmed",
    templateCode: "PAYMENT_CONFIRMED",
    class: "A",
    sms: true,
    whatsapp: true,
    email: true,
    deliverySla: "Instant (< 1 min)",
  },
  {
    rowNumber: 4,
    triggerName: "Refund Processed",
    templateCode: "REFUND_PROCESSED",
    class: "A",
    sms: true,
    whatsapp: true,
    email: true,
    deliverySla: "Instant on completion",
  },
  {
    rowNumber: 5,
    triggerName: "Pre-Order Sourced / In Transit",
    templateCode: "PREORDER_SOURCED_IN_TRANSIT",
    class: "B",
    sms: true,
    whatsapp: true,
    email: true,
    deliverySla: "Within 2 hours of update",
  },
  {
    rowNumber: 6,
    triggerName: "Pre-Order QC Passed / Balance Due",
    templateCode: "PREORDER_QC_PASSED_BALANCE_DUE",
    class: "B",
    sms: true,
    whatsapp: true,
    email: true,
    deliverySla: "Instant upon QC pass (within window)",
  },
  {
    rowNumber: 7,
    triggerName: "Out for Delivery Alert",
    templateCode: "OUT_FOR_DELIVERY",
    class: "B",
    sms: true,
    whatsapp: true,
    email: false,
    deliverySla: "Morning of delivery",
  },
  {
    rowNumber: 8,
    triggerName: "Pre-Order Balance Reminder (D1, 4, 7)",
    templateCode: "PREORDER_BALANCE_REMINDER",
    class: "B",
    sms: true,
    whatsapp: true,
    email: true,
    deliverySla: "10:00 AM",
  },
  {
    rowNumber: 9,
    triggerName: "Pickup Ready / Pickup Reminders",
    templateCode: "PICKUP_READY",
    class: "B",
    sms: true,
    whatsapp: true,
    email: false,
    deliverySla: "Instant (within window)",
  },
  {
    rowNumber: 10,
    triggerName: "RMA Status Change",
    templateCode: "RMA_STATUS_CHANGE",
    class: "B",
    sms: true,
    whatsapp: true,
    email: true,
    deliverySla: "Within 1 hour of review",
  },
  {
    rowNumber: 11,
    triggerName: "Promotions, Back-in-Stock, Abandoned Cart",
    templateCode: "PROMOTION_BROADCAST",
    class: "C",
    sms: true,
    whatsapp: true,
    email: true,
    deliverySla: "Opt-in only, 08:00–22:00",
  },
  {
    rowNumber: 12,
    triggerName: "Cloned Seal Alert (Security)",
    templateCode: "CLONED_SEAL_ALERT",
    class: "A",
    sms: true,
    whatsapp: true,
    email: true,
    deliverySla: "Urgent real-time (< 1 min)",
    isInternalAdmin: true,
  },
];

export interface MappedNotificationTarget {
  recipientType: "CUSTOMER" | "STAFF" | "ADMIN";
  recipientId?: string;
  toAddress: string; // phone or email
  channel: NotificationChannel;
  templateCode: string;
  class: NotificationClass;
  scheduledAt: Date;
  variables: Record<string, unknown>;
  locale: "bn" | "en";
}

export interface OutboxEventLike {
  type: string;
  payload: Record<string, unknown>;
  notificationClass?: NotificationClass | null;
  createdAt?: Date;
}

/**
 * Event-to-template and channels mapping.
 */
export function mapOutboxEventToNotifications(
  event: OutboxEventLike,
  now = new Date()
): MappedNotificationTarget[] {
  const p = event.payload ?? {};
  const customerId = (p.customerId as string) || (p.userId as string);
  const phone = (p.phone as string) || (p.customerPhone as string);
  const email = (p.email as string) || (p.customerEmail as string);
  const locale: "bn" | "en" = (p.locale as "bn" | "en") || "bn";

  const targets: MappedNotificationTarget[] = [];

  const addChannels = (
    templateCode: string,
    cls: NotificationClass,
    channels: { sms?: boolean; whatsapp?: boolean; email?: boolean },
    timingFn: (cls: NotificationClass, n: Date) => Date = nextAllowedSendTime,
    recipientType: "CUSTOMER" | "STAFF" | "ADMIN" = "CUSTOMER"
  ) => {
    const scheduledAt = timingFn(cls, now);

    if (channels.sms && phone) {
      targets.push({
        recipientType,
        recipientId: customerId,
        toAddress: phone,
        channel: "SMS",
        templateCode,
        class: cls,
        scheduledAt,
        variables: p,
        locale,
      });
    }

    if (channels.whatsapp && phone) {
      targets.push({
        recipientType,
        recipientId: customerId,
        toAddress: phone,
        channel: "WHATSAPP",
        templateCode,
        class: cls,
        scheduledAt,
        variables: p,
        locale,
      });
    }

    if (channels.email && email) {
      targets.push({
        recipientType,
        recipientId: customerId,
        toAddress: email,
        channel: "EMAIL",
        templateCode,
        class: cls,
        scheduledAt,
        variables: p,
        locale,
      });
    }
  };

  switch (event.type) {
    // 1. OTP Verification Code
    case "identity.otp_sent":
    case "auth.otp_generated":
      addChannels("OTP_VERIFICATION", "A", { sms: true }, nextAllowedSendTime);
      break;

    // 2. Order Placed
    case "order.created":
    case "orders.order_created":
    case "order.confirmed":
      addChannels("ORDER_PLACED", "A", { sms: true, whatsapp: true, email: true }, nextAllowedSendTime);
      break;

    // 3. Payment Confirmed
    case "payment.succeeded":
    case "payments.payment_confirmed":
    case "order.payment_received":
      addChannels("PAYMENT_CONFIRMED", "A", { sms: true, whatsapp: true, email: true }, nextAllowedSendTime);
      break;

    // 4. Refund Processed
    case "refund.completed":
    case "payments.refund_executed":
    case "payments.refund_completed":
      addChannels("REFUND_PROCESSED", "A", { sms: true, whatsapp: true, email: true }, nextAllowedSendTime);
      break;

    // 5. Pre-Order Sourced / In Transit
    case "preorder.sourced_in_transit":
    case "orders.preorder_in_transit":
      addChannels("PREORDER_SOURCED_IN_TRANSIT", "B", { sms: true, whatsapp: true, email: true }, nextAllowedSendTime);
      break;

    // 6. Pre-Order QC Passed / Balance Due
    case "preorder.qc_passed":
    case "orders.preorder_qc_passed":
      addChannels("PREORDER_QC_PASSED_BALANCE_DUE", "B", { sms: true, whatsapp: true, email: true }, nextAllowedSendTime);
      break;

    // 7. Out for Delivery Alert
    case "courier.out_for_delivery":
    case "shipment.out_for_delivery":
    case "logistics.out_for_delivery":
      addChannels(
        "OUT_FOR_DELIVERY",
        "B",
        { sms: true, whatsapp: true },
        () => computeOutForDeliveryTime(now)
      );
      break;

    // 8. Pre-Order Balance Reminder
    case "preorder.balance_reminder_due":
    case "orders.preorder_balance_reminder":
      addChannels(
        "PREORDER_BALANCE_REMINDER",
        "B",
        { sms: true, whatsapp: true, email: true },
        () => computeBalanceReminderTime(now)
      );
      break;

    // 9. Pickup Ready / Pickup Reminders
    case "order.ready_for_pickup":
    case "orders.ready_for_pickup":
    case "pos.pickup_ready":
      addChannels("PICKUP_READY", "B", { sms: true, whatsapp: true }, nextAllowedSendTime);
      break;

    // 10. RMA Status Change
    case "rma.status_changed":
    case "rma.claim_updated":
      addChannels("RMA_STATUS_CHANGE", "B", { sms: true, whatsapp: true, email: true }, nextAllowedSendTime);
      break;

    // 11. Promotions, Back-in-Stock, Abandoned Cart
    case "promotions.broadcast":
    case "promotions.abandoned_cart":
    case "promotions.back_in_stock":
      addChannels("PROMOTION_BROADCAST", "C", { sms: true, whatsapp: true, email: true }, nextAllowedSendTime);
      break;

    // 12. Cloned Seal Alert (Security Internal Admin)
    case "trust.cloned_seal_detected":
    case "security.cloned_seal": {
      const adminPhone = (p.adminPhone as string) || "+8801700000000";
      const adminEmail = (p.adminEmail as string) || "security@ncamart.com";
      targets.push({
        recipientType: "ADMIN",
        recipientId: "admin-security-desk",
        toAddress: adminPhone,
        channel: "SMS",
        templateCode: "CLONED_SEAL_ALERT",
        class: "A",
        scheduledAt: now,
        variables: p,
        locale: "bn",
      });
      targets.push({
        recipientType: "ADMIN",
        recipientId: "admin-security-desk",
        toAddress: adminPhone,
        channel: "WHATSAPP",
        templateCode: "CLONED_SEAL_ALERT",
        class: "A",
        scheduledAt: now,
        variables: p,
        locale: "bn",
      });
      targets.push({
        recipientType: "ADMIN",
        recipientId: "admin-security-desk",
        toAddress: adminEmail,
        channel: "EMAIL",
        templateCode: "CLONED_SEAL_ALERT",
        class: "A",
        scheduledAt: now,
        variables: p,
        locale: "en",
      });
      break;
    }

    // Internal Alerts from Earlier Prompts:
    case "sourcing.override_requested":
      targets.push({
        recipientType: "STAFF",
        recipientId: "sourcing-manager",
        toAddress: (p.managerPhone as string) || "+8801711111111",
        channel: "SMS",
        templateCode: "OVERRIDE_ESCALATION",
        class: "A",
        scheduledAt: now,
        variables: p,
        locale: "en",
      });
      break;

    case "sourcing.supplier_suspended":
      targets.push({
        recipientType: "STAFF",
        recipientId: "sourcing-dept",
        toAddress: (p.managerEmail as string) || "sourcing@ncamart.com",
        channel: "EMAIL",
        templateCode: "SUPPLIER_SUSPENDED",
        class: "A",
        scheduledAt: now,
        variables: p,
        locale: "en",
      });
      break;

    case "inventory.cycle_count_mismatch":
      targets.push({
        recipientType: "STAFF",
        recipientId: "godown-manager",
        toAddress: (p.staffPhone as string) || "+8801722222222",
        channel: "SMS",
        templateCode: "STOCK_CHECK_MISMATCH",
        class: "A",
        scheduledAt: now,
        variables: p,
        locale: "en",
      });
      break;

    case "finance.gateway_mismatch":
      targets.push({
        recipientType: "STAFF",
        recipientId: "finance-officer",
        toAddress: (p.financePhone as string) || "+8801733333333",
        channel: "SMS",
        templateCode: "PAYMENT_MISMATCH",
        class: "A",
        scheduledAt: now,
        variables: p,
        locale: "en",
      });
      break;

    case "finance.refund_sla_breach":
      targets.push({
        recipientType: "STAFF",
        recipientId: "finance-team",
        toAddress: (p.financeEmail as string) || "finance@ncamart.com",
        channel: "EMAIL",
        templateCode: "REFUND_SLA_BREACH",
        class: "A",
        scheduledAt: now,
        variables: p,
        locale: "en",
      });
      break;

    case "qc.sampling_failed":
      targets.push({
        recipientType: "STAFF",
        recipientId: "qc-lead",
        toAddress: (p.leadPhone as string) || "+8801744444444",
        channel: "SMS",
        templateCode: "SAMPLING_ESCALATION",
        class: "A",
        scheduledAt: now,
        variables: p,
        locale: "en",
      });
      break;

    case "system.outbox_lag_detected":
      targets.push({
        recipientType: "STAFF",
        recipientId: "devops-team",
        toAddress: (p.adminEmail as string) || "ops@ncamart.com",
        channel: "EMAIL",
        templateCode: "OUTBOX_LAG_ALERT",
        class: "A",
        scheduledAt: now,
        variables: p,
        locale: "en",
      });
      break;

    default:
      break;
  }

  return targets;
}

/**
 * Asserts that every single trigger row from PRD §3.10 is mapped in the event-map.
 */
export function verifyAllPrdMatrixRowsMapped(): {
  allMapped: boolean;
  totalRows: number;
  mappedRows: number;
  missingRows: PrdMatrixRowDefinition[];
} {
  const missingRows: PrdMatrixRowDefinition[] = [];

  for (const row of PRD_MATRIX_ROWS) {
    // Generate synthetic event matching this trigger
    let eventType = "";
    switch (row.templateCode) {
      case "OTP_VERIFICATION":
        eventType = "auth.otp_generated";
        break;
      case "ORDER_PLACED":
        eventType = "order.created";
        break;
      case "PAYMENT_CONFIRMED":
        eventType = "payment.succeeded";
        break;
      case "REFUND_PROCESSED":
        eventType = "refund.completed";
        break;
      case "PREORDER_SOURCED_IN_TRANSIT":
        eventType = "preorder.sourced_in_transit";
        break;
      case "PREORDER_QC_PASSED_BALANCE_DUE":
        eventType = "preorder.qc_passed";
        break;
      case "OUT_FOR_DELIVERY":
        eventType = "courier.out_for_delivery";
        break;
      case "PREORDER_BALANCE_REMINDER":
        eventType = "preorder.balance_reminder_due";
        break;
      case "PICKUP_READY":
        eventType = "order.ready_for_pickup";
        break;
      case "RMA_STATUS_CHANGE":
        eventType = "rma.status_changed";
        break;
      case "PROMOTION_BROADCAST":
        eventType = "promotions.broadcast";
        break;
      case "CLONED_SEAL_ALERT":
        eventType = "trust.cloned_seal_detected";
        break;
    }

    const testEvent: OutboxEventLike = {
      type: eventType,
      payload: {
        customerId: "cust-test-1",
        phone: "+8801700000000",
        email: "customer@test.com",
      },
    };

    const mapped = mapOutboxEventToNotifications(testEvent);
    if (!mapped || mapped.length === 0) {
      missingRows.push(row);
      continue;
    }

    const hasTemplate = mapped.some((m) => m.templateCode === row.templateCode);
    if (!hasTemplate) {
      missingRows.push(row);
    }
  }

  return {
    allMapped: missingRows.length === 0,
    totalRows: PRD_MATRIX_ROWS.length,
    mappedRows: PRD_MATRIX_ROWS.length - missingRows.length,
    missingRows,
  };
}
