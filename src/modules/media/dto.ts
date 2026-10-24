import { z } from "zod";
import { mediaKindEnum, mediaStatusEnum, mediaUploadedByTypeEnum } from "./schema";

export const uploadPurposeEnum = [
  "RMA_PHOTO",
  "RMA_VIDEO",
  "RECEIPT_PHOTO",
  "QC_PHOTO",
  "REFUND_PROOF",
  "PRODUCT_IMAGE",
] as const;
export type UploadPurpose = (typeof uploadPurposeEnum)[number];

export const uploadModeEnum = ["DIRECT_PUT", "MULTIPART"] as const;
export type UploadMode = (typeof uploadModeEnum)[number];

export const MediaAssetDtoSchema = z.object({
  id: z.string().uuid(),
  ownerType: z.string(),
  ownerId: z.string(),
  kind: z.enum(mediaKindEnum),
  fileName: z.string().nullable().optional(),
  uploadId: z.string().nullable().optional(),
  bucket: z.string(),
  storageKey: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  durationSeconds: z.number().int().positive().nullable().optional(),
  flagged: z.boolean().default(false),
  flagReason: z.string().nullable().optional(),
  status: z.enum(mediaStatusEnum),
  isPublic: z.boolean(),
  sortOrder: z.number().int(),
  isPrimary: z.boolean(),
  retentionUntil: z.date().nullable().optional(),
  uploadedByType: z.enum(mediaUploadedByTypeEnum),
  uploadedById: z.string(),
  createdAt: z.date(),
});
export type MediaAssetDto = z.infer<typeof MediaAssetDtoSchema>;

export const CreateMediaAssetDtoSchema = z.object({
  ownerType: z.string().min(1),
  ownerId: z.string().min(1),
  kind: z.enum(mediaKindEnum),
  fileName: z.string().optional(),
  uploadId: z.string().optional(),
  bucket: z.string().min(1),
  storageKey: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSeconds: z.number().int().positive().optional(),
  flagged: z.boolean().default(false),
  flagReason: z.string().optional(),
  isPublic: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  isPrimary: z.boolean().default(false),
  uploadedByType: z.enum(mediaUploadedByTypeEnum),
  uploadedById: z.string().min(1),
  retentionUntil: z.date().optional(),
});
export type CreateMediaAssetDto = z.input<typeof CreateMediaAssetDtoSchema>;

export const initiateUploadSchema = z.object({
  purpose: z.enum(uploadPurposeEnum),
  file_name: z.string().min(1, "file_name is required").max(255),
  content_type: z.string().min(1, "content_type is required"),
  size_bytes: z.number().int().positive("size_bytes must be a positive integer"),
  owner_type: z.string().optional(),
  owner_id: z.string().optional(),
  duration_seconds: z.number().int().positive().optional(),
});
export type InitiateUploadDto = z.infer<typeof initiateUploadSchema>;

export const fetchUploadPartsSchema = z.object({
  part_numbers: z.array(z.number().int().positive()).min(1, "part_numbers cannot be empty"),
});
export type FetchUploadPartsDto = z.infer<typeof fetchUploadPartsSchema>;

export const completeUploadPartSchema = z.object({
  part_number: z.number().int().positive(),
  etag: z.string().min(1),
});

export const completeUploadSchema = z.object({
  parts: z.array(completeUploadPartSchema).optional(),
  duration_seconds: z.number().int().positive().optional(),
});
export type CompleteUploadDto = z.infer<typeof completeUploadSchema>;

export const rmaUploadUrlSchema = z.object({
  file_name: z.string().min(1, "file_name is required"),
  file_size_bytes: z.number().int().positive().optional(),
  size_bytes: z.number().int().positive().optional(),
  content_type: z.string().min(1, "content_type is required"),
  duration_seconds: z.number().int().positive().optional(),
});
export type RmaUploadUrlDto = z.infer<typeof rmaUploadUrlSchema>;
