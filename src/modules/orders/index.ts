// Public boundary for module: orders
// ONLY export service, events, policies, DTOs, state-machine types, and pricing engine. Never export schema or repo.
export * from "./service";
export * from "./events";
export * from "./policies";
export * from "./dto";
export * from "./pricing";
export * from "./cart";
export * from "./checkout";
export {
  TRANSITIONS,
  transitionOrder,
  recomputePaymentStatus,
  type TransitionGuard,
  type RecomputePaymentResult,
} from "./state-machine";
export {
  orderStatusEnum,
  orderTypeEnum,
  orderChannelEnum,
  fulfillmentChannelEnum,
  paymentStatusEnum,
  paymentModeEnum,
} from "./schema";
export type {
  OrderStatus,
  OrderType,
  PaymentStatus,
  PaymentMode,
  FulfillmentChannel,
  OrderChannel,
  OrderActorType,
  PreOrderMilestone,
  PaymentPurpose,
  PaymentMethod,
  PaymentTransactionStatus,
  AddressSnapshot,
} from "./schema";
