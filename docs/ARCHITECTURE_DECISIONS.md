# INKs & Walls Architecture Decisions

**Micro Phase**: 01.06  
**Status**: APPROVED & LOCKED (Micro Phase 01.06 Shared UI Kit Configured)  
**Canonical Spec Reference**: `INKs-and-Walls-PRD.md` §4, §8, §9

---

## 1. Executive Summary & Core Architectural Principles

This document formally locks the technical architecture, stack, deployment model, and development environment for the **INKs & Walls** online e-commerce platform.

### Core Architecture Directives
1. **Single-Store Platform**: The application is strictly a single-store e-commerce platform. Multi-tenancy, tenant routing, tenant middleware, organization models, and tenant isolation IDs (`tenantId`, `organizationId`) are explicitly prohibited.
2. **Full-Stack Next.js**: The system is a unified Next.js App Router application written in TypeScript, using Server-Side Rendering (SSR), Static Site Generation (SSG) / Incremental Static Regeneration (ISR), and Server Actions for mutations.
3. **No External Commerce Platforms**: WordPress, WooCommerce, Shopify, headless commerce services (Medusa, Saleor, Shopify Headless), separate backend frameworks (Express, NestJS, Django), and microservice architectures are strictly prohibited.
4. **Persistent Infrastructure**: The application runs as a persistent Node.js service hosted on Railway in the Singapore region, supported by internal managed PostgreSQL and Redis services.

---

## 2. Version Lock & Stack Specifications

The following versions are locked for the development environment and production deployment:

| Layer / Technology | Component | Locked Version | Selection Rationale & Compatibility |
|---|---|---|---|
| **Runtime** | Node.js | `20.x` LTS | Railway standard stable LTS runtime; supported by Next.js 14 and Prisma 5. |
| **Package Manager** | npm | `10.x` / `11.x` | Standard npm with strict `package-lock.json` lockfile for deterministic builds. |
| **Framework** | Next.js | `14.2.x` | Stable App Router, native Server Actions, Route Handlers, optimized image loading. |
| **UI Library** | React | `18.3.x` | Compatible with Next.js 14 App Router and Server Components. |
| **Language** | TypeScript | `5.x` | Strict type-checking enabled (`"strict": true`). |
| **Styling & UI** | Tailwind CSS + shadcn/ui | Tailwind `3.4.x` | Utility-first CSS, Radix UI primitives, Lucide icons. |
| **Database & ORM** | PostgreSQL + Prisma ORM | Prisma `5.14.x` | Strongly typed database client, connection pooling, schema migration management. |
| **Queue & Cache** | Redis + BullMQ | BullMQ `5.x` / `ioredis` | Asynchronous background processing for emails, WhatsApp, image transforms, and carts. |
| **Media Engine** | Cloudflare R2 + Sharp | Sharp `0.33.x` | Server-side image variant processing prior to S3-compatible R2 object upload. |
| **Authentication** | Auth.js (`next-auth`) | `v5` (App Router) | Session management, WhatsApp OTP integration, Google OAuth. |
| **Payment Gateway** | Razorpay SDK | `razorpay` Node SDK | Server-side order creation, checkout widget integration, webhook verification. |
| **Transactional Mail**| Resend SDK | `resend` `3.x` | Direct transactional email API for OTP, order confirmations, shipping updates. |
| **Marketing Mail** | Brevo REST API | Brevo API `v3` | Asynchronous sync for newsletter subscriptions and promotional campaigns. |
| **Monitoring** | Sentry | `@sentry/nextjs` | Client-side and server-side crash reporting and performance tracing. |

---

## 3. Application Architecture

- **Architecture Model**: Full-stack Next.js App Router application.
- **Server Execution**: Persistent Node.js process executing `next start` inside Railway container runtime.
- **Data Mutations**: Server Actions for form submissions, cart actions, admin operations, and state changes.
- **Rendering Strategy**:
  - **Server-Side Rendering (SSR)**: Dynamic catalogue listings, product detail pages with custom size calculator, customer portal, checkout, and admin dashboard.
  - **Static Site Generation (SSG) / ISR**: Static policy pages, static blog posts, and marketing landing pages.
