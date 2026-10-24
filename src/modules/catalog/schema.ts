import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  bigint,
  bigserial,
  jsonb,
  timestamp,
  index,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// Enums & Types
export const fulfillmentTypeEnum = ["DROP_AND_PACK", "PRE_ORDER"] as const;
export type FulfillmentType = (typeof fulfillmentTypeEnum)[number];

export const specFieldTypeEnum = ["NUMBER", "STRING", "BOOLEAN", "ENUM"] as const;
export type SpecFieldType = (typeof specFieldTypeEnum)[number];

export const productTierEnum = ["AUTHENTIC", "BUDGET_SMART"] as const;
export type ProductTier = (typeof productTierEnum)[number];

export const btrcStatusEnum = ["NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED"] as const;
export type BtrcStatus = (typeof btrcStatusEnum)[number];

export const productStatusEnum = [
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "PUBLISHED",
  "ARCHIVED",
] as const;
export type ProductStatus = (typeof productStatusEnum)[number];

export const warrantyTypeEnum = [
  "SHOP_REPLACEMENT",
  "OFFICIAL_DISTRIBUTOR",
  "MANUFACTURER_GLOBAL",
] as const;
export type WarrantyType = (typeof warrantyTypeEnum)[number];

// 1. Categories Table
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentId: uuid("parent_id"),
    slug: text("slug").notNull().unique(),
    nameEn: text("name_en").notNull(),
    nameBn: text("name_bn").notNull(),
    level: integer("level").notNull(), // 1 (Root), 2 (Sub-category), 3 (Leaf)
    sortOrder: integer("sort_order").default(0).notNull(),
    defaultFulfillmentType: text("default_fulfillment_type", {
      enum: fulfillmentTypeEnum,
    })
      .default("DROP_AND_PACK")
      .notNull(),
    btrcClearanceRequired: boolean("btrc_clearance_required").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_categories_parent_id").on(table.parentId),
    index("idx_categories_slug").on(table.slug),
    index("idx_categories_level").on(table.level),
  ]
);

export type CategoryRow = typeof categories.$inferSelect;
export type InsertCategoryRow = typeof categories.$inferInsert;

// 2. Category Spec Fields Table
export const categorySpecFields = pgTable(
  "category_spec_fields",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    keyName: text("key_name").notNull(),
    labelEn: text("label_en").notNull(),
    labelBn: text("label_bn").notNull(),
    unit: text("unit"),
    fieldType: text("field_type", { enum: specFieldTypeEnum }).notNull(),
    enumOptions: jsonb("enum_options").$type<string[]>(),
    isRequired: boolean("is_required").default(false).notNull(),
    isHighlightedForComparison: boolean("is_highlighted_for_comparison")
      .default(false)
      .notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("uq_category_spec_fields_cat_key").on(table.categoryId, table.keyName),
    index("idx_category_spec_fields_category_id").on(table.categoryId),
  ]
);

export type CategorySpecFieldRow = typeof categorySpecFields.$inferSelect;
export type InsertCategorySpecFieldRow = typeof categorySpecFields.$inferInsert;

// 3. Brands Table
export const brands = pgTable(
  "brands",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    isAuthorizedDistribution: boolean("is_authorized_distribution")
      .default(false)
      .notNull(),
    officialDistributorName: text("official_distributor_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_brands_slug").on(table.slug)]
);

export type BrandRow = typeof brands.$inferSelect;
export type InsertBrandRow = typeof brands.$inferInsert;

// 4. Comparison Groups Table
export const comparisonGroups = pgTable(
  "comparison_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    verdictEn: text("verdict_en"),
    verdictBn: text("verdict_bn"),
    badgeAuthenticLabel: text("badge_authentic_label")
      .default("Full Safety Suite")
      .notNull(),
    badgeBudgetLabel: text("badge_budget_label")
      .default("Best Everyday Value")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_comparison_groups_category_id").on(table.categoryId)]
);

export type ComparisonGroupRow = typeof comparisonGroups.$inferSelect;
export type InsertComparisonGroupRow = typeof comparisonGroups.$inferInsert;

