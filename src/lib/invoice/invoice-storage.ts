import "server-only";
import { uploadObject, objectExists, isR2Configured, getPublicUrl } from "@/lib/storage/storage";
import { logger } from "@/lib/logger";

export interface SaveInvoicePdfOptions {
  invoiceNumber: string;
  pdfBuffer: Buffer;
  year?: number;
  overwrite?: boolean;
}

export interface SaveInvoicePdfResult {
  key: string;
  url: string;
  size: number;
}

/**
 * Deterministically generates the R2 object key for an invoice PDF.
 * Format: invoices/{year}/{invoiceNumber}.pdf
 */
export function getInvoiceObjectKey(invoiceNumber: string, year = new Date().getFullYear()): string {
  const safeNumber = invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "-").toUpperCase();
  return `invoices/${year}/${safeNumber}.pdf`;
}

/**
 * Uploads an invoice PDF buffer to Cloudflare R2 object storage.
 * Idempotent: Skips upload if object already exists unless overwrite is set to true.
 */
export async function saveInvoicePdfToR2(
  options: SaveInvoicePdfOptions
): Promise<SaveInvoicePdfResult> {
  const { invoiceNumber, pdfBuffer, year = new Date().getFullYear(), overwrite = false } = options;
  const key = getInvoiceObjectKey(invoiceNumber, year);

  if (!isR2Configured()) {
    logger.warn("R2 is not configured. Storing mock reference for invoice.", {
      component: "InvoiceStorage",
      invoiceNumber,
      key,
    });
    return {
      key,
      url: `/api/invoices/${encodeURIComponent(invoiceNumber)}/download`,
      size: pdfBuffer.byteLength,
    };
  }

  try {
    if (!overwrite) {
      const exists = await objectExists(key);
      if (exists) {
        return {
          key,
          url: getPublicUrl(key),
          size: pdfBuffer.byteLength,
        };
      }
    }

    const uploadResult = await uploadObject({
      key,
      body: pdfBuffer,
      contentType: "application/pdf",
      cacheControl: "private, no-cache, no-store",
    });

    return {
      key: uploadResult.key,
      url: uploadResult.url,
      size: uploadResult.size,
    };
  } catch (error) {
    logger.error("Failed to upload invoice PDF to R2", {
      component: "InvoiceStorage",
      invoiceNumber,
      key,
    }, error as Error);
    throw new Error(`Invoice storage failed: ${(error as Error).message}`);
  }
}
