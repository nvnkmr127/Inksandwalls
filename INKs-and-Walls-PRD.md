# PRD — INKs & Walls Online Store
### Custom Next.js e-commerce · Railway · Cloudflare R2 · Manual fulfillment
_Wallpapers, blinds, wall art. Reference build similar to wallstorie.in._
**Status: FINAL — architecture settled. This is the canonical build spec.**

---

## 1. Goal & success criteria

A fast, SEO-ready, self-manageable store selling **area-priced wallpaper & blinds** and **fixed-price wall art**, with India-native payments, manual (made-to-order) fulfillment, and a built-in WhatsApp + email marketing system.

**Done means:**
- A shopper can size a wallpaper/blind, add to cart, pay (UPI/card/COD), and get WhatsApp + email updates through to delivery.
- The client's team can add/edit products, run coupons, mark orders shipped, and see what's selling — no developer needed.
- Pages rank on Google (SSR/SSG, clean metadata, schema), load fast (LCP < 2.5s on 4G), and fire GA4 + Meta Pixel e-commerce events correctly.

---

## 2. Scope

**In:** catalogue + size calculator · cart · checkout · Razorpay + COD · coupons · GST invoicing · manual fulfillment + tracking · accounts (wishlist/reviews/orders) · consultation enquiry · WhatsApp enquiry · blog + policy pages · admin dashboard · marketing system · SEO + analytics.

**Out (per proposal):** logo/brand design · product photos & copy (client provides, team uploads) · >150 products at launch · hosting at actual cost · ad management & budget · annual maintenance after 30-day support.

---

## 3. Users & roles

- **Guest** — browse, size, add to cart, guest checkout.
- **Customer** — account, wishlist, reviews, order history + tracking, saved addresses.
- **Store admin (client team)** — products, media, coupons, orders/fulfillment, content, marketing dashboard.
- **Super admin (DigiCloudify)** — config, integrations, roles, feature flags.

---

## 4. Architecture (settled)

Single **custom Next.js full-stack app** as a persistent Node server on **Railway**. No headless-commerce backend — small made-to-order catalogue where area-pricing is custom regardless. Single store, **not** multi-tenant.

| Layer | Choice | Notes |
|---|---|---|
| Host | **Railway — Singapore region** | Persistent Node server; closest region for India. Set a spend cap. |
| Framework | **Next.js (App Router) + React + TypeScript** | SSR/SSG for SEO; server actions for mutations |
| UI | **Tailwind CSS + shadcn/ui**, Embla, `next/image` (custom R2 loader) | Image-heavy catalogue — image handling is first-class |
| Database | **Postgres (Railway)** + **Prisma** | Schema §8 |
| Cache/queue | **Redis (Railway)** + **BullMQ** | Jobs: abandoned cart, campaigns, image processing |
| Scheduled jobs | **Railway cron** | Cart sweeps, campaign triggers |
| Media | **Cloudflare R2** + **Sharp variants at upload** | R2 free ≤10 GB; Sharp keeps image transforms free |
| Auth | **Auth.js** + **WhatsApp OTP** (via WABA) + Google | Phone-first login for India; OTP over WhatsApp avoids SMS cost |
| Payments | **Razorpay** (UPI, cards, net banking) + **COD** | PhonePe via Razorpay or direct — confirm §11 |
| Fulfillment | **Manual** — courier + AWB, tracking-URL templates | Full spec §7.4 |
| WhatsApp | **Your WhatsApp Business API (watxio)** | Enquiry, order updates, offers, abandoned-cart nudges |
| Transactional email | **Resend** | Order/OTP/shipping confirmations |
| Campaigns/newsletter | **Brevo** | Don't bulk-send from the app server |
| Analytics/pixels | **GA4 + Meta Pixel via GTM** + server events | GTM manages pixels without redeploys |
| Monitoring | **Sentry** | Errors + payment/webhook failures |

---

## 5. Running costs (client-facing)

