import { z } from "zod";
import { mediaKindEnum, mediaStatusEnum, mediaUploadedByTypeEnum } from "./schema";

export const MediaAssetDtoSchema = z.object({
  id: z.string().uuid(),
  ownerType: z.string(),
  ownerId: z.string(),
  kind: z.enum(mediaKindEnum),
  bucket: z.string(),
  storageKey: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  durationSeconds: z.number().int().positive().nullable().optional(),
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
  bucket: z.string().min(1),
  storageKey: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSeconds: z.number().int().positive().optional(),
  isPublic: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  isPrimary: z.boolean().default(false),
  uploadedByType: z.enum(mediaUploadedByTypeEnum),
  uploadedById: z.string().min(1),
});

export type CreateMediaAssetDto = z.input<typeof CreateMediaAssetDtoSchema>;
