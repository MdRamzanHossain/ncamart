import crypto from "node:crypto";
import { Actor } from "@/lib/http/route";
import {
  NotFoundError,
  ValidationError,
  BusinessError,
  ForbiddenError,
} from "@/lib/errors";
import { emitOutbox } from "@/lib/outbox";
import { recordAudit } from "@/modules/audit";
import { env } from "@/lib/env";
import {
  presignPut,
  presignGet,
  createMultipartUpload,
  presignUploadPart,
  completeMultipartUpload,
  abortMultipartUpload,
  headObject,
  putObject,
  deleteObject,
  clearMemoryStorageForTesting,
} from "@/lib/storage";
import { mediaRepo } from "./repo";
import {
  MediaAssetRow,
  InsertMediaAssetRow,
  MediaKind,
  MediaStatus,
} from "./schema";
import {
  InitiateUploadDto,
  FetchUploadPartsDto,
  CompleteUploadDto,
  RmaUploadUrlDto,
  UploadPurpose,
} from "./dto";
import {
  assertCanUpload,
  assertCanAccessMedia,
  assertCanManageMedia,
} from "./policies";

// --------------------------------------------------------------------------
// Constants & Limit Rules (PRD §3.8.8, §3.18.1, architechture.md §5.5)
// --------------------------------------------------------------------------
export const MULTIPART_THRESHOLD_BYTES = 10 * 1024 * 1024; // 10 MB
export const PART_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB (per part)

const ALLOWED_CONTENT_TYPES: Record<UploadPurpose, string[]> = {
  RMA_PHOTO: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
  ],
  RMA_VIDEO: [
    "video/mp4",
    "video/quicktime",
    "video/webm",
  ],
  RECEIPT_PHOTO: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "application/pdf",
  ],
  QC_PHOTO: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ],
  REFUND_PROOF: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
  ],
  PRODUCT_IMAGE: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ],
};

const MAX_FILE_SIZE_BYTES: Record<UploadPurpose, number> = {
  RMA_PHOTO: 10 * 1024 * 1024, // 10 MB
  RMA_VIDEO: 300 * 1024 * 1024, // 300 MB
  RECEIPT_PHOTO: 10 * 1024 * 1024, // 10 MB
  QC_PHOTO: 10 * 1024 * 1024, // 10 MB
  REFUND_PROOF: 10 * 1024 * 1024, // 10 MB
  PRODUCT_IMAGE: 10 * 1024 * 1024, // 10 MB
};

export interface InitiateUploadResult {
  id: string;
  upload_mode: "DIRECT_PUT" | "MULTIPART";
  storage_key: string;
  bucket: string;
  upload_url?: string;
  upload_id?: string;
  part_size?: number;
  total_parts?: number;
  parts?: Array<{ part_number: number; upload_url: string }>;
  expires_in_seconds: number;
}

