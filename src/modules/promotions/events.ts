export interface CouponCreatedEventPayload {
  couponId: string;
  code: string;
  type: string;
  value: number;
  createdBy: string;
  createdAt: string;
}

export interface CouponActivatedEventPayload {
  couponId: string;
  code: string;
  activatedBy: string;
  activatedAt: string;
}

export interface CouponPausedEventPayload {
  couponId: string;
  code: string;
  pausedBy: string;
  pausedAt: string;
}

export interface CouponReservedEventPayload {
  redemptionId: string;
  couponId: string;
  orderId: string;
  phone: string;
  discountPaisa: number;
}

export interface CouponConfirmedEventPayload {
  redemptionId: string;
  couponId: string;
  orderId: string;
}

export interface CouponReleasedEventPayload {
  redemptionId: string;
  couponId: string;
  orderId: string;
}

export interface StoreCreditIssuedEventPayload {
  entryId: string;
  customerId: string;
  amountPaisa: number;
  reason: string;
  withdrawable: boolean;
  expiresAt: string | null;
  createdBy: string | null;
}

export interface StoreCreditAppliedEventPayload {
  customerId: string;
  orderId: string;
  amountPaisa: number;
}

export interface StoreCreditReversedEventPayload {
  customerId: string;
  orderId: string;
  amountPaisa: number;
  reason: string;
}

export interface StoreCreditWithdrawnEventPayload {
  customerId: string;
  amountPaisa: number;
  method: string;
  ref: string;
  staffId: string;
}

export interface StoreCreditExpiredEventPayload {
  expiredLotsCount: number;
  totalExpiredPaisa: number;
}
