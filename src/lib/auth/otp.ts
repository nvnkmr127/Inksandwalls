import "server-only";
import { redis } from "../redis";

export interface OtpChallenge {
  challengeId: string;
  phone: string;
  otpHash: string;
  createdAt: number;
  expiresAt: number;
  attemptCount: number;
  status: "active" | "used" | "invalid";
}

export function getOtpConfig() {
  return {
    ttlSeconds: parseInt(process.env.WHATSAPP_OTP_TTL_SECONDS || "300", 10),
    cooldownSeconds: parseInt(process.env.WHATSAPP_OTP_REQUEST_COOLDOWN_SECONDS || "60", 10),
    maxRequestsPerHour: parseInt(process.env.WHATSAPP_OTP_MAX_REQUESTS_PER_HOUR || "5", 10),
    maxVerifyAttempts: parseInt(process.env.WHATSAPP_OTP_MAX_VERIFY_ATTEMPTS || "5", 10),
  };
}

/**
 * Generate a cryptographically secure 6-digit numeric OTP using Web Crypto API.
 */
export function generateOtp(): string {
  const array = new Uint32Array(1);
  globalThis.crypto.getRandomValues(array);
  const num = 100000 + (array[0] % 900000);
  return String(num);
}

/**
 * Hash an OTP with phone number using HMAC-SHA256 (Web Crypto API).
 */
export async function hashOtp(phone: string, otp: string): Promise<string> {
  const secret = process.env.AUTH_SECRET || "fallback-otp-secret-min-32-chars";
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(`${phone}:${otp}`);
  
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, messageData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compare an incoming OTP with the stored OTP hash in constant time.
 */
export async function verifyOtpHash(phone: string, inputOtp: string, expectedHash: string): Promise<boolean> {
  const computedHash = await hashOtp(phone, inputOtp);
  if (computedHash.length !== expectedHash.length) {
    return false;
  }
  
  let mismatch = 0;
  for (let i = 0; i < computedHash.length; i++) {
    mismatch |= computedHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return mismatch === 0;
}

// Redis Namespace Keys
export function getRedisKeys(phone: string, ip?: string) {
  const safePhone = encodeURIComponent(phone);
  return {
    otpKey: `iw:auth:whatsapp:otp:${safePhone}`,
    cooldownKey: `iw:auth:whatsapp:cooldown:${safePhone}`,
    hourlyKey: `iw:auth:whatsapp:hourly:${safePhone}`,
    ipKey: ip ? `iw:auth:whatsapp:ip:${encodeURIComponent(ip)}` : null,
  };
}

/**
 * Check if the phone number or IP address is currently rate-limited.
 */
export async function checkRateLimits(phone: string, ip?: string): Promise<{ rateLimited: boolean; reason?: string }> {
  const config = getOtpConfig();
  const keys = getRedisKeys(phone, ip);

  // Check cooldown
  const cooldownActive = await redis.get(keys.cooldownKey);
  if (cooldownActive) {
    return { rateLimited: true, reason: `Please wait ${config.cooldownSeconds} seconds before requesting a new OTP.` };
  }

  // Check hourly limit per phone
  const hourlyCountStr = await redis.get(keys.hourlyKey);
  const hourlyCount = hourlyCountStr ? parseInt(hourlyCountStr, 10) : 0;
  if (hourlyCount >= config.maxRequestsPerHour) {
    return { rateLimited: true, reason: "Maximum hourly OTP requests reached for this phone number." };
  }

  // Check IP rate limit (max 10 requests per hour per IP)
  if (keys.ipKey) {
    const ipCountStr = await redis.get(keys.ipKey);
    const ipCount = ipCountStr ? parseInt(ipCountStr, 10) : 0;
    if (ipCount >= 10) {
      return { rateLimited: true, reason: "Too many OTP requests from this IP address." };
    }
  }

  return { rateLimited: false };
}

/**
 * Save an active OTP challenge to Redis and set rate-limiting counters.
 */
export async function saveOtpChallenge(phone: string, otp: string, ip?: string): Promise<OtpChallenge> {
  const config = getOtpConfig();
  const keys = getRedisKeys(phone, ip);
  const now = Date.now();
  const expiresAt = now + config.ttlSeconds * 1000;
  const otpHash = await hashOtp(phone, otp);

  const challenge: OtpChallenge = {
    challengeId: globalThis.crypto.randomUUID(),
    phone,
    otpHash,
    createdAt: now,
    expiresAt,
    attemptCount: 0,
    status: "active",
  };

  // Invalidate any existing challenge and set new challenge
  await redis.set(keys.otpKey, JSON.stringify(challenge), "EX", config.ttlSeconds);

  // Set cooldown
  await redis.set(keys.cooldownKey, "1", "EX", config.cooldownSeconds);

  // Increment hourly counter
  const newHourly = await redis.incr(keys.hourlyKey);
  if (newHourly === 1) {
    await redis.expire(keys.hourlyKey, 3600);
  }

  // Increment IP counter if provided
  if (keys.ipKey) {
    const newIpCount = await redis.incr(keys.ipKey);
    if (newIpCount === 1) {
      await redis.expire(keys.ipKey, 3600);
    }
  }

  return challenge;
}

/**
 * Retrieve the active OTP challenge for a phone number.
 */
export async function getOtpChallenge(phone: string): Promise<OtpChallenge | null> {
  const keys = getRedisKeys(phone);
  const raw = await redis.get(keys.otpKey);
  if (!raw) return null;
  try {
    const challenge: OtpChallenge = JSON.parse(raw);
    if (challenge.expiresAt < Date.now() || challenge.status !== "active") {
      return null;
    }
    return challenge;
  } catch {
    return null;
  }
}

/**
 * Increment the failed attempt count on an OTP challenge.
 */
export async function incrementAttemptCount(phone: string, challenge: OtpChallenge): Promise<number> {
  const config = getOtpConfig();
  const keys = getRedisKeys(phone);
  const newCount = challenge.attemptCount + 1;

  if (newCount >= config.maxVerifyAttempts) {
    challenge.status = "invalid";
    await redis.del(keys.otpKey);
  } else {
    challenge.attemptCount = newCount;
    const remainingTtl = Math.max(1, Math.ceil((challenge.expiresAt - Date.now()) / 1000));
    await redis.set(keys.otpKey, JSON.stringify(challenge), "EX", remainingTtl);
  }

  return newCount;
}

/**
 * Invalidate an active OTP challenge after successful verification.
 */
export async function invalidateOtpChallenge(phone: string): Promise<void> {
  const keys = getRedisKeys(phone);
  await redis.del(keys.otpKey);
}
