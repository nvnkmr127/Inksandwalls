import type { SellerTaxProfile } from "@/lib/tax/config";
import type { LineTaxDetail, HsnTaxSummary } from "@/lib/tax/types";

export interface InvoiceCustomerSnapshot {
  name: string;
  email: string;
  phone?: string | null;
  gstin?: string | null;
}

export interface InvoiceAddressSnapshot {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string | null;
}

export interface InvoiceLineSnapshot extends LineTaxDetail {
  productType?: "PER_AREA" | "FIXED";
  variantName?: string | null;
  dimensions?: {
    width?: number;
    height?: number;
    unit?: string;
    areaSqft?: number;
  } | null;
  unitPricePaise: number;
}

export interface InvoiceTotalsSnapshot {
  subtotalPaise: number;
  discountPaise: number;
  discountedSubtotalPaise: number;
  shippingAmountPaise: number;
  shippingTaxPaise: number;
  totalTaxableAmountPaise: number;
  totalCgstPaise: number;
  totalSgstPaise: number;
  totalIgstPaise: number;
  totalTaxAmountPaise: number;
  grandTotalPaise: number;
}

export interface InvoicePaymentSnapshot {
  method?: string | null; // e.g. "RAZORPAY", "COD", "PENDING"
  status?: string | null; // e.g. "PENDING", "PAID"
  transactionId?: string | null;
  paidAt?: string | null;
}

export interface InvoiceSnapshotDTO {
  invoiceNumber: string;
  invoiceDate: string; // ISO 8601 string
  dueDate?: string | null;
  placeOfSupply: string;
  seller: SellerTaxProfile;
  customer: InvoiceCustomerSnapshot;
  billingAddress: InvoiceAddressSnapshot;
  shippingAddress: InvoiceAddressSnapshot;
  lines: InvoiceLineSnapshot[];
  taxSummary: HsnTaxSummary[];
  totals: InvoiceTotalsSnapshot;
  payment?: InvoicePaymentSnapshot | null;
  notes?: string | null;
}

export interface InvoiceGenerationResult {
  success: boolean;
  invoiceNumber: string;
  invoiceDate: string;
  r2Key: string;
  r2Url: string;
  snapshot: InvoiceSnapshotDTO;
  pdfBuffer?: Buffer;
  error?: string;
}
