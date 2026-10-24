export type AvailabilityStatus =
  | "IN_STOCK"
  | "AVAILABLE"
  | "OUT_OF_STOCK"
  | "PRE_ORDER";

export interface SkuAvailabilityResult {
  status: "IN_STOCK" | "AVAILABLE" | "OUT_OF_STOCK";
  physicalQty: number;
}

export interface FormattedAvailabilityLabel {
  code: AvailabilityStatus;
  label_en: string;
  label_bn: string;
}

// In-memory mock overrides for testing & initial availability before P14
const mockAvailabilityStore = new Map<string, SkuAvailabilityResult>();

export function setMockSkuAvailability(
  skuId: string,
  result: SkuAvailabilityResult
): void {
  mockAvailabilityStore.set(skuId, result);
}

export function clearMockSkuAvailability(): void {
  mockAvailabilityStore.clear();
}

/**
 * Pure function formatting availability labels according to PRD §3.11.4:
 * - IN_STOCK: "In stock — ships today" / "স্টকে আছে — আজই ডেলিভারি"
 * - AVAILABLE: "Available — ships within 24h" / "সংগ্রহযোগ্য — ২৪ ঘণ্টার মধ্যে ডেলিভারি"
 * - OUT_OF_STOCK: "Out of stock" / "স্টক শেষ"
 * - PRE_ORDER: "Pre-order" / "প্রি-অর্ডার"
 */
export function formatAvailabilityLabel(
  status: AvailabilityStatus
): FormattedAvailabilityLabel {
  switch (status) {
    case "IN_STOCK":
      return {
        code: "IN_STOCK",
        label_en: "In stock — ships today",
        label_bn: "স্টকে আছে — আজই ডেলিভারি",
      };
    case "AVAILABLE":
      return {
        code: "AVAILABLE",
        label_en: "Available — ships within 24h",
        label_bn: "সংগ্রহযোগ্য — ২৪ ঘণ্টার মধ্যে ডেলিভারি",
      };
    case "OUT_OF_STOCK":
      return {
        code: "OUT_OF_STOCK",
        label_en: "Out of stock",
        label_bn: "স্টক শেষ",
      };
    case "PRE_ORDER":
      return {
        code: "PRE_ORDER",
        label_en: "Pre-order",
        label_bn: "প্রি-অর্ডার",
      };
  }
}

/**
 * Availability Service (interface for P11, backed by P14 physical inventory).
 * Defaults to IN_STOCK with quantity 10 for standard SKUs unless mocked.
 */
export async function getSkuAvailability(
  skuIds: string[]
): Promise<Record<string, SkuAvailabilityResult>> {
  const result: Record<string, SkuAvailabilityResult> = {};

  for (const skuId of skuIds) {
    const mock = mockAvailabilityStore.get(skuId);
    if (mock) {
      result[skuId] = mock;
    } else {
      // Default placeholder until P14 inventory engine
      result[skuId] = {
        status: "IN_STOCK",
        physicalQty: 10,
      };
    }
  }

  return result;
}

export const availabilityService = {
  getSkuAvailability,
  formatAvailabilityLabel,
  setMockSkuAvailability,
  clearMockSkuAvailability,
};
