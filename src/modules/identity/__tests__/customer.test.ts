import { describe, it, expect, beforeEach } from "vitest";
import { customerService, authService } from "../index";
import { codEligibility } from "@/modules/orders";
import { ValidationError, BusinessError } from "@/lib/errors";
import { clearMemoryOutboxForTesting, getMemoryOutbox } from "@/lib/outbox";
import { clearMemoryRateLimitsForTesting } from "@/lib/ratelimit";
import { withRoute } from "@/lib/http/route";
import { NextRequest } from "next/server";

describe("Customer Self-Service & Profile Management (P08)", () => {
  const customerPhone = "01711223344";
  let customerId = "";

  beforeEach(async () => {
    clearMemoryRateLimitsForTesting();
    customerService.clearMemoryCustomerDataForTesting();
    authService.clearMemoryAuthForTesting();
    clearMemoryOutboxForTesting();

    // Setup an active customer in authService
    await authService.sendOtp(customerPhone, "127.0.0.1");
    const outbox = getMemoryOutbox();
    const otp = (outbox[0]?.payload as { otp: string }).otp;
    const verifyRes = await authService.verifyOtp(customerPhone, otp);
    customerId = verifyRes.customer.id;
    clearMemoryOutboxForTesting();
  });

  describe("COD Eligibility Truth Table (architechture.md §9.3, PRD §3.6.2)", () => {
    it("evaluates 0 delivered / 0 RTO as ADVANCE_FEE_REQUIRED (first-time buyer)", () => {
      expect(
        codEligibility({ deliveredCount: 0, rtoCount12m: 0, codBlocked: false })
      ).toBe("ADVANCE_FEE_REQUIRED");
    });

    it("evaluates 1+ delivered / 0 RTO as FULL_COD (verified repeat buyer)", () => {
      expect(
        codEligibility({ deliveredCount: 1, rtoCount12m: 0, codBlocked: false })
      ).toBe("FULL_COD");
      expect(
        codEligibility({ deliveredCount: 5, rtoCount12m: 0, codBlocked: false })
      ).toBe("FULL_COD");
    });

    it("evaluates 3 delivered / 1 RTO as ADVANCE_FEE_REQUIRED (minor RTO, advance fee required)", () => {
      expect(
        codEligibility({ deliveredCount: 3, rtoCount12m: 1, codBlocked: false })
      ).toBe("ADVANCE_FEE_REQUIRED");
      expect(
        codEligibility({ deliveredCount: 0, rtoCount12m: 1, codBlocked: false })
      ).toBe("ADVANCE_FEE_REQUIRED");
    });

    it("evaluates x delivered / 2+ RTO as COD_BLOCKED (high-risk threshold)", () => {
      expect(
        codEligibility({ deliveredCount: 0, rtoCount12m: 2, codBlocked: false })
      ).toBe("COD_BLOCKED");
      expect(
        codEligibility({ deliveredCount: 10, rtoCount12m: 2, codBlocked: false })
      ).toBe("COD_BLOCKED");
      expect(
        codEligibility({ deliveredCount: 4, rtoCount12m: 3, codBlocked: false })
      ).toBe("COD_BLOCKED");
    });

    it("evaluates codBlocked = true as COD_BLOCKED regardless of order history", () => {
      expect(
        codEligibility({ deliveredCount: 20, rtoCount12m: 0, codBlocked: true })
      ).toBe("COD_BLOCKED");
      expect(
        codEligibility({ deliveredCount: 0, rtoCount12m: 0, codBlocked: true })
      ).toBe("COD_BLOCKED");
    });
  });

  describe("Customer Profile & Risk Profile", () => {
    it("fetches customer profile with risk summary and 0 store credit balance", async () => {
      const profile = await customerService.getProfile(customerId);

      expect(profile.id).toBe(customerId);
      expect(profile.phone).toBe("+8801711223344");
      expect(profile.store_credit_balance_paisa).toBe(0);
      expect(profile.preferred_locale).toBe("bn");
      expect(profile.marketing_opt_in).toBe(false);
      expect(profile.risk_profile.delivered_orders_count).toBe(0);
      expect(profile.risk_profile.rto_count_12m).toBe(0);
      expect(profile.risk_profile.cod_eligibility).toBe("ADVANCE_FEE_REQUIRED");
      expect(profile.risk_profile.cod_eligible_100_percent).toBe(false);
      expect(profile.risk_profile.is_cod_blacklisted).toBe(false);
    });

    it("updates full name, locale, and marketing opt-in", async () => {
      const updated = await customerService.updateProfile(customerId, {
        full_name: "Rahim Ahmed",
        preferred_locale: "en",
        marketing_opt_in: true,
      });

      expect(updated.full_name).toBe("Rahim Ahmed");
      expect(updated.preferred_locale).toBe("en");
      expect(updated.marketing_opt_in).toBe(true);
    });

    it("requires email verification when updating email address", async () => {
      const updated = await customerService.updateProfile(customerId, {
        email: "rahim@example.com",
      });

      expect(updated.email).toBe("rahim@example.com");
      expect(updated.email_verified).toBe(false);

      // Verify outbox event emitted with verification code
      const outbox = getMemoryOutbox();
      expect(outbox).toHaveLength(1);
      expect(outbox[0]?.type).toBe("customer.email_verification_requested");
      const code = (outbox[0]?.payload as { code: string }).code;
      expect(code).toHaveLength(6);

      // Verify email with wrong code fails
      await expect(customerService.verifyEmail(customerId, "000000")).rejects.toThrow(
        BusinessError
      );

      // Verify email with correct code succeeds
      const verifyRes = await customerService.verifyEmail(customerId, code);
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.email_verified).toBe(true);

      const profileAfter = await customerService.getProfile(customerId);
      expect(profileAfter.email_verified).toBe(true);
    });
  });

  describe("Customer Address Book & Geo Hierarchy Validation", () => {
    it("validates geographical hierarchy and creates address with is_inside_dhaka = true", async () => {
      // Kotwali / Nawabpur (thana 101) belongs to Dhaka (district 1, division 1)
      const addr = await customerService.createAddress(customerId, {
        label: "HOME",
        consignee_name: "Rahim Ahmed",
        contact_phone: "01711223344",
        division_id: "1",
        district_id: "1",
        thana_id: "101",
        address_line: "14 Nawabpur Road, Nawabpur Tower",
      });

      expect(addr.id).toBeDefined();
      expect(addr.is_inside_dhaka).toBe(true);
      expect(addr.is_default).toBe(true); // First address is automatically default
      expect(addr.consignee_name).toBe("Rahim Ahmed");
    });

    it("rejects address creation when thana does not belong to the specified district", async () => {
      // Thana 101 (Nawabpur, Dhaka) does NOT belong to District 2 (Gazipur)
      await expect(
        customerService.createAddress(customerId, {
          label: "OFFICE",
          district_id: "2",
          thana_id: "101",
          address_line: "Gazipur Bypass Road",
        })
      ).rejects.toThrow(ValidationError);
    });

    it("handles default address switching properly", async () => {
      // 1. Create first address (becomes default)
      const addr1 = await customerService.createAddress(customerId, {
        label: "HOME",
        district_id: "1",
        thana_id: "101",
        address_line: "House 1, Nawabpur",
      });
      expect(addr1.is_default).toBe(true);

      // 2. Create second address with is_default = true (switches default)
      const addr2 = await customerService.createAddress(customerId, {
        label: "OFFICE",
        district_id: "1",
        thana_id: "102", // Dhanmondi
        address_line: "House 42, Road 7/A, Dhanmondi",
        is_default: true,
      });
      expect(addr2.is_default).toBe(true);

      // Verify addr1 is no longer default
      const addresses = await customerService.listAddresses(customerId);
      const fetchedAddr1 = addresses.find((a) => a.id === addr1.id);
      const fetchedAddr2 = addresses.find((a) => a.id === addr2.id);
      expect(fetchedAddr1?.is_default).toBe(false);
      expect(fetchedAddr2?.is_default).toBe(true);

      // 3. Switch default back to addr1 using setDefaultAddress
      const switched = await customerService.setDefaultAddress(customerId, addr1.id);
      expect(switched.is_default).toBe(true);

      const refreshed = await customerService.listAddresses(customerId);
      expect(refreshed.find((a) => a.id === addr1.id)?.is_default).toBe(true);
      expect(refreshed.find((a) => a.id === addr2.id)?.is_default).toBe(false);
    });

    it("soft deletes address", async () => {
      const addr = await customerService.createAddress(customerId, {
        label: "OTHER",
        district_id: "1",
        thana_id: "103", // Gulshan
        address_line: "Gulshan Avenue, Circle 2",
      });

      await customerService.deleteAddress(customerId, addr.id);

      const list = await customerService.listAddresses(customerId);
      expect(list.some((a) => a.id === addr.id)).toBe(false);
    });
  });

  describe("Customer Warranties Portal Stub", () => {
    it("returns empty active warranties list with expected schema shape", async () => {
      const res = await customerService.getWarranties(customerId);
      expect(res.active_warranties).toEqual([]);
    });
  });

  describe("Dormant / Unconfirmed Session Protection", () => {
    it("blocks access and returns 403 ERR_OWNERSHIP_UNCONFIRMED when session is unconfirmed", async () => {
      const req = new NextRequest("http://localhost:3000/api/v1/customer/profile");

      // Custom mock resolver simulating an unconfirmed session
      const unconfirmedActor = {
        id: customerId,
        type: "customer" as const,
        ownershipUnconfirmed: true,
      };

      const customHandler = withRoute(
        {
          auth: "customer",
          actorResolver: {
            resolve: async () => unconfirmedActor,
          },
        },
        async () => new Response("OK")
      );

      const res = await customHandler(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe("ERR_OWNERSHIP_UNCONFIRMED");
    });
  });
});
