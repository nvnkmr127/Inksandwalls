# INKs & Walls — Implementation Roadmap
### FIRST TASK output for the Master Development Prompt
_Source of truth: `INKs-and-Walls-PRD.md`. Execution method: one micro-phase at a time, each closed against the Master Prompt's Definition of Done._

---

## 0. Project audit (greenfield)

| # | Audit item | Finding |
|---|---|---|
| 1 | Project architecture | **New build.** Target: Next.js (App Router) full-stack on Railway (Singapore) — see PRD §4 |
| 2–13 | Existing modules / routes / DB / APIs / auth / components / integrations / bugs / debt | **None — greenfield.** Nothing to inspect or preserve |
| 14 | Files to preserve | None yet. "Do not delete" rules activate from Phase 01 onward as code is written |
| 15 | Recommended architecture | Per PRD §4 (custom Next.js, Postgres + Redis, Prisma, R2 + Sharp, Auth.js + WhatsApp OTP, Razorpay, WABA, Resend/Brevo) |
| — | **Multi-tenancy** | **N/A — single store.** Do NOT build org/tenant isolation. RBAC roles apply; org-scoping does not |

**Design system / reusable components:** none exist → build the shared UI kit in Phase 01 (DataTable, Form primitives, Modal, Confirm, Toast, loading/empty/error states) so every later micro-phase reuses it instead of one-off UI.

---

## 1. PRD → module breakdown

| Module | Covers (PRD ref) |
|---|---|
| M0 Foundation | §4, §9 — scaffold, Railway, Prisma, R2/Sharp, UI kit, observability |
| M1 Auth | §7.5 — WhatsApp OTP, Google, sessions |
| M2 Roles & permissions | §3 — RBAC (guest/customer/store-admin/super-admin), audit log |
| M3 Catalog data | §7.1 — products (PER_AREA/FIXED), categories, collections, variants, media |
| M4 Area-pricing engine | §6 — size calculator core |
| M5 Storefront browse | §7.1 — PLP, filters, search, sort, paginate, PDP |
| M6 Cart | §7.2 — persistent cart, dimension snapshots |
| M7 Coupons | §7.2 — discount engine |
| M8 Checkout | §7.2 — address, pincode, shipping, totals |
| M9 Payments | §7.3 — Razorpay, COD, webhooks |
| M10 GST invoicing | §7.2 — tax, HSN, invoice PDF |
| M11 Orders & fulfillment | §7.4 — status flow, courier/AWB, tracking templates, refunds, returns |
| M12 Accounts | §7.5 — profile, addresses, order history, wishlist, reviews |
| M13 Enquiry | §7.6 — consultation form, WhatsApp button |
| M14 Content | §7.7 — blog, policy pages |
| M15 Admin dashboard | §7.8 — management surfaces (built per-entity across modules) |
| M16 Notifications | §7.4 — WABA triggers, Resend transactional |
| M17 SEO core | §7.10 — metadata, schema, sitemap, robots |
| M18 Analytics | §7.10 — GA4, GTM, Pixel, server events |
| M19 Commerce SEO & Merchant feed | §7.11 / Phase 4b — metadata engine, identifiers, MC feed, SEO checks, redirects _(add-on)_ |
| M20 Marketing system | §7.9 — newsletter, abandoned cart, campaigns, marketing dashboard |
| M21 Security / Perf / QA / Launch | §8, §9, §10 P6 |

---

## 2. Phase & micro-phase breakdown

> Every micro-phase is a full vertical slice: DB → migration → validation → API/server action → authz → CRUD → UI (loading/empty/error/success) → responsive → tests. Close each against the Master Prompt's **Definition of Done** before moving on.

### Phase 00 — Audit & scaffold lock
- **00.01** Confirm greenfield baseline; record that no code exists to preserve
- **00.02** Lock decisions: Node version, package manager, Next.js/Prisma versions, Railway services (web + Postgres + Redis), full env-var inventory, single-tenant confirmed

