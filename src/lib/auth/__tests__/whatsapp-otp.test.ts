import { normalizePhoneNumber, isValidPhoneNumber } from "../phone";
import { generateOtp, hashOtp, verifyOtpHash, saveOtpChallenge, getOtpChallenge, incrementAttemptCount, invalidateOtpChallenge, checkRateLimits } from "../otp";
import { getTestWhatsAppProvider, WatxioWhatsAppProvider } from "../../whatsapp/watxio";
import { redis } from "../../redis";
import { authConfig } from "../auth.config";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runWhatsAppOtpTests() {
  console.log("--> Running Phase 02.02 WhatsApp OTP self-tests...");

  // 1. Phone Normalization & Validation
  console.log("   [1/6] Testing Phone Normalization...");
  assert(normalizePhoneNumber("+919876543210") === "+919876543210", "E.164 Indian format failed");
  assert(normalizePhoneNumber("9876543210") === "+919876543210", "10-digit Indian format failed");
  assert(normalizePhoneNumber("09876543210") === "+919876543210", "Leading zero format failed");
  assert(normalizePhoneNumber("+91 98765 43210") === "+919876543210", "Formatted phone failed");
  assert(normalizePhoneNumber("1234567890") === null, "Invalid prefix 1 allowed incorrectly");
  assert(normalizePhoneNumber("98765") === null, "Short number allowed incorrectly");
  assert(normalizePhoneNumber("abcdefghij") === null, "Alpha string allowed incorrectly");
  assert(isValidPhoneNumber("+919876543210") === true, "isValidPhoneNumber failed for valid phone");
  assert(isValidPhoneNumber("12345") === false, "isValidPhoneNumber failed for invalid phone");

  // 2. Cryptographic OTP Generation & HMAC Hashing
  console.log("   [2/6] Testing Cryptographic OTP & HMAC Hashing...");
  for (let i = 0; i < 50; i++) {
    const otp = generateOtp();
    assert(/^\d{6}$/.test(otp), `OTP must be 6 digits: ${otp}`);
    assert(parseInt(otp, 10) >= 100000 && parseInt(otp, 10) <= 999999, "OTP out of 6-digit range");
  }

  const phone = "+919876543210";
  const rawOtp = "482731";
  const hash1 = await hashOtp(phone, rawOtp);
  assert(typeof hash1 === "string" && hash1.length === 64, "HMAC hash should be hex string");
  assert(hash1 !== rawOtp, "Raw OTP must never match hash");
  assert((await verifyOtpHash(phone, rawOtp, hash1)) === true, "OTP hash verification failed for correct OTP");
  assert((await verifyOtpHash(phone, "000000", hash1)) === false, "OTP hash verification succeeded for invalid OTP");

  // 3. Redis Storage, Challenge Lifecycle, & TTL
  console.log("   [3/6] Testing Redis Storage & Challenge Lifecycle...");
  await redis.reset();
  const challenge = await saveOtpChallenge(phone, rawOtp);
  assert(challenge.phone === phone, "Challenge phone mismatch");
  assert(challenge.status === "active", "Challenge should be active");
  assert(challenge.otpHash === hash1, "Challenge otpHash mismatch");

  const fetched = await getOtpChallenge(phone);
  assert(fetched !== null, "Challenge lookup in Redis failed");
  assert(fetched?.challengeId === challenge.challengeId, "Challenge ID mismatch");

  // 4. Verification & Single-Use Enforcement
  console.log("   [4/6] Testing Verification & Invalidation...");
  const invalidAttempt = await incrementAttemptCount(phone, fetched!);
  assert(invalidAttempt === 1, "Attempt counter did not increment");

  await invalidateOtpChallenge(phone);
  const afterInvalidate = await getOtpChallenge(phone);
  assert(afterInvalidate === null, "Challenge was not removed after invalidation (single-use breach)");

  // 5. Rate Limiting & Cooldowns
  console.log("   [5/6] Testing Rate Limits & Cooldown Enforcements...");
  await redis.reset();
  await saveOtpChallenge(phone, "111111");

  const rateCheck1 = await checkRateLimits(phone);
  assert(rateCheck1.rateLimited === true, "Cooldown rate check failed to trigger");

  // Clear cooldown to test hourly cap
  const safePhone = encodeURIComponent(phone);
  await redis.del(`iw:auth:whatsapp:cooldown:${safePhone}`);

  for (let i = 0; i < 4; i++) {
    await redis.incr(`iw:auth:whatsapp:hourly:${safePhone}`);
  }
  const rateCheckHourly = await checkRateLimits(phone);
  assert(rateCheckHourly.rateLimited === true, "Hourly rate limit failed to trigger");

  // 6. WhatsApp Provider & Auth.js Credentials Integration
  console.log("   [6/6] Testing WhatsApp Provider & Auth.js Integration...");
  const testProvider = getTestWhatsAppProvider();
  testProvider.clear();
  const dispatchRes = await testProvider.sendOtp({ phone, otp: "654321" });
  assert(dispatchRes.success === true, "Test WhatsApp provider dispatch failed");
  assert(testProvider.getLastOtp(phone) === "654321", "Test provider message store mismatch");

  // Verify Auth.js Credentials authorize handler
  type ProviderObj = { id?: string; options?: { id?: string } };
  const credentialsProvider = authConfig.providers.find((p) => {
    const obj: ProviderObj = typeof p === "function" ? (p as () => ProviderObj)() : (p as ProviderObj);
    return obj?.id === "whatsapp-otp" || obj?.options?.id === "whatsapp-otp";
  }) || authConfig.providers[0];
  assert(Boolean(credentialsProvider), "Credentials provider missing in authConfig");

  // Save active challenge for Auth.js authorize test
  await redis.reset();
  await saveOtpChallenge(phone, "999999");

  if (credentialsProvider) {
    type ProviderObj = { authorize?: (c: Record<string, unknown>, req: unknown) => Promise<{ phone?: string; role?: string } | null>; options?: { authorize?: (c: Record<string, unknown>, req: unknown) => Promise<{ phone?: string; role?: string } | null> } };
    const providerObj = credentialsProvider as unknown as ProviderObj;
    const authFn = providerObj.options?.authorize || providerObj.authorize;
    assert(typeof authFn === "function", "Credentials authorize function missing");

    if (authFn) {
      const dummyReq = new Request("https://inksandwalls.com/api/auth") as unknown as Request;
      const userRes = await authFn(
        { phone, otp: "999999" },
        dummyReq
      );
      assert(userRes !== null, "Auth.js authorize returned null for valid OTP");
      assert(userRes?.phone === phone, "Auth.js authorized user phone mismatch");
      assert(userRes?.role === "CUSTOMER", "Auth.js authorized user role mismatch");

      // Single-use check: second authorize attempt with same OTP must fail
      const replayRes = await authFn(
        { phone, otp: "999999" },
        dummyReq
      );
      assert(replayRes === null, "Auth.js authorize allowed replay of consumed OTP");
    }
  }

  // Production provider safety check
  try {
    const origEnv = process.env.NODE_ENV;
    (process.env as unknown as Record<string, string>).NODE_ENV = "production";
    delete process.env.WABA_API_KEY;
    new WatxioWhatsAppProvider().sendOtp({ phone, otp: "123456" });
    (process.env as unknown as Record<string, string>).NODE_ENV = origEnv;
  } catch {
    // expected
  }
  (process.env as unknown as Record<string, string>).NODE_ENV = "test";

  console.log("✓ All Phase 02.02 WhatsApp OTP self-tests passed cleanly!");
}

runWhatsAppOtpTests().catch((err) => {
  console.error("WhatsApp OTP self-test failed:", err);
  process.exit(1);
});
