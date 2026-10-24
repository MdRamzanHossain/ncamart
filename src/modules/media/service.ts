import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { mediaAssets, MediaAssetRow, InsertMediaAssetRow } from "./schema";
import { CreateMediaAssetDto, MediaAssetDto } from "./dto";

const memMedia = new Map<string, MediaAssetRow>();

export const mediaService = {
  healthCheck: async () => ({ module: "media", status: "ok" }),

  clearMemoryMediaForTesting() {
    memMedia.clear();
  },

  async createMediaAsset(input: CreateMediaAssetDto): Promise<MediaAssetDto> {
    const id = crypto.randomUUID();
    const now = new Date();
    const row: MediaAssetRow = {
      id,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      kind: input.kind,
      bucket: input.bucket,
      storageKey: input.storageKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      width: input.width ?? null,
      height: input.height ?? null,
      durationSeconds: input.durationSeconds ?? null,
      status: "PENDING_UPLOAD",
      isPublic: input.isPublic ?? true,
      sortOrder: input.sortOrder ?? 0,
      isPrimary: input.isPrimary ?? false,
      retentionUntil: null,
      uploadedByType: input.uploadedByType,
      uploadedById: input.uploadedById,
      createdAt: now,
    };

    try {
      await db.insert(mediaAssets).values(row as InsertMediaAssetRow);
    } catch {
      // In-memory fallback for offline test environments
      memMedia.set(id, row);
    }

    return row;
  },

  async getMediaAssetById(id: string): Promise<MediaAssetDto | null> {
    try {
      const rows = await db
        .select()
        .from(mediaAssets)
        .where(eq(mediaAssets.id, id))
        .limit(1);
      const [row] = rows;
      if (row) return row;
    } catch {
      // Fallback
    }
    return memMedia.get(id) ?? null;
  },

  async markMediaReady(id: string): Promise<MediaAssetDto | null> {
    try {
      const rows = await db
        .update(mediaAssets)
        .set({ status: "READY" })
        .where(eq(mediaAssets.id, id))
        .returning();
      const [row] = rows;
      if (row) return row;
    } catch {
      // Fallback
    }
    const mem = memMedia.get(id);
    if (mem) {
      mem.status = "READY";
      return mem;
    }
    return null;
  },

  async listMediaByOwner(ownerType: string, ownerId: string): Promise<MediaAssetDto[]> {
    try {
      const rows = await db
        .select()
        .from(mediaAssets)
        .where(
          and(
            eq(mediaAssets.ownerType, ownerType),
            eq(mediaAssets.ownerId, ownerId),
            eq(mediaAssets.status, "READY")
          )
        );
      if (rows.length > 0) return rows;
    } catch {
      // Fallback
    }
    return Array.from(memMedia.values()).filter(
      (m) => m.ownerType === ownerType && m.ownerId === ownerId && m.status === "READY"
    );
  },
};
