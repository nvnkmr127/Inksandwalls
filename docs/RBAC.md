# Server Role-Based Access Control (RBAC) Architecture

## Overview

This document defines the server authorization framework, route gates, resource ownership checks, and security boundaries established in **Micro Phase 03.02** for **INKs & Walls**.

---

## 1. Authentication vs Authorization

- **Authentication (Who are you?)**: Managed exclusively by **Auth.js**. Handles credential validation, WhatsApp OTP verification, Google OAuth flows, and JWT session token generation.
- **Authorization (What are you allowed to do?)**: Managed by server-side authorization guards (`guards.ts`, `ownership.ts`, `permissions.ts`) and middleware route gates.

> [!IMPORTANT]
> **Server-Side Enforcement**: UI visibility changes (e.g. hiding an admin link) are strictly cosmetic. Every sensitive server action, API route, and database mutation enforces authorization server-side.

---

## 2. Application Role Tiers

The authorization model enforces four application roles:

| Role Enum | PRD Terminology | Storefront Access | Admin Access | Customer Ownership |
| :--- | :--- | :--- | :--- | :--- |
| `GUEST` | `guest` | Public routes | ❌ Blocked (401/Redirect) | ❌ None |
| `CUSTOMER` | `customer` | Public + Customer account | ❌ Blocked (403 Forbidden) | ✅ Own resources only |
| `STORE_ADMIN` | `store_admin` | Full storefront | ✅ Granted (`/admin*`) | ✅ Store operational access |
| `SUPER_ADMIN` | `super_admin` | Full storefront | ✅ Granted (`/admin*`) | ✅ Full administrative access |

---

## 3. Reusable Server Authorization Guards

Located in `src/lib/auth/guards.ts` (marked with `"server-only"` boundary to prevent client bundle leakage):

- `requireAuth()`: Ensures session exists. Throws `AuthError` (401) if unauthenticated.
- `requireRole(allowedRoles)`: Validates current user role against single or multiple allowed roles. Throws `AuthError` (401) or `ForbiddenError` (403).
- `requireAdmin()`: Shortcut for requiring `STORE_ADMIN` or `SUPER_ADMIN`.
- `requireSuperAdmin()`: Shortcut requiring `SUPER_ADMIN`.

---

## 4. Admin Route Gate (`/admin`)

The `/admin*` namespace is protected at the middleware level (`src/middleware.ts`):

1. **Unauthenticated Visitor**:
   - Page Request: Redirected to `/login?callbackUrl=/admin...`
   - API Request (`/admin/api*` or `Accept: application/json`): 401 Unauthorized response (`UNAUTHENTICATED`).
2. **Authenticated Customer / Guest**:
   - 403 Forbidden response (`FORBIDDEN`).
3. **Store Admin / Super Admin**:
   - Request allowed through to handler.

---

## 5. Resource Ownership & IDOR Protection

Located in `src/lib/auth/ownership.ts` (marked with `"server-only"` boundary):

`requireOwnership({ resourceUserId, sessionUserId, userRole, hideExistenceOnForbidden })`:

- **Client Input Prohibition**: `userId`, `customerId`, or `ownerId` supplied in browser request bodies or URL parameters are **never** trusted as proof of ownership.
- **Verification Flow**:
  1. Authenticate user session server-side.
  2. Load resource from PostgreSQL.
  3. Compare resource `userId` against `session.user.id`.
  4. Allow if matching owner or if user role is `STORE_ADMIN` / `SUPER_ADMIN`.
  5. Throw `ForbiddenError` (403) or `NotFoundError` (404) if hide existence is requested.

---

## 6. Standardized Error Outcomes

| Scenario | HTTP Status | Error Code | Client Response Message |
| :--- | :--- | :--- | :--- |
| Unauthenticated user accessing protected route | 401 | `UNAUTHENTICATED` | "Authentication required" |
| Authenticated user accessing unauthorized role resource | 403 | `FORBIDDEN` | "Access denied" |
| Resource ownership mismatch (with hidden existence) | 404 | `NOT_FOUND` | "Requested resource not found" |

> [!SECURITY]
> Internal role requirements (e.g. "Requires SUPER_ADMIN") are never exposed in production API responses to prevent information disclosure.

---

## 7. Future Fine-Grained Permissions

Located in `src/lib/auth/permissions.ts` (`hasPermission(role, permission)`):
Foundation matrix established for future capability checks:
- `catalog.read`, `catalog.write`
- `orders.read`, `orders.update`
- `customers.read`, `customers.update`
- `settings.write`, `system.manage`
