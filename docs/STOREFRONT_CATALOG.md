# Storefront Foundation & Catalog Architecture

## Overview

The Storefront Foundation and Catalog Shell (Micro-Phase 05.01) establishes the public browsing experience for INKs & Walls. Customers can discover and explore active made-to-order wallpapers, acoustic murals, and fine art prints across categories and collections without authentication barriers.

---

## Route Structure

| Route | Type | Description |
|---|---|---|
| `/` | Static / Server | Storefront home landing page with public header and footer. |
| `/products` | Server Component | Canonical Product Listing Page (PLP) with server query layer, URL search parameters, dynamic filters, pagination, and sorting. |
| `/cart` | Static / Shell | Public cart boundary shell presenting empty state and transition to catalog (full cart persistence in Phase 06). |
| `/products/[slug]` | Reserved | Product Detail Page (PDP) boundary (Phase 05.03). Cards link here. |
| `/login` | Dynamic | Auth.js sign-in entry point for customer and administrative accounts. |
| `/account` | Dynamic | Customer account entry point (Phase 09). |

---

## Catalog Query Layer

Centralized server-only query service located at [`src/lib/storefront/catalog-service.ts`](file:///Users/naveenadicharla/Documents/Inksandwalls/src/lib/storefront/catalog-service.ts).

### Database Access & Performance
- **Active Products Only**: Strict `where: { isActive: true }` constraint ensures draft, inactive, or archived products are never exposed.
- **Single Primary Media Selection**: Product media is queried in the same pass using:
  ```ts
  media: {
    orderBy: [
      { isPrimary: "desc" },
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
    take: 1,
    select: { id: true, objectKey: true, altText: true, width: true, height: true },
  }
  ```
  This eliminates N+1 query waterfalls and loads zero redundant image variants.
- **Concurrent Execution**: `Promise.all([prisma.product.count({ where }), prisma.product.findMany({ where, ... })])` executes count and paginated items in parallel.

---

## Filtering, Sorting & Pagination

All catalog state is synchronized with URL search parameters for refresh safety, browser back/forward navigation, and shareable links.

### Filters
- `category`: Category slug or cuid ID. Matches `category.slug` or `categoryId`.
- `collection`: Collection slug or cuid ID. Matches `collection.slug` or `collectionId`.
- `type`: Product pricing model (`PER_AREA` for Made-to-Order wallpaper/murals, `FIXED` for standard wall art).
- `search`: Case-insensitive text search matching product `name` or `description`.

### Whitelisted Sorting
To prevent SQL injection or arbitrary column ordering, sort parameters are strictly validated against a whitelist:

| Key | Prisma Ordering | Description |
|---|---|---|
| `newest` (default) | `createdAt: "desc"` | Newest catalog additions first. |
| `price_asc` | `[{ price: "asc" }, { rate: "asc" }]` | Lowest price / rate per sqft first. |
| `price_desc` | `[{ price: "desc" }, { rate: "desc" }]` | Highest price / rate per sqft first. |
| `name_asc` | `name: "asc"` | Alphabetical A to Z. |
| `name_desc` | `name: "desc"` | Alphabetical Z to A. |

Any unsupported or invalid sort key safely defaults to `newest`.

### Pagination
- 1-indexed `page` parameter with integer clamping (`page >= 1`).
- Clamped page size (`pageSize = 12`, max `48`).
- Page links in [`src/components/storefront/catalog-pagination.tsx`](file:///Users/naveenadicharla/Documents/Inksandwalls/src/components/storefront/catalog-pagination.tsx) preserve all existing URL query parameters.

---

## Product Card & Media Handling

Implemented in [`src/components/storefront/product-card.tsx`](file:///Users/naveenadicharla/Documents/Inksandwalls/src/components/storefront/product-card.tsx).

### Data Requirements
- `id`, `name`, `slug`, `productType`, `price`, `rate`, `returnable`.
- `category: { name, slug }`.
- `media[0]`: Primary image object key and alt text.

### Pricing Representation
Pricing display is formatted via [`src/lib/money.ts`](file:///Users/naveenadicharla/Documents/Inksandwalls/src/lib/money.ts):
- **`PER_AREA`**: Formatted as `"From ₹<rate> / sq ft"` (e.g. rate of 18000 paise formats to `"From ₹180 / sq ft"`).
- **`FIXED`**: Formatted as `"₹<price>"` (e.g. price of 499900 paise formats to `"₹4,999"`).

### Responsive Image Pipeline
- Rendered using `<OptimizedImage>` with Cloudflare R2 loader abstraction (`src/lib/images/r2-loader.ts`).
- Responsive WebP variant breakpoints (`thumbnail`, `small`, `medium`, `large`).
- Alt text prioritizes `ProductMedia.altText` with fallback to `product.name`.
- If media is absent, renders a controlled CSS/SVG fallback placeholder. Never loads fake stock photos or causes broken layout shifts.

---

## Navigation Architecture

### Header
Located at [`src/components/layout/Header.tsx`](file:///Users/naveenadicharla/Documents/Inksandwalls/src/components/layout/Header.tsx):
- Server-rendered active categories and collections from `getStorefrontNavData()`.
- Brand logo link to `/`.
- Direct catalog discovery link to `/products`.
- Live categories and collections navigation links.
- Quick search form navigating to `/products?search=...`.
- Shopping cart icon linking to `/cart`.
- Responsive Mobile Drawer (Sheet) with accessible keyboard navigation, focus trap, and screen-reader labels.

### Footer
Located at [`src/components/layout/Footer.tsx`](file:///Users/naveenadicharla/Documents/Inksandwalls/src/components/layout/Footer.tsx):
- Dynamic active category and collection links to `/products?category=...` and `/products?collection=...`.
- Customer care navigation linking to `/account`, `/login`, `/cart`.
- Eliminates dead (`#`) links.

---

## Authentication & Cart Boundaries

1. **Guest Browsing**: Customers can browse the entire catalog, search, filter, and view product cards without login.
2. **Account State**: Integrated with Auth.js session (`src/components/auth/AuthStatus.tsx`). Displays customer identity when logged in and sign-in trigger when guest.
3. **Cart Entry Point**: Header provides accessible shopping bag icon linking to `/cart`. The `/cart` shell displays a clean empty cart state with discovery actions, ready for Phase 06 cart persistence integration.