| Item | Cost | Notes |
|---|---|---|
| **Railway** (app + Postgres + Redis) | **~$5–15/mo** | $5 floor incl. $5 credit; budget higher for always-on. Set spend cap. |
| Cloudflare R2 | ₹0 | Free ≤10 GB storage, zero egress |
| Resend / Brevo / Sentry | ₹0 | Free tiers cover this scale |
| GA4 / GTM / Meta Pixel / SSL | ₹0 | Free |
| WhatsApp (WABA) | Paise/msg | Utility (order) templates cheap; replies free in 24-hr window |
| **Razorpay** | **~2.36% per sale** | No setup/AMC fee. UPI mostly free (banks bear MDR ≤ ₹2,000). Only on sales. |
| Domain | ~₹1,000/yr | Year 1 in proposal |

**Floor: ~$5/month + transaction fees on sales.** No per-seat or fixed SaaS fees.

---

## 6. The crux: area-based pricing

Wallpaper and blinds are priced **per sq ft with customer-entered dimensions** — a cart line is a computed price with dimensions baked in, not "SKU × qty."

| Model | Products | Price |
|---|---|---|
| `PER_AREA` | Wallpaper, blinds | `area(sqft) × ratePerSqft`, with wastage buffer + min-area floor |
| `FIXED` | Wall art, framed prints | Variant price × qty |

**Size calculator (`PER_AREA`):**
- Inputs: width + height + **unit selector** (ft/inch/cm/mm) → normalise to sq ft.
- Per-product **wastage %** (e.g. +10–15%) and **minimum billable area**.
- Roll-based wallpaper: option to round up to roll/panel coverage via `rollWidth`.
- Blinds: width × drop, `mountType` (inside/outside), opacity/fabric variant.
- Cart line **snapshots**: dimensions, unit, area, rate, wastage, final price, options. Orders freeze the snapshot.
- One pricing function used on **PDP and cart** — single source of truth, typed + unit-tested.
- Inventory: custom-cut = **made-to-order** (`trackInventory: false`). Wall art can be stocked.

---

## 7. Complete feature list

### 7.1 Catalogue & discovery
Product types (`PER_AREA`/`FIXED`), categories, collections, media galleries, room-visualisation images. Filters (category, colour, room, material, price), Postgres search. PLP (listing) + PDP (detail with gallery, specs, size calculator, reviews, related products).

### 7.2 Cart & checkout
Persistent cart (guest cookie → merges on login), cart-line dimension snapshots. Coupons (%, flat, min-cart, product/category scope, expiry, usage caps). Checkout: address + pincode, shipping cost rule, payment. **GST invoice** + tax lines (HSN per product).

### 7.3 Payments
Razorpay: server order creation → checkout → **webhook signature verification** → order confirmed (idempotent). COD with optional pincode/eligibility rules. Order never confirmed without verified payment (except COD).

### 7.4 Manual fulfillment + tracking
Fulfillment status, separate from payment: `CONFIRMED → IN_PRODUCTION → READY_TO_SHIP → SHIPPED → DELIVERED` (+ `CANCELLED`, `RETURN_REQUESTED`, `RETURNED`).
Order/shipment fields: `courierName` (dropdown + Other), `awb`, `trackingUrl` (auto-built from courier URL templates), `shippedAt`, `deliveredAt`, `adminNote`.
Flow: paid → auto `IN_PRODUCTION` → team advances → at dispatch pick courier + AWB → `SHIPPED` → mark `DELIVERED`. Customer "Track" = deep link to courier page. Per-product `returnable: true/false` (custom-cut = non-returnable), reflected on PDP + returns policy.

### 7.5 Accounts
WhatsApp OTP + Google login, wishlist, moderated reviews & ratings, order history + re-order, saved addresses.

### 7.6 Enquiry
"Book a Free Consultation" → `Enquiry` record + email/WhatsApp notify (optional CRM push). WhatsApp enquiry button (`wa.me`).

### 7.7 Content
Blog (SEO), policy pages (shipping, returns, privacy, terms), About/Contact.

### 7.8 Admin dashboard
CRUD products (rate/sqft, wastage, min area, roll width, returnable, HSN), categories, media, coupons, blog/pages. Orders: view, advance fulfillment, invoice, refund. **Bulk CSV upload** (seed ≤150 at launch; team adds more). Role-gated.

