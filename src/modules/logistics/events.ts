// Domain events emitted by module: logistics

export interface ShipmentBookedEventPayload {
  shipmentId: string;
  orderId: string;
  courier: string;
  consignmentNo: string;
  trackingUrl?: string | null;
}

export interface ShipmentBookingFailedEventPayload {
  shipmentId: string;
  orderId: string;
  courier: string;
  attempts: number;
  lastError: string;
}

export interface ShipmentHandedOverEventPayload {
  shipmentId: string;
  orderId: string;
  courier: string;
  consignmentNo: string | null;
  handedOverAt: Date;
}

export interface OrderPackedEventPayload {
  orderId: string;
  packageWeightGrams: number;
  fulfillmentChannel: string;
}
