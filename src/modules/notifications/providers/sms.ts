import crypto from "node:crypto";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { ProviderSendResult, SmsProvider, SmsSendInput } from "./types";

// In-Memory test inspection store
export interface SentSmsRecord {
  to: string;
  text: string;
  senderId?: string;
  provider: string;
  messageId: string;
  sentAt: Date;
}
export const memSentSms: SentSmsRecord[] = [];

export function clearMemorySmsForTesting(): void {
  memSentSms.length = 0;
}

/**
 * Mock SMS Provider for local development & unit tests.
 */
export class MockSmsProvider implements SmsProvider {
  name = "MOCK_SMS";
  public failNextSendsCount = 0;
  public failRatePercent = 0;

  async send(input: SmsSendInput): Promise<ProviderSendResult> {
    const messageId = `mock_sms_${crypto.randomUUID()}`;

    // Controllable failure injection for testing
    if (this.failNextSendsCount > 0) {
      this.failNextSendsCount--;
      return {
        success: false,
        provider: this.name,
        messageId,
        error: "Simulated mock SMS gateway failure",
      };
    }

    if (this.failRatePercent > 0 && Math.random() * 100 < this.failRatePercent) {
      return {
        success: false,
        provider: this.name,
        messageId,
        error: "Simulated probabilistic SMS gateway failure",
      };
    }

    memSentSms.push({
      to: input.to,
      text: input.text,
      senderId: input.senderId ?? env.SMS_SENDER_ID,
      provider: this.name,
      messageId,
      sentAt: new Date(),
    });

    return {
      success: true,
      provider: this.name,
      messageId,
      status: "SENT",
    };
  }
}

/**
 * Primary Bangladeshi SMS Gateway HTTP Client.
 * Connects to a standard BD SMS provider (Greenweb, Alpha SMS, BulkSMSBD, etc.)
 */
export class GenericBdSmsProvider implements SmsProvider {
  name = "BD_SMS_PRIMARY";

  async send(input: SmsSendInput): Promise<ProviderSendResult> {
    const messageId = `bdsms_${crypto.randomUUID()}`;
    const endpoint = process.env.SMS_GATEWAY_URL || "https://api.sms-gateway-bd.com/send";

    if (env.MOCK_EXTERNAL_SERVICES || env.SMS_PROVIDER === "mock") {
      memSentSms.push({
        to: input.to,
        text: input.text,
        senderId: input.senderId ?? env.SMS_SENDER_ID,
        provider: this.name,
        messageId,
        sentAt: new Date(),
      });
      return {
        success: true,
        provider: this.name,
        messageId,
        status: "SENT",
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.SMS_API_KEY}`,
        },
        body: JSON.stringify({
          sender_id: input.senderId ?? env.SMS_SENDER_ID,
          recipient: input.to,
          message: input.text,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return {
          success: false,
          provider: this.name,
          messageId,
          error: `Gateway HTTP ${response.status}: ${errText}`,
        };
      }

      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const providerMsgId = String(data.message_id || data.id || messageId);

      return {
        success: true,
        provider: this.name,
        messageId: providerMsgId,
        status: "SENT",
      };
    } catch (err) {
      logger.error({ err, to: input.to }, "Primary BD SMS gateway request failed");
      return {
        success: false,
        provider: this.name,
        messageId,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

/**
 * Secondary / Fallback Bangladeshi SMS Gateway Client.
 */
export class SecondaryBdSmsProvider implements SmsProvider {
  name = "BD_SMS_SECONDARY";

  async send(input: SmsSendInput): Promise<ProviderSendResult> {
    const messageId = `sec_sms_${crypto.randomUUID()}`;
    const endpoint =
      process.env.SMS_SECONDARY_GATEWAY_URL || "https://backup.sms-gateway-bd.com/send";

    if (env.MOCK_EXTERNAL_SERVICES || env.SMS_PROVIDER === "mock") {
      memSentSms.push({
        to: input.to,
        text: input.text,
        senderId: input.senderId ?? env.SMS_SENDER_ID,
        provider: this.name,
        messageId,
        sentAt: new Date(),
      });
      return {
        success: true,
        provider: this.name,
        messageId,
        status: "SENT",
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.SMS_API_KEY}`,
        },
        body: JSON.stringify({
          sender_id: input.senderId ?? env.SMS_SENDER_ID,
          recipient: input.to,
          message: input.text,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return {
          success: false,
          provider: this.name,
          messageId,
          error: `Secondary Gateway HTTP ${response.status}: ${errText}`,
        };
      }

      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      return {
        success: true,
        provider: this.name,
        messageId: String(data.message_id || messageId),
        status: "SENT",
      };
    } catch (err) {
      logger.error({ err, to: input.to }, "Secondary SMS gateway request failed");
      return {
        success: false,
        provider: this.name,
        messageId,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
