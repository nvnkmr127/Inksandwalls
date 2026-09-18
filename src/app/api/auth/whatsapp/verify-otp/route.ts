import { NextRequest, NextResponse } from "next/server";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import { getOtpChallenge, verifyOtpHash, incrementAttemptCount } from "@/lib/auth/otp";
import { signIn } from "@/lib/auth";
import { createErrorResponse, ValidationError } from "@/lib/errors";
import { getCorrelationId } from "@/lib/correlation";
import { logger } from "@/lib/logger";
import { recordAuditEvent, extractRequestContext, AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from "@/lib/audit";
import { findOrCreateUserByPhone } from "@/lib/auth/user-service";

export async function POST(req: NextRequest) {
  const correlationId = getCorrelationId(req.headers);
  const reqContext = extractRequestContext(req.headers);

  try {
    const body = await req.json().catch(() => ({}));
    const rawPhone = body.phone;
    const rawOtp = body.otp;

    if (!rawPhone || typeof rawPhone !== "string") {
      throw new ValidationError("Phone number is required");
    }

    if (!rawOtp || typeof rawOtp !== "string") {
      throw new ValidationError("OTP is required");
    }

    const normalizedPhone = normalizePhoneNumber(rawPhone);
    if (!normalizedPhone) {
      throw new ValidationError("Invalid Indian mobile phone number format");
    }

    const cleanOtp = rawOtp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      throw new ValidationError("OTP must be exactly 6 digits");
    }

    // Inspect challenge prior to Auth.js sign-in to return rich error details
    const challenge = await getOtpChallenge(normalizedPhone);
    if (!challenge) {
      await recordAuditEvent({
        action: AUDIT_ACTIONS.AUTH_OTP_FAILED,
        resourceType: AUDIT_RESOURCE_TYPES.AUTHENTICATION,
        metadata: { phone: normalizedPhone, reason: "OTP expired or missing challenge" },
        ipAddress: reqContext.ipAddress,
        userAgent: reqContext.userAgent,
      });

      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "OTP expired or invalid. Please request a new OTP.",
            correlationId,
          },
        },
        { status: 400 }
      );
    }

    // Check if OTP matches
    const isValid = await verifyOtpHash(normalizedPhone, cleanOtp, challenge.otpHash);
    if (!isValid) {
      const attempts = await incrementAttemptCount(normalizedPhone, challenge);
      const remaining = Math.max(0, 5 - attempts);
      const msg = remaining > 0
        ? `Invalid OTP. ${remaining} attempt(s) remaining.`
        : "Maximum verification attempts exceeded. Please request a new OTP.";

      logger.warn("WhatsApp OTP verification failed", {
        component: "VerifyOtpApi",
        correlationId,
        metadata: { attempts },
      });

      await recordAuditEvent({
        action: AUDIT_ACTIONS.AUTH_OTP_FAILED,
        resourceType: AUDIT_RESOURCE_TYPES.AUTHENTICATION,
        metadata: { phone: normalizedPhone, attempts, reason: "Invalid OTP code" },
        ipAddress: reqContext.ipAddress,
        userAgent: reqContext.userAgent,
      });

      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: msg,
            correlationId,
          },
        },
        { status: 400 }
      );
    }

    // Ensure user record exists in database
    const user = await findOrCreateUserByPhone(normalizedPhone);

    // Execute Auth.js sign-in (validates credentials, invalidates challenge, & sets session cookie)
    try {
      await signIn("whatsapp-otp", {
        phone: normalizedPhone,
        otp: cleanOtp,
        redirect: false,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) {
        // Next.js redirect thrown by Auth.js is normal on success
      } else {
        logger.error("Auth.js session creation failed during OTP verification", {
          component: "VerifyOtpApi",
          correlationId,
        }, err as Error);
      }
    }

    await recordAuditEvent({
      actorUserId: user.id,
      action: AUDIT_ACTIONS.AUTH_OTP_VERIFIED,
      resourceType: AUDIT_RESOURCE_TYPES.AUTHENTICATION,
      resourceId: user.id,
      metadata: { phone: normalizedPhone },
      ipAddress: reqContext.ipAddress,
      userAgent: reqContext.userAgent,
    });

    await recordAuditEvent({
      actorUserId: user.id,
      action: AUDIT_ACTIONS.AUTH_LOGIN,
      resourceType: AUDIT_RESOURCE_TYPES.AUTHENTICATION,
      resourceId: user.id,
      metadata: { provider: "whatsapp-otp", phone: normalizedPhone },
      ipAddress: reqContext.ipAddress,
      userAgent: reqContext.userAgent,
    });

    logger.info("WhatsApp OTP verified & Auth.js session established", {
      component: "VerifyOtpApi",
      correlationId,
    });

    return NextResponse.json(
      {
        success: true,
        message: "OTP verified successfully",
        user: {
          id: user.id,
          phone: normalizedPhone,
          phoneVerified: true,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return createErrorResponse(error, correlationId, "VerifyOtpApi");
  }
}
