export interface NotificationSentEvent {
  type: "notification.sent";
  payload: {
    logId: string;
    recipientType: string;
    recipientId?: string | null;
    channel: string;
    templateCode: string;
    toAddress: string;
    provider: string;
    providerMessageId?: string | null;
  };
}

export interface NotificationDeadLetterEvent {
  type: "notification.dead_letter";
  payload: {
    logId: string;
    recipientType: string;
    recipientId?: string | null;
    channel: string;
    templateCode: string;
    toAddress: string;
    attempts: number;
    error?: string | null;
  };
}

export interface NotificationDeliveredEvent {
  type: "notification.delivered";
  payload: {
    logId: string;
    providerMessageId: string;
  };
}

export type NotificationsDomainEvent =
  | NotificationSentEvent
  | NotificationDeadLetterEvent
  | NotificationDeliveredEvent;
