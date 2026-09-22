# Customer Cart & Authoritative Pricing Engine (Micro-Phase 05.04)

## Overview

The INKs & Walls Cart System provides persistent shopping cart capabilities for both unauthenticated guest shoppers and authenticated customers. It enforces server-side authoritative pricing for made-to-order architectural wallpaper prints (`PER_AREA`) and standard framed prints (`FIXED`), preserving exact custom customer configurations across browsing sessions and logins.

---

## Architecture & Data Model

The cart architecture consists of two primary relational models in PostgreSQL (`prisma/schema.prisma`):

### 1. `Cart`
Represents an active shopping session belonging either to a guest session or an authenticated customer:
* `id`: CUID identifier.
* `sessionId`: HTTP-only cookie-backed guest session identifier (`inks_cart_session_id`). Unique when present.
* `customerId`: Foreign key reference to `Customer` table (`onDelete: SetNull`).
* `status`: `ACTIVE`, `CONVERTED` (after checkout or merge), or `ABANDONED`.
* `createdAt` / `updatedAt`: Standard audit timestamps.

### 2. `CartItem`
Maintains an immutable configuration snapshot and deterministic identity for each cart item:
* `id`: CUID identifier.
* `cartId`: Foreign key to `Cart` (`onDelete: Cascade`).
* `productId`: Reference to active `Product`.
* `variantId`: Optional reference to `ProductVariant` for fixed goods.
* `configHash`: 64-character SHA-256 deterministic hash identifying unique made-to-order configurations. Unique within a cart: `@@unique([cartId, configHash])`.
* `productName`: Snapshot of product name at addition time.
* `productType`: `PER_AREA` or `FIXED`.
* `variantName` / `sku`: Variant snapshot for fixed products.
* `width`, `height`, `unit`, `widthFt`, `heightFt`: Input dimensions and ft-normalized measurements for custom wallpapers.
* `enteredAreaSqft`, `wastagePct`, `wastageAreaSqft`, `areaWithWastageSqft`, `minAreaSqft`, `isMinAreaApplied`, `billableAreaSqft`, `rollWidthFt`, `panelsNeeded`: Comprehensive architectural area snapshot.
* `ratePaise`: Rate per sq ft in paise for `PER_AREA` products.
* `unitPricePaise`: Server-calculated unit price in paise (including wastage buffer and minimum area rules).
* `quantity`: Positive integer (1–99).
* `totalPricePaise`: `unitPricePaise * quantity`.
* `options`: Optional JSON object snapshot.
* `mediaKey`: R2 storage object key for primary product image.
* `returnable` / `hsnCode`: Compliance and return policy snapshots.

---

## Deterministic Cart Item Identity (`configHash`)

Two items within the same cart merge their quantities **only** when their meaningful configuration is 100% identical.

### Configuration Hashing Algorithm:
* `PER_AREA`: Computes SHA-256 hash over `[productId, productType, normalizedUnit, roundedWidth, roundedHeight, sortedOptions]`.
* `FIXED`: Computes SHA-256 hash over `[productId, productType, variantId ?? "base", sortedOptions]`.

### Invariants:
1. Two wallpaper items of different dimensions (e.g. 10×8 ft vs 12×8 ft) produce distinct hashes and remain distinct line items.
2. Two items of the exact same dimensions combine their quantities up to a max cap of 99.
3. Two framed prints with different variant choices (e.g. A3 Black Frame vs A2 Oak Frame) remain distinct line items.

---

## Guest Shopping & Cart Persistence

* **Session Token**: Guests receive a secure, HTTP-only, lax-cookie named `inks_cart_session_id` with a 30-day expiration window.
* **Server-Authoritative State**: No cart data is stored in `localStorage` or browser state. The database maintains all line items, ensuring consistency across page refreshes and browser restarts.
* **Privacy**: Guest carts contain zero personally identifiable information (PII).

---

## Authenticated Customer Cart & Guest Merge

When a customer signs in:
1. `resolveCartOwner()` detects the authenticated `User` and resolves or creates their `Customer` record.
2. If an active `inks_cart_session_id` cookie exists in the request:
   - The guest cart lines are retrieved.
   - The customer's active cart is resolved or created.
   - For each guest item, `configHash` is matched against existing customer lines.
   - If a matching configuration exists, quantities are summed (capped at 99).
   - If a distinct configuration exists, the line is migrated into the customer cart.
   - Authoritative pricing is refreshed.
   - The obsolete guest cart is marked `CONVERTED`.
   - The guest session cookie is deleted from the client.

---

## Server-Authoritative Pricing & Revalidation

Clients are never permitted to provide price, rate, wastage, billable area, or subtotal:
1. **On Add to Cart (`addItemToCart`)**:
   - Validates quantity ($1 \le Q \le 99$).
   - Validates product existence and `isActive: true`.
   - Re-runs canonical dimension validation and normalisation.
   - Re-runs canonical area calculations (`enteredArea`, `wastageArea`, `minAreaFloor`, `billableArea`).
   - Calculates `unitPricePaise = billableAreaSqft * ratePaise`.
   - Calculates `totalPricePaise = unitPricePaise * quantity`.
2. **On Cart Read (`getCartWithFreshPricing`)**:
   - Compares stored snapshots against active catalog rates.
   - If rates or variant prices have changed in the catalog, line items and subtotals are updated automatically and tagged with `priceChanged: true`.
   - If products or variants have been deactivated, lines are marked with `isAvailable: false`, and `hasUnavailableItems: true` blocks checkout.

---

## Server Actions & Mutation Boundaries

Storefront cart mutations are invoked via Next.js Server Actions (`src/app/actions/cart.ts`):
* `addToCartAction(input: AddToCartInput)`
* `updateCartQuantityAction(itemId: string, quantity: number)`
* `removeCartItemAction(itemId: string)`
* `clearCartAction()`
* `getCartAction()`
* `getCartItemCountAction()`

---

## Storefront Header Badge Synchronization

* Client-side `useCartCount()` hook listens to `inks_cart_updated` custom events.
* Mutations dispatch `notifyCartUpdated(newCount)` to update desktop and mobile cart badges without full page reloads.

---

## Security Model

1. **Zero Price Trust**: All prices and rates are derived exclusively from catalog tables.
2. **Strict Resource Ownership Guard**: `updateCartItemQuantity` and `removeCartItem` enforce `cartItem.cartId === activeCart.id`. Attempting to modify an item belonging to another guest or customer fails with `AuthError` (401) / `ForbiddenError` (403).
3. **Quantity Clamping**: Quantities are constrained to integers between 1 and 99.
