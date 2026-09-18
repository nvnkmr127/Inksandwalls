# User Identity & Role Architecture

## Overview

This document details the core identity and role architecture established in **Micro Phase 03.01** for the **INKs & Walls** application.

---

## 1. Application Roles

The role foundation supports four distinct role tiers:

| Role Enum | PRD Terminology | Description | Default Status |
| :--- | :--- | :--- | :--- |
| `GUEST` | `guest` | Unauthenticated visitor browsing the storefront. Does not possess a database `User` record. | N/A |
| `CUSTOMER` | `customer` | Authenticated store shopper. Can manage profile, addresses, orders, wishlists, and reviews (in future phases). | `CUSTOMER` (Default for new users) |
| `STORE_ADMIN` | `store_admin` | Operational administrator. Handles order processing, catalogue updates, and store configuration. | Assigned via server/seed |
| `SUPER_ADMIN` | `super_admin` | Platform superuser with full system access, user management, and system-level configuration capabilities. | Assigned via server/seed |

> [!NOTE]
> **Phase Boundary**: Permission enforcement and RBAC guards are intentionally excluded from Phase 03.01. Role-based authorization rules and route guards belong to **Micro Phase 03.02**.

---

## 2. User & Customer Domain Separation

To preserve a clean architecture and prevent authentication concerns from leaking into domain entities, identity is decoupled:

```text
User (1) ─── (0..1) Customer
```

- **`User` Model**: Handles core application identity, authentication provider linkage (`Account`), user role (`Role`), account status (`UserStatus`), and global contact details (`email`, `phone`).
- **`Customer` Model**: Represents the ecommerce domain customer entity. Serves as the anchor for future ecommerce relations such as addresses, orders, wishlists, reviews, and shopping cart persistence.

---

## 3. Account Status

The `UserStatus` enum manages high-level account status:

- `ACTIVE` (Default): Normal operating account state.
- `SUSPENDED`: Account administratively disabled (UI and suspension guards to be built in administrative phases).

---

## 4. Authentication Identifiers & Provider Linkage

The data model supports dual authentication pathways:

1. **WhatsApp OTP**: Authenticated via verified E.164 phone numbers (e.g. `+919876543210`). The `phone` field on `User` is normalized, unique, and strictly server-controlled. OTP challenge storage remains Redis-backed (Phase 02.02).
2. **Google OAuth**: Authenticated via standard Auth.js `Account` provider records. The `email` field on `User` is optional, unique, and synchronized upon OAuth login.

> [!IMPORTANT]
> - `email` and `phone` are both optional on the `User` table so phone-only shoppers and Google-only users can authenticate cleanly without artificial placeholder values.
> - Account merging between phone and email identities is **not** performed automatically to prevent security vulnerabilities. Identity linking boundaries will be addressed in dedicated future phases.

---

## 5. Guest Shopper Policy

- Anonymous visitors browsing the storefront are classified under the conceptual `GUEST` role.
- Anonymous visitors **do NOT receive database `User` records**.
- `isGuest()` helper returns `true` when no valid session is present.

---

## 6. Security Boundaries

- Role assignment is strictly server-controlled.
- Client payloads (e.g., `POST`, `PUT`, `PATCH` requests to API endpoints or server actions) attempting to inject or update `role` or `status` are automatically sanitized and rejected.
