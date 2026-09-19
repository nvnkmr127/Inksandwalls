# Collection Management Architecture

## Overview

The Collection module provides administrative management for product collections in the INKs & Walls store catalogue slice (Phase 04.02). A Collection represents a curated grouping of products (e.g., "New Arrivals", "Living Room", "Best Sellers").

## Data Model

```prisma
model Collection {
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
  @@map("collections")
}
```

### Fields & Rules
- `name`: Required string (1–100 chars, trimmed, no control characters).
- `slug`: Required URL-safe unique string (lowercase, alphanumeric + hyphens). Auto-generated from name if not provided.
- `description`: Optional plain text (max 1000 chars, sanitized).
- `isActive`: Boolean flag (default `true`). Controls storefront visibility.
- `sortOrder`: Integer value (default `0`) for collection display sequence.

## Slug Generation & Collision Strategy

1. **Generation**: `generateSlug(name)` converts spaces and underscores to hyphens, removes invalid non-alphanumeric characters, and trims hyphens.
2. **Normalization**: Custom administrative slugs are trimmed and normalized server-side.
3. **Collision Handling**: Duplicates are checked prior to mutation. Attempting to save a duplicate slug returns a 400 Validation Error (`A collection with slug 'x' already exists`). Arbitrary suffixes are not silently added, requiring explicit admin resolution.

## Authorization & RBAC

All Collection mutation and read operations on administrative endpoints require:
- `STORE_ADMIN` or `SUPER_ADMIN` role via `requireAdmin()`.
- Requests from `CUSTOMER` or `GUEST` are rejected with `401 Unauthorized` or `403 Forbidden`.

## Deletion Strategy & Future Product Preservation

- **Phase 04.02**: Hard deletion is performed when no dependent records exist.
- **Future Product Model Integration**: Once Product-to-Collection relationships are introduced (Phase 04.03+), collection deletion will verify product assignment constraints. Collections with associated active products will block hard deletion, recommending soft-deletion (`isActive = false`) or collection re-assignment.

## Audit Logging

All administrative mutations generate centralized audit events executed within a single database transaction (`prisma.$transaction`):
- `COLLECTION_CREATED`: Recorded on collection creation.
- `COLLECTION_UPDATED`: Recorded on attribute modification.
- `COLLECTION_ACTIVATED`: Recorded when status changes from inactive to active.
- `COLLECTION_DEACTIVATED`: Recorded when status changes from active to inactive.
- `COLLECTION_DELETED`: Recorded on collection removal.

## API Endpoints

- `GET /api/admin/collections` – List collections (supports `page`, `pageSize`, `search`, `status`, `sort`, `order`).
- `POST /api/admin/collections` – Create collection.
- `GET /api/admin/collections/:id` – Fetch collection details.
- `PATCH /api/admin/collections/:id` – Update collection or toggle status.
- `DELETE /api/admin/collections/:id` – Delete collection.
