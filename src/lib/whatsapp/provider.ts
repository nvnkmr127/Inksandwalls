import "server-only";

export interface SendOtpInput {
  phone: string;
  otp: string;
}

export interface SendOtpResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface SendTemplateInput {
  phone: string;
  templateName: string;
  parameters: string[]; // Standard Watxio parameter list
}

export interface SendTemplateResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface WhatsAppProvider {
  sendOtp(input: SendOtpInput): Promise<SendOtpResult>;
  sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult>;
}
