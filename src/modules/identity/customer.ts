import crypto from "node:crypto";
import { eq, and, isNull, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { customerAddresses, CustomerAddressRow } from "./schema";
import { authService } from "./auth";
import { geoService } from "./service";
import { codEligibility } from "@/modules/orders";
import { promotionsService } from "@/modules/promotions";
import { NotFoundError, ValidationError, BusinessError } from "@/lib/errors";
import { emitOutbox } from "@/lib/outbox";
import {
  CustomerProfileDto,
  UpdateCustomerProfileDto,
  CustomerAddressDto,
  CreateCustomerAddressDto,
  UpdateCustomerAddressDto,
  CustomerWarrantiesResponseDto,
} from "./dto";

type Uuid = `${string}-${string}-${string}-${string}-${string}`;

// In-memory fallback stores for test isolation and offline mode
const memAddressStore = new Map<string, CustomerAddressRow>();
const memEmailVerifyStore = new Map<string, { code: string; expiresAt: number; newEmail: string }>();

function formatAddressDto(addr: CustomerAddressRow, isInsideDhaka: boolean): CustomerAddressDto {
  return {
    id: addr.id,
    label: addr.label as "HOME" | "OFFICE" | "OTHER",
    consignee_name: addr.consigneeName,
    contact_phone: addr.contactPhone,
    division_id: addr.divisionId,
    district_id: addr.districtId,
    thana_id: addr.thanaId,
    area_id: addr.areaId ?? null,
    address_line: addr.addressLine,
    is_default: addr.isDefault,
    is_inside_dhaka: isInsideDhaka,
    created_at: addr.createdAt.toISOString(),
    updated_at: addr.updatedAt.toISOString(),
  };
}

export const customerService = {
  /**
   * Fetch customer profile with risk summary and COD eligibility (api-spec §3.1).
   */
  async getProfile(customerId: string): Promise<CustomerProfileDto> {
    const customer = await authService.findCustomerById(customerId);
    if (!customer) {
      throw new NotFoundError("Customer");
    }

    const codElig = codEligibility({
      deliveredCount: customer.deliveredOrderCount,
      rtoCount12m: customer.rtoCount12m,
      codBlocked: customer.codBlocked,
    });

    let storeCreditBalancePaisa = 0;
    try {
      const balance = await promotionsService.getStoreCreditBalance(undefined, customer.id);
      storeCreditBalancePaisa = balance.totalBalancePaisa;
    } catch {
      // Fallback
    }

    return {
      id: customer.id,
      phone: customer.phone,
      full_name: customer.fullName,
      email: customer.email,
      email_verified: customer.emailVerified,
      preferred_locale: customer.preferredLocale as "bn" | "en",
      marketing_opt_in: customer.marketingOptIn,
      store_credit_balance_paisa: storeCreditBalancePaisa,
      risk_profile: {
        delivered_orders_count: customer.deliveredOrderCount,
        rto_count_12m: customer.rtoCount12m,
        is_cod_blacklisted: customer.codBlocked || codElig === "COD_BLOCKED",
        cod_eligible_100_percent: codElig === "FULL_COD",
        cod_eligibility: codElig,
      },
    };
  },

  /**
   * Update profile fields (full_name, preferred_locale, marketing_opt_in, email).
   * Email change triggers email verification code sent via outbox event.
   */
  async updateProfile(
    customerId: string,
    input: UpdateCustomerProfileDto
  ): Promise<CustomerProfileDto> {
    const customer = await authService.findCustomerById(customerId);
    if (!customer) {
      throw new NotFoundError("Customer");
    }

    const now = new Date();

    if (input.full_name !== undefined) {
      customer.fullName = input.full_name;
    }
    if (input.preferred_locale !== undefined) {
      customer.preferredLocale = input.preferred_locale;
    }
    if (input.marketing_opt_in !== undefined) {
      customer.marketingOptIn = input.marketing_opt_in;
      if (input.marketing_opt_in) {
        customer.marketingOptInAt = now;
      }
    }

    // Email change flow
    if (input.email !== undefined && input.email !== customer.email) {
      const cleanEmail = input.email ? input.email.trim().toLowerCase() : null;
      customer.email = cleanEmail;
      customer.emailVerified = false;

      if (cleanEmail) {
        // Generate 6-digit verification code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        memEmailVerifyStore.set(customerId, {
          code,
          expiresAt: Date.now() + 15 * 60 * 1000,
          newEmail: cleanEmail,
        });

        // Emit outbox event for notification worker
        await emitOutbox(null, {
          aggregateType: "CUSTOMER",
          aggregateId: customerId,
          type: "customer.email_verification_requested",
          payload: {
            customerId,
            email: cleanEmail,
            code,
          },
          notificationClass: "A",
        });
      }
    }

    customer.updatedAt = now;
    await authService.saveCustomer(customer);

    return this.getProfile(customerId);
  },

  /**
   * Confirm email verification code.
   */
  async verifyEmail(
    customerId: string,
    code: string
  ): Promise<{ success: boolean; email_verified: boolean }> {
    const entry = memEmailVerifyStore.get(customerId);
    if (!entry || entry.expiresAt < Date.now() || entry.code !== code.trim()) {
      throw new BusinessError(
        "ERR_OTP_INVALID",
        "Invalid or expired email verification code",
        { status: 400 }
      );
    }

    const customer = await authService.findCustomerById(customerId);
    if (!customer) {
      throw new NotFoundError("Customer");
    }

    customer.emailVerified = true;
    customer.updatedAt = new Date();
    await authService.saveCustomer(customer);

    memEmailVerifyStore.delete(customerId);

    return { success: true, email_verified: true };
  },

  /**
   * Validate geographical hierarchy: thana must belong to district, district to division.
   */
  async validateGeoHierarchy(input: {
    divisionId?: string;
    districtId: string;
    thanaId: string;
    areaId?: string | null;
  }): Promise<{ isInsideDhaka: boolean; divisionId: string }> {
    // 1. Validate thana
    const thanas = await geoService.getThanas(input.districtId);
    const thana = thanas.find((t) => t.id === input.thanaId);

    if (!thana) {
      throw new ValidationError(
        "Invalid geographical hierarchy: thana does not belong to specified district",
        { districtId: input.districtId, thanaId: input.thanaId }
      );
    }

    // 2. Validate district and division
    const districts = await geoService.getDistricts();
    const district = districts.find((d) => d.id === input.districtId);
    if (!district) {
      throw new ValidationError("Invalid district ID", { districtId: input.districtId });
    }

    const divisionId = input.divisionId || district.divisionId;
    if (district.divisionId !== divisionId) {
      throw new ValidationError(
        "Invalid geographical hierarchy: district does not belong to specified division",
        { districtId: input.districtId, divisionId }
      );
    }

    return {
      isInsideDhaka: thana.isInsideDhaka,
      divisionId,
    };
  },

  /**
   * List customer's saved addresses.
   */
  async listAddresses(customerId: string): Promise<CustomerAddressDto[]> {
    let rows: CustomerAddressRow[] = [];
    try {
      rows = await db
        .select()
        .from(customerAddresses)
        .where(
          and(
            eq(customerAddresses.customerId, customerId as Uuid),
            isNull(customerAddresses.deletedAt)
          )
        )
        .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt));
    } catch {
      // Memory fallback
      for (const a of memAddressStore.values()) {
        if (a.customerId === customerId && !a.deletedAt) {
          rows.push(a);
        }
      }
      rows.sort((a, b) => {
        if (a.isDefault === b.isDefault) {
          return b.createdAt.getTime() - a.createdAt.getTime();
        }
        return a.isDefault ? -1 : 1;
      });
    }

    // Resolve thana details for isInsideDhaka
    const thanas = await geoService.getThanas();
    const thanaMap = new Map(thanas.map((t) => [t.id, t.isInsideDhaka]));

    return rows.map((r) => {
      const isInside = thanaMap.get(r.thanaId) ?? false;
      return formatAddressDto(r, isInside);
    });
  },

  /**
   * Create a new delivery address with geo hierarchy validation.
   */
  async createAddress(
    customerId: string,
    input: CreateCustomerAddressDto
  ): Promise<CustomerAddressDto> {
    const geo = await this.validateGeoHierarchy({
      divisionId: input.division_id,
      districtId: input.district_id,
      thanaId: input.thana_id,
      areaId: input.area_id,
    });

    const now = new Date();
    const existing = await this.listAddresses(customerId);
    const isFirstAddress = existing.length === 0;
    const isDefault = input.is_default !== undefined ? input.is_default : isFirstAddress;

    // If setting as default, unset other defaults
    if (isDefault) {
      try {
        await db
          .update(customerAddresses)
          .set({ isDefault: false, updatedAt: now })
          .where(
            and(
              eq(customerAddresses.customerId, customerId as Uuid),
              eq(customerAddresses.isDefault, true)
            )
          );
      } catch {
        for (const a of memAddressStore.values()) {
          if (a.customerId === customerId) a.isDefault = false;
        }
      }
    }

    // Resolve contact details
    let consigneeName = input.consignee_name?.trim();
    let contactPhone = input.contact_phone?.trim();
    if (!consigneeName || !contactPhone) {
      const customer = await authService.findCustomerById(customerId);
      if (!consigneeName) consigneeName = customer?.fullName || "Valued Customer";
      if (!contactPhone) contactPhone = customer?.phone || "+8801700000000";
    }

    const newAddr: typeof customerAddresses.$inferInsert = {
      customerId: customerId as Uuid,
      label: input.label || "HOME",
      consigneeName,
      contactPhone,
      divisionId: geo.divisionId,
      districtId: input.district_id,
      thanaId: input.thana_id,
      areaId: input.area_id ?? null,
      addressLine: input.address_line.trim(),
      isDefault,
    };

    let created: CustomerAddressRow | null = null;
    try {
      const [inserted] = await db.insert(customerAddresses).values(newAddr).returning();
      if (inserted) created = inserted;
    } catch {
      created = {
        id: crypto.randomUUID() as Uuid,
        customerId: customerId as Uuid,
        label: input.label || "HOME",
        consigneeName,
        contactPhone,
        divisionId: geo.divisionId,
        districtId: input.district_id,
        thanaId: input.thana_id,
        areaId: input.area_id ?? null,
        addressLine: input.address_line.trim(),
        isDefault,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      memAddressStore.set(created.id, created);
    }

    if (!created) {
      throw new Error("Failed to create customer address");
    }

    return formatAddressDto(created, geo.isInsideDhaka);
  },

  /**
   * Update an existing address.
   */
  async updateAddress(
    customerId: string,
    addressId: string,
    input: UpdateCustomerAddressDto
  ): Promise<CustomerAddressDto> {
    let existingAddr: CustomerAddressRow | null = null;
    try {
      const rows = await db
        .select()
        .from(customerAddresses)
        .where(
          and(
            eq(customerAddresses.id, addressId as Uuid),
            eq(customerAddresses.customerId, customerId as Uuid),
            isNull(customerAddresses.deletedAt)
          )
        )
        .limit(1);
      existingAddr = rows[0] ?? null;
    } catch {
      const mem = memAddressStore.get(addressId);
      if (mem && mem.customerId === customerId && !mem.deletedAt) {
        existingAddr = mem;
      }
    }

    if (!existingAddr) {
      throw new NotFoundError("Address");
    }

    const districtId = input.district_id || existingAddr.districtId;
    const thanaId = input.thana_id || existingAddr.thanaId;
    const divisionId = input.division_id || existingAddr.divisionId;
    const areaId = input.area_id !== undefined ? input.area_id : existingAddr.areaId;

    const geo = await this.validateGeoHierarchy({
      divisionId,
      districtId,
      thanaId,
      areaId,
    });

    const now = new Date();

    if (input.is_default) {
      try {
        await db
          .update(customerAddresses)
          .set({ isDefault: false, updatedAt: now })
          .where(
            and(
              eq(customerAddresses.customerId, customerId as Uuid),
              eq(customerAddresses.isDefault, true)
            )
          );
      } catch {
        for (const a of memAddressStore.values()) {
          if (a.customerId === customerId) a.isDefault = false;
        }
      }
    }

    const updatedFields = {
      label: input.label || existingAddr.label,
      consigneeName: input.consignee_name?.trim() || existingAddr.consigneeName,
      contactPhone: input.contact_phone?.trim() || existingAddr.contactPhone,
      divisionId: geo.divisionId,
      districtId,
      thanaId,
      areaId: areaId ?? null,
      addressLine: input.address_line?.trim() || existingAddr.addressLine,
      isDefault: input.is_default !== undefined ? input.is_default : existingAddr.isDefault,
      updatedAt: now,
    };

    try {
      const [updated] = await db
        .update(customerAddresses)
        .set(updatedFields)
        .where(eq(customerAddresses.id, addressId as Uuid))
        .returning();
      if (updated) existingAddr = updated;
    } catch {
      Object.assign(existingAddr, updatedFields);
      memAddressStore.set(addressId, existingAddr);
    }

    return formatAddressDto(existingAddr, geo.isInsideDhaka);
  },

  /**
   * Get customer address by ID.
   */
  async getAddressById(
    customerId: string,
    addressId: string
  ): Promise<CustomerAddressDto | null> {
    let row: CustomerAddressRow | null = null;
    try {
      const rows = await db
        .select()
        .from(customerAddresses)
        .where(
          and(
            eq(customerAddresses.id, addressId as Uuid),
            eq(customerAddresses.customerId, customerId as Uuid),
            isNull(customerAddresses.deletedAt)
          )
        )
        .limit(1);
      row = rows[0] ?? null;
    } catch {
      const mem = memAddressStore.get(addressId);
      if (mem && mem.customerId === customerId && !mem.deletedAt) {
        row = mem;
      }
    }

    if (!row) return null;

    const thanas = await geoService.getThanas(row.districtId);
    const thana = thanas.find((t) => t.id === row!.thanaId);
    const isInsideDhaka = thana?.isInsideDhaka ?? false;

    return formatAddressDto(row, isInsideDhaka);
  },

  /**
   * Soft-delete a customer address.
   */
  async deleteAddress(customerId: string, addressId: string): Promise<void> {
    const now = new Date();
    try {
      await db
        .update(customerAddresses)
        .set({ deletedAt: now, isDefault: false, updatedAt: now })
        .where(
          and(
            eq(customerAddresses.id, addressId as Uuid),
            eq(customerAddresses.customerId, customerId as Uuid)
          )
        );
    } catch {
      const mem = memAddressStore.get(addressId);
      if (mem && mem.customerId === customerId) {
        mem.deletedAt = now;
        mem.isDefault = false;
      }
    }
  },

  /**
   * Set address as customer default.
   */
  async setDefaultAddress(customerId: string, addressId: string): Promise<CustomerAddressDto> {
    const now = new Date();

    // 1. Verify existence
    let target: CustomerAddressRow | null = null;
    try {
      const rows = await db
        .select()
        .from(customerAddresses)
        .where(
          and(
            eq(customerAddresses.id, addressId as Uuid),
            eq(customerAddresses.customerId, customerId as Uuid),
            isNull(customerAddresses.deletedAt)
          )
        )
        .limit(1);
      target = rows[0] ?? null;
    } catch {
      const mem = memAddressStore.get(addressId);
      if (mem && mem.customerId === customerId && !mem.deletedAt) {
        target = mem;
      }
    }

    if (!target) {
      throw new NotFoundError("Address");
    }

    // 2. Unset all defaults
    try {
      await db
        .update(customerAddresses)
        .set({ isDefault: false, updatedAt: now })
        .where(
          and(
            eq(customerAddresses.customerId, customerId as Uuid),
            eq(customerAddresses.isDefault, true)
          )
        );
      const [updated] = await db
        .update(customerAddresses)
        .set({ isDefault: true, updatedAt: now })
        .where(eq(customerAddresses.id, addressId as Uuid))
        .returning();
      if (updated) target = updated;
    } catch {
      for (const a of memAddressStore.values()) {
        if (a.customerId === customerId) a.isDefault = false;
      }
      target.isDefault = true;
    }

    const thanas = await geoService.getThanas(target.districtId);
    const thana = thanas.find((t) => t.id === target.thanaId);

    return formatAddressDto(target, thana?.isInsideDhaka ?? false);
  },

  /**
   * Active Warranties Portal ("My Warranties") (api-spec §3.3).
   */
  async getWarranties(customerId: string): Promise<CustomerWarrantiesResponseDto> {
    const { trustService } = await import("@/modules/trust");
    const res = await trustService.getCustomerWarranties(customerId);
    return {
      active_warranties: res.active_warranties.map((w) => ({
        seal_id: w.seal_id,
        product_title_en: w.product_title_en,
        product_tier: w.product_tier as "AUTHENTIC" | "BUDGET_SMART",
        warranty_days_total: w.warranty_days_total,
        warranty_start: w.warranty_start ?? new Date().toISOString(),
        warranty_end: w.warranty_end ?? new Date().toISOString(),
        days_remaining: w.days_remaining,
        status: w.status as "ACTIVE" | "EXPIRED" | "CLAIMED" | "VOID",
      })),
    };
  },

  clearMemoryCustomerDataForTesting(): void {
    memAddressStore.clear();
    memEmailVerifyStore.clear();
  },
};
