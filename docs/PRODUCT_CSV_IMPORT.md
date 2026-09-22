# Bulk Product CSV Import Architecture & Specification

## Overview

The Bulk Product CSV Import module (Micro-Phase 04.06) provides authorized store administrators (`STORE_ADMIN`, `SUPER_ADMIN`) with a validated, auditable, and transactional bulk catalog import workflow.

It follows a strict three-phase lifecycle:
1. **Upload & Parse**: Validates file size, UTF-8 encoding, and parses CSV using RFC 4180 rules.
2. **Validate & Dry-Run Preview**: Validates every row against schema invariants, resolves taxonomy references without N+1 queries, detects duplicates inside the file and database, and displays a preview with row-level error reporting.
3. **Explicit Confirmation & Atomic Commit**: Requires administrative approval before executing an atomic database transaction (`prisma.$transaction`) that creates products, associates variants, and records audit log events.

---

## Supported CSV Fields Specification

| Field | Required | Data Type | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `name` | **Yes** | String (1–200 chars) | Product display name. Must not contain control characters. | `Royal Floral Wallpaper` |
| `slug` | No | String (URL-safe) | Unique catalogue slug. Auto-generated from name if omitted. | `royal-floral-wallpaper` |
| `sku` | **Yes** | String (1–50 chars) | Unique Stock Keeping Unit (`[a-zA-Z0-9_-]`). Checked for uniqueness. | `IW-WALL-001` |
| `productType` | **Yes** | `PER_AREA` \| `FIXED` | Pricing model. Determines applicable pricing rules. | `PER_AREA` |
| `category` | **Yes** | Slug or CUID | Identifier of an existing active Category. | `wallpapers` |
| `collection` | No | Slug or CUID | Identifier of an existing Collection. Must exist if specified. | `heritage-prints` |
| `price` | Conditional | Number > 0 (₹) | **Required for FIXED**. Converted to paise. Must be blank for PER_AREA. | `4999.00` |
| `rate` | Conditional | Number > 0 (₹/sqft) | **Required for PER_AREA**. Converted to paise. Must be blank for FIXED. | `150.00` |
| `wastage` | No | Number (0–100%) | Additional area buffer percentage for PER_AREA. Defaults to `0`. | `10.0` |
| `minArea` | No | Number (>= 0 sqft) | Minimum billable area in sqft for PER_AREA products. | `25.0` |
| `rollWidth` | No | Number (> 0 ft) | Panel/roll coverage width in feet for PER_AREA roll rounding. | `3.0` |
| `returnable` | No | Boolean (`true`/`false`) | Catalogue return eligibility (defaults to `true`). | `true` |
| `hsnCode` | No | String (max 20 chars) | Tax classification code (alphanumeric, dots, hyphens). | `4814.90` |
| `isActive` | No | Boolean (`true`/`false`) | Storefront visibility status (defaults to `true`). | `true` |
| `description` | No | String (max 2000 chars) | Plain text product description. | `Artisan silk wallpaper.` |

---

## Product Type Rules & Pricing Invariants

### 1. FIXED Products (Wall Art, Framed Prints)
- **`price`**: Required positive number (user-facing Rupees). Converted server-side to integer minor units (`paise`) via `Math.round(rupees * 100)`.
- **Incompatible fields**: `rate`, `wastage`, `minArea`, and `rollWidth` must be empty or null. Specifying any area pricing field on a `FIXED` product triggers a row-level validation error.
- **Variant record creation**: A `ProductVariant` record is created for each imported `FIXED` product containing `sku: row.sku`, `name: row.name`, `price: product.price`, and `sortOrder: 0`.

