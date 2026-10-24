export interface GeoDivisionDto {
  id: string;
  nameEn: string;
  nameBn: string;
}

export interface GeoDistrictDto {
  id: string;
  divisionId: string;
  nameEn: string;
  nameBn: string;
}

export interface GeoThanaDto {
  id: string;
  districtId: string;
  nameEn: string;
  nameBn: string;
  isInsideDhaka: boolean;
}

export interface GeoAreaDto {
  id: string;
  thanaId: string;
  nameEn: string;
  nameBn: string;
  postalCode?: string | null;
}

export interface CustomerRiskProfileDto {
  delivered_orders_count: number;
  rto_count_12m: number;
  is_cod_blacklisted: boolean;
  cod_eligible_100_percent: boolean;
  cod_eligibility: "FULL_COD" | "ADVANCE_FEE_REQUIRED" | "COD_BLOCKED";
}

export interface CustomerProfileDto {
  id: string;
  phone: string;
  full_name: string | null;
  email: string | null;
  email_verified: boolean;
  preferred_locale: "bn" | "en";
  marketing_opt_in: boolean;
  store_credit_balance_paisa: number;
  risk_profile: CustomerRiskProfileDto;
}

export interface UpdateCustomerProfileDto {
  full_name?: string | null;
  email?: string | null;
  preferred_locale?: "bn" | "en";
  marketing_opt_in?: boolean;
}

export interface CustomerAddressDto {
  id: string;
  label: "HOME" | "OFFICE" | "OTHER";
  consignee_name: string;
  contact_phone: string;
  division_id: string;
  district_id: string;
  thana_id: string;
  area_id?: string | null;
  address_line: string;
  is_default: boolean;
  is_inside_dhaka: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerAddressDto {
  label?: "HOME" | "OFFICE" | "OTHER";
  consignee_name?: string;
  contact_phone?: string;
  division_id?: string;
  district_id: string;
  thana_id: string;
  area_id?: string | null;
  address_line: string;
  is_default?: boolean;
}

export interface UpdateCustomerAddressDto {
  label?: "HOME" | "OFFICE" | "OTHER";
  consignee_name?: string;
  contact_phone?: string;
  division_id?: string;
  district_id?: string;
  thana_id?: string;
  area_id?: string | null;
  address_line?: string;
  is_default?: boolean;
}

export interface CustomerWarrantyDto {
  seal_id: string;
  product_title_en: string;
  product_tier: "AUTHENTIC" | "BUDGET_SMART";
  warranty_days_total: number;
  warranty_start: string;
  warranty_end: string;
  days_remaining: number;
  status: "ACTIVE" | "EXPIRED" | "CLAIMED" | "VOID";
}

export interface CustomerWarrantiesResponseDto {
  active_warranties: CustomerWarrantyDto[];
}
