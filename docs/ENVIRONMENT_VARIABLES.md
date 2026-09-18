# INKs & Walls Environment Variable Inventory

**Micro Phase**: 01.05  
**Status**: APPROVED & LOCKED (Micro Phase 01.05 Observability, Sentry, Logging & Global Error Handling Configured)  
**Canonical Spec Reference**: `INKs-and-Walls-PRD.md` §8, §9

> [!IMPORTANT]
> **Security Mandate**: Never commit actual secrets or credentials to source control. This file contains placeholder syntax and documentation only. Production secrets must be managed securely through Railway Service Environment Variables.

---

## 1. Application

| Environment Variable | Required | Default / Example | Purpose & Description |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Yes | `https://inksandwalls.com` | Base public URL of the application for canonical URLs, Auth callbacks, and metadata. |
| `NODE_ENV` | Yes | `production` | Node execution environment (`development`, `test`, `production`). |
| `PORT` | Yes | `3000` | Port automatically assigned by Railway host environment for binding HTTP server. |

---

## 2. Database

| Environment Variable | Required | Default / Example | Purpose & Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/dbname?pgbouncer=true` | Railway PostgreSQL pooled connection string for application runtime queries via Prisma Client. |
| `DIRECT_URL` | Yes | `postgresql://user:pass@host:5432/dbname` | Direct Railway PostgreSQL connection string used exclusively by Prisma schema migrations. |

---

## 3. Redis

| Environment Variable | Required | Default / Example | Purpose & Description |
|---|---|---|---|
| `REDIS_URL` | Yes | `redis://default:secret@host:6379` | Railway Redis connection URL for BullMQ job queues, caching, and rate-limiting. |

---

## 4. Authentication

| Environment Variable | Required | Default / Example | Purpose & Description |
|---|---|---|---|
| `AUTH_SECRET` | Yes | `your-32-byte-base64-secret` | Cryptographic key used by Auth.js (`next-auth`) to sign and encrypt session JWTs and cookies. |
| `AUTH_URL` | Yes | `https://inksandwalls.com` | Canonical URL of the application used by Auth.js to construct OAuth callback redirects. |
| `GOOGLE_CLIENT_ID` | Yes | `xxxx.apps.googleusercontent.com` | Google OAuth 2.0 Client ID generated in Google Cloud Console. |
| `GOOGLE_CLIENT_SECRET` | Yes | `GOCSPX-xxxxxx` | Google OAuth 2.0 Client Secret generated in Google Cloud Console. |
| `WABA_API_ENDPOINT` | Yes | `https://api.watxio.com/v1` | WABA gateway endpoint (via Watxio) for sending WhatsApp OTP verification messages. |
| `WABA_API_KEY` | Yes | `watxio_live_xxxxxx` | API key for authenticating requests to the WABA gateway service. |
| `WABA_PHONE_NUMBER_ID` | Yes | `100234567890` | Registered WABA phone number account ID used to originate WhatsApp messages. |
| `WHATSAPP_OTP_TTL_SECONDS` | No | `300` | Expiration time for WhatsApp OTP challenge in seconds (default: 300 / 5 minutes). |
| `WHATSAPP_OTP_REQUEST_COOLDOWN_SECONDS` | No | `60` | Minimum delay between consecutive OTP requests for a single phone number (default: 60 seconds). |
| `WHATSAPP_OTP_MAX_REQUESTS_PER_HOUR` | No | `5` | Maximum number of OTP requests allowed per phone number in an hour (default: 5). |
| `WHATSAPP_OTP_MAX_VERIFY_ATTEMPTS` | No | `5` | Maximum allowed failed OTP verification attempts before challenge invalidation (default: 5). |

---

## 5. Cloudflare R2

