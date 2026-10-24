import { describe, it, expect, beforeEach } from "vitest";
import { catalogService } from "../index";
import { mediaService } from "@/modules/media";
import { BusinessError, ValidationError } from "@/lib/errors";
import { clearMemoryOutboxForTesting, getMemoryOutbox } from "@/lib/outbox";
import { clearMemoryAuditChainForTesting, getRecentMemoryAuditEntries } from "@/modules/audit";
import { Actor } from "@/lib/http/route";

describe("Catalog Governance & Management APIs — P10", () => {
  const creatorActor: Actor = {
    id: "creator-manager-id",
    type: "staff",
    roles: ["CATALOG_MANAGER"],
  };

  const submitterActor: Actor = {
    id: "submitter-manager-id",
    type: "staff",
    roles: ["CATALOG_MANAGER"],
  };

  const superAdminActor: Actor = {
    id: "super-admin-independent-id",
    type: "staff",
    roles: ["SUPER_ADMIN"],
  };

  beforeEach(() => {
    catalogService.clearMemoryCatalogForTesting();
    mediaService.clearMemoryMediaForTesting();
    clearMemoryOutboxForTesting();
    clearMemoryAuditChainForTesting();
  });

  describe("1. Review Checklist (PRD §3.15.2) Failures Aggregated", () => {
    it("aggregates all checklist failures on BUDGET_SMART product", async () => {
      const cat = await catalogService.createCategory(
        {
          slug: "chargers",
          nameEn: "Chargers",
          nameBn: "চার্জার",
          level: 1,
        },
        creatorActor
      );

      // Create product missing zero_replica_attested, missing real-packaging photo, no SKUs
      const product = await catalogService.createProduct(
        {
          slug: "budget-smart-charger",
          titleEn: "Budget Smart Charger 30W",
          titleBn: "বাজেট স্মার্ট চার্জার",
          categoryId: cat.id,
          productTier: "BUDGET_SMART",
          fulfillmentType: "DROP_AND_PACK",
          zeroReplicaAttested: false,
        },
        creatorActor
      );

      try {
        await catalogService.submitProductForReview(product.id, submitterActor);
        expect.unreachable("Should have failed checklist");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(BusinessError);
        const bErr = err as BusinessError;
        expect(bErr.code).toBe("ERR_CHECKLIST_FAILED");
        const details = bErr.details as { failures: string[]; warnings: string[] };
        expect(details.failures).toBeDefined();
        expect(details.failures.length).toBeGreaterThanOrEqual(3);

        // Verify specific checklist errors aggregated
        const failureText = details.failures.join(" | ");
        expect(failureText).toContain("zero-replica attestation");
        expect(failureText).toContain("real-packaging product photo");
        expect(failureText).toContain("at least one SKU variant");
      }
    });

    it("aggregates AUTHENTIC tier and BTRC clearance checklist failures", async () => {
      const wirelessCat = await catalogService.createCategory(
        {
          slug: "wireless-audio",
          nameEn: "Wireless Audio",
          nameBn: "ওয়্যারলেস অডিও",
          level: 1,
          btrcClearanceRequired: true,
        },
        creatorActor
      );

      // Missing distributor evidence, missing hs_code, btrc_status is NOT_REQUIRED
      const product = await catalogService.createProduct(
        {
          slug: "authentic-earbuds",
          titleEn: "Authentic ANC Earbuds",
          titleBn: "অথেনটিক ইয়ারবাডস",
          categoryId: wirelessCat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
          btrcStatus: "NOT_REQUIRED",
          hsCode: "",
        },
        creatorActor
      );

      // Add a SKU with 0 weight (which also violates checklist)
      await catalogService.createSku(
        {
          productId: product.id,
          skuCode: "AUTH-EARBUD-01",
          pricePaisa: 450000,
          baseCostPaisa: 320000,
          warrantyType: "OFFICIAL_DISTRIBUTOR",
          weightGrams: 0, // invalid weight
        },
        creatorActor
      );

      try {
        await catalogService.submitProductForReview(product.id, submitterActor);
        expect.unreachable("Should have failed checklist");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(BusinessError);
        const bErr = err as BusinessError;
        expect(bErr.code).toBe("ERR_CHECKLIST_FAILED");
        const details = bErr.details as { failures: string[]; warnings: string[] };

        const failureText = details.failures.join(" | ");
        expect(failureText).toContain("authorized distributor or invoice evidence");
        expect(failureText).toContain("HS Code");
        expect(failureText).toContain("valid BTRC status");
        expect(failureText).toContain("positive weight in grams");
      }
    });

    it("succeeds submission when all review checklist criteria are met and transitions to PENDING_REVIEW", async () => {
      const cat = await catalogService.createCategory(
        {
          slug: "cables-cat",
          nameEn: "Cables",
          nameBn: "কেবল",
          level: 1,
        },
        creatorActor
      );

      const comparisonGroup = await catalogService.createComparisonGroup(
        {
          name: "60W Fast Cables",
          categoryId: cat.id,
        },
        creatorActor
      );

      const product = await catalogService.createProduct(
        {
          slug: "budget-fast-cable",
          titleEn: "Budget Smart Fast Cable 1M",
          titleBn: "বাজেট স্মার্ট ফাস্ট কেবল",
          categoryId: cat.id,
          productTier: "BUDGET_SMART",
          fulfillmentType: "DROP_AND_PACK",
          comparisonGroupId: comparisonGroup.id,
          zeroReplicaAttested: true,
          zeroReplicaAttestedBy: creatorActor.id,
        },
        creatorActor
      );

      // Add SKU with positive weight
      await catalogService.createSku(
        {
          productId: product.id,
          skuCode: "BDG-CBL-1M",
          pricePaisa: 35000,
          baseCostPaisa: 22000,
          warrantyType: "SHOP_REPLACEMENT",
          weightGrams: 45,
        },
        creatorActor
      );

      // Add verified packaging photo
      const uploadRes = await catalogService.createImageUploadUrl(
        product.id,
        {
          fileName: "packaging-box.webp",
          contentType: "image/webp",
          sizeBytes: 450000,
          kind: "PRODUCT_IMAGE",
        },
        creatorActor
      );
      await catalogService.completeImageUpload(product.id, uploadRes.media_id, creatorActor);

      // Submit for review
      const res = await catalogService.submitProductForReview(product.id, submitterActor);
      expect(res.product.status).toBe("PENDING_REVIEW");
      expect(res.product.submittedBy).toBe(submitterActor.id);
    });
  });

  describe("2. Four-Eyes Principle Enforcement", () => {
    it("blocks creator from approving their own product", async () => {
      const cat = await catalogService.createCategory({
        slug: "general-accessories",
        nameEn: "General Accessories",
        nameBn: "সাধারণ এক্সেসরিজ",
        level: 1,
      });

      const product = await catalogService.createProduct(
        {
          slug: "baseus-gan-charger",
          titleEn: "Baseus GaN 65W",
          titleBn: "বেসাস গ্যান ৬৫ ওয়াট",
          categoryId: cat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
          distributorEvidenceMediaId: "fake-media-id",
        },
        creatorActor
      );

      await catalogService.createSku({
        productId: product.id,
        skuCode: "BAS-65W-BLK",
        pricePaisa: 380000,
        baseCostPaisa: 280000,
        warrantyType: "OFFICIAL_DISTRIBUTOR",
        weightGrams: 120,
      });

      await catalogService.submitProductForReview(product.id, submitterActor);

      // Creator attempts to approve -> 403 ERR_FOUR_EYES_VIOLATION
      await expect(
        catalogService.approveProduct(product.id, creatorActor, "Self approval")
      ).rejects.toThrow(BusinessError);

      try {
        await catalogService.approveProduct(product.id, creatorActor, "Self approval");
      } catch (err) {
        const bErr = err as BusinessError;
        expect(bErr.code).toBe("ERR_FOUR_EYES_VIOLATION");
        expect(bErr.status).toBe(403);
      }
    });

    it("blocks submitter from approving the product", async () => {
      const cat = await catalogService.createCategory({
        slug: "audio-gear",
        nameEn: "Audio Gear",
        nameBn: "অডিও গিয়ার",
        level: 1,
      });

      const product = await catalogService.createProduct(
        {
          slug: "ugreen-audio-adapter",
          titleEn: "UGREEN Audio Adapter",
          titleBn: "ইউগ্রীন অডিও অ্যাডাপ্টার",
          categoryId: cat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
          distributorEvidenceMediaId: "fake-distributor-id",
        },
        creatorActor
      );

      await catalogService.createSku({
        productId: product.id,
        skuCode: "UGR-AUD-ADP",
        pricePaisa: 95000,
        baseCostPaisa: 60000,
        warrantyType: "OFFICIAL_DISTRIBUTOR",
        weightGrams: 30,
      });

      await catalogService.submitProductForReview(product.id, submitterActor);

      // Submitter attempts to approve -> 403 ERR_FOUR_EYES_VIOLATION
      try {
        await catalogService.approveProduct(product.id, submitterActor, "Self approval");
        expect.unreachable();
      } catch (err) {
        const bErr = err as BusinessError;
        expect(bErr.code).toBe("ERR_FOUR_EYES_VIOLATION");
        expect(bErr.status).toBe(403);
      }
    });

    it("allows independent SUPER_ADMIN to approve or reject", async () => {
      const cat = await catalogService.createCategory({
        slug: "desk-lamps",
        nameEn: "Desk Lamps",
        nameBn: "ডেস্ক ল্যাম্প",
        level: 1,
      });

      const product = await catalogService.createProduct(
        {
          slug: "baseus-i-wok-screenbar",
          titleEn: "Baseus i-Wok Screenbar Lamp",
          titleBn: "বেসাস আই-ওক স্ক্রিনবার ল্যাম্প",
          categoryId: cat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
          distributorEvidenceMediaId: "evidence-media-uuid",
        },
        creatorActor
      );

      await catalogService.createSku({
        productId: product.id,
        skuCode: "BAS-IWOK-BAR",
        pricePaisa: 280000,
        baseCostPaisa: 190000,
        warrantyType: "OFFICIAL_DISTRIBUTOR",
        weightGrams: 480,
      });

      await catalogService.submitProductForReview(product.id, submitterActor);

      // Independent admin approves
      const approved = await catalogService.approveProduct(
        product.id,
        superAdminActor,
        "Reviewed distributor invoice, verified authentic barcode"
      );

      expect(approved.status).toBe("APPROVED");
      expect(approved.reviewedBy).toBe(superAdminActor.id);
      expect(approved.reviewNotes).toContain("Reviewed distributor invoice");
    });
  });

  describe("3. Publish & BTRC Clearance Guard (412 Precondition Failed)", () => {
    it("blocks publishing for BTRC category without approved clearance code (412)", async () => {
      const rfCat = await catalogService.createCategory({
        slug: "matter-smart-hubs",
        nameEn: "Matter Smart Hubs",
        nameBn: "ম্যাটার স্মার্ট হাব",
        level: 1,
        btrcClearanceRequired: true,
      });

      const product = await catalogService.createProduct(
        {
          slug: "aqara-hub-m3",
          titleEn: "Aqara Hub M3",
          titleBn: "আকারা হাব এম৩",
          categoryId: rfCat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "PRE_ORDER",
          hsCode: "8517.62.00",
          btrcStatus: "PENDING", // Not yet approved
          btrcClearanceCode: null,
          distributorEvidenceMediaId: "distributor-doc-id",
        },
        creatorActor
      );

      await catalogService.createSku({
        productId: product.id,
        skuCode: "AQR-HUB-M3",
        pricePaisa: 1450000,
        baseCostPaisa: 1050000,
        warrantyType: "OFFICIAL_DISTRIBUTOR",
        weightGrams: 280,
      });

      await catalogService.submitProductForReview(product.id, submitterActor);
      await catalogService.approveProduct(product.id, superAdminActor);

      // Attempt publish while BTRC is PENDING -> 412 ERR_BTRC_CLEARANCE_REQUIRED
      try {
        await catalogService.publishProduct(product.id, superAdminActor);
        expect.unreachable("Should have failed BTRC guard");
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessError);
        const bErr = err as BusinessError;
        expect(bErr.code).toBe("ERR_BTRC_CLEARANCE_REQUIRED");
        expect(bErr.status).toBe(412);
      }

      // Now approve BTRC with certificate code
      await catalogService.updateProduct(
        product.id,
        {
          btrcStatus: "APPROVED",
          btrcClearanceCode: "BTRC-RF-2026-8812",
        },
        superAdminActor
      );

      const published = await catalogService.publishProduct(product.id, superAdminActor);
      expect(published.status).toBe("PUBLISHED");
      expect(published.publishedAt).toBeInstanceOf(Date);

      // Verify transactional outbox event
      const outbox = getMemoryOutbox();
      const publishEvent = outbox.find((o) => o.type === "catalog.product_published");
      expect(publishEvent).toBeDefined();
      expect(publishEvent?.aggregateId).toBe(product.id);
    });
  });

  describe("4. Published Product Immutability & Allowed SKU Pricing Revisions", () => {
    it("blocks structural edits to a PUBLISHED product and its SKUs", async () => {
      const cat = await catalogService.createCategory({
        slug: "chargers-immutability-test",
        nameEn: "Chargers",
        nameBn: "চার্জার",
        level: 1,
      });

      const product = await catalogService.createProduct(
        {
          slug: "ugreen-nexode-65w",
          titleEn: "UGREEN Nexode 65W GaN",
          titleBn: "ইউগ্রীন নেক্সোড ৬৫ ওয়াট",
          categoryId: cat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
          distributorEvidenceMediaId: "distributor-media-id",
        },
        creatorActor
      );

      const sku = await catalogService.createSku({
        productId: product.id,
        skuCode: "UGR-NEX-65W",
        pricePaisa: 340000,
        baseCostPaisa: 250000,
        warrantyType: "OFFICIAL_DISTRIBUTOR",
        weightGrams: 140,
      });

      await catalogService.submitProductForReview(product.id, submitterActor);
      await catalogService.approveProduct(product.id, superAdminActor);
      await catalogService.publishProduct(product.id, superAdminActor);

      // 1. Structural product edit blocked
      await expect(
        catalogService.updateProduct(
          product.id,
          {
            titleEn: "Changed Title Without Revision",
          },
          creatorActor
        )
      ).rejects.toThrow(/Structural edits to published products/);

      // 2. Adding new SKU to published product blocked
      await expect(
        catalogService.createSku(
          {
            productId: product.id,
            skuCode: "UGR-NEX-65W-WHT",
            pricePaisa: 340000,
            baseCostPaisa: 250000,
            warrantyType: "OFFICIAL_DISTRIBUTOR",
            weightGrams: 140,
          },
          creatorActor
        )
      ).rejects.toThrow(/Adding new SKUs to published products/);

      // 3. Structural SKU edit blocked (e.g. changing attributes or specs)
      await expect(
        catalogService.updateSku(
          product.id,
          sku.id,
          {
            warrantyDays: 730, // structural warranty change
          },
          creatorActor
        )
      ).rejects.toThrow(/Structural edits to published SKUs/);
    });

    it("allows in-place price and spot buffer updates on published SKUs and creates audit row", async () => {
      const cat = await catalogService.createCategory({
        slug: "cables-pricing-test",
        nameEn: "Cables",
        nameBn: "কেবল",
        level: 1,
      });

      const product = await catalogService.createProduct(
        {
          slug: "baseus-crystal-cable",
          titleEn: "Baseus Crystal Type-C Cable",
          titleBn: "বেসাস ক্রিস্টাল টাইপ-সি কেবল",
          categoryId: cat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
          distributorEvidenceMediaId: "evidence-id",
        },
        creatorActor
      );

      const sku = await catalogService.createSku({
        productId: product.id,
        skuCode: "BAS-CRY-CBL",
        pricePaisa: 55000,
        baseCostPaisa: 38000,
        spotBufferBp: 600,
        warrantyType: "OFFICIAL_DISTRIBUTOR",
        weightGrams: 35,
      });

      await catalogService.submitProductForReview(product.id, submitterActor);
      await catalogService.approveProduct(product.id, superAdminActor);
      await catalogService.publishProduct(product.id, superAdminActor);

      // Update pricing in-place
      // New base cost: 40,000 paisa, spot buffer: 700 bp (7%)
      // New max unit purchase: 40,000 + (40,000 * 700 / 10,000) = 40,000 + 2,800 = 42,800 paisa
      const updatedSku = await catalogService.updateSku(
        product.id,
        sku.id,
        {
          pricePaisa: 59000,
          baseCostPaisa: 40000,
          spotBufferBp: 700,
          dailyOrderCap: 50,
        },
        creatorActor
      );

      expect(updatedSku.pricePaisa).toBe(59000);
      expect(updatedSku.baseCostPaisa).toBe(40000);
      expect(updatedSku.maxUnitPurchasePaisa).toBe(42800);
      expect(updatedSku.dailyOrderCap).toBe(50);

      // Verify audit log entry
      const auditLogs = getRecentMemoryAuditEntries();
      const pricingAudit = auditLogs.find((a) => a.action === "catalog.sku_pricing_updated");
      expect(pricingAudit).toBeDefined();
      expect(pricingAudit?.entityId).toBe(sku.id);
    });
  });

  describe("5. Product Image Upload Validation & Complete Flow", () => {
    it("validates image content type and rejects unsupported formats", async () => {
      const cat = await catalogService.createCategory({
        slug: "image-test-cat",
        nameEn: "Image Test",
        nameBn: "ইমেজ টেস্ট",
        level: 1,
      });

      const product = await catalogService.createProduct(
        {
          slug: "test-img-prod",
          titleEn: "Test Product",
          titleBn: "টেস্ট প্রোডাক্ট",
          categoryId: cat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
        },
        creatorActor
      );

      // Unsupported format (e.g. PDF or GIF)
      await expect(
        catalogService.createImageUploadUrl(
          product.id,
          {
            fileName: "manual.pdf",
            contentType: "application/pdf" as unknown as "image/jpeg",
            sizeBytes: 200000,
          },
          creatorActor
        )
      ).rejects.toThrow(ValidationError);
    });

    it("rejects image files exceeding 10 MB", async () => {
      const cat = await catalogService.createCategory({
        slug: "image-size-test-cat",
        nameEn: "Size Test",
        nameBn: "সাইজ টেস্ট",
        level: 1,
      });

      const product = await catalogService.createProduct(
        {
          slug: "size-test-prod",
          titleEn: "Size Test Product",
          titleBn: "সাইজ টেস্ট প্রোডাক্ট",
          categoryId: cat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
        },
        creatorActor
      );

      // 12 MB
      const oversizedBytes = 12 * 1024 * 1024;
      await expect(
        catalogService.createImageUploadUrl(
          product.id,
          {
            fileName: "huge-photo.jpg",
            contentType: "image/jpeg",
            sizeBytes: oversizedBytes,
          },
          creatorActor
        )
      ).rejects.toThrow(/Image file size cannot exceed 10 MB/);
    });

    it("creates presigned upload URL and marks ready on complete", async () => {
      const cat = await catalogService.createCategory({
        slug: "image-success-cat",
        nameEn: "Success Test",
        nameBn: "সাকসেস টেস্ট",
        level: 1,
      });

      const product = await catalogService.createProduct(
        {
          slug: "photo-prod",
          titleEn: "Photo Product",
          titleBn: "ফটো প্রোডাক্ট",
          categoryId: cat.id,
          productTier: "AUTHENTIC",
          fulfillmentType: "DROP_AND_PACK",
        },
        creatorActor
      );

      const res = await catalogService.createImageUploadUrl(
        product.id,
        {
          fileName: "hero-photo.webp",
          contentType: "image/webp",
          sizeBytes: 1200000,
        },
        creatorActor
      );

      expect(res.media_id).toBeDefined();
      expect(res.presigned_upload_url).toContain("hero-photo.webp");
      expect(res.storage_key).toContain(product.id);

      const completed = await catalogService.completeImageUpload(
        product.id,
        res.media_id,
        creatorActor
      );

      expect(completed.status).toBe("READY");

      // Verify full product query includes the ready media
      const full = await catalogService.getFullProduct(product.id);
      expect(full.media.length).toBe(1);
      expect(full.media[0]?.id).toBe(res.media_id);
    });
  });
});
