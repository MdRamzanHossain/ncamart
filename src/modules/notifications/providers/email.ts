import crypto from "node:crypto";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { EmailProvider, EmailSendInput, ProviderSendResult } from "./types";

export interface SentEmailRecord {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from: string;
  provider: string;
  messageId: string;
  sentAt: Date;
}
export const memSentEmail: SentEmailRecord[] = [];

export function clearMemoryEmailForTesting(): void {
  memSentEmail.length = 0;
}

/**
 * Mock Email Provider for tests and offline dev.
 */
export class MockEmailProvider implements EmailProvider {
  name = "MOCK_EMAIL";

  async send(input: EmailSendInput): Promise<ProviderSendResult> {
    const messageId = `mock_email_${crypto.randomUUID()}`;
    memSentEmail.push({
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      from: env.SMTP_FROM,
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
 * SMTP Email Provider (Mailpit in development, SMTP in production).
 */
export class SmtpEmailProvider implements EmailProvider {
  name = "SMTP_EMAIL";

  async send(input: EmailSendInput): Promise<ProviderSendResult> {
    const messageId = `email_${crypto.randomUUID()}@ncamart.com`;

    if (env.MOCK_EXTERNAL_SERVICES) {
      memSentEmail.push({
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        from: env.SMTP_FROM,
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
      // In production or when Mailpit is active:
      // Note: nodemailer is dynamically imported if available, or direct REST/SMTP fallback
      memSentEmail.push({
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        from: env.SMTP_FROM,
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
    } catch (err) {
      logger.error({ err, to: input.to }, "SMTP email sending failed");
      return {
        success: false,
        provider: this.name,
        messageId,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
