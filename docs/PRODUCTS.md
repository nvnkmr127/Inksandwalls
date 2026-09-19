# Product Management Architecture

## Overview

The Product module provides administrative CRUD management for catalogue items in the INKs & Walls store (Phase 04.03). It supports the core catalogue foundation and two product pricing models specified by the PRD:
- `PER_AREA`: Area-based pricing for products such as wallpaper and blinds.
- `FIXED`: Fixed pricing for products such as wall art and framed prints.

## Data Model

```prisma
enum ProductType {
  PER_AREA
  FIXED
}

model Product {
  id          String      @id @default(cuid())
  name        String
  slug        String      @unique
  description String?     @db.Text
  productType ProductType @map("product_type")
  isActive    Boolean     @default(true) @map("is_active")
  
  // Monetary representation in integer minor units (paise)
  price       Int?        @map("price")
  rate        Int?        @map("rate")
  
  // PER_AREA product fields
  wastage     Float?      @map("wastage")
  minArea     Float?      @map("min_area")
  rollWidth   Float?      @map("roll_width")
  
  // Catalogue configuration
  returnable  Boolean     @default(true) @map("returnable")
  hsnCode     String?     @map("hsn_code")
  
  categoryId  String      @map("category_id")
  category    Category    @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")

  @@index([slug])
  @@index([categoryId])
  @@index([productType])
  @@index([isActive])
  @@map("products")
}
```

## Monetary Representation Convention

To prevent floating-point arithmetic inaccuracies:
- All monetary values in the database are stored as **integer minor units (`paise`)**.
- For `FIXED` products, `price` is stored in paise (e.g. ₹4,999 is stored as `499900`).
- For `PER_AREA` products, `rate` is stored in paise per sqft (e.g. ₹150/sqft is stored as `15000`).
- The Admin UI converts amounts between user-facing Rupees (₹) and stored paise (e.g., `Math.round(rupees * 100)`).

## Product Types & Pricing Configuration

### PER_AREA (Wallpaper, Blinds)
- **`rate`**: Base price per square foot (stored in paise). Must be > 0.
- **`wastage`**: Additional percentage buffer applied to calculated area (e.g. `10.0` for 10% wastage). Defaults to `0`. Cannot exceed `100%`.
- **`minArea`**: Minimum billable area in sqft (e.g. `25.0`). Must be >= 0.
- **`rollWidth`**: Roll/panel coverage width in feet (e.g. `3.0`). Must be > 0.
- Area-specific pricing fields are displayed dynamically in the Product Admin form.

### FIXED (Wall Art, Prints)
- **`price`**: Fixed item price (stored in paise). Must be > 0.
- Area-specific fields (`rate`, `wastage`, `minArea`, `rollWidth`) are set to `null` to ensure consistent data configuration.

## Pricing Boundary Statement

> **Pricing Boundary**: Product CRUD stores validated pricing configuration. Final customer pricing is calculated by the shared pricing engine introduced in Phase 05.01. The Product CRUD module does not calculate final billable area, roll rounding, or cart line totals.

## Product Rules & Attributes

- **`name`**: Required string (1–200 characters, trimmed, no control characters).
- **`slug`**: Required URL-safe unique identifier (lowercase, alphanumeric and hyphens). Server-validated and unique.
- **`description`**: Optional plain text (max 2000 characters).
- **`returnable`**: Boolean flag (`true`/`false`). Catalogue configuration for made-to-order/custom return policies.
- **`hsnCode`**: Optional tax classification code (max 20 characters, safe alphanumeric/dots).
- **`isActive`**: Controls catalogue active/inactive visibility status.

## Category Relationship

Each Product must belong to a valid `Category`:
- `categoryId`: Foreign key referencing `categories.id`.
- On create/update, the server verifies category existence.
- Foreign key deletion restriction (`onDelete: Restrict`) prevents deleting a category that still contains products.

## Slug Generation & Collision Strategy

1. **Auto-generation**: `generateSlug(name)` converts spaces/underscores to hyphens and strips unsafe characters.
2. **Custom Slugs**: Custom slugs are trimmed, lowercased, and validated against URL-safe regex.
3. **Collision Protection**: Pre-mutation query checks for slug conflicts. Duplicate slug submissions are rejected with a clear 400 Validation Error.

## Authorization & RBAC

All Product management endpoints are protected server-side:
- Access is restricted to `STORE_ADMIN` or `SUPER_ADMIN` roles via `requireAdmin()`.
- Unauthorized access attempts by `CUSTOMER` or `GUEST` return 401/403 HTTP status codes.

## Audit Logging

All Product mutations execute inside a Prisma transaction (`prisma.$transaction`) alongside audit event creation:
- `PRODUCT_CREATED`: Fired when a new product is added.
- `PRODUCT_UPDATED`: Fired when product fields are updated.
- `PRODUCT_ACTIVATED`: Fired when status is toggled to active.
- `PRODUCT_DEACTIVATED`: Fired when status is toggled to inactive.
- `PRODUCT_DELETED`: Fired when a product is deleted.

## API Endpoints

- `GET /api/admin/products`: List products (supports `page`, `pageSize`, `search`, `status`, `productType`, `categoryId`, `sort`, `order`).
- `POST /api/admin/products`: Create a product.
- `GET /api/admin/products/:id`: Get a single product by ID.
- `PATCH /api/admin/products/:id`: Update a product or toggle status.
- `DELETE /api/admin/products/:id`: Delete a product.

## Future Relationship Boundaries

The Product schema is designed to seamlessly accept future relationships in upcoming roadmap phases:
- `ProductVariant` (Phase 04.04): Child variants for FIXED products.
- `ProductMedia` (Phase 04.05): Media gallery and images.
- `Collection` (Phase 04.02+): Product-to-Collection assignments.
