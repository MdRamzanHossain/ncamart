import { maskPhone } from "@/lib/phone";
import { recordAudit } from "@/modules/audit";
import { Actor } from "@/lib/http/route";

export interface CustomerRawData {
  id: string;
  fullName: string | null;
  phone: string;
  email: string | null;
  addressLine?: string | null;
  thanaName?: string | null;
  districtName?: string | null;
  divisionName?: string | null;
  bin?: string | null;
  invoiceNo?: string | null;
}

/** Full PII representation for Support Agents and Super Admins */
export interface FullCustomerDto {
  id: string;
  fullName: string | null;
  phone: string;
  email: string | null;
  addressLine: string | null;
  thanaName: string | null;
  districtName: string | null;
  divisionName: string | null;
  bin: string | null;
  invoiceNo: string | null;
}

/** Shipping PII representation for Dispatch Staff (delivery label printing) */
export interface ShippingCustomerDto {
  id: string;
  consigneeName: string | null;
  contactPhone: string;
  addressLine: string | null;
  thanaName: string | null;
  districtName: string | null;
  divisionName: string | null;
}

/** Counter PII representation for POS Showroom Staff (pickup verification) */
export interface CounterCustomerDto {
  id: string;
  consigneeName: string | null;
  maskedPhone: string;
}

/** Billing PII representation for Finance Officers (Mushak 6.3 VAT tax invoices) */
export interface BillingCustomerDto {
  id: string;
  customerName: string | null;
  bin: string | null;
  invoiceNo: string | null;
}

/** Masked representation for Runners, QC Technicians, and Sourcing Managers (ZERO PII) */
export interface MaskedCustomerDto {
  id: string;
}

export const piiSerializers = {
  /**
   * Serialize FULL PII for Support and Super Admin.
   * Emits an audit log entry documenting staff access to sensitive customer PII.
   */
  async toFull(
    data: CustomerRawData,
    actor: Actor,
    reason = "SUPPORT_CUSTOMER_LOOKUP"
  ): Promise<FullCustomerDto> {
    await recordAudit(null, {
      staffId: actor.id,
      actorType: "STAFF",
      action: "pii.read",
      entityType: "CUSTOMER",
      entityId: data.id,
      afterState: { reason },
    });

    return {
      id: data.id,
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      addressLine: data.addressLine ?? null,
      thanaName: data.thanaName ?? null,
      districtName: data.districtName ?? null,
      divisionName: data.divisionName ?? null,
      bin: data.bin ?? null,
      invoiceNo: data.invoiceNo ?? null,
    };
  },

  /**
   * Serialize SHIPPING PII for parcel dispatch handover.
   */
  toShipping(data: CustomerRawData): ShippingCustomerDto {
    return {
      id: data.id,
      consigneeName: data.fullName,
      contactPhone: data.phone,
      addressLine: data.addressLine ?? null,
      thanaName: data.thanaName ?? null,
      districtName: data.districtName ?? null,
      divisionName: data.divisionName ?? null,
    };
  },

  /**
   * Serialize COUNTER PII for showroom counter pickups (masked phone).
   */
  toCounter(data: CustomerRawData): CounterCustomerDto {
    return {
      id: data.id,
      consigneeName: data.fullName,
      maskedPhone: maskPhone(data.phone),
    };
  },

  /**
   * Serialize BILLING PII for accounting, invoices, and Mushak returns.
   */
  toBilling(data: CustomerRawData): BillingCustomerDto {
    return {
      id: data.id,
      customerName: data.fullName,
      bin: data.bin ?? null,
      invoiceNo: data.invoiceNo ?? null,
    };
  },

  /**
   * Serialize MASKED representation for field runners and QC technicians.
   * Structurally prevents customer PII from leaking to warehouse and field personnel.
   */
  toMasked(data: CustomerRawData): MaskedCustomerDto {
    return {
      id: data.id,
    };
  },
};
