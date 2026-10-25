import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// --------------------------------------------------------------------------
// Enums
// --------------------------------------------------------------------------
export const notificationChannelEnum = ["SMS", "WHATSAPP", "EMAIL"] as const;
export type NotificationChannel = (typeof notificationChannelEnum)[number];

export const notificationClassEnum = ["A", "B", "C"] as const;
export type NotificationClass = (typeof notificationClassEnum)[number];

export const notificationLocaleEnum = ["bn", "en"] as const;
export type NotificationLocale = (typeof notificationLocaleEnum)[number];

export const notificationStatusEnum = [
  "QUEUED",
  "SCHEDULED",
  "SENT",
  "DELIVERED",
  "FAILED",
  "DEAD_LETTER",
  "SKIPPED_OPT_OUT",
] as const;
export type NotificationStatus = (typeof notificationStatusEnum)[number];

export const recipientTypeEnum = ["CUSTOMER", "STAFF", "ADMIN"] as const;
export type RecipientType = (typeof recipientTypeEnum)[number];

// --------------------------------------------------------------------------
// 1. Notification Templates
// --------------------------------------------------------------------------
export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    channel: text("channel", { enum: notificationChannelEnum }).notNull(),
    locale: text("locale", { enum: notificationLocaleEnum }).default("bn").notNull(),
    class: text("class", { enum: notificationClassEnum }).notNull(),
    subject: text("subject"), // For emails
    body: text("body").notNull(), // Template text with {{vars}}
    whatsappTemplateName: text("whatsapp_template_name"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_notification_templates_code_channel_locale").on(
      table.code,
      table.channel,
      table.locale
    ),
    index("idx_notification_templates_class").on(table.class),
    index("idx_notification_templates_channel").on(table.channel),
  ]
);

export type NotificationTemplateRow = typeof notificationTemplates.$inferSelect;
export type InsertNotificationTemplateRow = typeof notificationTemplates.$inferInsert;

// --------------------------------------------------------------------------
// 2. Notification Logs
// --------------------------------------------------------------------------
export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientType: text("recipient_type", { enum: recipientTypeEnum }).default("CUSTOMER").notNull(),
    recipientId: text("recipient_id"),
    toAddress: text("to_address").notNull(), // phone or email
    channel: text("channel", { enum: notificationChannelEnum }).notNull(),
    templateCode: text("template_code").notNull(),
    class: text("class", { enum: notificationClassEnum }).notNull(),
    status: text("status", { enum: notificationStatusEnum }).default("QUEUED").notNull(),
    provider: text("provider").notNull(), // BD_SMS_PRIMARY, BD_SMS_SECONDARY, MOCK_SMS, WHATSAPP_CLOUD, SMTP_EMAIL
    providerMessageId: text("provider_message_id"),
    attempts: integer("attempts").default(0).notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    error: text("error"),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_notification_logs_status").on(table.status),
    index("idx_notification_logs_to_address").on(table.toAddress),
    index("idx_notification_logs_template_code").on(table.templateCode),
    index("idx_notification_logs_provider_msg_id").on(table.providerMessageId),
    index("idx_notification_logs_scheduled_at").on(table.scheduledAt),
    index("idx_notification_logs_created_at").on(table.createdAt),
  ]
);

export type NotificationLogRow = typeof notificationLogs.$inferSelect;
export type InsertNotificationLogRow = typeof notificationLogs.$inferInsert;

// --------------------------------------------------------------------------
// 3. Customer Notification Preferences
// --------------------------------------------------------------------------
export const customerNotificationPreferences = pgTable(
  "customer_notification_preferences",
  {
    customerId: text("customer_id").primaryKey(),
    marketingOptIn: boolean("marketing_opt_in").default(false).notNull(),
    whatsappOptIn: boolean("whatsapp_opt_in").default(true).notNull(),
    emailOptIn: boolean("email_opt_in").default(true).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_customer_notif_prefs_marketing").on(table.marketingOptIn),
  ]
);

export type CustomerNotificationPreferencesRow = typeof customerNotificationPreferences.$inferSelect;
export type InsertCustomerNotificationPreferencesRow = typeof customerNotificationPreferences.$inferInsert;