export const mediaService = {
  healthCheck: async () => ({ module: "media", status: "ok" }),

  clearMemoryForTesting(): void {
    mediaRepo.clearMemoryForTesting();
    clearMemoryStorageForTesting();
  },

  // --------------------------------------------------------------------------
  // 1. Initiate Generic Media Upload
  // --------------------------------------------------------------------------
  async initiateUpload(
    dto: InitiateUploadDto,
    actor: Actor
  ): Promise<InitiateUploadResult> {
    assertCanUpload(actor, dto.purpose);

    const normContentType = dto.content_type.toLowerCase().trim();
    const allowedTypes = ALLOWED_CONTENT_TYPES[dto.purpose];

    const extMatch = dto.file_name.toLowerCase().match(/\.([a-z0-9]+)$/);
    const ext = extMatch ? extMatch[1] : "";

    const isMimeAllowed = allowedTypes.some((t) => normContentType.startsWith(t) || t === normContentType);
    const isExtAllowed =
      (dto.purpose === "RMA_PHOTO" && ["jpg", "jpeg", "png", "webp", "heic"].includes(ext!)) ||
      (dto.purpose === "RMA_VIDEO" && ["mp4", "mov", "webm"].includes(ext!)) ||
      (dto.purpose === "RECEIPT_PHOTO" && ["jpg", "jpeg", "png", "webp", "heic", "pdf"].includes(ext!)) ||
      (dto.purpose === "QC_PHOTO" && ["jpg", "jpeg", "png", "webp"].includes(ext!)) ||
      (dto.purpose === "REFUND_PROOF" && ["jpg", "jpeg", "png", "webp", "pdf"].includes(ext!)) ||
      (dto.purpose === "PRODUCT_IMAGE" && ["jpg", "jpeg", "png", "webp"].includes(ext!));

    if (!isMimeAllowed && !isExtAllowed) {
      throw new ValidationError(
        `Invalid content type '${dto.content_type}' for '${dto.purpose}'. Allowed formats: ${allowedTypes.join(", ")}`,
        { allowed: allowedTypes, provided: dto.content_type }
      );
    }

    const maxSize = MAX_FILE_SIZE_BYTES[dto.purpose];
    if (dto.size_bytes > maxSize) {
      const maxMb = Math.round(maxSize / (1024 * 1024));
      throw new ValidationError(
        `File size (${(dto.size_bytes / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed size of ${maxMb} MB for ${dto.purpose}`,
        { maxBytes: maxSize, providedBytes: dto.size_bytes }
      );
    }

    // Purpose-specific quantity & duration limits
    if (dto.purpose === "RMA_PHOTO" && dto.owner_id) {
      const existingPhotos = await mediaRepo.countMediaByOwnerAndKind(
        dto.owner_type ?? "RMA_CLAIM",
        dto.owner_id,
        "RMA_PHOTO"
      );
      if (existingPhotos >= 5) {
        throw new ValidationError(
          "Maximum 5 photos allowed per RMA claim (PRD §3.8.8)",
          { currentCount: existingPhotos, maxAllowed: 5 }
        );
      }
    }

    if (dto.purpose === "RMA_VIDEO") {
      if (dto.owner_id) {
        const existingVideos = await mediaRepo.countMediaByOwnerAndKind(
          dto.owner_type ?? "RMA_CLAIM",
          dto.owner_id,
          "RMA_VIDEO"
        );
        if (existingVideos >= 1) {
          throw new ValidationError(
            "Maximum 1 unboxing/defect video allowed per RMA claim (PRD §3.8.8)",
            { currentCount: existingVideos, maxAllowed: 1 }
          );
        }
      }

      // Check duration: ≤ 3 minutes (180 seconds)
      if (dto.duration_seconds && dto.duration_seconds > 180) {
        throw new ValidationError(
          `Video duration (${dto.duration_seconds}s) exceeds maximum allowed limit of 3 minutes (180 seconds)`,
          { durationSeconds: dto.duration_seconds, maxDurationSeconds: 180 }
        );
      }
    }

    // Determine storage bucket and key
    const isPublic = dto.purpose === "PRODUCT_IMAGE";
    const bucket = isPublic ? env.S3_BUCKET_MEDIA : env.S3_BUCKET_PRIVATE;
    const mediaId = crypto.randomUUID();
    const sanitizedFileName = dto.file_name.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
    const datePrefix = new Date().toISOString().slice(0, 10);
    const storageKey = `media/${dto.purpose.toLowerCase()}/${datePrefix}/${mediaId.slice(0, 8)}-${sanitizedFileName}`;

    // Retention duration calculation
    const now = new Date();
    let retentionUntil: Date | null = null;
    if (dto.purpose === "RMA_PHOTO" || dto.purpose === "RMA_VIDEO") {
      retentionUntil = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 180 days
    } else if (dto.purpose === "QC_PHOTO") {
      retentionUntil = new Date(now.getTime() + 730 * 24 * 60 * 60 * 1000); // 2 years
    } else if (dto.purpose === "RECEIPT_PHOTO" || dto.purpose === "REFUND_PROOF") {
      retentionUntil = new Date(now.getTime() + 2555 * 24 * 60 * 60 * 1000); // 7 years finance retention
    }

    const uploadedByType = actor.type === "customer" ? "CUSTOMER" : actor.type === "staff" ? "STAFF" : "SYSTEM";

    // Small files (≤ 10 MB) -> Single Presigned PUT
    if (dto.size_bytes <= MULTIPART_THRESHOLD_BYTES) {
      const uploadUrl = await presignPut({
        bucket,
        key: storageKey,
        contentType: dto.content_type,
        expiresIn: 900,
      });

      await mediaRepo.createMediaAsset({
        id: mediaId,
        ownerType: dto.owner_type ?? "UNATTACHED",
        ownerId: dto.owner_id ?? mediaId,
        kind: dto.purpose,
        fileName: dto.file_name,
        bucket,
        storageKey,
        contentType: dto.content_type,
        sizeBytes: dto.size_bytes,
        durationSeconds: dto.duration_seconds ?? null,
        status: "PENDING_UPLOAD",
        isPublic,
        retentionUntil,
        uploadedByType,
        uploadedById: actor.id,
      });

      return {
        id: mediaId,
        upload_mode: "DIRECT_PUT",
        upload_url: uploadUrl,
        storage_key: storageKey,
        bucket,
        expires_in_seconds: 900,
      };
    }

    // Large files (> 10 MB) -> S3 Multipart Upload
    const uploadId = await createMultipartUpload(bucket, storageKey, dto.content_type);
    const totalParts = Math.ceil(dto.size_bytes / PART_SIZE_BYTES);

    // Presign initial part URLs (up to 10 parts upfront)
    const initialPartsCount = Math.min(totalParts, 10);
    const parts: Array<{ part_number: number; upload_url: string }> = [];

    for (let partNumber = 1; partNumber <= initialPartsCount; partNumber++) {
      const uploadUrl = await presignUploadPart({
        bucket,
        key: storageKey,
        uploadId,
        partNumber,
        expiresIn: 900,
      });
      parts.push({ part_number: partNumber, upload_url: uploadUrl });
    }

    await mediaRepo.createMediaAsset({
      id: mediaId,
      ownerType: dto.owner_type ?? "UNATTACHED",
      ownerId: dto.owner_id ?? mediaId,
      kind: dto.purpose,
      fileName: dto.file_name,
      uploadId,
      bucket,
      storageKey,
      contentType: dto.content_type,
      sizeBytes: dto.size_bytes,
      durationSeconds: dto.duration_seconds ?? null,
      status: "PENDING_UPLOAD",
      isPublic,
      retentionUntil,
      uploadedByType,
      uploadedById: actor.id,
    });

    return {
      id: mediaId,
      upload_mode: "MULTIPART",
      upload_id: uploadId,
      storage_key: storageKey,
      bucket,
      part_size: PART_SIZE_BYTES,
      total_parts: totalParts,
      parts,
      expires_in_seconds: 900,
    };
  },

  // --------------------------------------------------------------------------
  // 2. Fetch Multipart Part URLs (Resumable Lazy Fetch)
  // --------------------------------------------------------------------------
  async getUploadParts(
    mediaId: string,
    dto: FetchUploadPartsDto,
    actor: Actor
  ): Promise<{
    id: string;
    upload_id: string;
    parts: Array<{ part_number: number; upload_url: string }>;
    expires_in_seconds: number;
  }> {
    const media = await mediaRepo.getMediaAssetById(mediaId);
    if (!media) {
      throw new NotFoundError(`Media asset '${mediaId}' not found`);
    }

    if (media.status !== "PENDING_UPLOAD" || !media.uploadId) {
      throw new BusinessError(
        "ERR_INVALID_UPLOAD_STATE",
        `Media upload '${mediaId}' is not in a pending multipart state`,
        { status: media.status },
        400
      );
    }

    const parts: Array<{ part_number: number; upload_url: string }> = [];
    for (const partNumber of dto.part_numbers) {
      const uploadUrl = await presignUploadPart({
        bucket: media.bucket,
        key: media.storageKey,
        uploadId: media.uploadId,
        partNumber,
        expiresIn: 900,
      });
      parts.push({ part_number: partNumber, upload_url: uploadUrl });
    }

    return {
      id: media.id,
      upload_id: media.uploadId,
      parts,
      expires_in_seconds: 900,
    };
  },

  // --------------------------------------------------------------------------
  // 3. Complete Upload
  // --------------------------------------------------------------------------
  async completeUpload(
    mediaId: string,
    dto: CompleteUploadDto,
    actor: Actor
  ): Promise<MediaAssetRow> {
    const media = await mediaRepo.getMediaAssetById(mediaId);
    if (!media) {
      throw new NotFoundError(`Media asset '${mediaId}' not found`);
    }

    // Idempotency: if already completed and READY, return
    if (media.status === "READY") {
      return media;
    }

    // If multipart upload, assemble and finalize parts
    if (media.uploadId) {
      if (dto.parts && dto.parts.length > 0) {
        const sortedParts = [...dto.parts].sort((a, b) => a.part_number - b.part_number);
        await completeMultipartUpload({
          bucket: media.bucket,
          key: media.storageKey,
          uploadId: media.uploadId,
          parts: sortedParts.map((p) => ({
            PartNumber: p.part_number,
            ETag: p.etag,
          })),
        });
      }
    }

    // Verify presence and metadata via HeadObject
    let head = await headObject(media.bucket, media.storageKey);
    if (!head.exists) {
      if (env.MOCK_EXTERNAL_SERVICES) {
        // In mock mode / test environments, simulate the uploaded object in memory
        await putObject(media.bucket, media.storageKey, Buffer.alloc(1024), media.contentType);
        head = { exists: true, contentLength: media.sizeBytes, contentType: media.contentType };
      } else {
        throw new BusinessError(
          "ERR_UPLOAD_NOT_FOUND",
          `Uploaded object for media asset '${mediaId}' was not found in storage`,
          {},
          400
        );
      }
    }

    let flagged = media.flagged;
    let flagReason = media.flagReason;
    let durationSeconds = dto.duration_seconds ?? media.durationSeconds;

    // Check duration verification for RMA video
    if (media.kind === "RMA_VIDEO" && durationSeconds && durationSeconds > 180) {
      flagged = true;
      flagReason = `Declared video duration (${durationSeconds}s) exceeds 3 minutes`;
    }

    const updated = await mediaRepo.updateMediaAsset(media.id, {
      status: "READY",
      sizeBytes: head.contentLength ?? media.sizeBytes,
      contentType: head.contentType ?? media.contentType,
      durationSeconds,
      flagged,
      flagReason,
    });

    if (!updated) {
      throw new BusinessError("ERR_UPDATE_FAILED", "Failed to finalize media asset", {}, 500);
    }

    // Emit transactional outbox event
    await emitOutbox(undefined, {
      type: "media.uploaded",
      aggregateType: "media",
      aggregateId: updated.id,
      payload: {
        mediaId: updated.id,
        purpose: updated.kind,
        ownerType: updated.ownerType,
        ownerId: updated.ownerId,
        storageKey: updated.storageKey,
        bucket: updated.bucket,
        sizeBytes: updated.sizeBytes,
        contentType: updated.contentType,
        durationSeconds: updated.durationSeconds,
        flagged: updated.flagged,
        flagReason: updated.flagReason,
      },
    });

    return updated;
  },

  // --------------------------------------------------------------------------
  // 4. Abort Upload
  // --------------------------------------------------------------------------
  async abortUpload(
    mediaId: string,
    actor: Actor
  ): Promise<{ success: boolean; message: string }> {
    const media = await mediaRepo.getMediaAssetById(mediaId);
    if (!media) {
      throw new NotFoundError(`Media asset '${mediaId}' not found`);
    }

    assertCanManageMedia(actor, media);

    if (media.uploadId && media.status === "PENDING_UPLOAD") {
      await abortMultipartUpload(media.bucket, media.storageKey, media.uploadId);
    }

    await mediaRepo.updateMediaAsset(media.id, {
      status: "DELETED",
    });

    return {
      success: true,
      message: "Upload aborted successfully",
    };
  },

  // --------------------------------------------------------------------------
  // 5. Get Media Access URL (Signed GET URL for Private Media)
  // --------------------------------------------------------------------------
  async getMediaUrl(
    mediaId: string,
    actor: Actor | null
  ): Promise<{
    url: string;
    expires_in_seconds?: number;
    is_public: boolean;
  }> {
    const media = await mediaRepo.getMediaAssetById(mediaId);
    if (!media) {
      throw new NotFoundError(`Media asset '${mediaId}' not found`);
    }

    if (media.status === "DELETED") {
      throw new NotFoundError(`Media asset '${mediaId}' has been deleted`);
    }

    // Public media -> Public CDN URL directly
    if (media.isPublic) {
      const cdnBase = env.S3_PUBLIC_DOMAIN.replace(/\/+$/, "");
      return {
        url: `${cdnBase}/${media.storageKey}`,
        is_public: true,
      };
    }

    // Private media -> Verify permission and issue signed GET URL (5 minutes)
    assertCanAccessMedia(actor, media);

    const signedUrl = await presignGet({
      bucket: media.bucket,
      key: media.storageKey,
      expiresIn: 300, // 5 minutes
    });

    return {
      url: signedUrl,
      expires_in_seconds: 300,
      is_public: false,
    };
  },

  // --------------------------------------------------------------------------
  // 6. Retention Cleanup Job (Daily 05:00)
  // --------------------------------------------------------------------------
  async runRetentionCleanupJob(): Promise<{ purgedCount: number }> {
    const now = new Date();
    const expiredAssets = await mediaRepo.listExpiredMedia(now, 200);
    let purgedCount = 0;

    for (const asset of expiredAssets) {
      try {
        await deleteObject(asset.bucket, asset.storageKey);
        await mediaRepo.updateMediaAsset(asset.id, {
          status: "DELETED",
        });

        await recordAudit(undefined, {
          actorType: "SYSTEM",
          action: "MEDIA_RETENTION_PURGE",
          entityType: "MEDIA_ASSET",
          entityId: asset.id,
          metadata: {
            storageKey: asset.storageKey,
            bucket: asset.bucket,
            kind: asset.kind,
            retentionUntil: asset.retentionUntil,
          },
        });

        purgedCount++;
      } catch {
        // Continue processing others
      }
    }

    return { purgedCount };
  },

  // --------------------------------------------------------------------------
  // 7. Abandoned Uploads Cleanup Job
  // --------------------------------------------------------------------------
  async runAbandonedUploadsCleanupJob(): Promise<{ abortedCount: number }> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // > 24h
    const abandoned = await mediaRepo.listAbandonedUploads(cutoff, 200);
    let abortedCount = 0;

    for (const asset of abandoned) {
      try {
        if (asset.uploadId) {
          await abortMultipartUpload(asset.bucket, asset.storageKey, asset.uploadId);
        }
        await deleteObject(asset.bucket, asset.storageKey);
        await mediaRepo.updateMediaAsset(asset.id, {
          status: "DELETED",
        });

        await recordAudit(undefined, {
          actorType: "SYSTEM",
          action: "MEDIA_ABANDONED_PURGE",
          entityType: "MEDIA_ASSET",
          entityId: asset.id,
          metadata: {
            storageKey: asset.storageKey,
            uploadId: asset.uploadId,
            createdAt: asset.createdAt,
          },
        });

        abortedCount++;
      } catch {
        // Continue
      }
    }

    return { abortedCount };
  },

  // --------------------------------------------------------------------------
  // 8. Alias: RMA Upload URL (api-spec §13.1 POST /api/v1/rma/upload-url)
  // --------------------------------------------------------------------------
  async initiateRmaUploadUrl(
    dto: RmaUploadUrlDto,
    actor: Actor
  ): Promise<{
    media_id: string;
    presigned_upload_url: string;
    r2_key: string;
    expires_in_seconds: number;
    upload_mode: string;
    upload_id?: string;
  }> {
    const sizeBytes = dto.file_size_bytes ?? dto.size_bytes ?? 50 * 1024 * 1024;
    const isVideo =
      dto.content_type.startsWith("video/") ||
      dto.file_name.toLowerCase().endsWith(".mp4") ||
      dto.file_name.toLowerCase().endsWith(".mov") ||
      dto.file_name.toLowerCase().endsWith(".webm");

    const purpose: UploadPurpose = isVideo ? "RMA_VIDEO" : "RMA_PHOTO";

    const res = await this.initiateUpload(
      {
        purpose,
        file_name: dto.file_name,
        content_type: dto.content_type,
        size_bytes: sizeBytes,
        duration_seconds: dto.duration_seconds,
      },
      actor
    );

    const presignedUrl =
      res.upload_mode === "DIRECT_PUT"
        ? res.upload_url!
        : res.parts?.[0]?.upload_url || "";

    return {
      media_id: res.id,
      presigned_upload_url: presignedUrl,
      r2_key: res.storage_key,
      expires_in_seconds: res.expires_in_seconds,
      upload_mode: res.upload_mode,
      upload_id: res.upload_id,
    };
  },

  // Legacy helper methods
  async createMediaAsset(input: any) {
    return mediaRepo.createMediaAsset(input);
  },
  async getMediaAssetById(id: string) {
    return mediaRepo.getMediaAssetById(id);
  },
  async markMediaReady(id: string) {
    return mediaRepo.updateMediaAsset(id, { status: "READY" });
  },
  async listMediaByOwner(ownerType: string, ownerId: string) {
    return mediaRepo.listMediaByOwner(ownerType, ownerId);
  },
};
