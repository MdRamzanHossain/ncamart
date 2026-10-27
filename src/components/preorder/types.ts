/**
 * NCAMart — Pre-Order Types & Definitions
 * PRD §3.3, §3.4, §3.12, F18
 */

export interface PreOrderItem {
  id: string;
  slug: string;
  sku_code: string;
  title_en: string;
  title_bn: string;
  brand_name: string;
  brand_slug: string;
  category_name: string;
  category_slug: string;
  total_price_paisa: number;
  deposit_percent: number; // 10, 15, or 20%
  target_quota: number;
  reserved_quota: number;
  batch_code: string;
  estimated_arrival_window: string;
  eta_days_min: number;
  eta_days_max: number;
  image_url: string;
  specs: Array<{ label: string; value: string }>;
  highlights: string[];
  status: "OPEN" | "AIR_FREIGHT_SCHEDULED" | "CUSTOMS_CLEARING" | "ARRIVED_GODOWN";
  btrc_cleared: boolean;
  origin_hub: string;
  warranty_days: number;
}

export interface DepositBreakdown {
  totalPricePaisa: number;
  depositPercent: number;
  depositPaisa: number;
  remainingPaisa: number;
  formattedTotal: string;
  formattedDeposit: string;
  formattedRemaining: string;
}

export function calculateDepositBreakdown(
  totalPricePaisa: number,
  depositPercent: number
): DepositBreakdown {
  // Integer arithmetic to prevent floating-point rounding errors
  const depositPaisa = Math.round((totalPricePaisa * depositPercent) / 100);
  const remainingPaisa = Math.max(0, totalPricePaisa - depositPaisa);

  // Helper formatter for BDT
  const format = (paisa: number) => {
    const taka = Math.floor(paisa / 100);
    return `৳${taka.toLocaleString("en-IN")}`;
  };

  return {
    totalPricePaisa,
    depositPercent,
    depositPaisa,
    remainingPaisa,
    formattedTotal: format(totalPricePaisa),
    formattedDeposit: format(depositPaisa),
    formattedRemaining: format(remainingPaisa),
  };
}

export function calculateQuotaProgress(reserved: number, target: number): {
  percentage: number;
  isFilled: boolean;
  remaining: number;
} {
  if (target <= 0) return { percentage: 0, isFilled: false, remaining: 0 };
  const percentage = Math.min(100, Math.round((reserved / target) * 100));
  const remaining = Math.max(0, target - reserved);
  return {
    percentage,
    isFilled: reserved >= target,
    remaining,
  };
}
