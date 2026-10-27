export type DefectCategory =
  | "DEAD_ON_ARRIVAL"
  | "OVERHEATING"
  | "PORT_LOOSE"
  | "NO_POWER"
  | "SPEC_MISMATCH"
  | "OTHER";

export type WarrantyCoverageType =
  | "OFFICIAL_DISTRIBUTOR_18_MONTH"
  | "NCAMART_6_MONTH_REPLACEMENT"
  | "OFFICIAL_12_MONTH";

export interface ActiveWarranty {
  id: string;
  orderNumber: string;
  sealId: string;
  productTitleEn: string;
  productTitleBn: string;
  brandName: string;
  serialNumber: string;
  deliveredAt: string;
  expiresAt: string;
  warrantyDaysTotal: number;
  coverageType: WarrantyCoverageType;
  coverageLabel: string;
  imageUrl?: string;
  status: "ACTIVE" | "EXPIRED" | "CLAIM_PENDING";
}

export interface RmaSubmissionPayload {
  warrantyId: string;
  sealId: string;
  defectCategory: DefectCategory;
  defectDescription: string;
  sealPhotoFile?: File | null;
  sealPhotoUrl?: string;
  demoVideoFile?: File | null;
  demoVideoUrl?: string;
  preferredResolution: "REPLACEMENT_UNIT" | "STORE_CREDIT_REFUND";
  contactPhone: string;
  pickupAddress: string;
}

export function calculateRemainingDays(expiresAt: string): {
  days: number;
  isExpired: boolean;
} {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) {
    return { days: 0, isExpired: true };
  }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    isExpired: false,
  };
}