// 5. Products Table
export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    titleEn: text("title_en").notNull(),
    titleBn: text("title_bn").notNull(),
    descriptionEn: text("description_en"),
    descriptionBn: text("description_bn"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
    productTier: text("product_tier", { enum: productTierEnum }).notNull(),
    fulfillmentType: text("fulfillment_type", { enum: fulfillmentTypeEnum }).notNull(),
    comparisonGroupId: uuid("comparison_group_id").references(
      () => comparisonGroups.id,
      { onDelete: "set null" }
    ),
    originCountry: text("origin_country"),
    hsCode: text("hs_code"),
    btrcStatus: text("btrc_status", { enum: btrcStatusEnum })
      .default("NOT_REQUIRED")
      .notNull(),
    btrcClearanceCode: text("btrc_clearance_code"),
    vatRateBp: integer("vat_rate_bp").default(0).notNull(), // e.g., 500 for 5%
    status: text("status", { enum: productStatusEnum }).default("DRAFT").notNull(),
    zeroReplicaAttested: boolean("zero_replica_attested").default(false).notNull(),
    zeroReplicaAttestedBy: uuid("zero_replica_attested_by"),
    distributorEvidenceMediaId: uuid("distributor_evidence_media_id"),
    comparisonPointsEn: text("comparison_points_en").array(),
    comparisonPointsBn: text("comparison_points_bn").array(),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    preorderEtaDaysMin: integer("preorder_eta_days_min"),
    preorderEtaDaysMax: integer("preorder_eta_days_max"),
    preorderBatchThreshold: integer("preorder_batch_threshold"),
    createdBy: uuid("created_by"),
    submittedBy: uuid("submitted_by"),
    reviewedBy: uuid("reviewed_by"),
    reviewNotes: text("review_notes"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      "chk_products_budget_smart_replica_attested",
      sql`status != 'PUBLISHED' OR product_tier != 'BUDGET_SMART' OR zero_replica_attested = true`
    ),
    index("idx_products_cat_tier_status").on(
      table.categoryId,
      table.productTier,
      table.status
    ),
    index("idx_products_comparison_group_id").on(table.comparisonGroupId),
    index("idx_products_brand_id").on(table.brandId),
    index("idx_products_slug").on(table.slug),
  ]
);

export type ProductRow = typeof products.$inferSelect;
export type InsertProductRow = typeof products.$inferInsert;

// 6. SKUs Table
export const skus = pgTable(
  "skus",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    skuCode: text("sku_code").notNull().unique(), // uppercase
    barcodeEan13: text("barcode_ean13"),
    attributes: jsonb("attributes")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    specs: jsonb("specs").$type<Record<string, unknown>>().default({}).notNull(),
    pricePaisa: bigint("price_paisa", { mode: "number" }).notNull(), // VAT-inclusive list price
    compareAtPricePaisa: bigint("compare_at_price_paisa", { mode: "number" }),
    baseCostPaisa: bigint("base_cost_paisa", { mode: "number" }).notNull(),
    spotBufferBp: integer("spot_buffer_bp").default(600).notNull(), // 500..700 bp
    maxUnitPurchasePaisa: bigint("max_unit_purchase_paisa", { mode: "number" }).notNull(),
    warrantyDays: integer("warranty_days").default(0).notNull(),
    warrantyType: text("warranty_type", { enum: warrantyTypeEnum }).notNull(),
    officialDistributorName: text("official_distributor_name"),
    weightGrams: integer("weight_grams").default(0).notNull(),
    dailyOrderCap: integer("daily_order_cap"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_skus_product_id").on(table.productId),
    index("idx_skus_sku_code").on(table.skuCode),
    index("idx_skus_barcode_ean13").on(table.barcodeEan13),
  ]
);

export type SkuRow = typeof skus.$inferSelect;
export type InsertSkuRow = typeof skus.$inferInsert;

// 7. Product Status History Table (Append-only)
export const productStatusHistory = pgTable(
  "product_status_history",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    actorId: uuid("actor_id"),
    actorType: text("actor_type", { enum: ["STAFF", "SYSTEM"] })
      .default("STAFF")
      .notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_product_status_history_product_id").on(table.productId),
    index("idx_product_status_history_created_at").on(table.createdAt),
  ]
);

export type ProductStatusHistoryRow = typeof productStatusHistory.$inferSelect;
export type InsertProductStatusHistoryRow = typeof productStatusHistory.$inferInsert;

// Relations
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "category_hierarchy",
  }),
  children: many(categories, { relationName: "category_hierarchy" }),
  specFields: many(categorySpecFields),
  products: many(products),
  comparisonGroups: many(comparisonGroups),
}));

export const categorySpecFieldsRelations = relations(categorySpecFields, ({ one }) => ({
  category: one(categories, {
    fields: [categorySpecFields.categoryId],
    references: [categories.id],
  }),
}));

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
}));

export const comparisonGroupsRelations = relations(comparisonGroups, ({ one, many }) => ({
  category: one(categories, {
    fields: [comparisonGroups.categoryId],
    references: [categories.id],
  }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  brand: one(brands, {
    fields: [products.brandId],
    references: [brands.id],
  }),
  comparisonGroup: one(comparisonGroups, {
    fields: [products.comparisonGroupId],
    references: [comparisonGroups.id],
  }),
  skus: many(skus),
  statusHistory: many(productStatusHistory),
}));

export const skusRelations = relations(skus, ({ one }) => ({
  product: one(products, {
    fields: [skus.productId],
    references: [products.id],
  }),
}));

export const productStatusHistoryRelations = relations(productStatusHistory, ({ one }) => ({
  product: one(products, {
    fields: [productStatusHistory.productId],
    references: [products.id],
  }),
}));
