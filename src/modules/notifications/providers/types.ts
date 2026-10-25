export interface ProviderSendResult {
  success: boolean;
  provider: string;
  messageId: string;
  status?: string;
  error?: string;
}

export interface SmsSendInput {
  to: string; // E.164 e.g. +88017XXXXXXXX
  text: string;
  senderId?: string;
}

export interface SmsProvider {
  name: string;
  send(input: SmsSendInput): Promise<ProviderSendResult>;
}

export interface WhatsAppSendInput {
  to: string;
  templateName: string;
  language?: string;
  bodyParams?: string[];
}

export interface WhatsAppProvider {
  name: string;
  send(input: WhatsAppSendInput): Promise<ProviderSendResult>;
}

export interface EmailSendInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProvider {
  name: string;
  send(input: EmailSendInput): Promise<ProviderSendResult>;
}
