# Coupon Engine Architecture (Micro-Phase 06.03)

## Overview

The INKs & Walls Coupon Engine provides a secure, server-authoritative discount mechanism applied to customer carts. Discounts are strictly computed on the server against authoritative subtotal amounts after product line pricing calculations (`PER_AREA` and `FIXED`).

---

## 1. Data Model

The coupon data model is integrated into PostgreSQL via Prisma:

### `Coupon`
- `id` (CUID, primary key)
- `code` (VarChar, unique normalized string, uppercase alphanumeric)
- `discountType` (`PERCENTAGE` | `FIXED_AMOUNT`)
- `discountValue` (Integer: percentage points e.g. 10 for 10%, or minor units/paise for fixed discounts)
- `minCartValuePaise` (Integer?, minimum authoritative cart subtotal in paise required to apply)
- `maxDiscountPaise` (Integer?, maximum cap in paise for percentage discounts)
- `startDate` (DateTime?, coupon cannot be used prior to this timestamp)
- `expiryDate` (DateTime?, coupon cannot be used at or after this timestamp)
- `usageLimit` (Integer?, total global usage limit across all customers)
- `perCustomerLimit` (Integer?, maximum times a single authenticated customer can redeem this coupon)
- `currentUsageCount` (Integer, tracking global redeemed count)
- `isActive` (Boolean, administrative kill-switch)
- `createdAt`, `updatedAt`

### `CouponUsage`
- `id` (CUID)
- `couponId` (Foreign key to `Coupon`)
- `customerId` (Foreign key to `Customer`, nullable for guest checkouts)
- `cartId` (Foreign key to `Cart`, nullable)
- `usedAt` (DateTime)

### `Cart` Integration
- `Cart.couponId` (Foreign key to `Coupon`, nullable)
- Holds a direct relation to the currently applied coupon.

---

## 2. Coupon Code Normalization & Formatting

- **Strategy**: Trim leading/trailing whitespace, transform to uppercase.
- **Format constraint**: `^[A-Z0-9_-]{2,30}$`. Visually distinct casings (`save10`, `SAVE10`, ` Save10 `) normalize to the identical unique key `SAVE10`.
- Stored and indexed uniquely on `code`.

---

## 3. Discount Calculations

Discounts are calculated strictly from the server-authoritative `subtotalPaise`:

### Percentage Discounts (`PERCENTAGE`)
$$\text{calculated} = \text{round}\left(\frac{\text{subtotalPaise} \times \text{discountValue}}{100}\right)$$
If `maxDiscountPaise` is defined:
$$\text{discount} = \min(\text{calculated}, \text{maxDiscountPaise})$$
Floor check:
$$\text{finalTotal} = \max(0, \text{subtotalPaise} - \text{discount})$$

### Fixed Discounts (`FIXED_AMOUNT`)
$$\text{discount} = \min(\text{subtotalPaise}, \text{discountValue})$$
$$\text{finalTotal} = \max(0, \text{subtotalPaise} - \text{discount})$$

The final total is prevented from becoming negative under all circumstances.

---

## 4. Validation Rules & Customer Eligibility

When applying or revalidating a coupon, the following assertions are evaluated server-side:
1. **Empty Cart Check**: Cart must contain at least 1 item and have subtotal > 0.
2. **Active Status**: `coupon.isActive === true`.
3. **Start Date**: `now >= coupon.startDate` (evaluated using server UTC).
4. **Expiry Date**: `now < coupon.expiryDate` (evaluated using server UTC).
5. **Minimum Cart Value**: `subtotalPaise >= coupon.minCartValuePaise`.
6. **Global Usage Limit**: If defined, `currentUsageCount < usageLimit`.
7. **Per-Customer Limit**: If authenticated customer and limit defined, `customerPreviousUsageCount < perCustomerLimit`.

---

## 5. Cart Mutation Revalidation Flow

Whenever a cart changes:
- Item added (`addItemToCart`)
- Item removed (`removeCartItem`)
- Quantity updated (`updateCartItemQuantity`)
- Dimensions/options updated (`updateCartItemConfiguration`)

`getCartWithFreshPricing` is invoked:
1. Recalculates authoritative line item prices and fresh `subtotalPaise`.
2. Inspects `cart.couponId`.
3. If coupon is no longer eligible (e.g. Subtotal dropped below `minCartValuePaise`, or global limit reached):
   - Automatically decouples coupon (`couponId: null`).
   - Sets `discountPaise = 0`.
   - Returns a friendly, informative `couponWarning` message to the shopper explaining why the coupon was removed.
4. If eligible:
   - Recalculates `discountPaise` against the fresh subtotal.
   - Computes `totalPaise = subtotalPaise - discountPaise`.

---

## 6. Concurrency & Race Condition Protection

- Coupon application uses atomic database transactions (`prisma.$transaction`).
- Within the transaction, the coupon record is re-queried to verify `currentUsageCount < usageLimit` and `isActive` before binding `couponId` to the cart.
- Checkout finalization in Phase 07 will lock and increment `currentUsageCount` atomically during order creation.

---

## 7. Security Boundaries

- **No Client Price / Discount Trust**: The client cannot supply a discount value, coupon reduction amount, or total amount. All figures are derived server-side.
- **Cart Ownership Enforcement**: Coupons cannot be applied or removed from carts belonging to other sessions or customers.
- **Customer ID Resolution**: Customer identity is resolved strictly from the authenticated server session, preventing ID spoofing.
