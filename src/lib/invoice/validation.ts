import { z } from "zod";

export const invoiceAddressSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  addressLine1: z.string().min(1, "Address Line 1 is required"),
  addressLine2: z.string().nullable().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().min(4, "Invalid PIN/Postal code"),
  country: z.string().default("IN"),
  phone: z.string().nullable().optional(),
});

export const invoiceCustomerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  email: z.string().email("Valid customer email is required"),
  phone: z.string().nullable().optional(),
  gstin: z.string().nullable().optional(),
});

export const sellerProfileSchema = z.object({
  legalName: z.string().min(1),
  tradeName: z.string().min(1),
  gstin: z.string().min(1),
  pan: z.string().min(1),
  addressLine1: z.string().min(1),
  addressLine2: z.string().nullable().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  stateCode: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().default("IN"),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
});

export const invoiceLineSchema = z.object({
  lineId: z.string().min(1),
  productId: z.string().min(1),
  productName: z.string().min(1),
  hsnCode: z.string().min(2),
  productType: z.enum(["PER_AREA", "FIXED"]).optional(),
  variantName: z.string().nullable().optional(),
  dimensions: z
    .object({
      width: z.number().optional(),
      height: z.number().optional(),
      unit: z.string().optional(),
      areaSqft: z.number().optional(),
    })
    .nullable()
    .optional(),
  quantity: z.number().int().positive(),
  unitPricePaise: z.number().int().nonnegative(),
  grossAmountPaise: z.number().int().nonnegative(),
  discountPaise: z.number().int().nonnegative(),
  taxableAmountPaise: z.number().int().nonnegative(),
  gstRatePct: z.number().nonnegative(),
  isIntraState: z.boolean(),
  cgstRatePct: z.number().nonnegative(),
  cgstAmountPaise: z.number().int().nonnegative(),
  sgstRatePct: z.number().nonnegative(),
  sgstAmountPaise: z.number().int().nonnegative(),
  igstRatePct: z.number().nonnegative(),
  igstAmountPaise: z.number().int().nonnegative(),
  totalTaxPaise: z.number().int().nonnegative(),
  lineTotalWithTaxPaise: z.number().int().nonnegative(),
});

export const hsnTaxSummarySchema = z.object({
  hsnCode: z.string().min(1),
  taxableAmountPaise: z.number().int().nonnegative(),
  gstRatePct: z.number().nonnegative(),
  cgstAmountPaise: z.number().int().nonnegative(),
  sgstAmountPaise: z.number().int().nonnegative(),
  igstAmountPaise: z.number().int().nonnegative(),
  totalTaxPaise: z.number().int().nonnegative(),
});

export const invoiceTotalsSchema = z.object({
  subtotalPaise: z.number().int().nonnegative(),
  discountPaise: z.number().int().nonnegative(),
  discountedSubtotalPaise: z.number().int().nonnegative(),
  shippingAmountPaise: z.number().int().nonnegative(),
  shippingTaxPaise: z.number().int().nonnegative(),
  totalTaxableAmountPaise: z.number().int().nonnegative(),
  totalCgstPaise: z.number().int().nonnegative(),
  totalSgstPaise: z.number().int().nonnegative(),
  totalIgstPaise: z.number().int().nonnegative(),
  totalTaxAmountPaise: z.number().int().nonnegative(),
  grandTotalPaise: z.number().int().nonnegative(),
});

export const invoicePaymentSchema = z
  .object({
    method: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    transactionId: z.string().nullable().optional(),
    paidAt: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

export const invoiceSnapshotDTOSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.string().min(1, "Invoice date is required"),
  dueDate: z.string().nullable().optional(),
  placeOfSupply: z.string().min(1, "Place of supply is required"),
  seller: sellerProfileSchema,
  customer: invoiceCustomerSchema,
  billingAddress: invoiceAddressSchema,
  shippingAddress: invoiceAddressSchema,
  lines: z.array(invoiceLineSchema).min(1, "At least one line item is required"),
  taxSummary: z.array(hsnTaxSummarySchema),
  totals: invoiceTotalsSchema,
  payment: invoicePaymentSchema,
  notes: z.string().nullable().optional(),
});

export function validateInvoiceSnapshotDTO(data: unknown) {
  return invoiceSnapshotDTOSchema.parse(data);
}
