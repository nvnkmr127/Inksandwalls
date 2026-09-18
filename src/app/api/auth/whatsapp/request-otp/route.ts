import { NextRequest, NextResponse } from "next/server";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import { generateOtp, saveOtpChallenge, checkRateLimits } from "@/lib/auth/otp";
import { getWhatsAppProvider } from "@/lib/whatsapp";
import { createErrorResponse, ValidationError } from "@/lib/errors";
import { getCorrelationId } from "@/lib/correlation";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationId(req.headers);

  try {
    const body = await req.json().catch(() => ({}));
    const rawPhone = body.phone;

    if (!rawPhone || typeof rawPhone !== "string") {
      throw new ValidationError("Phone number is required");
    }

    const normalizedPhone = normalizePhoneNumber(rawPhone);
    if (!normalizedPhone) {
      throw new ValidationError("Invalid Indian mobile phone number format");
    }

    // Extract client IP address for rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;

    // Check rate limits (Cooldown, Hourly cap, IP cap)
    const rateCheck = await checkRateLimits(normalizedPhone, ip);
    if (rateCheck.rateLimited) {
      logger.warn(`OTP request rate limited for phone`, {
        component: "RequestOtpApi",
        correlationId,
        metadata: { reason: rateCheck.reason },
      });
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: rateCheck.reason || "Too many requests. Please try again later.",
            correlationId,
          },
        },
        { status: 429 }
      );
    }

    // Generate 6-digit cryptographic OTP and save challenge in Redis
    const otp = generateOtp();
    await saveOtpChallenge(normalizedPhone, otp, ip);

    // Dispatch OTP message via WhatsApp provider (Watxio / Test Adapter)
    const provider = getWhatsAppProvider();
    const result = await provider.sendOtp({ phone: normalizedPhone, otp });

    if (!result.success) {
      logger.error("WhatsApp OTP provider delivery failure", {
        component: "RequestOtpApi",
        correlationId,
        metadata: { providerError: result.error },
      });
    }

    logger.info("WhatsApp OTP requested successfully", {
      component: "RequestOtpApi",
      correlationId,
    });

    // Return anti-enumeration generic success response
    return NextResponse.json(
      {
        success: true,
        message: "If the number is eligible, an OTP has been sent.",
      },
      { status: 200 }
    );
  } catch (error) {
    return createErrorResponse(error, correlationId, "RequestOtpApi");
  }
}
