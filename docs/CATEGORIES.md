# Category Management Architecture

## Overview

The Category module provides administrative management for product categories in the INKs & Walls store catalogue slice (Phase 04.01).

## Data Model

```prisma
model Category {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String?  @db.Text
  isActive    Boolean  @default(true) @map("is_active")
  sortOrder   Int      @default(0) @map("sort_order")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@index([slug])
  @@index([isActive])
  @@index([sortOrder])
  @@map("categories")
}
```

### Fields & Rules
- `name`: Required string (1–100 chars, trimmed, no control characters).
- `slug`: Required URL-safe unique string (lowercase, alphanumeric + hyphens). Auto-generated from name if not provided.
- `description`: Optional plain text (max 1000 chars, sanitized).
- `isActive`: Boolean flag (default `true`). Controls storefront visibility.
- `sortOrder`: Integer value (default `0`) for catalog display sequence.

## Slug Generation & Collision Strategy

1. **Generation**: `generateSlug(name)` converts spaces and underscores to hyphens, removes invalid non-alphanumeric characters, and trims hyphens.
2. **Normalization**: Custom administrative slugs are trimmed and normalized server-side.
3. **Collision Handling**: Duplicates are checked prior to mutation. Attempting to save a duplicate slug returns a 400 Validation Error (`A category with slug 'x' already exists`). Arbitrary suffixes are not silently added, requiring explicit admin resolution.

## Authorization & RBAC

All Category mutation and read operations on administrative endpoints require:
- `STORE_ADMIN` or `SUPER_ADMIN` role via `requireAdmin()`.
- Requests from `CUSTOMER` or `GUEST` are rejected with `401 Unauthorized` or `403 Forbidden`.

## Deletion Strategy & Future Product Preservation

- **Phase 04.01**: Hard deletion is performed when no dependent records exist.
- **Future Product Model Integration**: Once Product models are introduced (Phase 04.03+), category deletion will verify product association constraints. Categories with associated active products will block hard deletion, recommending soft-deletion (`isActive = false`) or category re-assignment.

## Audit Logging

All administrative mutations generate centralized audit events executed within a single database transaction (`prisma.$transaction`):
- `CATEGORY_CREATED`: Recorded on category creation.
- `CATEGORY_UPDATED`: Recorded on attribute modification.
- `CATEGORY_ACTIVATED`: Recorded when status changes from inactive to active.
- `CATEGORY_DEACTIVATED`: Recorded when status changes from active to inactive.
- `CATEGORY_DELETED`: Recorded on category removal.

## API Endpoints

- `GET /api/admin/categories` – List categories (supports `page`, `pageSize`, `search`, `status`, `sort`, `order`).
- `POST /api/admin/categories` – Create category.
- `GET /api/admin/categories/:id` – Fetch category details.
- `PATCH /api/admin/categories/:id` – Update category or toggle status.
- `DELETE /api/admin/categories/:id` – Delete category.
