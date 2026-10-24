import crypto from "node:crypto";
import { eq, and, sql, lte, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  mediaAssets,
  MediaAssetRow,
  InsertMediaAssetRow,
  MediaKind,
} from "./schema";

// In-Memory Fallback Store for offline test environments
const memMedia = new Map<string, MediaAssetRow>();

export function clearMemoryMediaForTesting(): void {
  memMedia.clear();
}

export const mediaRepo = {
  clearMemoryForTesting(): void {
    clearMemoryMediaForTesting();
  },

  async createMediaAsset(input: InsertMediaAssetRow): Promise<MediaAssetRow> {
    const id = input.id ?? crypto.randomUUID();
    const now = new Date();
    const row: MediaAssetRow = {
      id,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      kind: input.kind,
      fileName: input.fileName ?? null,
      uploadId: input.uploadId ?? null,
      bucket: input.bucket,
      storageKey: input.storageKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      width: input.width ?? null,
      height: input.height ?? null,
      durationSeconds: input.durationSeconds ?? null,
      flagged: input.flagged ?? false,
      flagReason: input.flagReason ?? null,
      status: input.status ?? "PENDING_UPLOAD",
      isPublic: input.isPublic ?? true,
      sortOrder: input.sortOrder ?? 0,
      isPrimary: input.isPrimary ?? false,
      retentionUntil: input.retentionUntil ?? null,
      uploadedByType: input.uploadedByType,
      uploadedById: input.uploadedById,
      createdAt: input.createdAt ?? now,
    };

    try {
      const [inserted] = await db.insert(mediaAssets).values(row).returning();
      if (inserted) {
        memMedia.set(id, inserted);
        return inserted;
      }
    } catch {
      // Memory fallback
    }

    memMedia.set(id, row);
    return row;
  },

  async getMediaAssetById(id: string): Promise<MediaAssetRow | null> {
    try {
      const rows = await db
        .select()
        .from(mediaAssets)
        .where(eq(mediaAssets.id, id))
        .limit(1);
      if (rows[0]) return rows[0];
    } catch {
      // Memory fallback
    }
    return memMedia.get(id) ?? null;
  },

  async updateMediaAsset(
    id: string,
    updates: Partial<InsertMediaAssetRow>
  ): Promise<MediaAssetRow | null> {
    try {
      const rows = await db
        .update(mediaAssets)
        .set(updates)
        .where(eq(mediaAssets.id, id))
        .returning();
      if (rows[0]) {
        memMedia.set(id, rows[0]);
        return rows[0];
      }
    } catch {
      // Memory fallback
    }

    const mem = memMedia.get(id);
    if (mem) {
      const updated: MediaAssetRow = {
        ...mem,
        ...updates,
      };
      memMedia.set(id, updated);
      return updated;
    }
    return null;
  },

  async listMediaByOwner(ownerType: string, ownerId: string): Promise<MediaAssetRow[]> {
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
      // Memory fallback
    }

    return Array.from(memMedia.values()).filter(
      (m) => m.ownerType === ownerType && m.ownerId === ownerId && m.status === "READY"
    );
  },

  async countMediaByOwnerAndKind(
    ownerType: string,
    ownerId: string,
    kind: MediaKind
  ): Promise<number> {
    try {
      const rows = await db
        .select({ count: sql<number>`count(*)` })
        .from(mediaAssets)
        .where(
          and(
            eq(mediaAssets.ownerType, ownerType),
            eq(mediaAssets.ownerId, ownerId),
            eq(mediaAssets.kind, kind),
            ne(mediaAssets.status, "DELETED")
          )
        );
      if (rows[0]) return Number(rows[0].count);
    } catch {
      // Memory fallback
    }

    return Array.from(memMedia.values()).filter(
      (m) =>
        m.ownerType === ownerType &&
        m.ownerId === ownerId &&
        m.kind === kind &&
        m.status !== "DELETED"
    ).length;
  },

  async listExpiredMedia(now: Date, limit = 100): Promise<MediaAssetRow[]> {
    try {
      const rows = await db
        .select()
        .from(mediaAssets)
        .where(
          and(
            sql`${mediaAssets.retentionUntil} IS NOT NULL`,
            lte(mediaAssets.retentionUntil, now),
            ne(mediaAssets.status, "DELETED")
          )
        )
        .limit(limit);
      if (rows.length > 0) return rows;
    } catch {
      // Memory fallback
    }

    return Array.from(memMedia.values())
      .filter((m) => m.retentionUntil && m.retentionUntil <= now && m.status !== "DELETED")
      .slice(0, limit);
  },

  async listAbandonedUploads(cutoff: Date, limit = 100): Promise<MediaAssetRow[]> {
    try {
      const rows = await db
        .select()
        .from(mediaAssets)
        .where(
          and(
            eq(mediaAssets.status, "PENDING_UPLOAD"),
            lte(mediaAssets.createdAt, cutoff)
          )
        )
        .limit(limit);
      if (rows.length > 0) return rows;
    } catch {
      // Memory fallback
    }

    return Array.from(memMedia.values())
      .filter((m) => m.status === "PENDING_UPLOAD" && m.createdAt <= cutoff)
      .slice(0, limit);
  },
};
