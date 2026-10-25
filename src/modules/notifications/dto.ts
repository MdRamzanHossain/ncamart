import { z } from "zod";
import {
  notificationChannelEnum,
  notificationClassEnum,
  notificationLocaleEnum,
  notificationStatusEnum,
  recipientTypeEnum,
} from "./schema";

export const NotificationChannelSchema = z.enum(notificationChannelEnum);
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

export const NotificationClassSchema = z.enum(notificationClassEnum);
export type NotificationClass = z.infer<typeof NotificationClassSchema>;

export const NotificationLocaleSchema = z.enum(notificationLocaleEnum);
export type NotificationLocale = z.infer<typeof NotificationLocaleSchema>;

export const NotificationStatusSchema = z.enum(notificationStatusEnum);
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;

export const RecipientTypeSchema = z.enum(recipientTypeEnum);
export type RecipientType = z.infer<typeof RecipientTypeSchema>;

// --------------------------------------------------------------------------
// Templates
// --------------------------------------------------------------------------
export const NotificationTemplateDtoSchema = z.object({
  id: z.string(),
  code: z.string(),
  channel: NotificationChannelSchema,
  locale: NotificationLocaleSchema,
  class: NotificationClassSchema,
  subject: z.string().nullable().optional(),
  body: z.string(),
  whatsappTemplateName: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type NotificationTemplateDto = z.infer<typeof NotificationTemplateDtoSchema>;

export const CreateTemplateInputSchema = z.object({
  code: z.string().min(1),
  channel: NotificationChannelSchema,
  locale: NotificationLocaleSchema.default("bn"),
  class: NotificationClassSchema,
  subject: z.string().optional(),
  body: z.string().min(1),
  whatsappTemplateName: z.string().optional(),
  isActive: z.boolean().default(true),
});
export type CreateTemplateInput = z.infer<typeof CreateTemplateInputSchema>;

// --------------------------------------------------------------------------
// Logs
// --------------------------------------------------------------------------
export const NotificationLogDtoSchema = z.object({
  id: z.string(),
  recipientType: RecipientTypeSchema,
  recipientId: z.string().nullable().optional(),
  toAddress: z.string(),
  channel: NotificationChannelSchema,
  templateCode: z.string(),
  class: NotificationClassSchema,
  status: NotificationStatusSchema,
  provider: z.string(),
  providerMessageId: z.string().nullable().optional(),
  attempts: z.number().int().nonnegative(),
  scheduledAt: z.date(),
  sentAt: z.date().nullable().optional(),
  error: z.string().nullable().optional(),
  payload: z.record(z.unknown()),
  createdAt: z.date(),
});
export type NotificationLogDto = z.infer<typeof NotificationLogDtoSchema>;

// --------------------------------------------------------------------------
// Customer Preferences
// --------------------------------------------------------------------------
export const CustomerNotificationPreferencesDtoSchema = z.object({
  customerId: z.string(),
  marketingOptIn: z.boolean(),
  whatsappOptIn: z.boolean(),
  emailOptIn: z.boolean(),
  updatedAt: z.date(),
});
export type CustomerNotificationPreferencesDto = z.infer<
  typeof CustomerNotificationPreferencesDtoSchema
>;

export const UpdateCustomerPreferencesInputSchema = z.object({
  marketing_opt_in: z.boolean().optional(),
  whatsapp_opt_in: z.boolean().optional(),
  email_opt_in: z.boolean().optional(),
});
export type UpdateCustomerPreferencesInput = z.infer<
  typeof UpdateCustomerPreferencesInputSchema
>;

// --------------------------------------------------------------------------
// Admin Dead-Letter & Retry
// --------------------------------------------------------------------------
export const DeadLetterQuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type DeadLetterQuery = z.infer<typeof DeadLetterQuerySchema>;

export const RetryDeadLetterResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  log: NotificationLogDtoSchema,
});
export type RetryDeadLetterResponse = z.infer<typeof RetryDeadLetterResponseSchema>;

// --------------------------------------------------------------------------
// Delivery Receipts Webhooks
// --------------------------------------------------------------------------
export const DeliveryReceiptWebhookInputSchema = z.object({
  messageId: z.string().optional(),
  providerMessageId: z.string().optional(),
  status: z.enum(["DELIVERED", "FAILED", "SENT", "UNDELIVERED", "BOUNCED"]).or(z.string()),
  error: z.string().optional(),
  timestamp: z.string().optional(),
  raw: z.record(z.unknown()).optional(),
});
export type DeliveryReceiptWebhookInput = z.infer<
  typeof DeliveryReceiptWebhookInputSchema
>;