### 2. PER_AREA Products (Wallpaper, Custom Blinds)
- **`rate`**: Required positive rate per square foot (user-facing Rupees). Converted server-side to integer minor units (`paise`).
- **`wastage`**: Optional percentage (0.0% to 100.0%). Defaults to `0`.
- **`minArea`**: Optional non-negative number in square feet.
- **`rollWidth`**: Optional positive number in feet.
- **Incompatible fields**: `price` must be empty or null. Specifying fixed price on a `PER_AREA` product triggers a row-level validation error.
- **Variant boundary**: Following Phase 04.04 (`docs/PRODUCT_VARIANTS.md`), `PER_AREA` products use customer dimension pricing engines (Phase 05.01) and do not have static variant records.

---

## Taxonomy Resolution

### Category Resolution
- The `category` column resolves against the existing `Category` table by either `slug` or `id` (case-insensitive).
- If the referenced category does not exist in the database, the row is flagged with a row-level error:
  `Row X: Category 'xyz' does not exist in catalogue.`
- Taxonomy records are **never** auto-created during product import.

### Collection Resolution
- The `collection` column is optional.
- If provided, the collection must resolve to an existing `Collection` in the database by `slug` or `id`.
- If the referenced collection does not exist, the row is rejected:
  `Row X: Collection 'abc' does not exist in catalogue.`
- Collections are **never** auto-created during product import.

---

## SKU Validation & Conflict Handling

- **Format**: 1 to 50 characters matching regex `/^[a-zA-Z0-9_\-]+$/`.
- **Within-file uniqueness**: The system tracks all SKUs across the CSV. If two or more rows share the same SKU, all conflicting rows are reported with their respective line numbers before any database mutation can occur:
  `Duplicate SKU 'IW-001' found in CSV (Row 5, Row 9).`
- **Database collision check**: All candidate SKUs are queried against `ProductVariant.sku` prior to preview display. If an existing product variant uses the SKU:
  `A product or variant with SKU 'IW-001' already exists in catalogue.`
- **Default import policy**: New SKU creates product; existing SKU triggers validation error. No silent overwrites.

---

## Transaction Strategy & Rollback Guarantee

- The commit phase runs inside a single Prisma transaction:
  ```ts
  await prisma.$transaction(async (tx) => {
    // 1. Concurrency double-check for SKUs and slugs
    // 2. Insert Product records
    // 3. Insert ProductVariant records for FIXED items
    // 4. Record PRODUCT_IMPORT_COMPLETED audit event
  }, { timeout: 30000 });
  ```
- **Atomicity**: If an unexpected integrity violation or concurrent write occurs during import, the transaction rolls back completely. Zero partial records are written.
- **Audit tracking**:
  - `PRODUCT_IMPORT_STARTED`: Recorded at start of import process.
  - `PRODUCT_IMPORT_COMPLETED`: Recorded inside the transaction on success.
  - `PRODUCT_IMPORT_FAILED`: Recorded on failure with the reason and total row count.

---

## Security Safeguards

1. **Formula Injection (CSV Injection) Protection**:
   All serialized CSV exports (e.g. downloadable template and error CSVs) sanitize values starting with formula control characters (`=`, `+`, `-`, `@`, `\t`, `\r`) by prepending a single quote `'`.
2. **File Size and Volume Limits**:
   - Maximum CSV upload size: **5 MB**.
   - Maximum batch rows: **1,000 rows** per import execution.
3. **Prototype Pollution Guard**:
   Parsed row data dictionaries are constructed with `Object.create(null)` to eliminate prototype injection vulnerabilities.
4. **Server-Side RBAC Enforcement**:
   - All import endpoints require `requireAdmin()` (`STORE_ADMIN` or `SUPER_ADMIN`).
   - Unauthorized requests by `CUSTOMER` or `GUEST` return `401 Unauthorized` or `403 Forbidden`.

---

## API Endpoints

- `GET /api/admin/products/import/template`: Download the canonical CSV template.
- `POST /api/admin/products/import/validate`: Upload and validate CSV; returns structured dry-run preview JSON.
- `POST /api/admin/products/import/commit`: Execute atomic transaction to import validated rows.