### Phase 01 — Architecture & foundation
- **01.01** Next.js + TS + Tailwind + shadcn scaffold; base layout, header/footer, design tokens
- **01.02** Railway: web + Postgres + Redis, env config, **spend cap**, GitHub→Railway deploy, healthcheck
- **01.03** Prisma init + pooled connection; migration harness; seed-script skeleton
- **01.04** R2 bucket + upload service + **Sharp variant pipeline** + `next/image` custom loader
- **01.05** Observability: Sentry, structured logging, global error boundary
- **01.06** **Shared UI kit**: DataTable (search/filter/sort/paginate), Form primitives (validation + states), Modal, Confirm, Toast, loading/empty/error components

### Phase 02 — Authentication
- **02.01** Auth.js session + middleware
- **02.02** WhatsApp OTP request/verify via WABA, rate-limited
- **02.03** Google OAuth
- **02.04** Auth UI (login / OTP / logout); guest session handling

### Phase 03 — Roles, permissions & audit
- **03.01** User/Customer model + role enum (guest/customer/store_admin/super_admin)
- **03.02** Server-side RBAC guards, admin route gate, resource-ownership checks
- **03.03** Audit-log foundation for admin actions

### Phase 04 — Catalog data & admin CRUD
- **04.01** Category CRUD (admin) — full slice
- **04.02** Collection CRUD
- **04.03** Product CRUD (PER_AREA/FIXED) incl. rate/sqft, wastage, min-area, roll width, returnable, HSN
- **04.04** Product variant CRUD (FIXED)
- **04.05** Media upload/manage (R2) + alt text
- **04.06** Bulk CSV product import (validate → dry-run → commit)

### Phase 05 — Storefront & size calculator
- **05.01** **Area-pricing engine** (pure module): units, area, wastage, min-area, roll rounding — unit-tested
- **05.02** PLP: filters (category/colour/room/material/price) + search + sort + pagination
- **05.03** PDP: gallery, specs, related; FIXED variant selection
- **05.04** Size-calculator UI on PDP (PER_AREA) wired to engine; live price
- **05.05** Storefront states + mobile layouts

### Phase 06 — Cart & coupons
- **06.01** Cart model + persistence (guest cookie → merge on login); CartLine with **dimension snapshot**
- **06.02** Add/update/remove line (PER_AREA snapshot + FIXED qty); cart drawer/page
- **06.03** Coupon CRUD (admin)
- **06.04** Coupon application logic (scope, min-cart, expiry, usage caps) + validation

### Phase 07 — Checkout, payments, GST invoice
- **07.01** Address CRUD + pincode; checkout address step
- **07.02** Shipping-cost rule + order-summary totals
- **07.03** GST/tax computation + HSN; invoice PDF → R2
- **07.04** **Razorpay**: server order create, checkout, **webhook signature verify, idempotent** confirm
- **07.05** COD flow + eligibility
- **07.06** Order-placement transaction (no confirm without verified payment, except COD); success/failure states

### Phase 08 — Orders & manual fulfillment
- **08.01** Order model (payment + fulfillment status) + admin list (search/filter/sort/paginate)
- **08.02** Order detail (admin): item snapshots, customer, payment, invoice
- **08.03** Fulfillment transitions (CONFIRMED→IN_PRODUCTION→READY_TO_SHIP→SHIPPED→DELIVERED + cancel/return) with rules
- **08.04** Courier + AWB entry; **tracking-URL template map** → auto trackingUrl
- **08.05** Refund action (Razorpay) + audit
- **08.06** Returns (RETURN_REQUESTED/RETURNED) respecting `returnable`

### Phase 09 — Customer accounts
- **09.01** Profile + address management
- **09.02** Order history + detail + re-order + customer tracking link
- **09.03** Wishlist CRUD
- **09.04** Reviews & ratings: submit → moderation (admin) → display on PDP

### Phase 10 — Enquiry & content
- **10.01** Consultation enquiry form → model + admin list + notify
- **10.02** WhatsApp enquiry button (wa.me)
- **10.03** Blog CRUD (admin) + storefront list/detail
- **10.04** Policy/Page CRUD (shipping/returns/privacy/terms/about/contact)

