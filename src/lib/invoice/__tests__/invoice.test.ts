import assert from "node:assert";
import { generateInvoicePdfBuffer, numberToIndianWords } from "../pdf-generator";
import { validateInvoiceSnapshotDTO } from "../validation";
import { generateInvoice } from "../invoice-service";
import { getInvoiceObjectKey } from "../invoice-storage";
import { DEFAULT_SELLER_PROFILE } from "@/lib/tax/config";
import type { InvoiceSnapshotDTO } from "../types";

export async function runInvoiceTests() {
  console.log("--> Running Micro-Phase 07.03: Invoice Snapshot, PDF & R2 Tests...");

  // -------------------------------------------------------------
  // Test 1: Number to Indian Words Conversion
  // -------------------------------------------------------------
  console.log("  1. Testing Indian English Number-to-Words Conversion...");
  assert.strictEqual(
    numberToIndianWords(118000), // ₹1,180
    "One Thousand One Hundred and Eighty Rupees Only"
  );
  assert.strictEqual(
    numberToIndianWords(424800), // ₹4,248
    "Four Thousand Two Hundred and Forty Eight Rupees Only"
  );
  assert.strictEqual(
    numberToIndianWords(15000000), // ₹1,50,000 (1.5 Lakh)
    "One Lakh Fifty Thousand Rupees Only"
  );
  assert.strictEqual(
    numberToIndianWords(0),
    "Zero Rupees Only"
  );

  // -------------------------------------------------------------
  // Test 2: Invoice Snapshot DTO Validation
  // -------------------------------------------------------------
  console.log("  2. Testing Invoice Snapshot DTO Validation...");
  const validSnapshot: InvoiceSnapshotDTO = {
    invoiceNumber: "INV-2026-0001",
    invoiceDate: "2026-09-24T12:00:00.000Z",
    dueDate: null,
    placeOfSupply: "Telangana (36)",
    seller: DEFAULT_SELLER_PROFILE,
    customer: {
      name: "Rohan Sharma",
      email: "rohan@example.com",
      phone: "+919876543210",
      gstin: null,
    },
    billingAddress: {
      firstName: "Rohan",
      lastName: "Sharma",
      addressLine1: "Flat 402, Sunshine Apts",
      addressLine2: "Banjara Hills",
      city: "Hyderabad",
      state: "Telangana",
      postalCode: "500034",
      country: "IN",
      phone: "+919876543210",
    },
    shippingAddress: {
      firstName: "Rohan",
      lastName: "Sharma",
      addressLine1: "Flat 402, Sunshine Apts",
      addressLine2: "Banjara Hills",
      city: "Hyderabad",
      state: "Telangana",
      postalCode: "500034",
      country: "IN",
      phone: "+919876543210",
    },
    lines: [
      {
        lineId: "l1",
        productId: "p1",
        productName: "Premium Silk Wallpaper - Heritage Botanical Motif",
        hsnCode: "4814",
        productType: "PER_AREA",
        variantName: "Matte Finish",
        dimensions: { width: 10, height: 8, unit: "ft", areaSqft: 80 },
        quantity: 1,
        unitPricePaise: 400000,
        grossAmountPaise: 400000,
        discountPaise: 40000,
        taxableAmountPaise: 360000,
        gstRatePct: 18,
        isIntraState: true,
        cgstRatePct: 9,
        cgstAmountPaise: 32400,
        sgstRatePct: 9,
        sgstAmountPaise: 32400,
        igstRatePct: 0,
        igstAmountPaise: 0,
        totalTaxPaise: 64800,
        lineTotalWithTaxPaise: 424800,
      },
    ],
    taxSummary: [
      {
        hsnCode: "4814",
        taxableAmountPaise: 360000,
        gstRatePct: 18,
        cgstAmountPaise: 32400,
        sgstAmountPaise: 32400,
        igstAmountPaise: 0,
        totalTaxPaise: 64800,
      },
    ],
    totals: {
      subtotalPaise: 400000,
      discountPaise: 40000,
      discountedSubtotalPaise: 360000,
      shippingAmountPaise: 0,
      shippingTaxPaise: 0,
      totalTaxableAmountPaise: 360000,
      totalCgstPaise: 32400,
      totalSgstPaise: 32400,
      totalIgstPaise: 0,
      totalTaxAmountPaise: 64800,
      grandTotalPaise: 424800,
    },
    payment: {
      method: "ONLINE",
      status: "PAID",
      transactionId: "pay_test123",
      paidAt: "2026-09-24T12:00:00.000Z",
    },
    notes: "Custom printed on premium wallpaper stock.",
  };

  const validated = validateInvoiceSnapshotDTO(validSnapshot);
  assert.strictEqual(validated.invoiceNumber, "INV-2026-0001");
  assert.strictEqual(validated.totals.grandTotalPaise, 424800);

  // Rejection of invalid invoice data
  assert.throws(() => {
    validateInvoiceSnapshotDTO({
      ...validSnapshot,
      invoiceNumber: "", // invalid empty number
    });
  });

  // -------------------------------------------------------------
  // Test 3: PDF Binary Generation & Layout Safety
  // -------------------------------------------------------------
  console.log("  3. Testing PDF Binary Generation & Special Characters...");
  const pdfBuffer = generateInvoicePdfBuffer(validSnapshot);
  assert.ok(Buffer.isBuffer(pdfBuffer));
  assert.ok(pdfBuffer.byteLength > 1000, "PDF buffer must contain substantial content");

  const pdfString = pdfBuffer.toString("utf-8");
  assert.ok(pdfString.startsWith("%PDF-1.4"), "Must have standard PDF-1.4 magic header");
  assert.ok(pdfString.includes("%%EOF"), "Must contain EOF trailer marker");
  assert.ok(pdfString.includes("TAX INVOICE"), "Must render Tax Invoice header");
  assert.ok(pdfString.includes("INV-2026-0001"), "Must contain invoice number");
  assert.ok(pdfString.includes("Rohan Sharma"), "Must render customer name");

  // Test Long Strings & Escaped Characters
  const longNameSnapshot: InvoiceSnapshotDTO = {
    ...validSnapshot,
    customer: {
      ...validSnapshot.customer,
      name: "Dr. Srikanth Varma (Specialist Consultant & Architect)",
    },
    lines: [
      {
        ...validSnapshot.lines[0],
        productName:
          "Ultra High Resolution Custom Mural - Victorian Golden Meadow & Majestic Flora (Extra Large Panoramic Edition with Matte Texture)",
      },
    ],
  };

  const longPdfBuffer = generateInvoicePdfBuffer(longNameSnapshot);
  assert.ok(longPdfBuffer.byteLength > 1000);
  assert.ok(longPdfBuffer.toString("utf-8").includes("%%EOF"));

  // -------------------------------------------------------------
  // Test 4: Deterministic R2 Key Generation
  // -------------------------------------------------------------
  console.log("  4. Testing Deterministic R2 Key Generation...");
  const key = getInvoiceObjectKey("INV-2026-0001", 2026);
  assert.strictEqual(key, "invoices/2026/INV-2026-0001.pdf");

  // -------------------------------------------------------------
  // Test 5: Full Invoice Service Generation Flow
  // -------------------------------------------------------------
  console.log("  5. Testing generateInvoice Service Flow...");
  const generationResult = await generateInvoice({
    invoiceNumber: "INV-2026-0099",
    invoiceDate: new Date("2026-09-24T15:30:00.000Z"),
    customer: {
      name: "Priya Nair",
      email: "priya@example.com",
      phone: "+919876543211",
    },
    billingAddress: {
      firstName: "Priya",
      lastName: "Nair",
      addressLine1: "12 Marine Drive",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400020",
      country: "IN",
      phone: "+919876543211",
    },
    shippingAddress: {
      firstName: "Priya",
      lastName: "Nair",
      addressLine1: "12 Marine Drive",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400020",
      country: "IN",
      phone: "+919876543211",
    },
    lines: [
      {
        id: "line-p1",
        productId: "prod-art",
        productName: "Abstract Canvas Art Print",
        hsnCode: "4911",
        productType: "FIXED",
        quantity: 2,
        unitPricePaise: 250000, // ₹2,500 each = ₹5,000 total
        totalPricePaise: 500000,
      },
    ],
    discountPaise: 50000, // ₹500 discount -> ₹4,500 taxable
    shippingPaise: 15000, // ₹150 shipping
    customGstRatePct: 18,
  });

  assert.strictEqual(generationResult.success, true);
  assert.strictEqual(generationResult.invoiceNumber, "INV-2026-0099");
  assert.strictEqual(generationResult.snapshot.totals.subtotalPaise, 500000);
  assert.strictEqual(generationResult.snapshot.totals.discountPaise, 50000);
  assert.strictEqual(generationResult.snapshot.totals.discountedSubtotalPaise, 450000);
  // Inter-state (Maharashtra vs Telangana) -> IGST only
  assert.strictEqual(generationResult.snapshot.totals.totalCgstPaise, 0);
  assert.strictEqual(generationResult.snapshot.totals.totalSgstPaise, 0);
  assert.ok(generationResult.snapshot.totals.totalIgstPaise > 0);
  assert.strictEqual(
    generationResult.r2Key,
    getInvoiceObjectKey("INV-2026-0099", new Date("2026-09-24T15:30:00.000Z").getFullYear())
  );
  assert.ok(generationResult.pdfBuffer && generationResult.pdfBuffer.byteLength > 1000);

  console.log("  ✔ All Invoice Snapshot, PDF & R2 tests passed successfully!");
}
