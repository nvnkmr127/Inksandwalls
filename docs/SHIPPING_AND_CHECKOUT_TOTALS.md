# Shipping Cost Rules and Authoritative Checkout Totals

## Micro-Phase: 07.02
**Canonical Spec:** INKs-and-Walls-PRD.md §7.2, §8

---

## 1. Shipping Rule Model

Shipping rules in INKs & Walls define delivery availability, shipping costs, and free shipping thresholds across India.

### Schema Definition (`ShippingRule`)

```prisma
model ShippingRule {
  id                         String   @id @default(cuid())
  name                       String
  description                String?  @db.Text
  pincodePattern             String?  @map("pincode_pattern") // e.g. "500*", "500001, 500002", or "*" / null
  state                      String?  // e.g. "Telangana", "Maharashtra", or null
  minOrderValuePaise         Int?     @map("min_order_value_paise")
  maxOrderValuePaise         Int?     @map("max_order_value_paise")
  shippingCostPaise          Int      @default(0) @map("shipping_cost_paise")
  freeShippingThresholdPaise Int?     @map("free_shipping_threshold_paise")
  isDeliverable              Boolean  @default(true) @map("is_deliverable")
  priority                   Int      @default(0)
  isActive                   Boolean  @default(true) @map("is_active")
  createdAt                  DateTime @default(now()) @map("created_at")
  updatedAt                  DateTime @updatedAt @map("updated_at")

  @@index([isActive])
  @@index([priority])
  @@map("shipping_rules")
}
```

### Dimensions

- **Pincode Pattern:** Exact pincode (`500001`), prefix wildcard (`500*`), comma-separated list (`500001, 500002`), or universal wildcard (`*` or `null`).
- **State Filter:** Optional state matching (e.g., `Telangana`, `Maharashtra`).
- **Order Value Bounds:** `minOrderValuePaise` and `maxOrderValuePaise` define eligible cart subtotal range.
- **Shipping Cost:** Integer minor units (`paise`).
- **Free Shipping Threshold:** Eligible cart subtotal in paise at or above which shipping cost becomes `0`.
- **Deliverability Flag:** `isDeliverable = false` explicitly blocks orders to matching regions.

---

## 2. Shipping Rule Precedence & Priority

Resolution is 100% deterministic:

1. **Filtering:** Active rules (`isActive = true`) matching subtotal value bounds and target pincode/state.
2. **Specificity Scoring:**
   - Exact PIN code match: `+30`
   - Wildcard prefix match (`500*`): `+20`
   - State match: `+10`
   - Universal nationwide rule: `+0`
3. **Composite Priority:** `priority * 100 + specificityScore` (Descending).
4. **Tie Breaking:** Lower `shippingCostPaise` ASC, then `id` ASC.
5. **Fallback:** If no custom database rule matches, the system uses the default standard rule:
   - Name: Standard Delivery
   - Cost: ₹150 (15,000 paise)
   - Free Shipping Threshold: ₹1,500 (150,000 paise)

---

## 3. Pincode & Address Integration

1. Pincodes are validated against the 6-digit standard Indian postal format (`/^[1-9][0-9]{5}$/`).
2. Restricted/unserviceable zones are detected before rule execution.
3. Deliverability checks ensure only valid, serviceable addresses can proceed to payment.

---

## 4. Authoritative Checkout Totals Calculation Flow

The server-side totals engine executes in the following strict order:

```
[Cart Items]
     │
     ▼
1. Compute Cart Subtotal (Sum of active CartItem line totals in paise)
     │
     ▼
2. Revalidate & Apply Coupon (calculateCouponDiscount)
   ↳ If ineligible: Discount = 0, set customer warning message
     │
     ▼
3. Calculate Discounted Subtotal: max(0, Subtotal - Coupon Discount)
     │
     ▼
4. Resolve Shipping Rule (resolveShippingRule)
   ↳ Check address pincode & state
   ↳ Evaluate Free Shipping Threshold on authoritative subtotal
   ↳ Set shipping cost (0 if free shipping or undeliverable)
     │
     ▼
5. Tax Placeholder (taxAmountPaise = 0, reserved for Micro-Phase 07.03 GST)
     │
     ▼
6. Compute Total Payable: Discounted Subtotal + Shipping + Tax
```

---

## 5. Recalculation Triggers

Authoritative totals recalculate whenever:
- Cart line items or quantities change.
- Product configuration or dimensions change.
- A coupon is applied, changed, or invalidated.
- Shipping address or PIN code is selected or updated.
- A customer logs in and merges a guest cart.

---

## 6. Monetary Representation & Security Boundaries

- **Minor Units (Paise):** All monetary values (`subtotalPaise`, `couponDiscountPaise`, `shippingPaise`, `taxAmountPaise`, `totalAmountPaise`) are stored and computed as integer minor units.
- **No Floating-Point Arithmetic:** Zero float rounding drift.
- **Zero Client Trust:**
  - Client-supplied shipping prices are strictly ignored.
  - Client-supplied discounts or totals are rejected.
  - Ownership is verified against session cookie (`sessionId`) or authenticated customer (`customerId`).
