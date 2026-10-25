import { CouponType, CouponScopeType, CouponStatus } from "@/modules/promotions/schema";

export interface SeedCouponDefinition {
  code: string;
  type: CouponType;
  value: number; // Paisa if FIXED, Basis points if PERCENT (1000 bp = 10%)
  minOrderPaisa: number;
  maxDiscountPaisa?: number;
  scopeType: CouponScopeType;
  status: CouponStatus;
  perPhoneLimit: number;
  usageLimit?: number;
}

export const SEED_COUPONS: SeedCouponDefinition[] = [
  {
    code: "WELCOME10",
    type: "PERCENT",
    value: 1000, // 10%
    minOrderPaisa: 100000, // ৳1,000
    maxDiscountPaisa: 30000, // ৳300 max
    scopeType: "ALL",
    status: "DRAFT",
    perPhoneLimit: 1,
    usageLimit: 500,
  },
  {
    code: "NAWABPUR100",
    type: "FIXED",
    value: 10000, // ৳100 off
    minOrderPaisa: 150000, // ৳1,500
    scopeType: "ALL",
    status: "ACTIVE",
    perPhoneLimit: 2,
    usageLimit: 1000,
  },
];
