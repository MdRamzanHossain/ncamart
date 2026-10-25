import {
  SmsProvider,
  WhatsAppProvider,
  EmailProvider,
} from "./types";
import {
  MockSmsProvider,
  GenericBdSmsProvider,
  SecondaryBdSmsProvider,
  clearMemorySmsForTesting,
  memSentSms,
} from "./sms";
import {
  MockWhatsAppProvider,
  WhatsAppCloudProvider,
  clearMemoryWhatsAppForTesting,
  memSentWhatsApp,
} from "./whatsapp";
import {
  MockEmailProvider,
  SmtpEmailProvider,
  clearMemoryEmailForTesting,
  memSentEmail,
} from "./email";

export * from "./types";
export * from "./sms";
export * from "./whatsapp";
export * from "./email";

export interface NotificationProviders {
  smsPrimary: SmsProvider;
  smsSecondary: SmsProvider;
  whatsapp: WhatsAppProvider;
  email: EmailProvider;
}

export const mockSmsProvider = new MockSmsProvider();
export const mockSecondarySmsProvider = new MockSmsProvider();
export const genericBdSmsProvider = new GenericBdSmsProvider();
export const secondaryBdSmsProvider = new SecondaryBdSmsProvider();

export const mockWhatsAppProvider = new MockWhatsAppProvider();
export const whatsAppCloudProvider = new WhatsAppCloudProvider();

export const mockEmailProvider = new MockEmailProvider();
export const smtpEmailProvider = new SmtpEmailProvider();

export const defaultProviders: NotificationProviders = {
  smsPrimary: genericBdSmsProvider,
  smsSecondary: secondaryBdSmsProvider,
  whatsapp: whatsAppCloudProvider,
  email: smtpEmailProvider,
};

export function clearAllMemoryProvidersForTesting(): void {
  clearMemorySmsForTesting();
  clearMemoryWhatsAppForTesting();
  clearMemoryEmailForTesting();
}
