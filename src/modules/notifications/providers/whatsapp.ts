import crypto from "node:crypto";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { ProviderSendResult, WhatsAppProvider, WhatsAppSendInput } from "./types";

export interface SentWhatsAppRecord {
  to: string;
  templateName: string;
  language?: string;
  bodyParams?: string[];
  provider: string;
  messageId: string;
  sentAt: Date;
}
export const memSentWhatsApp: SentWhatsAppRecord[] = [];

export function clearMemoryWhatsAppForTesting(): void {
  memSentWhatsApp.length = 0;
}

/**
 * Mock WhatsApp Provider for tests and offline dev.
 */
export class MockWhatsAppProvider implements WhatsAppProvider {
  name = "MOCK_WHATSAPP";

  async send(input: WhatsAppSendInput): Promise<ProviderSendResult> {
    const messageId = `mock_wa_${crypto.randomUUID()}`;
    memSentWhatsApp.push({
      to: input.to,
      templateName: input.templateName,
      language: input.language ?? "bn",
      bodyParams: input.bodyParams,
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
 * WhatsApp Cloud API Provider.
 * Calls Meta WhatsApp Cloud API endpoint.
 */
export class WhatsAppCloudProvider implements WhatsAppProvider {
  name = "WHATSAPP_CLOUD";

  async send(input: WhatsAppSendInput): Promise<ProviderSendResult> {
    const messageId = `wamid_${crypto.randomUUID()}`;
    const baseUrl = process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v21.0";
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;

    if (env.MOCK_EXTERNAL_SERVICES || !env.WHATSAPP_API_TOKEN) {
      memSentWhatsApp.push({
        to: input.to,
        templateName: input.templateName,
        language: input.language ?? "bn",
        bodyParams: input.bodyParams,
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
      const cleanTo = input.to.replace(/[^0-9]/g, "");
      const bodyParameters = (input.bodyParams ?? []).map((text) => ({
        type: "text",
        text,
      }));

      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "template",
        template: {
          name: input.templateName,
          language: { code: input.language ?? "bn" },
          components:
            bodyParameters.length > 0
              ? [{ type: "body", parameters: bodyParameters }]
              : undefined,
        },
      };

      const response = await fetch(`${baseUrl}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.WHATSAPP_API_TOKEN}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        return {
          success: false,
          provider: this.name,
          messageId,
          error: `WhatsApp HTTP ${response.status}: ${errText}`,
        };
      }

      const resData = (await response.json().catch(() => ({}))) as {
        messages?: Array<{ id: string }>;
      };
      const actualId = resData.messages?.[0]?.id || messageId;

      return {
        success: true,
        provider: this.name,
        messageId: actualId,
        status: "SENT",
      };
    } catch (err) {
      logger.error({ err, to: input.to }, "WhatsApp Cloud API request failed");
      return {
        success: false,
        provider: this.name,
        messageId,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
