# Product Variant Architecture & Management

## Overview

The Product Variant module provides administrative CRUD management for product options (Phase 04.04). It adds SKU, size, frame, and price variants to `FIXED` price products (e.g. Wall Art, Framed Prints) while preserving the core Product data model and pricing architecture from Phase 04.03.

## Data Model

```prisma
model ProductVariant {
  id        String   @id @default(cuid())
  productId String   @map("product_id")
  name      String
  sku       String?  @unique
  price     Int      @map("price")
  isActive  Boolean  @default(true) @map("is_active")
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@index([sku])
  @@index([isActive])
  @@index([sortOrder])
  @@map("product_variants")
}
```

## Product Type Boundary

- **FIXED Products**: Variants are explicitly restricted to `FIXED` pricing products (e.g., "30 × 40 cm", "Black Frame", "White Frame").
- **PER_AREA Products**: Wallpaper and blinds products use dimension-based rates (`rate` per sqft, wastage, roll width) and do not use fixed variant records.
- Server-side validation enforces that attempts to create variants for `PER_AREA` products are rejected with a `400 Validation Error`.

## Monetary Representation Convention

- All variant prices in the database are stored as **integer minor units (`paise`)**.
- For example, a variant price of ₹4,999 is stored as `499900` paise.
- The Admin UI handles conversion between user-facing Rupees (₹) and persisted minor units (paise).

## Pricing Boundary Statement

> **Pricing Boundary**: Product Variant CRUD stores validated variant pricing configuration. Final cart line calculations and storefront selections are handled in subsequent phases (Phase 05.03 & Phase 06). Variant CRUD does not calculate discounts, taxes, or shipping.

## Rules & Validation

- **`name`**: Required string (1–200 characters, trimmed, no control characters).
- **`sku`**: Optional string (max 50 chars, allowed characters `[a-zA-Z0-9_-]`). If specified, it must be globally unique in the database.
- **`price`**: Required integer minor units > 0.
- **`isActive`**: Boolean visibility flag (`true`/`false`). Defaults to `true`.
- **`sortOrder`**: Integer ordering value (defaults to `0`). Used for storefront option sorting.

## Product Relationship & IDOR Protection

- Every variant belongs to a parent `Product` via `productId`.
- Deleting a parent `Product` automatically cascades (`onDelete: Cascade`) to its child variants.
- All variant mutation endpoints verify that the target variant actually belongs to the `productId` specified in the route, preventing cross-resource manipulation (IDOR).

## Delete Behavior & Transactional Safety

- **Hard Deletion**: Administrative deletion removes the variant record from `product_variants` within a transaction that logs `PRODUCT_VARIANT_DELETED`.
- **Soft Deactivation (`isActive = false`)**: Admins can toggle status to Inactive, retaining configuration history while hiding the variant from future storefront offerings.
- **Future Transactional Safeguards**: When transactional records (`CartLine`, `Order`) are introduced in subsequent phases (Phase 06 & 07), variants referenced by placed orders will be protected from hard deletion via foreign key constraints (`onDelete: Restrict`), requiring archival via deactivation (`isActive: false`).

## Authorization & RBAC

All Product Variant management endpoints are protected server-side:
- Restricted to `STORE_ADMIN` or `SUPER_ADMIN` roles via `requireAdmin()`.
- Unauthorized requests from `CUSTOMER` or `GUEST` return 401/403 HTTP status codes.

## Audit Logging

All variant mutations execute inside a Prisma transaction (`prisma.$transaction`) alongside audit event creation:
- `PRODUCT_VARIANT_CREATED`: Fired when a variant is created.
- `PRODUCT_VARIANT_UPDATED`: Fired when variant attributes are modified.
- `PRODUCT_VARIANT_ACTIVATED`: Fired when status is set to active.
- `PRODUCT_VARIANT_DEACTIVATED`: Fired when status is set to inactive.
- `PRODUCT_VARIANT_DELETED`: Fired when a variant is deleted.

## API Endpoints

- `GET /api/admin/products/:id/variants`: List variants for a product (supports `page`, `pageSize`, `search`, `status`, `sort`, `order`).
- `POST /api/admin/products/:id/variants`: Create a variant for a product.
- `GET /api/admin/products/:id/variants/:variantId`: Get single variant by ID.
- `PATCH /api/admin/products/:id/variants/:variantId`: Update variant attributes or toggle active status.
- `DELETE /api/admin/products/:id/variants/:variantId`: Delete a variant.

## Future Storefront Usage Statement

Storefront variant selection on the PDP (Phase 05.03) and cart line variant pricing (Phase 06.01) will consume these active `ProductVariant` records for `FIXED` items. Storefront variant selection is deferred to those upcoming phases.
