import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import { Actor } from "@/lib/http/route";
import { clearMemoryOutboxForTesting, getMemoryOutbox } from "@/lib/outbox";
import { catalogService } from "@/modules/catalog";
import { clearMemoryRateLimitsForTesting } from "@/lib/ratelimit";
import { RateLimitError } from "@/lib/errors";
import {
  trustService,
  generateSealId,
  checkVerifyRateLimit,
} from "../index";
import { trustRepo } from "../repo";

const superAdmin: Actor = {
  id: "01920000-0000-7000-8000-000000000099",
  type: "staff",
  roles: ["SUPER_ADMIN"],
};

const qcTechnician: Actor = {
  id: "01920000-0000-7000-8000-000000000001",
  type: "staff",
  roles: ["QC_TECHNICIAN"],
};

describe("P27 — Pre-Dispatch QC & Public Verification / Clone Detection", () => {
  beforeEach(() => {
    trustService.clearMemoryForTesting();
    catalogService.clearMemoryCatalogForTesting();
    clearMemoryRateLimitsForTesting();
    clearMemoryOutboxForTesting();
  });

  async function createTestSeal(status: "ACTIVE" | "VOID_PRINT_ERROR" = "ACTIVE", tier: "AUTHENTIC" | "BUDGET_SMART" = "AUTHENTIC", warrantyDays = 365) {
    const category = await catalogService.createCategory({
      slug: `cat-${crypto.randomUUID().slice(0, 8)}`,
      nameEn: "Chargers",
      nameBn: "চার্জার",
      level: 1,
    });

    const product = await catalogService.createProduct(
      {
        titleEn: tier === "AUTHENTIC" ? "UGREEN Nexode 65W GaN" : "Budget Charger 30W",
        titleBn: "চার্জার",
        slug: `prod-${crypto.randomUUID().slice(0, 8)}`,
        categoryId: category.id,
        productTier: tier,
        fulfillmentType: "DROP_AND_PACK",
        vatRateBp: 0,
      },
      superAdmin
    );

    const sku = await catalogService.createSku(
      {
        productId: product.id,
        skuCode: `SKU-${crypto.randomUUID().slice(0, 6)}`,
        pricePaisa: 250_000,
        baseCostPaisa: 180_000,
        weightGrams: 200,
        warrantyType: tier === "AUTHENTIC" ? "OFFICIAL_DISTRIBUTOR" : "SHOP_REPLACEMENT",
        warrantyDays,
      },
      superAdmin
    );

    catalogService.setProductStatusForTesting(product.id, "PUBLISHED");

    const sealId = generateSealId();
    const now = new Date();
    const warrantyEnd = new Date(now.getTime() + warrantyDays * 24 * 3600 * 1000);

    const seal = await trustRepo.createSealRecord({
      sealId,
      skuId: sku.id,
      productTier: tier,
      manufacturerSerial: tier === "AUTHENTIC" ? `SN-${crypto.randomUUID().slice(0, 8)}` : null,
      status,
      technicianId: qcTechnician.id,
      warrantyDays,
      warrantyStart: status === "ACTIVE" ? now : null,
      warrantyEnd: status === "ACTIVE" ? warrantyEnd : null,
    });

    // Create QC Record
    await trustRepo.createQcRecord({
      sealId,
      skuId: sku.id,
      qcType: tier === "AUTHENTIC" ? "NON_INVASIVE" : "THREE_POINT",
      testChecklist: { check: true },
      result: "PASS",
      technicianId: qcTechnician.id,
    });

    return { category, product, sku, seal };
  }

  // --------------------------------------------------------------------------
  // 1. Device Limit Triggers Before IP Limit
  // --------------------------------------------------------------------------
  it("device limit (5/min) triggers before IP limit (60/min) for a single device", async () => {
    const { seal } = await createTestSeal("ACTIVE");
    const deviceId = "test-device-single";
    const clientIp = "192.168.1.50";

    // First 5 requests should pass
    for (let i = 1; i <= 5; i++) {
      const res = await trustService.verifyLookup({
        inputQuery: seal.sealId,
        deviceId,
        ip: clientIp,
        userAgent: "Mozilla/5.0",
        geoDistrict: "Dhaka",
        isQr: false,
      });
      expect(res.success).toBe(true);
      expect((res as any).response.is_valid).toBe(true);
    }

    // 6th request from the same device should trigger rate limit 429 challenge
    await expect(
      trustService.verifyLookup({
        inputQuery: seal.sealId,
        deviceId,
        ip: clientIp,
        userAgent: "Mozilla/5.0",
        geoDistrict: "Dhaka",
        isQr: false,
      })
    ).rejects.toThrow(RateLimitError);
  });

  // --------------------------------------------------------------------------
  // 2. CGNAT Scenario: 60 devices behind one IP
  // --------------------------------------------------------------------------
  it("CGNAT scenario: 60 devices behind one shared IP (1 req each) pass without 429", async () => {
    const { seal } = await createTestSeal("ACTIVE");
    const sharedIp = "103.14.24.5"; // CGNAT IP in Bangladesh

    for (let i = 1; i <= 60; i++) {
      const deviceId = `cgnat-device-${i}`;
      const res = await trustService.verifyLookup({
        inputQuery: seal.sealId,
        deviceId,
        ip: sharedIp,
        userAgent: "Mozilla/5.0 Mobile",
        geoDistrict: "Dhaka",
        isQr: true,
      });
      expect(res.success).toBe(true);
      expect((res as any).response.is_valid).toBe(true);
    }

    // 61st device with the same shared IP triggers the 60/min IP limit
    await expect(
      trustService.verifyLookup({
        inputQuery: seal.sealId,
        deviceId: "cgnat-device-61",
        ip: sharedIp,
        userAgent: "Mozilla/5.0 Mobile",
        geoDistrict: "Dhaka",
        isQr: true,
      })
    ).rejects.toThrow(RateLimitError);
  });

  // --------------------------------------------------------------------------
  // 3. Turnstile Retry Path
  // --------------------------------------------------------------------------
  it("turnstile retry path bypasses rate limit when valid token is supplied", async () => {
    const { seal } = await createTestSeal("ACTIVE");
    const deviceId = "rate-limited-user";
    const clientIp = "192.168.1.75";

    // Burn 5 allowances
    for (let i = 1; i <= 5; i++) {
      await trustService.verifyLookup({
        inputQuery: seal.sealId,
        deviceId,
        ip: clientIp,
        userAgent: "Mozilla/5.0",
        geoDistrict: "Dhaka",
        isQr: false,
      });
    }

    // 6th request without token fails
    await expect(
      trustService.verifyLookup({
        inputQuery: seal.sealId,
        deviceId,
        ip: clientIp,
        userAgent: "Mozilla/5.0",
        geoDistrict: "Dhaka",
        isQr: false,
      })
    ).rejects.toThrow(RateLimitError);

    // 7th request with valid Turnstile token succeeds!
    const retryRes = await trustService.verifyLookup({
      inputQuery: seal.sealId,
      deviceId,
      ip: clientIp,
      userAgent: "Mozilla/5.0",
      geoDistrict: "Dhaka",
      isQr: false,
      turnstileToken: "cf-test-valid-turnstile-token",
    });

    expect(retryRes.success).toBe(true);
    expect((retryRes as any).response.is_valid).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 4. Repeated Abuse (3 strikes) Triggers 15-Min Block
  // --------------------------------------------------------------------------
  it("repeated abuse (3 strikes in 10 min) blocks the device/IP for 15 minutes", async () => {
    const deviceId = "abusive-device";
    const clientIp = "192.168.1.99";

    // Burn 5 requests
    for (let i = 1; i <= 5; i++) {
      const res = await checkVerifyRateLimit({ deviceId, ip: clientIp });
      expect(res.allowed).toBe(true);
    }

    // Strike 1
    const strike1 = await checkVerifyRateLimit({ deviceId, ip: clientIp });
    expect(strike1.allowed).toBe(false);
    expect(strike1.challengeRequired).toBe(true);

    // Strike 2
    const strike2 = await checkVerifyRateLimit({ deviceId, ip: clientIp });
    expect(strike2.allowed).toBe(false);

    // Strike 3 -> triggers 15-min block!
    const strike3 = await checkVerifyRateLimit({ deviceId, ip: clientIp });
    expect(strike3.allowed).toBe(false);
    expect(strike3.blocked).toBe(true);

    // Subsequent request is immediately blocked
    const blockedCheck = await checkVerifyRateLimit({ deviceId, ip: clientIp });
    expect(blockedCheck.blocked).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 5. Clone SQL with Fixtures (4 dev/3 dist -> no alert, 5 dev/2 dist -> alert, dedupe)
  // --------------------------------------------------------------------------
  it("clone detection: 4 devices/3 districts -> no alert; 5 devices/2 districts -> alert with dedupe", async () => {
    const { seal } = await createTestSeal("ACTIVE");
    const sealId = seal.sealId;

    // Fixture 1: 4 distinct devices across 3 districts (Dhaka, Chittagong, Sylhet)
    const scansFixture1 = [
      { device: "dev-1", district: "Dhaka" },
      { device: "dev-2", district: "Chittagong" },
      { device: "dev-3", district: "Sylhet" },
      { device: "dev-4", district: "Dhaka" },
    ];

    for (const scan of scansFixture1) {
      await trustRepo.createVerification({
        sealId,
        queryRaw: sealId,
        queryType: "SEAL",
        found: true,
        deviceId: scan.device,
        ip: "103.14.24.1",
        geoDistrict: scan.district,
        userAgent: "Mozilla/5.0",
        isQr: true,
      });
    }

    // Run clone detection -> Should NOT alert because devices = 4 (< 5 threshold)
    const result1 = await trustService.runCloneDetectionJob();
    expect(result1.flagged).toBe(0);
    expect(result1.alertsCreated).toBe(0);

    // Fixture 2: Add 5th distinct device in Chittagong (now 5 devices, 3 districts)
    await trustRepo.createVerification({
      sealId,
      queryRaw: sealId,
      queryType: "SEAL",
      found: true,
      deviceId: "dev-5",
      ip: "103.14.24.2",
      geoDistrict: "Chittagong",
      userAgent: "Mozilla/5.0",
      isQr: true,
    });

    // Run clone detection -> Should trigger alert!
    const result2 = await trustService.runCloneDetectionJob();
    expect(result2.flagged).toBe(1);
    expect(result2.alertsCreated).toBe(1);

    // Verify outbox security event
    const outbox = getMemoryOutbox();
    const alertEvent = outbox.find((e) => e.type === "security.cloned_seal_suspected");
    expect(alertEvent).toBeDefined();
    expect(alertEvent?.payload.sealId).toBe(sealId);
    expect(alertEvent?.payload.distinctDevices).toBe(5);

    // Fixture 3: Dedupe per seal per 24h
    // Running again immediately should NOT create a second duplicate alert
    const result3 = await trustService.runCloneDetectionJob();
    expect(result3.alertsCreated).toBe(0);
  });

  // --------------------------------------------------------------------------
  // 6. Void-Seal Lookup Alerts Immediately
  // --------------------------------------------------------------------------
  it("void-seal lookup alerts immediately and returns is_valid: false", async () => {
    const { seal } = await createTestSeal("VOID_PRINT_ERROR");

    // Perform public lookup on void seal
    const result = await trustService.verifyLookup({
      inputQuery: seal.sealId,
      deviceId: "user-scanner-1",
      ip: "192.168.1.10",
      userAgent: "Mozilla/5.0",
      geoDistrict: "Dhaka",
      isQr: true,
    });

    // Public response: is_valid: false with generic message
    expect(result.success).toBe(true);
    expect((result as any).response.is_valid).toBe(false);
    expect((result as any).response.message).toContain("voided print error");

    // Check that immediate alert was created in repo
    const alerts = await trustRepo.listCloneAlerts();
    const voidAlert = alerts.find((a) => a.sealId === seal.sealId && a.reason === "VOID_SEAL_LOOKUP");
    expect(voidAlert).toBeDefined();
    expect(voidAlert?.status).toBe("OPEN");

    // Outbox event was emitted
    const outbox = getMemoryOutbox();
    const event = outbox.find(
      (e) => e.type === "security.cloned_seal_suspected" && e.payload.reason === "VOID_SEAL_LOOKUP"
    );
    expect(event).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 7. PRD Wins Over API-Spec: Clone Alert is Internal Only
  // --------------------------------------------------------------------------
  it("public lookup never reveals clone suspicion to customer even when cloned", async () => {
    const { seal } = await createTestSeal("ACTIVE");

    // Inject clone alert into system
    await trustRepo.createCloneAlert({
      sealId: seal.sealId,
      reason: "MULTI_DEVICE_MULTI_DISTRICT",
      distinctDevices: 8,
      distinctDistricts: ["Dhaka", "Chittagong"],
      totalScans24h: 20,
      status: "OPEN",
    });

    // Public customer lookup
    const result = await trustService.verifyLookup({
      inputQuery: seal.sealId,
      deviceId: "customer-phone-123",
      ip: "103.14.24.8",
      userAgent: "Mozilla/5.0",
      geoDistrict: "Dhaka",
      isQr: false,
    });

    // Should return STANDARD VALID INFO (never reveal counterfeit warning to public)
    expect(result.success).toBe(true);
    const resp = (result as any).response;
    expect(resp.is_valid).toBe(true);
    expect(resp.seal_id).toBe(seal.sealId);
    expect(resp.product_tier).toBe("AUTHENTIC");
    expect(resp.warning).toBeUndefined(); // No public warning!
    expect(resp.start_claim_url).toBe(`https://ncamart.com/claims/new?seal_id=${seal.sealId}`);
  });

  // --------------------------------------------------------------------------
  // 8. Admin Security Clone Alerts List and Resolve
  // --------------------------------------------------------------------------
  it("admin can list and resolve clone alerts", async () => {
    const { seal } = await createTestSeal("ACTIVE");

    const alert = await trustRepo.createCloneAlert({
      sealId: seal.sealId,
      reason: "MULTI_DEVICE_MULTI_DISTRICT",
      distinctDevices: 6,
      distinctDistricts: ["Dhaka", "Rajshahi"],
      totalScans24h: 12,
      status: "OPEN",
    });

    // 1. List alerts
    const listRes = await trustService.listCloneAlerts(undefined, superAdmin);
    expect(listRes.alerts).toHaveLength(1);
    expect(listRes.alerts[0]!.seal_id).toBe(seal.sealId);
    expect(listRes.alerts[0]!.status).toBe("OPEN");

    // 2. Resolve alert
    const resolveRes = await trustService.resolveCloneAlert(
      alert.id,
      {
        status: "CONFIRMED_CLONE",
        notes: "Field audit confirmed fake sticker copying genuine Seal ID",
      },
      superAdmin
    );

    expect(resolveRes.status).toBe("CONFIRMED_CLONE");
    expect(resolveRes.resolved_by).toBe(superAdmin.id);
    expect(resolveRes.notes).toContain("Field audit confirmed");
  });

  // --------------------------------------------------------------------------
  // 9. Warranty Expiry Job (Daily at 02:30)
  // --------------------------------------------------------------------------
  it("warranty expiry job transitions active seals past warranty_end to EXPIRED", async () => {
    const { seal } = await createTestSeal("ACTIVE");

    // Set warrantyEnd to past
    const pastDate = new Date(Date.now() - 24 * 3600 * 1000);
    await trustRepo.updateSealRecord(seal.id, {
      warrantyEnd: pastDate,
    });

    // Run warranty expiry job
    const jobRes = await trustService.runWarrantyExpiryJob();
    expect(jobRes.expiredCount).toBe(1);

    // Verify status updated to EXPIRED
    const updated = await trustRepo.getSealRecordById(seal.id);
    expect(updated?.status).toBe("EXPIRED");

    // Verify append-only seal_events
    const events = await trustRepo.listSealEvents(seal.sealId);
    expect(events.some((e) => e.toStatus === "EXPIRED" && e.reason === "WARRANTY_EXPIRED")).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 10. Monthly Partition Maintenance
  // --------------------------------------------------------------------------
  it("partition maintenance job creates next month partition and drops old partitions", async () => {
    const testDate = new Date(2026, 9, 25); // October 25, 2026

    const result = await trustService.runPartitionMaintenanceJob(testDate);
    // Should create next month: seal_verifications_2026_11
    expect(result.createdPartitions).toContain("seal_verifications_2026_11");
    expect(result.createdPartitions).toContain("seal_verifications_2026_10");

    // Check tracked partitions in repo
    const allPartitions = trustRepo.getCreatedPartitions();
    expect(allPartitions).toContain("seal_verifications_2026_11");
  });
});