- **Explicit Exclusions**: No WordPress, WooCommerce, Shopify, headless commerce engines, standalone backend microservices, or external REST API wrappers.

---

## 4. Hosting & Infrastructure Architecture (Railway Singapore)

### Topology Diagram

```
                        [ Cloudflare DNS & R2 CDN ]
                                     │
                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ Railway Singapore Region (ap-southeast-1)                                 │
│                                                                           │
│  ┌───────────────────────┐   ┌─────────────────────┐   ┌────────────────┐ │
│  │ Web Application Server │───│  PostgreSQL Server  │   │  Redis Server  │ │
│  │ (Next.js Node Server)  │   │ (Connection Pooled) │   │ (BullMQ Queue) │ │
│  └───────────────────────┘   └─────────────────────┘   └────────────────┘ │
└───────────────────────────────────────────────────────────────────────────┘
```

### Services & Deployment Relationship
1. **Application Service (`web`)**: Persistent Node.js container executing Next.js runtime, configured via `railway.json` (`buildCommand: "npm run build"`, `startCommand: "npm run start"`).
2. **Database Service (`postgres`)**: Railway-managed PostgreSQL instance (`DATABASE_URL`). Kept as internal infrastructure (non-publicly exposed except via secure environment credentials).
3. **Redis Service (`redis`)**: Railway-managed Redis instance (`REDIS_URL`). Kept as internal infrastructure for caching, session persistence, and BullMQ queues.
4. **Network Access**: Internal micro-networking allows the Next.js service to access Postgres and Redis over high-speed private Railway internal network interfaces.
5. **Deployment Pipeline**: GitHub push to `main` branch triggers automatic Railway build, Next.js production build, deployment, and health check validation.

### Health Check & Operational Guardrails
- **Health Check Endpoint**: `/api/health` returning JSON `{ status: "ok", timestamp: ISO }`. Railway application service configured with HTTP health check probe targeting `/api/health` with a 100s timeout.
- **Railway Spend Cap**: Account hard spend cap set to an initial floor of **$5–$15/month** to prevent run-away billable compute usage.

---

## 5. Database Architecture (PostgreSQL + Prisma)

- **Database Engine**: PostgreSQL 16 on Railway.
- **ORM & Version**: Prisma ORM `5.14.0` (`prisma` / `@prisma/client`).
- **Prisma Client Singleton**: Centralized module at `src/lib/prisma.ts` using `globalThis` caching to prevent connection leakages during Next.js App Router hot reloading.
- **Migration Infrastructure**:
  - Declarative migrations stored in `prisma/migrations/`.
  - Development Workflow: `npm run db:migrate` (`npx prisma migrate dev`).
  - Production Release Workflow: Non-destructive controlled execution via `npm run db:migrate:deploy` (`npx prisma migrate deploy`) during Railway release step. Never run `prisma migrate reset` in production.
- **Connection Handling**:
  - `DATABASE_URL`: Connection string provided via Railway service environment for application queries and migrations.
- **Seed Strategy**: Safe skeleton script at `prisma/seed.ts` executed via `npm run db:seed` (`tsx prisma/seed.ts`). Safe for repeated executions; contains no fake business data.
- **Micro Phase 01.03 Guardrail**: Schema initialized with baseline `SystemHealth` model. All business models (`Product`, `Category`, `Customer`, `Order`, `Cart`, etc.) strictly deferred to future micro-phases.

---

## 6. Redis & Queue Architecture (Railway Redis + BullMQ)

- **Engine**: Railway Redis.
- **Queue Framework**: BullMQ.
- **Queue Use Cases (Deferred Execution)**:
  - **Abandoned Cart Jobs**: Delayed triggers (1h, 24h) for WhatsApp/Email cart recovery reminders.
  - **Campaign Jobs**: Batch dispatch for Brevo newsletter sync and promotional messaging.
  - **Image Processing Jobs**: Async processing of high-resolution wallpaper/art uploads via Sharp.
  - **Notification Retries**: Retry logic with backoff for WABA and Resend API calls.
- **Phase 00.02 Guardrail**: BullMQ queues are documented; background job logic is not implemented in this phase.

