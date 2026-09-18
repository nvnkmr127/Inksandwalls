# INKs & Walls Project Baseline

## Project Status

Greenfield application baseline confirmed. The repository contains no existing application code, dependencies, framework setup, or database infrastructure. The directory currently contains only initial project specification documentation (`INKs-and-Walls-PRD.md` and `INKs-and-Walls-Build-Roadmap.md`).

## Existing Application

Greenfield project. No existing application functionality identified.

## Existing Routes

None exist.

## Existing Database

None exists.

## Existing Authentication

None exists.

## Existing Integrations

None exist.

## Existing Components

None exist.

## Existing Deployment

None exists.

## Files Requiring Preservation

No existing business functionality requires preservation. Initial specification files (`INKs-and-Walls-PRD.md` and `INKs-and-Walls-Build-Roadmap.md`) are kept as authoritative project documentation.

## Confirmed Architecture

The confirmed architecture per the canonical technical specification (PRD) is:

### Application Layer
- **Framework**: Custom Next.js full-stack application (App Router)
- **UI & Styling**: React, TypeScript, Tailwind CSS, shadcn/ui

### Infrastructure Layer
- **Platform / Host**: Railway (Singapore region, persistent Node.js application server)
- **Database**: PostgreSQL (Railway) with Prisma ORM
- **Cache & Queue**: Redis (Railway) with BullMQ job queues

### Storage & Media
- **Object Storage**: Cloudflare R2
- **Image Processing**: Sharp (variant generation at upload)

### Authentication
- **Framework**: Auth.js
- **Methods**: WhatsApp OTP through WABA (WhatsApp Business API / watxio), Google OAuth

### Payments
- **Gateways**: Razorpay (UPI, Cards, Net Banking) and Cash on Delivery (COD)

### Fulfillment
- **Fulfillment Model**: Manual fulfillment (courier, AWB assignment, tracking URL templates)

### Communication & Marketing
- **Transactional Email**: Resend
- **Campaigns / Newsletter**: Brevo
- **WhatsApp Messaging**: WABA (watxio)

### Analytics & Monitoring
- **Analytics & Tracking**: GA4, GTM, Meta Pixel, Server-side purchase event tracking
- **Error & Performance Monitoring**: Sentry

## Single Store Constraint

The application is explicitly designed as a single-store system.
- No multi-tenant architecture.
- No organization model.
- No `tenantId` or organization isolation fields shall be introduced into the database schema or application architecture.

## Scope Constraints

### In-Scope (Base Store)
- Product catalogue (PER_AREA products e.g., wallpaper/blinds, FIXED products e.g., wall art)
- Size calculator with wastage buffer & minimum billable area
- Cart & snapshot pricing
- Coupons & promotions
- Checkout flow
- Razorpay & COD payment methods
- GST invoicing
- Order management & manual fulfillment with tracking
- Customer accounts (wishlist, reviews, order history)
- Consultation & WhatsApp enquiries
- Blog & policy pages
- Admin dashboard
- Marketing system (abandoned cart, email/WhatsApp notifications)
- SEO & Analytics integration

### Out-of-Scope (Base Store)
- Logo design & brand design
- Product photography & product copywriting
- Catalogue population >150 launch products
- Ad management & ad budget
- Annual maintenance after the 30-day support period
- Separately gated scope: Commerce SEO and Merchant Center functionality (identified as added scope in PRD; excluded from base micro-phases)

## Next Micro Phase

Micro Phase 00.02 complete.  
Next micro-phase: 01.01, Next.js + TS + Tailwind + shadcn Scaffold.

