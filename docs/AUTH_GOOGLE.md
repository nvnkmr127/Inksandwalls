# Auth.js Google OAuth Authentication Architecture

**Phase**: 02.03  
**Status**: APPROVED & LOCKED  
**Canonical Spec Reference**: `INKs-and-Walls-PRD.md` §8 (Authentication Strategy)

---

## 1. Overview

Google OAuth is integrated directly into the unified Auth.js framework alongside the WhatsApp OTP credentials provider. Auth.js manages the complete OAuth lifecycle (authorization redirects, code exchanges, state validation, and secure session cookie issuance).

---

## 2. Architecture & OAuth Flow

```text
User selects "Continue with Google"
        ↓
Auth.js initiates OAuth flow (`signIn("google")`)
        ↓
Redirect to Google OAuth 2.0 consent endpoint (`https://accounts.google.com/o/oauth2/v2/auth`)
        ↓
User grants permissions (openid, profile, email)
        ↓
Google redirects to Auth.js callback route (`/api/auth/callback/google`)
        ↓
Auth.js exchanges authorization code for identity tokens server-side
        ↓
`jwt` callback maps `sub`, `name`, `email`, `picture`, `role` ("CUSTOMER")
        ↓
`session` callback constructs `session.user` identity
        ↓
Encrypted JWT session token set in HTTP-only cookie
```

---

## 3. Required Scopes & Identity Data

Only the minimal required OAuth scopes are requested to adhere to principle of least privilege:

* `openid`: Standard OpenID Connect identity provider claim
* `profile`: Basic user name and profile picture URL (`name`, `picture`)
* `email`: User primary email address (`email`, `email_verified`)

> [!WARNING]
> Do NOT request access to Google Drive, Gmail, Calendar, Contacts, or secondary APIs.

---

## 4. Environment Variables

| Variable | Required | Server-Only | Description |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | Yes | Yes | Google Cloud Console OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Yes | Google Cloud Console OAuth 2.0 Client Secret |
| `AUTH_SECRET` | Yes | Yes | HMAC secret for Auth.js JWT signing & cookie encryption |
| `AUTH_URL` / `NEXT_PUBLIC_APP_URL` | Yes | No | Canonical app domain (`https://inksandwalls.com`) |

---

## 5. Google Cloud Console Setup Guide

### 5.1 Project Creation & Consent Screen
1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select the project `inks-and-walls-prod`.
3. Navigate to **APIs & Services > OAuth consent screen**.
4. User Type: **External**.
5. App name: `INKS & Walls`.
6. User support email: `support@inksandwalls.com`.
7. App domain & Authorized domains: `inksandwalls.com`.
8. Developer contact information: `dev@inksandwalls.com`.
9. Scopes: Add `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`.

### 5.2 OAuth 2.0 Web Client Credentials
1. Navigate to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. Application type: **Web application**.
4. Name: `INKS & Walls Auth.js Web Client`.
5. Authorized JavaScript origins:
   - Development: `http://localhost:3000`
   - Production: `https://inksandwalls.com`
6. Authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://inksandwalls.com/api/auth/callback/google`
7. Copy Client ID & Client Secret into Railway / Environment configuration.

---

## 6. Account-Linking & Identity Boundary

- **Minimal Identity**: Google authentication produces standard Auth.js JWT session identity containing `id`, `name`, `email`, `image`, and `role: "CUSTOMER"`.
- **No Unsafe Account Linking**: Automatic identity merging based solely on unverified emails is disabled to prevent account takeover vectors.
- **Phase 03.01 Migration Path**: Persistent customer model & multi-provider account linking will be introduced in Phase 03.01.

---

## 7. Security Rules

1. **Server-Only Credentials**: `GOOGLE_CLIENT_SECRET` must never be prefixed with `NEXT_PUBLIC_` or bundled in client JS.
2. **State Verification**: CSRF state checks managed automatically by Auth.js.
3. **No Credential Logging**: Access tokens, refresh tokens, and client secrets are strictly excluded from structured logs.
4. **HttpOnly Cookies**: Session tokens use `HttpOnly`, `SameSite=lax`, and `Secure` (production) cookies.