| Environment Variable | Required | Default / Example | Purpose & Description |
|---|---|---|---|
| `R2_ACCOUNT_ID` | Yes | `cf_account_id_xxxxxx` | Cloudflare Account ID hosting the R2 bucket. |
| `R2_ACCESS_KEY_ID` | Yes | `r2_access_key_xxxxxx` | S3-compatible Access Key ID for Cloudflare R2 bucket access. |
| `R2_SECRET_ACCESS_KEY` | Yes | `r2_secret_key_xxxxxx` | S3-compatible Secret Access Key for Cloudflare R2 bucket access. |
| `R2_BUCKET_NAME` | Yes | `inks-and-walls-media` | Target Cloudflare R2 bucket name for storing variant images. |
| `R2_PUBLIC_DOMAIN` | Yes | `https://media.inksandwalls.com` | Public CDN custom domain mapping to the R2 bucket for serving images via `next/image`. |

---

## 6. Razorpay

| Environment Variable | Required | Default / Example | Purpose & Description |
|---|---|---|---|
| `RAZORPAY_KEY_ID` | Yes | `rzp_live_xxxxxx` | Razorpay public Key ID for client-side checkout widget initialization. |
| `RAZORPAY_KEY_SECRET` | Yes | `rzp_secret_xxxxxx` | Razorpay private Key Secret for server-side API calls and order creation. |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | `whsec_xxxxxx` | HMAC secret for verifying incoming Razorpay payment event webhooks. |

---

## 7. Resend

| Environment Variable | Required | Default / Example | Purpose & Description |
|---|---|---|---|
| `RESEND_API_KEY` | Yes | `re_xxxxxx` | Resend API Key for sending transactional email (OTP, order confirmations, shipping updates). |
| `RESEND_FROM_EMAIL` | Yes | `orders@inksandwalls.com` | Verified domain sender email address for all transactional email communications. |

---

## 8. Brevo

| Environment Variable | Required | Default / Example | Purpose & Description |
|---|---|---|---|
| `BREVO_API_KEY` | Yes | `xkeysib-xxxxxx` | Brevo (Sendinblue) API key for syncing customer marketing contacts and email newsletters. |
| `BREVO_MARKETING_LIST_ID` | Yes | `2` | List ID in Brevo for auto-subscribing newsletter signup customers. |

---

## 9. Sentry & Logging

| Environment Variable | Required | Default / Example | Purpose & Description |
|---|---|---|---|
| `SENTRY_DSN` | Optional | `https://xxxx@o0.ingest.sentry.io/0` | Server/Edge Sentry DSN for error telemetry. |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | `https://xxxx@o0.ingest.sentry.io/0` | Public browser client Sentry DSN for client-side crash reporting. |
| `SENTRY_AUTH_TOKEN` | Optional | `sntrys_xxxxxx` | Build-time authentication token for uploading release source maps to Sentry. |
| `SENTRY_ORG` | Optional | `inks-and-walls` | Sentry organization slug used for source-map release matching. |
| `SENTRY_PROJECT` | Optional | `inks-and-walls-store` | Sentry project slug used for source-map release matching. |
| `LOG_LEVEL` | Optional | `info` | Minimum log output level (`debug`, `info`, `warn`, `error`). Defaults to `info` in production. |

---

## 10. Analytics

| Environment Variable | Required | Default / Example | Purpose & Description |
|---|---|---|---|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Yes | `G-XXXXXXXXXX` | Google Analytics 4 Measurement ID for client tracking. |
| `NEXT_PUBLIC_GTM_ID` | Yes | `GTM-XXXXXXX` | Google Tag Manager Container ID. |
| `NEXT_PUBLIC_META_PIXEL_ID` | Yes | `123456789012345` | Meta (Facebook) Pixel ID for client-side ad event tracking. |

---

## 11. Application Security

| Environment Variable | Required | Default / Example | Purpose & Description |
|---|---|---|---|
| `CRON_SECRET` | Yes | `your-secure-cron-secret-token` | Secret header key to authorize internal background cron trigger routes (e.g. BullMQ health, abandoned cart cleanup). |
| `ENCRYPTION_KEY` | Yes | `32-char-random-secret-key-phrase` | Key used for encrypting sensitive customer data or tokens stored in database fields. |
