import "server-only";
import { validateInvoiceSnapshotDTO } from "./validation";
import { generateInvoicePdfBuffer } from "./pdf-generator";
import { saveInvoicePdfToR2 } from "./invoice-storage";
import { DEFAULT_SELLER_PROFILE, getStateGstCode } from "@/lib/tax/config";
import { calculateGstTaxes } from "@/lib/tax/tax-calculator";
import { logger } from "@/lib/logger";
import type {
  InvoiceSnapshotDTO,
  InvoiceGenerationResult,
  InvoiceCustomerSnapshot,
  InvoiceAddressSnapshot,
  InvoicePaymentSnapshot,
} from "./types";
import type { SellerTaxProfile } from "@/lib/tax/config";

export interface GenerateInvoiceInput {
  invoiceNumber: string;
  invoiceDate?: string | Date;
  dueDate?: string | Date | null;
  seller?: Partial<SellerTaxProfile>;
  customer: InvoiceCustomerSnapshot;
  billingAddress: InvoiceAddressSnapshot;
  shippingAddress: InvoiceAddressSnapshot;
  lines: Array<{
    id: string;
    productId: string;
    productName: string;
    hsnCode?: string | null;
    productType?: "PER_AREA" | "FIXED";
    variantName?: string | null;
    dimensions?: {
      width?: number;
      height?: number;
      unit?: string;
      areaSqft?: number;
    } | null;
    quantity: number;
    unitPricePaise: number;
    totalPricePaise: number;
  }>;
  discountPaise?: number;
  shippingPaise?: number;
  customGstRatePct?: number | null;
  payment?: InvoicePaymentSnapshot | null;
  notes?: string | null;
}

/**
 * Authoritative Server-Side Invoice Generation Service.
 * Validates inputs, calculates immutable tax lines & snapshots, generates PDF, and uploads to R2.
 */
export async function generateInvoice(
  input: GenerateInvoiceInput
): Promise<InvoiceGenerationResult> {
  try {
    const invoiceDateStr = input.invoiceDate
      ? typeof input.invoiceDate === "string"
        ? input.invoiceDate
        : input.invoiceDate.toISOString()
      : new Date().toISOString();

    const sellerProfile: SellerTaxProfile = {
      ...DEFAULT_SELLER_PROFILE,
      ...(input.seller || {}),
    };

    // Calculate authoritative taxes
    const taxResult = calculateGstTaxes({
      lines: input.lines,
      discountPaise: input.discountPaise || 0,
      shippingPaise: input.shippingPaise || 0,
      customerState: input.shippingAddress.state || input.billingAddress.state,
      sellerState: sellerProfile.state,
      customGstRatePct: input.customGstRatePct,
    });

    // Map calculated lines to invoice line snapshot
    const lineSnapshots = taxResult.lines.map((calcLine) => {
      const origLine = input.lines.find((l) => l.id === calcLine.lineId);
      return {
        ...calcLine,
        productType: origLine?.productType,
        variantName: origLine?.variantName,
        dimensions: origLine?.dimensions,
        unitPricePaise: origLine?.unitPricePaise || Math.round(calcLine.grossAmountPaise / (calcLine.quantity || 1)),
      };
    });

    const placeOfSupply = `${input.shippingAddress.state} (${
      getStateGstCode(input.shippingAddress.state) || "Code N/A"
    })`;

    const subtotalPaise = input.lines.reduce((sum, l) => sum + l.totalPricePaise, 0);
    const discountPaise = input.discountPaise || 0;
    const discountedSubtotalPaise = Math.max(0, subtotalPaise - discountPaise);

    const snapshotData: InvoiceSnapshotDTO = {
      invoiceNumber: input.invoiceNumber,
      invoiceDate: invoiceDateStr,
      dueDate: input.dueDate
        ? typeof input.dueDate === "string"
          ? input.dueDate
          : input.dueDate.toISOString()
        : null,
      placeOfSupply,
      seller: sellerProfile,
      customer: input.customer,
      billingAddress: input.billingAddress,
      shippingAddress: input.shippingAddress,
      lines: lineSnapshots,
      taxSummary: taxResult.hsnSummaries,
      totals: {
        subtotalPaise,
        discountPaise,
        discountedSubtotalPaise,
        shippingAmountPaise: taxResult.shippingAmountPaise,
        shippingTaxPaise: taxResult.shippingTotalTaxPaise,
        totalTaxableAmountPaise: taxResult.totalTaxableAmountPaise,
        totalCgstPaise: taxResult.totalCgstPaise,
        totalSgstPaise: taxResult.totalSgstPaise,
        totalIgstPaise: taxResult.totalIgstPaise,
        totalTaxAmountPaise: taxResult.totalTaxAmountPaise,
        grandTotalPaise: taxResult.grandTotalPaise,
      },
      payment: input.payment || null,
      notes: input.notes || null,
    };

    // Validate with Zod
    const validatedSnapshot = validateInvoiceSnapshotDTO(snapshotData);

    // Generate PDF Buffer
    const pdfBuffer = generateInvoicePdfBuffer(validatedSnapshot);

    // Upload to R2 Storage
    const storageResult = await saveInvoicePdfToR2({
      invoiceNumber: validatedSnapshot.invoiceNumber,
      pdfBuffer,
    });

    logger.info("Invoice generated and stored successfully", {
      component: "InvoiceService",
      invoiceNumber: validatedSnapshot.invoiceNumber,
      r2Key: storageResult.key,
      totalAmountPaise: validatedSnapshot.totals.grandTotalPaise,
    });

    return {
      success: true,
      invoiceNumber: validatedSnapshot.invoiceNumber,
      invoiceDate: validatedSnapshot.invoiceDate,
      r2Key: storageResult.key,
      r2Url: storageResult.url,
      snapshot: validatedSnapshot,
      pdfBuffer,
    };
  } catch (error) {
    logger.error("Invoice generation failed", {
      component: "InvoiceService",
      invoiceNumber: input.invoiceNumber,
    }, error as Error);

    return {
      success: false,
      invoiceNumber: input.invoiceNumber,
      invoiceDate: typeof input.invoiceDate === "string" ? input.invoiceDate : new Date().toISOString(),
      r2Key: "",
      r2Url: "",
      snapshot: {} as InvoiceSnapshotDTO,
      error: (error as Error).message,
    };
  }
}
