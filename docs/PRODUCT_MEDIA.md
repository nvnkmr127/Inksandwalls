# Product Media Architecture & Management

## Overview

The Product Media module provides administrative media upload, variant processing, ordering, alt text editing, primary image assignment, and deletion for catalogue items in INKs & Walls (Phase 04.05). It integrates with Cloudflare R2 object storage and the Sharp responsive image pipeline established in Phase 01.04.

Customer-facing product detail gallery and PDP integration are reserved for Phase 05.03.

---

## 1. Data Model

```prisma
model ProductMedia {
  id         String   @id @default(cuid())
  productId  String   @map("product_id")
  objectKey  String   @map("object_key")
  altText    String?  @db.Text @map("alt_text")
  width      Int?
  height     Int?
  format     String?
  mimeType   String?  @map("mime_type")
  size       Int?
  metadata   Json?
  sortOrder  Int      @default(0) @map("sort_order")
  isPrimary  Boolean  @default(false) @map("is_primary")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@index([sortOrder])
  @@index([isPrimary])
  @@index([productId, sortOrder])
  @@map("product_media")
}
```

### PostgreSQL Single Primary Invariant

To guarantee that no product can have more than one primary image, a PostgreSQL partial unique index is enforced:

```sql
CREATE UNIQUE INDEX "product_media_product_id_primary_unique_idx"
ON "product_media"("product_id")
WHERE "is_primary" = true;
```

---

## 2. Cloudflare R2 Storage Namespace

Product media objects are stored under collision-safe, deterministic paths isolated by product:

```
products/{productId}/media/{mediaId}/{variant}.webp
```

* **`productId`**: Sanitized parent product identifier.
* **`mediaId`**: Cryptographically secure 12-byte random hex identifier.
* **`variant`**: One of the standard responsive WebP breakpoints:
  * `thumbnail` (max width 200px)
  * `small` (max width 600px)
  * `medium` (max width 1200px)
  * `large` (max width 1920px)
  * `original` (max width 2560px)
* Path segments are strictly sanitized to prevent directory traversal (`..`, slashes, control characters).

---

## 3. Upload & Sharp Processing Flow

1. **Client Submission**: Store admin submits a multipart form with image binary and optional alt text to `POST /api/admin/products/:id/media`.
2. **Server-Side Validation**:
   * File payload presence and size check (maximum 10MB).
   * MIME whitelist validation (`image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/gif`).
   * Binary magic bytes inspection to confirm legitimate image signatures and reject forged MIME types.
3. **Sharp Processing Pipeline**:
   * Auto-rotates image according to EXIF orientation metadata.
   * Generates 5 optimized WebP responsive variants without upscaling (`withoutEnlargement: true`, `fit: "inside"`).
   * Extracts source width, height, format, and color space.
4. **Cloudflare R2 Upload**:
   * Uploads all responsive variants with `Cache-Control: public, max-age=31536000, immutable`.
   * Credentials remain strictly server-side.
5. **Database Transaction**:
   * If this is the first image for the product, automatically assigns `isPrimary = true`.
   * Sets `sortOrder` to current media count.
   * Persists `ProductMedia` record and emits a transactional audit log (`PRODUCT_MEDIA_UPLOADED`).

---

## 4. Compensating Cleanup & Transaction Safety

Because PostgreSQL and Cloudflare R2 cannot share a two-phase distributed commit:
* If database record creation fails after R2 objects have been uploaded, a **compensating cleanup** routine immediately removes the newly uploaded R2 keys.
* Cleanup errors are captured in application logs for operational audits.
* No orphaned storage objects remain after database errors.

---

## 5. Primary Image Rules

* **Single Primary Invariant**: A product has 0 or 1 primary image.
* **Atomic Promotion**: Setting an image as primary executes in a transaction:
  1. Resets `isPrimary = false` for all media of the product.
  2. Sets target media `isPrimary = true`.
* **Automatic Fallback on Deletion**: When the current primary image is deleted:
  * If other images exist, the next remaining image (lowest `sortOrder`) is automatically promoted to primary.
  * If no images remain, the product smoothly transitions to 0 primary images.

---

## 6. Ordering & Reordering

* Media items have a `sortOrder` integer.
* Reorder API: `PATCH /api/admin/products/:id/media/reorder` receives `{ mediaIds: string[] }`.
* Validates that all IDs belong to the product (IDOR prevention).
* Updates `sortOrder` sequentially in a single atomic transaction.
* Admin UI supports both HTML5 drag-and-drop handles and accessible Move Left / Move Right buttons.

---

## 7. Alt Text & Metadata

* Administrators can specify alt text during upload or edit it via `PATCH /api/admin/products/:id/media/:mediaId`.
* Alt text is sanitized (trimmed, maximum 500 characters, no control characters).
* Metadata updates cannot alter the underlying image file, object key, or ownership.

---

## 8. Secure Deletion

1. Verifies admin authorization and product ownership.
2. Identifies all R2 variant keys belonging to the media record.
3. Deletes objects from Cloudflare R2.
4. If storage deletion fails, the database record is preserved to prevent desynchronization.
5. Deletes the database record within a transaction and handles primary promotion if needed.
6. Emits `PRODUCT_MEDIA_DELETED` audit event.

---

## 9. Authorization & Audit Logging

* **RBAC**: All media operations require `STORE_ADMIN` or `SUPER_ADMIN` role via `requireAdmin()`.
* **Audit Events**:
  * `PRODUCT_MEDIA_UPLOADED`
  * `PRODUCT_MEDIA_UPDATED`
  * `PRODUCT_MEDIA_REORDERED`
  * `PRODUCT_MEDIA_PRIMARY_SET`
  * `PRODUCT_MEDIA_DELETED`
* Audit records log actor ID, product ID, media ID, IP address, user agent, and metadata without storing image binaries or credentials.

---

## 10. Automated Test Strategy

The test suite in `src/lib/product-media/__tests__/media.test.ts` validates:
* File validation (magic bytes, MIME type whitelist, 10MB size bounds).
* Missing product and cross-product IDOR boundary checks.
* Compensating cleanup ensuring zero orphaned R2 objects on DB failure.
* Single primary invariant and atomic primary switches.
* Media reordering with validation against duplicate/foreign IDs.
* Alt text validation and sanitization.
* Storage deletion failure behavior (preserving DB records).
* Primary promotion when primary media is deleted.
* Deterministic R2 key generation with traversal prevention.
