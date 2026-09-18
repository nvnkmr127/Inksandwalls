# WhatsApp OTP Authentication Specification & Architecture

**Micro Phase**: 02.02  
**Status**: APPROVED & IMPLEMENTED  
**Canonical Reference**: `INKs-and-Walls-PRD.md` §6, §8

---

## 1. Overview

This document defines the secure WhatsApp OTP request and verification architecture integrated into the Auth.js (`next-auth` v5) session foundation for INKs & Walls.

OTP delivery uses the Watxio WABA gateway API contract.

---

## 2. Authentication Flow

```text
User enters phone number
        ↓
POST /api/auth/whatsapp/request-otp
        ↓
Normalize phone number (+91XXXXXXXXXX)
        ↓
Check Redis rate limits (Cooldown, Hourly, IP)
        ↓
Generate 6-digit cryptographic OTP
        ↓
Save HMAC-SHA256 OTP challenge in Redis
        ↓
Dispatch message via Watxio WABA provider
        ↓
Return generic anti-enumeration response
        ↓
User enters 6-digit OTP
        ↓
POST /api/auth/whatsapp/verify-otp
        ↓
Verify challenge status & attempt count in Redis
        ↓
Compare OTP HMAC hash in constant time
        ↓
Invalidate challenge in Redis (Single-use)
        ↓
Establish authenticated Auth.js JWT session
```

---

## 3. Redis Keys & Namespace Architecture

All Redis keys are namespaced under `iw:auth:whatsapp:` with hashed or E.164 phone numbers:

| Key Pattern | Purpose | Default TTL |
|---|---|---|
| `iw:auth:whatsapp:otp:{phone}` | Active OTP challenge payload (JSON: `challengeId`, `phone`, `otpHash`, `attemptCount`, `expiresAt`) | `300s` (5 min) |
| `iw:auth:whatsapp:cooldown:{phone}` | Per-phone OTP request cooldown sentinel key | `60s` (1 min) |
| `iw:auth:whatsapp:hourly:{phone}` | Hourly OTP request counter per phone number | `3600s` (1 hour) |
| `iw:auth:whatsapp:ip:{ip}` | Hourly OTP request counter per IP address | `3600s` (1 hour) |

---

## 4. Rate Limiting Rules

1. **Per-Phone Cooldown**: Maximum 1 OTP request every 60 seconds (`WHATSAPP_OTP_REQUEST_COOLDOWN_SECONDS`).
2. **Per-Phone Hourly Limit**: Maximum 5 OTP requests per hour (`WHATSAPP_OTP_MAX_REQUESTS_PER_HOUR`).
3. **Per-IP Rate Limit**: Maximum 10 OTP requests per hour per IP address.
4. **Verification Attempt Cap**: Maximum 5 failed verification attempts per challenge (`WHATSAPP_OTP_MAX_VERIFY_ATTEMPTS`). On the 5th failed attempt, the challenge is invalidated immediately.

---

## 5. Security & Anti-Enumeration Rules

- **Anti-Enumeration**: `POST /api/auth/whatsapp/request-otp` returns `{ "success": true, "message": "If the number is eligible, an OTP has been sent." }` regardless of user existence.
- **HMAC Storage**: Raw OTP values are never stored. Only HMAC-SHA256 hashes generated with `AUTH_SECRET` are stored in Redis.
- **Constant-Time Comparison**: OTP verification uses `crypto.timingSafeEqual` to eliminate timing side-channel attacks.
- **Single-Use Enforcement**: Upon successful verification, the challenge key is deleted from Redis atomically before session creation.
- **Replay Protection**: Consumer cannot reuse an OTP challenge. Requesting a new OTP replaces any previous active challenge.
- **Sensitive Data Logging Protection**: `logger` redacts `otp`, `waba_api_key`, and `token` fields automatically. Phone numbers in log messages are masked (`+91****1210`).

---

## 6. Provider Abstraction & Environment Configuration

- **Provider Interface**: `WhatsAppOtpProvider` in `src/lib/whatsapp/provider.ts`.
- **Watxio Gateway**: `WatxioWhatsAppProvider` in `src/lib/whatsapp/watxio.ts` handles production delivery using `WABA_API_ENDPOINT`, `WABA_API_KEY`, and `WABA_PHONE_NUMBER_ID`.
- **Test Adapter**: `TestWhatsAppProvider` simulates dispatch for automated tests and local dev when `WABA_API_KEY` is not present.
- **Production Validation**: In production (`NODE_ENV=production`), missing `WABA_API_KEY` causes explicit failure during startup/provider initialization.
