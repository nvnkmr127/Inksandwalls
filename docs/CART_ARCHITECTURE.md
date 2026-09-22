# Cart Architecture (INKs & Walls)

This document outlines the architecture for the Cart Model and Persistence layer, ensuring accurate representation of both custom dimension (PER_AREA) products and standard (FIXED) products.

## 1. Cart & CartItem Data Models

The cart is persisted in PostgreSQL via Prisma.

- **`Cart` Model**: Represents a shopping session. It acts as a container for cart items and can be owned either by a guest session (`sessionId`) or an authenticated customer (`customerId`).
- **`CartItem` Model**: Represents a distinct line item in the cart. It stores:
  - Product reference (and variant reference if applicable)
  - Dimension snapshots (`width`, `height`, `unit`, `areaWithWastageSqft`, etc.)
  - Calculated pricing snapshot (`ratePaise`, `unitPricePaise`, `totalPricePaise`)
  - A deterministic configuration hash (`configHash`) to identify unique lines.

## 2. Guest Cart Architecture

- **Guest Identifier**: An unauthenticated user receives a secure, server-generated session ID (e.g., `gst_1710000000_1234abcd...`).
- **Persistence**: This ID is stored in a cookie (`inks_cart_session_id`) configured with `HttpOnly`, `Secure` (in production), and `SameSite=lax`.
- **Database Mapping**: The active `Cart` record in the database is linked to this `sessionId`. Browsers hold no authoritative state other than the session pointer.

## 3. Customer Cart Architecture

- When a user logs in, their cart is mapped directly to their `Customer` record via `customerId`.
- If an active guest cart cookie exists during an authenticated request, the system detects this and triggers a safe merge (see "Guest → Customer Merge").

## 4. Cart-Line Identity (`configHash`)

A cart line is uniquely identified by a deterministic SHA-256 hash containing:
- `productId`
- `productType`
- `variantId` (if FIXED)
- `width`, `height`, `unit` (if PER_AREA)
- Stringified `options` (if applicable)

If a user adds the exact same configuration multiple times, the server simply increments the `quantity` of the existing `CartItem`. If any configuration detail differs (e.g., different width), a separate `CartItem` row is created.

## 5. Pricing and Dimension Snapshots

- **PER_AREA Snapshot**: When a custom mural or wallpaper is added, the cart line captures the user's selected width, height, and unit. It also computes and stores the exact square footage, wastage application, and the resulting minor-unit price per sqft (`ratePaise`). 
- **FIXED Snapshot**: For standard products (like framed art), the cart line captures the selected variant and its base price.
- **Server Authority**: The server *never* trusts client-submitted prices or areas. It always recalculates the correct price using the pricing engine during `addItemToCart`.

## 6. Guest → Customer Merge

When an unauthenticated user with a guest cart logs in, `resolveCartOwner` automatically merges the guest cart into the customer cart.
1. The guest cart items are fetched.
2. Inside a **Prisma Database Transaction**, the customer's active cart is retrieved or created.
3. For each guest item:
   - If the exact `configHash` already exists in the customer cart, the quantities are summed (capped at 99).
   - If not, a new `CartItem` is created in the customer cart, perfectly preserving the configuration snapshot.
4. The guest cart's status is set to `CONVERTED` and the session cookie is discarded.

## 7. Ownership Checks & Security

All operations (`updateCartItemQuantity`, `removeCartItem`) strictly enforce ownership boundaries. The server verifies that the requested `cartId` matches the currently resolved owner (either the guest session ID or the authenticated customer ID). The client cannot arbitrarily modify items belonging to another user.

## 8. Transaction Strategy

Database operations that span multiple mutations (like merging a guest cart) are wrapped in `prisma.$transaction`. This prevents race conditions or partial merges (e.g., if the server crashes mid-merge, no duplicate or orphaned lines are left behind).

## 9. Configuration Editing

Customers can edit the dimensions (`width`, `height`, `unit`) of `PER_AREA` items directly from the cart UI.
1. The client sends the new dimensions to `updateCartConfigurationAction`.
2. The server strictly validates the new dimensions and completely recalculates the pricing using the authoritative `rate` from the database.
3. The server generates a new `configHash` for the updated dimensions.
4. If an existing cart item shares this new `configHash`, the server merges the quantities inside a `prisma.$transaction` and deletes the old item. Otherwise, it updates the existing item in place.
5. The `cart-updated` event is dispatched to keep UI elements (like the Header Cart Drawer) synchronized.