### Phase 11 — Notifications
- **11.01** Resend transactional (order/OTP/shipping/delivery) + templates
- **11.02** WABA order triggers via BullMQ (confirmed/in-production/shipped/delivered+review)
- **11.03** Retry + failure logging

### Phase 12 — SEO core & analytics
- **12.01** Per-page metadata, canonical, OG/Twitter, robots
- **12.02** JSON-LD (Product/Breadcrumb/Review/Organization/LocalBusiness) + validation
- **12.03** Dynamic sitemap.xml + robots.txt
- **12.04** GA4 + GTM + Meta Pixel; e-commerce events + server-side purchase
- **12.05** GSC verify + sitemap submit; GBP/local schema

### Phase 13 — Commerce SEO & Merchant feed _(add-on — Phase 4b; include only if client approves added scope)_
- **13.01** ProductSeo + CategorySeo models + admin editor
- **13.02** Product identifiers (brand/GTIN/MPN/google category/condition/availability…) + admin
- **13.03** Merchant Center feed (Content API/XML) + scheduled updates + validation
- **13.04** Automated per-product SEO-check panel (rules + issue list)
- **13.05** 301 redirect management + 404 monitoring

### Phase 14 — Marketing system & dashboards
- **14.01** Newsletter capture + Brevo sync
- **14.02** Abandoned-cart job (Railway cron + BullMQ) → WABA + email
- **14.03** Campaign tools (festival/coupon)
- **14.04** Marketing dashboard (top products, revenue, coupon perf, abandonment, funnel)
- **14.05** Admin analytics (orders, sales, inventory status)

### Phase 15 — Security hardening
- **15.01** Server-side authz audit across all endpoints + ownership checks
- **15.02** Input validation (zod) coverage; SQLi/XSS/CSRF; rate limits (OTP/checkout/webhooks)
- **15.03** Secrets/env audit; secure file handling; webhook signature coverage

### Phase 16 — Performance
- **16.01** Query/index review; N+1 elimination; server-side filter/paginate
- **16.02** ISR/edge caching (PLP/PDP); image-variant tuning; **LCP < 2.5s** / CWV budget

### Phase 17 — Testing, seed & launch
- **17.01** Seed/demo data + ≤150 product load
- **17.02** E2E (browse→size→cart→pay→fulfill) + full CRUD matrix + unauthorized/edge cases
- **17.03** Team training + admin runbook
- **17.04** Backups (`pg_dump`→R2) verified; production-readiness checklist; launch; 30-day support begins

---

## 3. Dependency order (critical path)

```
00 → 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08        (spine: nothing sells without this chain)
                              │
        09, 10, 11 ───────────┤  (need 04–08; can parallelize after 08)
        12 ──────────────────┤  (needs storefront 05 + PDP)
        13 ──────────────────┤  (needs 04 + 12; add-on, gated on client approval)
        14 ──────────────────┤  (needs 06/07/08 + 11)
        15 → 16 → 17 ─────────┘  (last: hardening, perf, QA, launch)
```

Rules: never jump ahead to an easier later feature; never combine unrelated micro-phases; each micro-phase must leave the app building, typed, linted, and green before the next starts.

---

## 4. Definition of Done (per micro-phase)

Use the Master Prompt's DoD checklist verbatim. Summary gate: **requirement + DB + migration + server logic + validation + authn/authz + full CRUD (where relevant) + search/filter/sort/paginate (where relevant) + loading/empty/error/success states + responsive + existing functionality intact + TS/lint/build/tests pass + no fake data / dead buttons / broken routes.**

---

## 5. How to run this

- **Feed to a coding agent:** use the Master Development Prompt as the agent's system/instruction prompt, with **this roadmap + the PRD** as source of truth. Start at **Micro Phase 00.01**, one at a time, reporting in the Master Prompt's STEP 7 format.
- **Gate before Phase 04:** resolve PRD §11 client questions (wallpaper/blinds pricing specifics, GST/HSN) — they block the catalog + pricing engine.
- **Phase 13 is optional** — only if the client approves the added Commerce-SEO scope/price.
