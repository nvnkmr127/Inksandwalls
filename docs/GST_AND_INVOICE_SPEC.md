# GST / Tax Computation, HSN, and Invoice PDF Generation (Micro-Phase 07.03)

## Canonical Spec: INKs-and-Walls-PRD.md §7.2, §8, §11

---

## 1. GST Calculation Engine

Tax calculations in INKs & Walls follow Indian Goods and Services Tax (GST) principles:

- **Intra-State Supply** (Seller State === Buyer State):
  - Equal split between Central GST (CGST) and State GST (SGST).
  - e.g., 18% GST -> 9% CGST + 9% SGST.
- **Inter-State Supply** (Seller State !== Buyer State):
  - Integrated GST (IGST) at the full rate.
  - e.g., 18% GST -> 18% IGST.
- **Discount Allocation:**
  - Order-level coupon discounts are proportionally distributed across taxable items before calculating GST.
- **Precision:**
  - All values stored and computed in integer minor units (`paise`) using `Math.round` to prevent floating-point drift.
- **Shipping GST:**
  - Shipping/courier service (HSN/SAC `9968`) is taxed at the applicable GST rate.

---

## 2. Product HSN Integration

- Products store their canonical HSN code in `Product.hsnCode`.
- Default fallback HSN: `4814` (Wallpaper and wall coverings).
- Art prints/fixed canvas HSN: `4911` (Printed matter).
- Line item snapshots capture `hsnCode` permanently to preserve legal records.

---

## 3. Invoice Snapshot DTO & Storage

The invoice engine constructs an immutable `InvoiceSnapshotDTO` containing:

- Invoice Number & Date
- Seller Profile (Legal Name, GSTIN, PAN, Address, State & Code)
- Customer Profile & Delivery Addresses
- Line items with dimensions, HSN, quantities, unit prices, discounts, and tax breakdowns
- HSN Summary Table
- Totals (Subtotal, Discounts, Shipping, Taxes, Grand Total)

---

## 4. Server-Side PDF Generation & R2 Upload

- Invoices are rendered directly on the server to compliant standard PDF 1.4 binary format.
- Output dimensions: Standard A4 portrait (`595.28 x 841.89 pt`).
- Rendered PDFs are saved to Cloudflare R2 under `invoices/{year}/{invoiceNumber}.pdf` with private access.
- Uploads are idempotent (duplicate requests verify existing keys before re-uploading).

---

## 5. Unresolved Client Inputs (PRD §11)

The following inputs are currently configured via environment variables and configuration defaults pending client confirmation:

1. **GST Rate(s):**
   - Default: `18%` (standard for wall coverings & decor).
   - Configurable via: `DEFAULT_GST_RATE_PCT`.
2. **Seller Legal & Tax Details:**
   - Legal Business Name: `SELLER_LEGAL_NAME` (default: `INKs & Walls Private Limited`)
   - GSTIN: `SELLER_GSTIN`
   - PAN: `SELLER_PAN`
   - Registered Business Address: `SELLER_ADDRESS_LINE1`, `SELLER_ADDRESS_LINE2`, `SELLER_CITY`, `SELLER_PINCODE`
   - State & State Code: `SELLER_STATE` (default: `Telangana`), `SELLER_STATE_CODE` (default: `36`)
3. **Invoice Numbering Scheme:**
   - Prefix: `INVOICE_PREFIX` (default: `INV`)
