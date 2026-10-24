import { OrderStatus, PaymentStatus, OrderType, OrderActorType } from "./schema";

export interface OrderCreatedEvent {
  orderId: string;
  orderNumber: string;
  customerId: string;
  orderType: OrderType;
  channel: string;
  totalPayablePaisa: number;
}

export interface OrderStatusChangedEvent {
  orderId: string;
  orderNumber: string;
  orderType: OrderType;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: OrderActorType;
  actorId?: string | null;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface OrderPaymentStatusChangedEvent {
  orderId: string;
  orderNumber: string;
  previousStatus: PaymentStatus;
  nextStatus: PaymentStatus;
  paidTotalPaisa: number;
}