### 7.9 Marketing system
Newsletter capture → Brevo sync. **Abandoned cart** (Railway cron + BullMQ) → WhatsApp + email nudge. Festival/coupon campaigns. Reviews & ratings feeding rich snippets. **Marketing dashboard**: top products, revenue, coupon performance, cart-abandonment rate, traffic→order funnel.

### 7.10 SEO & tracking
SSR/SSG, per-page metadata, OG, canonical, `sitemap.xml`, `robots.txt`, JSON-LD (Product, Breadcrumb, Review, Organization). GA4 + Meta Pixel via GTM with e-commerce events (view_item, add_to_cart, begin_checkout, purchase) + server-side purchase. SSL, image optimisation, Core Web Vitals budget.

### 7.11 Commerce SEO & Google Shopping _(added scope — see note in §10 Phase 4b)_
Upgrades the store's SEO from "metadata" to full commerce-SEO + a Google Shopping feed. This is **beyond the original proposal's one-line "SEO setup + GA"** and should be priced/timeboxed as an add-on.

- **Per-product metadata engine:** SEO title, meta description, slug, canonical, meta robots, OG (title/desc/image), Twitter (title/desc/image), image alt text + title.
- **Schema suite (auto-generated + validated):** Product, Breadcrumb, Review, FAQ, LocalBusiness, Organization, Address.
- **Category SEO:** title, meta description, slug, canonical, H1, intro content, category schema, internal-linking suggestions.
- **Global SEO management:** site title, global meta, robots.txt editor, XML sitemap, canonical management, **301 redirects**, **404 monitoring**, indexability/noindex/nofollow controls.
- **Product identifiers (for Shopping):** brand, SKU, GTIN, MPN, `google_product_category`, product_type, material, colour, size, condition, availability, price, sale price, currency, shipping, return policy.
- **Google Merchant Center feed (this store only):** auto product-feed generation (Content API or XML), scheduled updates, feed validation/diagnostics for this store's products, sale-price scheduling, custom labels.
- **Connections:** GA4 + GTM + Meta Pixel (already in build) + GSC (sitemap submission + verification) + GBP (single location).
- **Automated per-product SEO checks (admin panel):** missing/too-long/too-short title & meta, missing canonical, missing/duplicate H1, missing alt, missing schema, missing GTIN/MPN/brand/Google category, broken product URL, incorrect price/availability.

> **Not in this store** (a separate platform — see §12): multi-account Merchant Center management, Shopping/GSC analytics dashboards, site-wide crawlers, multi-location GEO engine, rank tracking, AI recommendation engine, WooCommerce/Shopify/external-feed integrations.

---

## 8. Data model (key entities)

```
Product(id, type[PER_AREA|FIXED], title, slug, description, shortDescription,
        categoryId, ratePerSqft?, minAreaSqft?, wastagePct?, rollWidth?, basePrice?,
        salePrice?, trackInventory, stock?, returnable, hsnCode, media[],
        brand, sku, gtin?, mpn?, googleProductCategory, productType,
        material?, colour?, size?, condition, availability)
ProductSeo(id, productId, seoTitle, metaDescription, canonicalUrl, metaRobots,
        ogTitle, ogDescription, ogImage, twitterTitle, twitterDescription,
        twitterImage, h1, imageAlt{}, faq[])          // per-product SEO/metadata
CategorySeo(id, categoryId, seoTitle, metaDescription, canonicalUrl, h1, intro)
Redirect(id, fromPath, toPath, code[301|302], createdAt)   // + 404 log
MerchantFeedItem(id, productId, feedStatus, issues[], lastSyncedAt) // MC feed state
ProductVariant(id, productId, options{}, price, sku, stock?)      // FIXED
Category(id, name, slug, parentId?)   Collection(id, name, slug, productIds[])
Customer(id, phone, email?, name, googleId?)   Address(...)
Cart(id, customerId?, email?, phone?, updatedAt)
CartLine(id, cartId, productId, pricingModel, dimensions{w,h,unit},
         areaSqft, ratePerSqft, wastagePct, qty, unitPrice, options{}, lineTotal)
Order(id, number, customerId, paymentStatus, fulfillmentStatus,
      items[snapshot], subtotal, discount, shipping, tax, total,
      gstInvoiceUrl, courierName?, awb?, trackingUrl?, shippedAt?, deliveredAt?)
Payment(id, orderId, provider, providerOrderId, signature, status)
Coupon(id, code, type, value, scope, minCart, usageLimit, expiresAt)
Review(id, productId, customerId, rating, body, status)
WishlistItem(id, customerId, productId)
Enquiry(id, name, phone, message, source, createdAt)
NewsletterSubscriber(id, email, source, syncedToEsp)
BlogPost(...)   Page(...)   // policy/content
```