---

## 7. Media Architecture (Cloudflare R2 + Sharp Image Pipeline)

- **Storage Provider**: Cloudflare R2 (S3-compatible object storage) via `@aws-sdk/client-s3`.
- **Processing Engine**: Sharp (`sharp`) on Next.js server runtime.
- **Storage Abstraction Layer**:
  - `src/lib/storage/r2.ts`: Server-only S3Client initialization and environment credential management (`server-only`).
  - `src/lib/storage/storage.ts`: Clean domain abstraction providing `uploadObject`, `deleteObject`, `objectExists`, `getPublicUrl`.
  - `src/lib/storage/keys.ts`: Deterministic, sanitized key generation (`uploads/{resource}/{uniqueId}/{variant}.{format}`) avoiding path traversal or unsafe characters.
- **Upload Validation**:
  - Max file size limit: Configurable (default 10MB).
  - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/gif`.
  - Binary inspection: Header magic bytes inspection (`FF D8 FF`, `89 50 4E 47`, `RIFF...WEBP`, `ftypavif`) to prevent MIME spoofing.
- **Sharp Image Variant Pipeline**:
  - Auto-rotates EXIF orientation.
  - Generates responsive WebP variants:
    - `thumbnail`: max width 200px
    - `small`: max width 600px
    - `medium`: max width 1200px
    - `large`: max width 1920px
    - `original`: max width 2560px
  - WebP quality optimized to 82 to achieve storefront LCP target < 2.5s.
- **Next.js Integration & Custom Loader**:
  - `src/lib/images/r2-loader.ts`: Custom Next.js image loader resolving optimal R2 variant URL based on requested `src` key and `width`.
  - `src/components/ui/OptimizedImage.tsx`: Reusable React component wrapping `next/image` with R2 loader integration and zero layout shift.
- **Security & Boundaries**:
  - R2 secrets (`R2_SECRET_ACCESS_KEY`, `R2_ACCESS_KEY_ID`) are strictly isolated server-side.
  - API upload route at `/api/media/upload` validates payloads and prepares for Phase 02 Auth authorization integration.

---

## 8. Authentication Architecture (Auth.js Session + Middleware)

- **Authentication Framework**: Auth.js (`next-auth` `^5.0.0-beta.32`). Centralized configuration located at `src/lib/auth/auth.config.ts` and `src/lib/auth/index.ts`.
- **Session Strategy**: Stateless **JWT** (`session: { strategy: "jwt" }`).
  - *Rationale*: JWT tokens allow fast, decentralized token verification inside Next.js App Router Middleware and Edge/Node runtimes without performing database lookups on every incoming request. Sessions expire after 30 days (`maxAge: 30 * 24 * 60 * 60`).
- **Auth Secret Management**: Configured via environment variable `AUTH_SECRET`. Never hardcoded in production or committed to repository.
- **Server-Side Session Access**: Centralized helper module at `src/lib/auth/session.ts` providing typed session access (`getSession()`, `getCurrentUser()`, `isAuthenticated()`, `isGuest()`) for Server Components, Server Actions, and Route Handlers without duplicating Auth.js configuration.
- **Middleware Foundation**: Located at `src/middleware.ts` using Auth.js `auth(...)` wrapper.
  - *Matcher*: Excludes static assets, internal `_next` bundles, favicons, and static image/font extensions (`/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)`).
  - *Correlation Tracing*: Attaches request correlation ID (`x-request-id`) across incoming requests.
- **Public Route & Guest Strategy**: Public storefront routes (`/`, `/products`, `/blog`, public APIs) remain completely accessible without mandatory login. Unauthenticated requests are identified as Guest shoppers.
- **Future Authorization Boundaries**:
  - *Public*: Storefront browsing, product detail pages, blog, policy pages.
  - *Customer*: `/account/*`, order history, wishlist, address management (Phase 03 RBAC).
  - *Admin*: `/admin/*` management dashboard (Phase 03 RBAC).
- **Security & Privacy Policy**:
  - Session cookies use `HttpOnly`, `SameSite=lax`, and `Secure` attributes in production.
  - Minimal session payload size: stores identity metadata (`id`, `name`, `email`, `phone`, `role`) only; full customer profiles, orders, or PII are loaded from database on demand.
  - Authentication tokens, cookies, OTPs, and `AUTH_SECRET` are strictly excluded from application logs and Sentry error telemetry.
- **Providers & RBAC Guardrail**: WhatsApp OTP (Phase 02.02), Google OAuth (Phase 02.03), Auth UI (Phase 02.04), and RBAC access enforcement (Phase 03) are deferred to their designated micro-phases.

---

## 9. Payment Architecture (Razorpay + COD)

- **Primary Gateway**: Razorpay Node.js SDK.
- **Supported Payment Methods**: UPI, Debit/Credit Cards, Net Banking, Cash on Delivery (COD).
- **Online Checkout Workflow**:
  ```
  Server Order Creation (Razorpay Order API)
    → Client Razorpay Checkout Widget
    → Payment Execution
    → Razorpay Webhook Event Dispatch (`payment.captured`)
    → Webhook Signature Verification (`RAZORPAY_WEBHOOK_SECRET`)
    → Idempotent Order & Payment Record Confirmation
  ```
- **COD Eligibility Engine**: Separate flow enforcing pincode serviceability check, order value threshold capping, and mandatory phone OTP confirmation.
- **Phase 00.02 Guardrail**: Payment routes, keys, and webhooks are deferred to Phase 07.

---

## 10. Email & WhatsApp Architecture

- **Communication Channels & Strict Responsibilities**:
  - **Resend**: Transactional emails exclusively (Auth OTP, Order Confirmation, GST Invoice, Shipping AWB Update, Delivery Confirmation).
  - **WABA (Watxio)**: WhatsApp communications exclusively (WhatsApp OTP, Order Status Updates, Abandoned Cart Reminders, Exclusive Offers, Consultation Enquiries).
  - **Brevo**: Marketing newsletters and bulk promotional campaign emails.
- **Isolation Rule**: Bulk marketing emails must never be sent through the primary application server or Resend transactional pipeline.

---

## 11. Observability Architecture (Sentry & Structured Logging)

- **Monitoring Tool**: Sentry (`@sentry/nextjs`).
- **Telemetry Coverage**:
  - Server-side runtime errors (`sentry.server.config.ts`, `instrumentation.ts`).
  - Edge runtime errors (`sentry.edge.config.ts`).
  - Browser client runtime rendering errors (`sentry.client.config.ts`).
  - App Router route-level (`src/app/error.tsx`) and root fatal (`src/app/global-error.tsx`) error boundaries.
  - Future telemetry hooks: Razorpay payment failures, BullMQ job errors, Auth errors.
- **Environment Strategy**:
  - Distinguishes `development`, `preview`, and `production` environments.
  - Local development suppresses debug telemetry sent to production Sentry DSN.
- **Source Maps Strategy**:
  - Build-time uploading via `SENTRY_AUTH_TOKEN` (kept server/build-side only).
  - Source maps hidden from client bundles (`hideSourceMaps: true`) to avoid public code disclosure.
- **Structured Application Logger**:
  - Centralized module at `src/lib/logger.ts`.
  - Log levels: `debug`, `info`, `warn`, `error`.
  - Writes JSON logs directly to `stdout` (`console.log`/`info`/`warn`) and `stderr` (`console.error`) for Railway compatibility.
  - Safe error object parsing (`name`, `message`, `stack`) without secondary serialization failures.
- **Sensitive Data & Security Policy**:
  - Automated recursive metadata redaction scrubbing secrets (`password`, `otp`, `auth`, `cookie`, `creditCard`, `cvv`, `r2_secret_access_key`, `database_url`, `razorpay_key_secret`, `resend_api_key`, `brevo_api_key`, `waba_api_key`).
  - No raw authorization headers, cookies, passwords, or payment credentials logged or sent to Sentry.
- **Error Normalization & Response Strategy**:
  - Standard error classes at `src/lib/errors.ts` (`AppError`, `ValidationError`, `AuthError`, `ForbiddenError`, `NotFoundError`, `ExternalServiceError`).
  - API error response builder `createErrorResponse` producing standardized JSON `{ error: { code, message, correlationId } }`.
  - Internal technical details (stack traces, SQL errors) masked in production responses.
- **Request Correlation Strategy**:
  - Lightweight correlation ID utility `src/lib/correlation.ts` attaching `x-request-id` across incoming requests, structured logs, and Sentry events.

---

## 12. Analytics Architecture (GA4 + GTM + Meta Pixel)

- **Analytics Stack**: Google Analytics 4, Google Tag Manager, Meta Pixel.
- **Mandatory E-Commerce Tracking Events**:
  - `view_item` (Product view with variant metadata).
  - `add_to_cart` (Cart addition with custom dimensions e.g. wall size).
  - `begin_checkout` (Initiate checkout flow).
  - `purchase` (Order completed with dual tracking: client-side GTM + server-side conversion API).
- **Client Management**: GTM container handles client-side scripts to allow tag management without code redeployment.

---

## 13. Single-Store Architecture Lock

The INKs & Walls codebase is explicitly locked as a single-store e-commerce application.

### Strict Prohibitions
- NO `Organization` or `Tenant` database tables.
- NO `tenantId` or `organizationId` foreign key columns on any database model.
- NO multi-tenant middleware or tenant-based sub-domain routing (`tenant.domain.com`).
- NO tenant-isolated database schemas or multi-tenant permission layers.

### Permission Model
Access security is governed strictly by user role (`GUEST`, `CUSTOMER`, `STORE_ADMIN`, `SUPER_ADMIN`).

---

## 14. Deferred Implementation Schedule

To ensure systematic and controlled development, all application business features are deferred to their designated roadmap micro-phases:

| Feature / System | Target Micro Phase |
|---|---|
| Next.js Scaffold & Tailwind setup | Phase 01.01 |
| Railway Infrastructure Provisioning | Phase 01.02 |
| Prisma Schema & DB Migrations | Phase 01.03 |
| Cloudflare R2 Upload Pipeline & Sharp | Phase 01.04 |
| Auth.js, WhatsApp OTP & Google OAuth | Phase 02 |
| Product Catalogue & PER_AREA Calculator | Phase 03 & Phase 04 |
| Cart & Checkout Flow | Phase 05 & Phase 06 |
| Razorpay & COD Payments | Phase 07 |
| Fulfillment & Order Management | Phase 08 |
| Admin Dashboard | Phase 10 |
| Abandoned Cart & Brevo Sync | Phase 11 |
| GA4, GTM & Meta Pixel Analytics | Phase 12 |

---

## 15. Shared UI Architecture

- **UI Framework & Foundation**: React, TypeScript, Tailwind CSS, `@base-ui/react` primitives, Lucide icons, and shadcn design tokens.
- **Component Architecture**:
  - **Form Primitives**: `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `FormField`, and `Button` (with `isLoading` spinner state).
  - **Dialogs & Modals**: `Dialog` (accessible overlay, title, description, close, focus trap, Escape key handling) and `ConfirmDialog` (confirmation wrapper for destructive and non-destructive actions).
  - **Badges & Status**: `Badge` component with semantic variants (`default`, `secondary`, `outline`, `destructive`, `success`, `warning`, `info`, `neutral`).
  - **Feedback Components**: `LoadingState` (spinners, skeletons, page loading), `EmptyState` (icon, title, description, action), `ErrorState` (title, safe description, retry action), and `ToastProvider` / `toast` helper (`success`, `error`, `warning`, `info`).
  - **DataTable Foundation**: Generic, strongly typed `DataTable` component supporting Search, Filter, Sort, Pagination, Loading, Empty, Search-Empty, and Error states.
- **Server and Client Boundaries**:
  - Components are Server Components by default.
  - Interactive components requiring client hooks or browser events (`Dialog`, `Toast`, `DataTableToolbar`, form controls) use `"use client"`.
- **Accessibility & Responsiveness**:
  - WAI-ARIA labels, role attributes, focus traps, keyboard navigation, and responsive overflow handling across Mobile, Tablet, and Desktop breakpoints.
- **No Embedded Business Logic**: Shared UI components are strictly presentational and generic, receiving data and handlers from parent business modules.
