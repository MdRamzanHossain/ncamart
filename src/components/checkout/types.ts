/**
 * NCAMart — Checkout Component Types
 * PRD §3.6, §3.7, §3.11, §3.14, F15
 */
export interface CustomerIdentity {
  phone: string;
  name?: string;
  email?: string;
  isAuthenticated: boolean;
  isExistingAccount?: boolean;
}

export interface ShippingAddressData {
  recipientName: string;
  phone: string;
  alternatePhone?: string;
  divisionId: string;
  divisionName: string;
  districtId: string;
  districtName: string;
  thanaId: string;
  thanaName: string;
  streetAddress: string;
  landmark?: string;
  isPickupCounter: boolean;
}

export interface CorporateInvoiceData {
  isCorporateRequested: boolean;
  companyName: string;
  binNumber: string; // 11-digit BIN
}

export interface AppliedCoupon {
  code: string;
  discountPaisa: number;
  description?: string;
}

export interface CheckoutPricingSummary {
  subtotalPaisa: number;
  deliveryFeePaisa: number;
  vatIncludedPaisa: number;
  couponDiscountPaisa: number;
  storeCreditPaisa: number;
  totalPaisa: number;
}
