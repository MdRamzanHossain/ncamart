import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import { mediaService, initiateUploadSchema } from "../index";
import { mediaRepo } from "../repo";
import { Actor } from "@/lib/http/route";
import { ValidationError, ForbiddenError, BusinessError, NotFoundError } from "@/lib/errors";
import { clearMemoryOutboxForTesting, getMemoryOutbox } from "@/lib/outbox";
import { clearMemoryAuditChainForTesting, getRecentMemoryAuditEntries } from "@/modules/audit";

describe("P31 — Media Uploads (Presigned Multipart to R2)", () => {
  // Test Actors
  const customerAlice: Actor = {
    id: "alice-cust-1234",
    type: "customer",
  };

  const customerBob: Actor = {
    id: "bob-cust-5678",
    type: "customer",
  };

  const supportStaff: Actor = {
    id: "staff-support-001",
    type: "staff",
    roles: ["SUPPORT_AGENT"],
  };

  const financeStaff: Actor = {
    id: "staff-finance-001",
    type: "staff",
    roles: ["FINANCE_OFFICER"],
  };

  const catalogStaff: Actor = {
    id: "staff-catalog-001",
    type: "staff",
    roles: ["CATALOG_SPECIALIST"],
  };

  const qcStaff: Actor = {
    id: "staff-qc-001",
    type: "staff",
    roles: ["QC_TECHNICIAN"],
  };

  const runnerStaff: Actor = {
    id: "staff-runner-001",
    type: "staff",
    roles: ["RUNNER"],
  };

  const superAdmin: Actor = {
    id: "staff-admin-001",
    type: "staff",
    roles: ["SUPER_ADMIN"],
  };

  beforeEach(() => {
    mediaService.clearMemoryForTesting();
    clearMemoryOutboxForTesting();
    clearMemoryAuditChainForTesting();
  });

  // ==========================================================================
  // Test 1: S3 Multipart Upload Happy Path (>10 MB)
  // ==========================================================================
  describe("1. S3 Multipart Upload Happy Path (> 10 MB)", () => {
    it("initiates multipart upload, fetches lazy parts, completes upload, and emits media.uploaded", async () => {
      // A customer uploading an unboxing defect video (25 MB)
      const fileSize = 25 * 1024 * 1024; // 25 MB
      const initResult = await mediaService.initiateUpload(
        {
          purpose: "RMA_VIDEO",
          file_name: "unboxing_order_10482.mp4",
          content_type: "video/mp4",
          size_bytes: fileSize,
          owner_type: "RMA_CLAIM",
          owner_id: "claim-uuid-999",
          duration_seconds: 120, // 2 minutes (≤ 180s)
        },
        customerAlice
      );

      expect(initResult.upload_mode).toBe("MULTIPART");
      expect(initResult.upload_id).toBeDefined();
      expect(initResult.part_size).toBe(10 * 1024 * 1024); // 10 MB
      expect(initResult.total_parts).toBe(3); // 25 MB / 10 MB = 3 parts
      expect(initResult.parts).toHaveLength(3);
      expect(initResult.parts![0]!.part_number).toBe(1);
      expect(initResult.parts![0]!.upload_url).toContain("unboxing_order_10482");

      // Verify lazy part fetching endpoint (e.g. client requesting parts 2 & 3 specifically)
      const lazyParts = await mediaService.getUploadParts(
        initResult.id,
        { part_numbers: [2, 3] },
        customerAlice
      );

      expect(lazyParts.id).toBe(initResult.id);
      expect(lazyParts.upload_id).toBe(initResult.upload_id);
      expect(lazyParts.parts).toHaveLength(2);
      expect(lazyParts.parts[0]!.part_number).toBe(2);
      expect(lazyParts.parts[1]!.part_number).toBe(3);

      // Complete multipart upload with ETags
      const completed = await mediaService.completeUpload(
        initResult.id,
        {
          parts: [
            { part_number: 1, etag: '"etag-part-1-abc"' },
            { part_number: 2, etag: '"etag-part-2-def"' },
            { part_number: 3, etag: '"etag-part-3-ghi"' },
          ],
          duration_seconds: 120,
        },
        customerAlice
      );

      expect(completed.status).toBe("READY");
      expect(completed.kind).toBe("RMA_VIDEO");
      expect(completed.flagged).toBe(false);
      expect(completed.durationSeconds).toBe(120);

      // Verify outbox event 'media.uploaded'
      const events = getMemoryOutbox();
      const uploadEvent = events.find((e) => e.type === "media.uploaded");
      expect(uploadEvent).toBeDefined();
      expect(uploadEvent?.payload.mediaId).toBe(initResult.id);
      expect(uploadEvent?.payload.purpose).toBe("RMA_VIDEO");
    });
  });

  // ==========================================================================
  // Test 2: Single Presigned PUT (≤ 10 MB)
  // ==========================================================================
  describe("2. Single Presigned PUT (≤ 10 MB)", () => {
    it("issues single presigned PUT URL for files ≤ 10 MB and completes successfully", async () => {
      const initResult = await mediaService.initiateUpload(
        {
          purpose: "RMA_PHOTO",
          file_name: "port_damage.jpg",
          content_type: "image/jpeg",
          size_bytes: 2 * 1024 * 1024, // 2 MB
          owner_type: "RMA_CLAIM",
          owner_id: "claim-uuid-999",
        },
        customerAlice
      );

      expect(initResult.upload_mode).toBe("DIRECT_PUT");
      expect(initResult.upload_url).toBeDefined();
      expect(initResult.upload_id).toBeUndefined();
      expect(initResult.parts).toBeUndefined();

      const completed = await mediaService.completeUpload(
        initResult.id,
        {},
        customerAlice
      );

      expect(completed.status).toBe("READY");
      expect(completed.kind).toBe("RMA_PHOTO");
      expect(completed.isPublic).toBe(false);
    });
  });

  // ==========================================================================
  // Test 3: Size, Content-Type & Quantity Limits Rejection
  // ==========================================================================
  describe("3. Size, Content-Type & Quantity Limits Rejection", () => {
    it("rejects file exceeding purpose max size", async () => {
      // RMA_PHOTO limit is 10 MB -> attempt 12 MB
      await expect(
        mediaService.initiateUpload(
          {
            purpose: "RMA_PHOTO",
            file_name: "huge_damage.png",
            content_type: "image/png",
            size_bytes: 12 * 1024 * 1024,
          },
          customerAlice
        )
      ).rejects.toThrow(/exceeds maximum allowed size of 10 MB/i);

      // RMA_VIDEO limit is 300 MB -> attempt 350 MB
      await expect(
        mediaService.initiateUpload(
          {
            purpose: "RMA_VIDEO",
            file_name: "huge_video.mp4",
            content_type: "video/mp4",
            size_bytes: 350 * 1024 * 1024,
          },
          customerAlice
        )
      ).rejects.toThrow(/exceeds maximum allowed size of 300 MB/i);
    });

    it("rejects unauthorized content-type / file extension", async () => {
      // Executable file or script rejected
      await expect(
        mediaService.initiateUpload(
          {
            purpose: "RMA_PHOTO",
            file_name: "payload.exe",
            content_type: "application/x-msdownload",
            size_bytes: 1024 * 100,
          },
          customerAlice
        )
      ).rejects.toThrow(/invalid content type/i);

      // Audio file for RMA_PHOTO rejected
      await expect(
        mediaService.initiateUpload(
          {
            purpose: "RMA_PHOTO",
            file_name: "audio.mp3",
            content_type: "audio/mpeg",
            size_bytes: 1024 * 100,
          },
          customerAlice
        )
      ).rejects.toThrow(/invalid content type/i);
    });

    it("rejects RMA video exceeding 3 minutes duration limit", async () => {
      // 200 seconds (> 180 seconds)
      await expect(
        mediaService.initiateUpload(
          {
            purpose: "RMA_VIDEO",
            file_name: "too_long.mp4",
            content_type: "video/mp4",
            size_bytes: 50 * 1024 * 1024,
            duration_seconds: 200,
          },
          customerAlice
        )
      ).rejects.toThrow(/duration .* exceeds maximum allowed limit of 3 minutes/i);
    });

    it("enforces max 5 photos per RMA claim", async () => {
      const claimId = "claim-five-photos";

      // Upload 5 photos successfully
      for (let i = 1; i <= 5; i++) {
        await mediaService.initiateUpload(
          {
            purpose: "RMA_PHOTO",
            file_name: `photo_${i}.jpg`,
            content_type: "image/jpeg",
            size_bytes: 1024 * 500,
            owner_type: "RMA_CLAIM",
            owner_id: claimId,
          },
          customerAlice
        );
      }

      // 6th photo must be rejected
      await expect(
        mediaService.initiateUpload(
          {
            purpose: "RMA_PHOTO",
            file_name: "photo_6.jpg",
            content_type: "image/jpeg",
            size_bytes: 1024 * 500,
            owner_type: "RMA_CLAIM",
            owner_id: claimId,
          },
          customerAlice
        )
      ).rejects.toThrow(/maximum 5 photos allowed per rma claim/i);
    });

    it("enforces max 1 video per RMA claim", async () => {
      const claimId = "claim-single-video";

      // 1st video succeeds
      await mediaService.initiateUpload(
        {
          purpose: "RMA_VIDEO",
          file_name: "video_1.mp4",
          content_type: "video/mp4",
          size_bytes: 15 * 1024 * 1024,
          owner_type: "RMA_CLAIM",
          owner_id: claimId,
        },
        customerAlice
      );

      // 2nd video rejected
      await expect(
        mediaService.initiateUpload(
          {
            purpose: "RMA_VIDEO",
            file_name: "video_2.mp4",
            content_type: "video/mp4",
            size_bytes: 15 * 1024 * 1024,
            owner_type: "RMA_CLAIM",
            owner_id: claimId,
          },
          customerAlice
        )
      ).rejects.toThrow(/maximum 1 unboxing\/defect video allowed per rma claim/i);
    });

    it("flags video duration when client declares duration > 180s on completion", async () => {
      // Upload initiated without duration
      const initResult = await mediaService.initiateUpload(
        {
          purpose: "RMA_VIDEO",
          file_name: "unboxed.mp4",
          content_type: "video/mp4",
          size_bytes: 15 * 1024 * 1024,
        },
        customerAlice
      );

      // On complete, duration passed is 210s (> 180s)
      const completed = await mediaService.completeUpload(
        initResult.id,
        {
          parts: [{ part_number: 1, etag: '"etag-1"' }],
          duration_seconds: 210,
        },
        customerAlice
      );

      expect(completed.status).toBe("READY");
      expect(completed.flagged).toBe(true);
      expect(completed.flagReason).toContain("exceeds 3 minutes");
    });
  });

  // ==========================================================================
  // Test 4: Access Control on Signed URLs
  // ==========================================================================
  describe("4. Access Control on Signed URLs", () => {
    it("returns public CDN URL directly for public product images without signing", async () => {
      const initResult = await mediaService.initiateUpload(
        {
          purpose: "PRODUCT_IMAGE",
          file_name: "product_front.webp",
          content_type: "image/webp",
          size_bytes: 1024 * 400,
        },
        catalogStaff
      );

      await mediaService.completeUpload(initResult.id, {}, catalogStaff);

      // Anonymous actor can access public image
      const access = await mediaService.getMediaUrl(initResult.id, null);
      expect(access.is_public).toBe(true);
      expect(access.url).toContain(initResult.storage_key);
      expect(access.expires_in_seconds).toBeUndefined();
    });

    it("allows uploader customer to access their private media via 5-min signed URL", async () => {
      const initResult = await mediaService.initiateUpload(
        {
          purpose: "RMA_PHOTO",
          file_name: "defect.jpg",
          content_type: "image/jpeg",
          size_bytes: 1024 * 300,
        },
        customerAlice
      );

      await mediaService.completeUpload(initResult.id, {}, customerAlice);

      // Alice can access her own media
      const access = await mediaService.getMediaUrl(initResult.id, customerAlice);
      expect(access.is_public).toBe(false);
      expect(access.expires_in_seconds).toBe(300); // 5 minutes
      expect(access.url).toMatch(/X-Amz-Signature|presigned=get/);
    });

    it("rejects unauthorized customer from accessing another customer's private media", async () => {
      const initResult = await mediaService.initiateUpload(
        {
          purpose: "RMA_PHOTO",
          file_name: "alice_private.jpg",
          content_type: "image/jpeg",
          size_bytes: 1024 * 300,
        },
        customerAlice
      );

      await mediaService.completeUpload(initResult.id, {}, customerAlice);

      // Bob tries to access Alice's private RMA photo -> 403 Forbidden
      await expect(
        mediaService.getMediaUrl(initResult.id, customerBob)
      ).rejects.toThrow(ForbiddenError);
    });

    it("allows Support staff to access RMA media and Finance to access receipts", async () => {
      // 1. RMA Media: Support staff can access
      const rmaResult = await mediaService.initiateUpload(
        {
          purpose: "RMA_PHOTO",
          file_name: "serial_scratch.jpg",
          content_type: "image/jpeg",
          size_bytes: 1024 * 200,
        },
        customerAlice
      );
      await mediaService.completeUpload(rmaResult.id, {}, customerAlice);

      const supportAccess = await mediaService.getMediaUrl(rmaResult.id, supportStaff);
      expect(supportAccess.expires_in_seconds).toBe(300);

      // 2. Receipt Media: Runner uploads, Finance staff can access
      const receiptResult = await mediaService.initiateUpload(
        {
          purpose: "RECEIPT_PHOTO",
          file_name: "stall_memo.jpg",
          content_type: "image/jpeg",
          size_bytes: 1024 * 200,
        },
        runnerStaff
      );
      await mediaService.completeUpload(receiptResult.id, {}, runnerStaff);

      const financeAccess = await mediaService.getMediaUrl(receiptResult.id, financeStaff);
      expect(financeAccess.expires_in_seconds).toBe(300);

      // Finance trying to access arbitrary QC photo -> rejected
      const qcResult = await mediaService.initiateUpload(
        {
          purpose: "QC_PHOTO",
          file_name: "seal_tamper.jpg",
          content_type: "image/jpeg",
          size_bytes: 1024 * 200,
        },
        qcStaff
      );
      await mediaService.completeUpload(qcResult.id, {}, qcStaff);

      await expect(
        mediaService.getMediaUrl(qcResult.id, financeStaff)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // ==========================================================================
  // Test 5: Abort Upload
  // ==========================================================================
  describe("5. Abort Upload", () => {
    it("aborts pending multipart upload and marks record DELETED", async () => {
      const initResult = await mediaService.initiateUpload(
        {
          purpose: "RMA_VIDEO",
          file_name: "cancelled_video.mp4",
          content_type: "video/mp4",
          size_bytes: 20 * 1024 * 1024,
        },
        customerAlice
      );

      const abortRes = await mediaService.abortUpload(initResult.id, customerAlice);
      expect(abortRes.success).toBe(true);

      const media = await mediaRepo.getMediaAssetById(initResult.id);
      expect(media?.status).toBe("DELETED");

      // Attempting to complete aborted upload throws
      await expect(
        mediaService.getMediaUrl(initResult.id, customerAlice)
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ==========================================================================
  // Test 6: Retention Purge & Abandoned Uploads Cleanup Jobs
  // ==========================================================================
  describe("6. Retention Purge & Abandoned Uploads Cleanup Jobs", () => {
    it("purges expired objects past retention_until and writes audit records", async () => {
      // Create asset with retention in the past (e.g. 1 day ago)
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const init = await mediaService.initiateUpload(
        {
          purpose: "RMA_PHOTO",
          file_name: "expired_rma.jpg",
          content_type: "image/jpeg",
          size_bytes: 1024 * 100,
        },
        customerAlice
      );
      await mediaService.completeUpload(init.id, {}, customerAlice);

      // Force retention date in past
      await mediaRepo.updateMediaAsset(init.id, {
        retentionUntil: pastDate,
      });

      // Run daily retention job
      const purgeResult = await mediaService.runRetentionCleanupJob();
      expect(purgeResult.purgedCount).toBe(1);

      const media = await mediaRepo.getMediaAssetById(init.id);
      expect(media?.status).toBe("DELETED");

      // Verify system audit trail
      const audits = getRecentMemoryAuditEntries();
      const purgeAudit = audits.find((a) => a.action === "MEDIA_RETENTION_PURGE");
      expect(purgeAudit).toBeDefined();
      expect(purgeAudit?.actorType).toBe("SYSTEM");
      expect(purgeAudit?.entityId).toBe(init.id);
    });

    it("aborts and purges abandoned uploads in PENDING_UPLOAD state > 24 hours", async () => {
      const init = await mediaService.initiateUpload(
        {
          purpose: "RMA_VIDEO",
          file_name: "abandoned.mp4",
          content_type: "video/mp4",
          size_bytes: 15 * 1024 * 1024,
        },
        customerAlice
      );

      // Force creation time > 24h ago
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      await mediaRepo.updateMediaAsset(init.id, {
        createdAt: twoDaysAgo,
      });

      const cleanupRes = await mediaService.runAbandonedUploadsCleanupJob();
      expect(cleanupRes.abortedCount).toBe(1);

      const media = await mediaRepo.getMediaAssetById(init.id);
      expect(media?.status).toBe("DELETED");

      const audits = getRecentMemoryAuditEntries();
      const purgeAudit = audits.find((a) => a.action === "MEDIA_ABANDONED_PURGE");
      expect(purgeAudit).toBeDefined();
    });
  });

  // ==========================================================================
  // Test 7: RMA Upload URL Alias (api-spec §13.1)
  // ==========================================================================
  describe("7. RMA Upload URL Alias (api-spec §13.1)", () => {
    it("returns formatted presigned upload url matching api-spec §13.1 shape", async () => {
      const res = await mediaService.initiateRmaUploadUrl(
        {
          file_name: "unboxing_order_10482.mp4",
          file_size_bytes: 145000000,
          content_type: "video/mp4",
        },
        customerAlice
      );

      expect(res.media_id).toBeDefined();
      expect(res.presigned_upload_url).toBeDefined();
      expect(res.r2_key).toContain("media/rma_video");
      expect(res.expires_in_seconds).toBe(900);
      expect(res.upload_mode).toBe("MULTIPART");
      expect(res.upload_id).toBeDefined();
    });
  });
});
