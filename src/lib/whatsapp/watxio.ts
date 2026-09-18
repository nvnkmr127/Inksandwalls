import "server-only";
import { WhatsAppOtpProvider, SendOtpInput, SendOtpResult } from "./provider";
import { logger } from "../logger";

export class WatxioWhatsAppProvider implements WhatsAppOtpProvider {
  private apiEndpoint: string;
  private apiKey: string;
  private phoneNumberId: string;

  constructor(apiEndpoint?: string, apiKey?: string, phoneNumberId?: string) {
    this.apiEndpoint = apiEndpoint || process.env.WABA_API_ENDPOINT || "https://api.watxio.com/v1";
    this.apiKey = apiKey || process.env.WABA_API_KEY || "";
    this.phoneNumberId = phoneNumberId || process.env.WABA_PHONE_NUMBER_ID || "";
  }

  async sendOtp({ phone }: SendOtpInput): Promise<SendOtpResult> {
    if (!this.apiKey) {
      logger.error("Watxio API Key missing in environment configuration", { component: "WhatsAppProvider" });
      return { success: false, error: "Provider configuration error" };
    }

    try {
      // Production call to Watxio API gateway
      const response = await fetch(`${this.apiEndpoint}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "template",
          template: {
            name: "otp_verification",
            language: { code: "en" },
          },
          phoneNumberId: this.phoneNumberId,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.error(`Watxio OTP delivery failed with status ${response.status}`, {
          component: "WhatsAppProvider",
          metadata: { status: response.status, body: errText },
        });
        return { success: false, error: "Failed to dispatch WhatsApp OTP" };
      }

      const data = await response.json();
      logger.info("WhatsApp OTP requested", {
        component: "WhatsAppProvider",
        metadata: { provider: "Watxio", result: "success" },
      });

      return {
        success: true,
        providerMessageId: data.messages?.[0]?.id || data.id || "waba_msg_ok",
      };
    } catch (error) {
      logger.error("Network error during Watxio OTP dispatch", { component: "WhatsAppProvider" }, error as Error);
      return { success: false, error: "WhatsApp provider communication failure" };
    }
  }
}

export class TestWhatsAppProvider implements WhatsAppOtpProvider {
  public sentMessages: Array<{ phone: string; otp: string; timestamp: number }> = [];

  async sendOtp({ phone, otp }: SendOtpInput): Promise<SendOtpResult> {
    this.sentMessages.push({ phone, otp, timestamp: Date.now() });
    logger.info("Test WhatsApp OTP dispatched", {
      component: "TestWhatsAppProvider",
      metadata: { phoneMasked: phone.replace(/(\+\d{2}\d{2})\d{4}(\d{4})/, "$1****$2") },
    });
    return {
      success: true,
      providerMessageId: `test_msg_${Date.now()}`,
    };
  }

  getLastOtp(phone: string): string | undefined {
    const found = [...this.sentMessages].reverse().find((m) => m.phone === phone);
    return found?.otp;
  }

  clear() {
    this.sentMessages = [];
  }
}

let testProviderInstance: TestWhatsAppProvider | null = null;

export function getWhatsAppProvider(): WhatsAppOtpProvider {
  const env = process.env.NODE_ENV || "development";
  const hasWatxioKey = Boolean(process.env.WABA_API_KEY);

  if (env === "production" && !hasWatxioKey) {
    throw new Error("Missing required WABA_API_KEY environment variable for Watxio provider in production.");
  }

  if (hasWatxioKey) {
    return new WatxioWhatsAppProvider();
  }

  if (!testProviderInstance) {
    testProviderInstance = new TestWhatsAppProvider();
  }
  return testProviderInstance;
}

export function getTestWhatsAppProvider(): TestWhatsAppProvider {
  if (!testProviderInstance) {
    testProviderInstance = new TestWhatsAppProvider();
  }
  return testProviderInstance;
}
