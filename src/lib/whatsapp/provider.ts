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

export interface WhatsAppOtpProvider {
  sendOtp(input: SendOtpInput): Promise<SendOtpResult>;
}
