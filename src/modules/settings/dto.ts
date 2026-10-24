import { z } from "zod";

export const SETTINGS_SCHEMAS = {
  PREORDER_COD_BALANCE_MAX_PAISA: z.number().int().nonnegative(),
  DELIVERY_BASE_DHAKA_PAISA: z.number().int().nonnegative(),
  DELIVERY_BASE_OUTSIDE_PAISA: z.number().int().nonnegative(),
  DELIVERY_BASE_WEIGHT_GRAMS: z.number().int().positive(),
  DELIVERY_SURCHARGE_PER_KG_PAISA: z.number().int().nonnegative(),
  RESERVATION_TTL_SECONDS: z.number().int().positive(),
  UNPAID_ORDER_CANCEL_HOURS: z.number().int().positive(),
  SPOT_BUFFER_DEFAULT_BP: z.number().int().min(0).max(10000),
  MIN_MARGIN_BP: z.number().int().min(0).max(10000),
  RUNNER_PURCHASE_APPROVAL_THRESHOLD_PAISA: z.number().int().nonnegative(),
  REFUND_LIMIT_SUPPORT_PAISA: z.number().int().nonnegative(),
  REFUND_LIMIT_FINANCE_PAISA: z.number().int().nonnegative(),
  GOODWILL_CREDIT_EXPIRY_MONTHS: z.number().int().positive(),
  PREORDER_DELAY_CREDIT_PAISA: z.number().int().nonnegative(),
  QC_SAMPLING_BP: z.number().int().min(0).max(10000),
  QC_SAMPLING_SLA_MINUTES: z.number().int().positive(),
  PICKUP_PIN_VALID_DAYS: z.number().int().positive(),
  PICKUP_PIN_MAX_ATTEMPTS: z.number().int().positive(),
  SUPPLIER_DEFECT_SUSPEND_BP: z.number().int().min(0).max(10000),
  BUSINESS_HOLIDAYS: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  MARKETING_QUIET_START: z.string().regex(/^\d{2}:\d{2}$/),
  MARKETING_QUIET_END: z.string().regex(/^\d{2}:\d{2}$/),
} as const;

export type SettingKey = keyof typeof SETTINGS_SCHEMAS;

export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS_SCHEMAS)[K]>;

export const DEFAULT_SETTINGS: { [K in SettingKey]: SettingValue<K> } = {
  PREORDER_COD_BALANCE_MAX_PAISA: 3000000,
  DELIVERY_BASE_DHAKA_PAISA: 8000,
  DELIVERY_BASE_OUTSIDE_PAISA: 15000,
  DELIVERY_BASE_WEIGHT_GRAMS: 1000,
  DELIVERY_SURCHARGE_PER_KG_PAISA: 2000,
  RESERVATION_TTL_SECONDS: 600,
  UNPAID_ORDER_CANCEL_HOURS: 24,
  SPOT_BUFFER_DEFAULT_BP: 500,
  MIN_MARGIN_BP: 1500,
  RUNNER_PURCHASE_APPROVAL_THRESHOLD_PAISA: 200000,
  REFUND_LIMIT_SUPPORT_PAISA: 100000,
  REFUND_LIMIT_FINANCE_PAISA: 2000000,
  GOODWILL_CREDIT_EXPIRY_MONTHS: 12,
  PREORDER_DELAY_CREDIT_PAISA: 100000,
  QC_SAMPLING_BP: 500,
  QC_SAMPLING_SLA_MINUTES: 120,
  PICKUP_PIN_VALID_DAYS: 7,
  PICKUP_PIN_MAX_ATTEMPTS: 5,
  SUPPLIER_DEFECT_SUSPEND_BP: 300,
  BUSINESS_HOLIDAYS: [],
  MARKETING_QUIET_START: "22:00",
  MARKETING_QUIET_END: "08:00",
};
