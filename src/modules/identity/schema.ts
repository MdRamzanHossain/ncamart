import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  char,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// 1. Customers Table
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phone: text("phone").unique().notNull(), // normalized +8801XXXXXXXXX
    fullName: text("full_name"),
    email: text("email"), // lowercase
    emailVerified: boolean("email_verified").default(false).notNull(),
    status: text("status", { enum: ["ACTIVE", "FROZEN", "ANONYMIZED"] })
      .default("ACTIVE")
      .notNull(),
    deliveredOrderCount: integer("delivered_order_count").default(0).notNull(),
    rtoCount12m: integer("rto_count_12m").default(0).notNull(),
    codBlocked: boolean("cod_blocked").default(false).notNull(),
    codBlockReason: text("cod_block_reason"),
    codBlockLiftedBy: text("cod_block_lifted_by"),
    marketingOptIn: boolean("marketing_opt_in").default(false).notNull(),
    marketingOptInAt: timestamp("marketing_opt_in_at", { withTimezone: true }),
    preferredLocale: text("preferred_locale", { enum: ["bn", "en"] })
      .default("bn")
      .notNull(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    previousCustomerId: uuid("previous_customer_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_customers_phone").on(table.phone),
    index("idx_customers_email").on(table.email),
    index("idx_customers_status").on(table.status),
  ]
);

export type CustomerRow = typeof customers.$inferSelect;
export type InsertCustomerRow = typeof customers.$inferInsert;
export const users = customers;
export type UserRow = CustomerRow;


// 2. Customer Addresses Table
export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    label: text("label", { enum: ["HOME", "OFFICE", "OTHER"] })
      .default("HOME")
      .notNull(),
    consigneeName: text("consignee_name").notNull(),
    contactPhone: text("contact_phone").notNull(),
    divisionId: text("division_id").notNull(),
    districtId: text("district_id").notNull(),
    thanaId: text("thana_id").notNull(),
    areaId: text("area_id"),
    addressLine: text("address_line").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_customer_addresses_customer_id").on(table.customerId),
    uniqueIndex("idx_customer_default_address")
      .on(table.customerId)
      .where(sql`is_default = true AND deleted_at IS NULL`),
  ]
);

export type CustomerAddressRow = typeof customerAddresses.$inferSelect;
export type InsertCustomerAddressRow = typeof customerAddresses.$inferInsert;

// 3. Geo Reference Tables
export const geoDivisions = pgTable("geo_divisions", {
  id: text("id").primaryKey(),
  nameEn: text("name_en").notNull(),
  nameBn: text("name_bn").notNull(),
});

export const geoDistricts = pgTable(
  "geo_districts",
  {
    id: text("id").primaryKey(),
    divisionId: text("division_id")
      .notNull()
      .references(() => geoDivisions.id),
    nameEn: text("name_en").notNull(),
    nameBn: text("name_bn").notNull(),
  },
  (table) => [index("idx_geo_districts_division").on(table.divisionId)]
);

export const geoThanas = pgTable(
  "geo_thanas",
  {
    id: text("id").primaryKey(),
    districtId: text("district_id")
      .notNull()
      .references(() => geoDistricts.id),
    nameEn: text("name_en").notNull(),
    nameBn: text("name_bn").notNull(),
    isInsideDhaka: boolean("is_inside_dhaka").default(false).notNull(),
  },
  (table) => [
    index("idx_geo_thanas_district").on(table.districtId),
    index("idx_geo_thanas_inside_dhaka").on(table.isInsideDhaka),
  ]
);

export const geoAreas = pgTable(
  "geo_areas",
  {
    id: text("id").primaryKey(),
    thanaId: text("thana_id")
      .notNull()
      .references(() => geoThanas.id),
    nameEn: text("name_en").notNull(),
    nameBn: text("name_bn").notNull(),
    postalCode: text("postal_code"),
  },
  (table) => [index("idx_geo_areas_thana").on(table.thanaId)]
);


// 5. Staff Table
export const staff = pgTable(
  "staff",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fullName: text("full_name").notNull(),
    email: text("email").unique().notNull(),
    phone: text("phone").unique().notNull(),
    passwordHash: text("password_hash").notNull(),
    totpSecretEnc: text("totp_secret_enc"),
    totpEnabled: boolean("totp_enabled").default(false).notNull(),
    status: text("status", { enum: ["ACTIVE", "SUSPENDED"] })
      .default("ACTIVE")
      .notNull(),
    mustChangePassword: boolean("must_change_password").default(true).notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_staff_email").on(table.email),
    index("idx_staff_phone").on(table.phone),
  ]
);

export type StaffRow = typeof staff.$inferSelect;
export type InsertStaffRow = typeof staff.$inferInsert;

// 6. Staff Roles Table
export const staffRoles = pgTable(
  "staff_roles",
  {
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: [
        "FIELD_RUNNER",
        "QC_TECHNICIAN",
        "GODOWN_MANAGER",
        "DISPATCH_STAFF",
        "SHOWROOM_POS_STAFF",
        "SOURCING_MANAGER",
        "CATALOG_MANAGER",
        "CUSTOMER_SUPPORT",
        "FINANCE_OFFICER",
        "OPS_MANAGER",
        "SUPER_ADMIN",
      ],
    }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.staffId, table.role] })]
);

export type StaffRoleRow = typeof staffRoles.$inferSelect;

// 7. Sessions Table
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: char("token_hash", { length: 64 }).unique().notNull(),
    subjectType: text("subject_type", { enum: ["CUSTOMER", "STAFF"] }).notNull(),
    subjectId: uuid("subject_id").notNull(),
    deviceId: text("device_id"),
    deviceLabel: text("device_label"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    ownershipUnconfirmed: boolean("ownership_unconfirmed").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: text("revoked_by"),
  },
  (table) => [
    uniqueIndex("idx_sessions_token_hash").on(table.tokenHash),
    index("idx_sessions_subject").on(table.subjectType, table.subjectId),
    index("idx_sessions_expires_at").on(table.expiresAt),
  ]
);

export type SessionRow = typeof sessions.$inferSelect;
export type InsertSessionRow = typeof sessions.$inferInsert;

// 8. Customer Ownership Challenges Table
export const customerOwnershipChallenges = pgTable(
  "customer_ownership_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    method: text("method", { enum: ["EMAIL_OTP", "SUPPORT"] }).notNull(),
    status: text("status", { enum: ["PENDING", "RESOLVED", "EXPIRED", "FAILED"] })
      .default("PENDING")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by"),
  },
  (table) => [
    index("idx_challenges_session").on(table.sessionId),
    index("idx_challenges_customer").on(table.customerId),
  ]
);

export type CustomerOwnershipChallengeRow = typeof customerOwnershipChallenges.$inferSelect;