---

## 9. Non-functional
- **Performance:** LCP < 2.5s; responsive R2 image variants; edge/CDN caching for PLP/PDP.
- **SEO:** static/ISR where possible; product pages indexable.
- **Security:** webhook signature verify; rate-limit OTP + checkout; secrets in Railway env; minimal PII.
- **Reliability:** idempotent payment webhooks; **nightly `pg_dump` → R2** (backup, alongside Railway's managed backups).

---

## 10. Phased delivery plan (6–8 weeks)

Every feature is mapped to a phase below. Each phase has a goal, its features, and an exit gate that must pass before moving on.

### Phase 0 — Foundations & setup _(Week 1)_
**Goal:** deployable skeleton with auth, admin shell, and image pipeline working.
- Repo, Next.js on **Railway (Singapore)**, Postgres + Redis, **spend cap set**
- Prisma schema + migrations (all entities from §8)
- Auth: **WhatsApp OTP + Google** login/session
- Admin shell (role-gated), base layout, header/footer, design system (Tailwind + shadcn)
- **R2 + Sharp image pipeline** + `next/image` custom loader
- Env/secrets, Sentry, GA4/GTM/Pixel scaffolding, GitHub → Railway CI/CD
**Exit:** app deploys; login works; admin loads; image upload → resized variants served from R2.

### Phase 1 — Catalogue & size calculator _(Week 2)_
**Goal:** shoppers can browse, filter, and price a product by area.
- Product model (`PER_AREA`/`FIXED`), categories, collections, media galleries
- **Size calculator + area-pricing engine** (unit conversion, wastage, min area, roll rounding) — typed + unit-tested
- PLP with filters (category, colour, room, material, price) + search
- PDP (gallery, specs, calculator, related products)
- Admin: product/category CRUD, **bulk CSV upload**
**Exit:** browse → filter → size a wallpaper → see correct computed price on PDP.

### Phase 2 — Cart, checkout & payments _(Week 3)_
**Goal:** a complete purchase works end to end.
- Persistent cart (guest → merge on login) with **dimension snapshots**
- Coupons/discounts engine
- Checkout: address, pincode, shipping cost rule
- **Razorpay** (order create, checkout, webhook verify, idempotent) + **COD**
- **GST invoice** + tax lines (HSN)
- Order creation + confirmation (email via Resend, WhatsApp via WABA)
**Exit:** buy end-to-end via UPI / card / COD; GST invoice generated; confirmation fires.

### Phase 3 — Accounts, fulfillment & content _(Week 4)_
**Goal:** customers manage orders; team ships them; content is live.
- Customer account: profile, addresses, order history, re-order, **wishlist**, **reviews & ratings** (moderated)
- **Manual fulfillment**: status flow, courier + AWB, tracking-URL templates, admin order management, returnable flag + returns
- **WABA order triggers**: confirmed · in production · shipped · delivered + review request
- Enquiry: **Book Free Consultation** form + **WhatsApp enquiry button**
- Content: **blog**, policy pages (shipping/returns/privacy/terms), About/Contact
**Exit:** customer tracks an order; admin advances an order to shipped; WhatsApp updates fire; content pages live.

### Phase 4 — SEO, analytics, performance & data load _(Week 5)_
**Goal:** indexable, tracked, fast, and seeded with real products.
- SEO: metadata, OG, canonical, `sitemap.xml`, `robots.txt`, JSON-LD (Product/Breadcrumb/Review/Organization)
- **GA4 + Meta Pixel via GTM** — e-commerce events + server-side purchase
- Performance pass: image optimisation, caching, **LCP < 2.5s**, Core Web Vitals budget
- Security hardening: rate limits, webhook signatures, SSL
- **Product data load (≤150)** + team-provided content
**Exit:** Lighthouse/CWV pass; events verified in GA4 + Pixel; catalogue seeded.

### Phase 4b — Commerce SEO & Merchant Center feed _(added scope — +1–1.5 weeks, price separately)_
**Goal:** every product is Shopping-ready and SEO-complete; the store has its own Merchant feed. _Optional add-on beyond the base proposal — include only if the client approves the extra scope/cost._
- Per-product metadata engine (title, meta, slug, canonical, robots, OG, Twitter, alt)
- Schema suite auto-generated + validated (Product/Breadcrumb/Review/FAQ/LocalBusiness/Organization/Address)
- Category SEO + internal-linking suggestions
- Global SEO: robots.txt, sitemap, canonical, **301 redirects, 404 monitoring**, indexability controls
- Product-identifier fields (brand, GTIN, MPN, google_product_category, condition, availability, etc.)
- **Google Merchant Center feed** (this store): auto-generation, scheduled updates, validation, sale-price scheduling, custom labels
- Connect GSC (sitemap/verify) + GBP; **automated per-product SEO-check panel** in admin
**Exit:** feed accepted by Merchant Center; SEO-check panel green on seeded products; schema validates.

### Phase 5 — Marketing system _(Week 6)_
**Goal:** the growth engine is live and visible.
- Newsletter capture → **Brevo** sync
- **Abandoned cart** (Railway cron + BullMQ) → WhatsApp + email nudge
- Festival / coupon **campaign tools**
- Reviews feeding rich snippets
- **Marketing dashboard**: top products, revenue, coupon performance, abandonment rate, funnel
**Exit:** abandoned-cart nudge fires on a test cart; dashboard shows live data.

### Phase 6 — QA, training & launch _(Weeks 7–8)_
**Goal:** live, stable, team self-sufficient.
- QA / UAT: cross-device, payment edge cases, webhook idempotency, calculator accuracy
- **Team training** (products, orders/fulfillment, coupons, campaigns)
- **Backups verified** (`pg_dump` → R2)
- Launch + buffer
- **30-day free support begins**
**Exit:** store live; team trained; support window active.

---

## 11. Resolve with client (before Phase 1–2)
1. **Wallpaper pricing:** per-sq-ft rolls vs custom murals? roll width? wastage %?
2. **Blinds:** types (roller/roman/zebra)? per sq ft? min size? mount options?
3. **PhonePe:** via Razorpay or direct PhonePe PG?
4. **GST:** rate(s), HSN codes, invoice format?
5. **Inventory:** which products (if any) are stocked vs made-to-order?
6. **Reach:** India-only confirmed?

---

## 12. Separate product — SEO / Shopping / Merchant / GEO platform (NOT this store)
The larger spec (multi-account Merchant Center management, Shopping + Search Console analytics dashboards, site-wide SEO crawler with audit scoring, multi-location GEO engine with rank tracking + competitor monitoring, AI SEO recommendation engine, WooCommerce/Shopify/external-feed integrations, scheduled cross-site reports, combined health dashboard) is a **standalone platform**, not a feature of one store. It pulls Google Merchant/Ads/Search Console/GBP APIs, runs crawls and rank tracking across sites, and manages other stores.

**Recommended home:** a **DS OS module** (reusable across every DigiCloudify client) or a standalone SaaS — aligns with the productization strategy far better than embedding it here. Needs its own PRD + architecture (multi-tenant, API integrations, job/crawler infra). Months of work, priced as a separate engagement.

---

## 13. Not in this build
Logo/brand design · product photos & copy (client provides) · >150 products at launch · hosting at actual cost · ad management & budget · annual maintenance after 30-day support.
