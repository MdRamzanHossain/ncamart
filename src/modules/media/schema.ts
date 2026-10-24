import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  bigint,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const mediaKindEnum = [
  "PRODUCT_IMAGE",
  "DISTRIBUTOR_EVIDENCE",
  "RECEIPT_PHOTO",
  "QC_PHOTO",
  "RMA_PHOTO",
  "RMA_VIDEO",
  "REFUND_PROOF",
  "INVOICE_PDF",
  "OTHER",
] as const;
export type MediaKind = (typeof mediaKindEnum)[number];

export const mediaStatusEnum = ["PENDING_UPLOAD", "READY", "DELETED"] as const;
export type MediaStatus = (typeof mediaStatusEnum)[number];

export const mediaUploadedByTypeEnum = ["STAFF", "CUSTOMER", "SYSTEM"] as const;
export type MediaUploadedByType = (typeof mediaUploadedByTypeEnum)[number];

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerType: text("owner_type").notNull(), // e.g., 'PRODUCT', 'SKU', 'DISTRIBUTOR', 'RMA', 'QC'
    ownerId: text("owner_id").notNull(),
    kind: text("kind", { enum: mediaKindEnum }).notNull(),
    fileName: text("file_name"),
    uploadId: text("upload_id"),
    bucket: text("bucket").notNull(),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    width: integer("width"),
    height: integer("height"),
    durationSeconds: integer("duration_seconds"),
    flagged: boolean("flagged").default(false).notNull(),
    flagReason: text("flag_reason"),
    status: text("status", { enum: mediaStatusEnum }).default("PENDING_UPLOAD").notNull(),
    isPublic: boolean("is_public").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    retentionUntil: timestamp("retention_until", { withTimezone: true }),
    uploadedByType: text("uploaded_by_type", { enum: mediaUploadedByTypeEnum }).notNull(),
    uploadedById: text("uploaded_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_media_assets_owner").on(table.ownerType, table.ownerId),
    index("idx_media_assets_kind").on(table.kind),
    index("idx_media_assets_status").on(table.status),
    index("idx_media_assets_retention").on(table.retentionUntil),
  ]
);

export type MediaAssetRow = typeof mediaAssets.$inferSelect;
export type InsertMediaAssetRow = typeof mediaAssets.$inferInsert;

