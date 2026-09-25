import assert from "node:assert";
import { calculateGstTaxes } from "../tax-calculator";
import { DEFAULT_FALLBACK_HSN } from "../config";

export function runTaxEngineTests() {
  console.log("--> Running Micro-Phase 07.03: GST & Tax Calculation Tests...");

  // -------------------------------------------------------------
  // Test 1: Intra-State GST Calculation (CGST + SGST)
  // -------------------------------------------------------------
  console.log("  1. Testing Intra-State GST Calculation (Telangana -> Telangana)...");
  const items = [
    {
      id: "line-1",
      productId: "prod-1",
      productName: "Floral Wallpaper Mural",
      hsnCode: "4814",
      quantity: 1,
      unitPricePaise: 100000, // ₹1,000
      totalPricePaise: 100000,
    },
  ];

  // ₹1,000 subtotal, 0 discount, 0 shipping, intra-state -> 9% CGST (₹90 = 9000 paise) + 9% SGST (₹90 = 9000 paise) = ₹180 (18000 paise) tax
  const intraResult = calculateGstTaxes({
    lines: items,
    customerState: "Telangana",
    sellerState: "Telangana",
    customGstRatePct: 18,
  });

  assert.strictEqual(intraResult.isIntraState, true);
  assert.strictEqual(intraResult.itemsTaxableAmountPaise, 100000);
  assert.strictEqual(intraResult.itemsCgstPaise, 9000);
  assert.strictEqual(intraResult.itemsSgstPaise, 9000);
  assert.strictEqual(intraResult.itemsIgstPaise, 0);
  assert.strictEqual(intraResult.totalTaxAmountPaise, 18000);
  assert.strictEqual(intraResult.grandTotalPaise, 118000); // ₹1,180

  // -------------------------------------------------------------
  // Test 2: Inter-State GST Calculation (Telangana -> Maharashtra: IGST)
  // -------------------------------------------------------------
  console.log("  2. Testing Inter-State GST Calculation (Telangana -> Maharashtra)...");
  const interResult = calculateGstTaxes({
    lines: items,
    customerState: "Maharashtra",
    sellerState: "Telangana",
    customGstRatePct: 18,
  });

  assert.strictEqual(interResult.isIntraState, false);
  assert.strictEqual(interResult.itemsTaxableAmountPaise, 100000);
  assert.strictEqual(interResult.itemsCgstPaise, 0);
  assert.strictEqual(interResult.itemsSgstPaise, 0);
  assert.strictEqual(interResult.itemsIgstPaise, 18000); // 18% IGST = ₹180
  assert.strictEqual(interResult.totalTaxAmountPaise, 18000);
  assert.strictEqual(interResult.grandTotalPaise, 118000);

  // -------------------------------------------------------------
  // Test 3: Discounted Taxable Amount & Proportional Distribution
  // -------------------------------------------------------------
  console.log("  3. Testing Proportional Discount Allocation across lines...");
  const multiItems = [
    {
      id: "line-a",
      productId: "prod-a",
      productName: "Wallpaper Roll A",
      hsnCode: "4814",
      quantity: 1,
      unitPricePaise: 300000, // ₹3,000 (75% of cart)
      totalPricePaise: 300000,
    },
    {
      id: "line-b",
      productId: "prod-b",
      productName: "Wallpaper Roll B",
      hsnCode: "4814",
      quantity: 1,
      unitPricePaise: 100000, // ₹1,000 (25% of cart)
      totalPricePaise: 100000,
    },
  ];

  // ₹4,000 subtotal - ₹400 coupon discount = ₹3,600 taxable
  // line-a gets 75% of ₹400 = ₹300 discount -> ₹2,700 taxable (270000 paise)
  // line-b gets 25% of ₹400 = ₹100 discount -> ₹900 taxable (90000 paise)
  const discountResult = calculateGstTaxes({
    lines: multiItems,
    discountPaise: 40000, // ₹400
    customerState: "Telangana",
    customGstRatePct: 18,
  });

  assert.strictEqual(discountResult.itemsTaxableAmountPaise, 360000);
  assert.strictEqual(discountResult.lines[0].discountPaise, 30000);
  assert.strictEqual(discountResult.lines[0].taxableAmountPaise, 270000);
  assert.strictEqual(discountResult.lines[1].discountPaise, 10000);
  assert.strictEqual(discountResult.lines[1].taxableAmountPaise, 90000);

  // 18% on ₹3,600 = ₹648 (64800 paise) -> CGST 32400 + SGST 32400
  assert.strictEqual(discountResult.totalCgstPaise, 32400);
  assert.strictEqual(discountResult.totalSgstPaise, 32400);
  assert.strictEqual(discountResult.totalTaxAmountPaise, 64800);
  assert.strictEqual(discountResult.grandTotalPaise, 424800); // ₹4,248

  // -------------------------------------------------------------
  // Test 4: Shipping Tax Integration
  // -------------------------------------------------------------
  console.log("  4. Testing Shipping Tax Integration...");
  const shippingResult = calculateGstTaxes({
    lines: items,
    discountPaise: 0,
    shippingPaise: 15000, // ₹150 shipping
    customerState: "Telangana",
    customGstRatePct: 18,
  });

  assert.strictEqual(shippingResult.shippingAmountPaise, 15000);
  assert.strictEqual(shippingResult.shippingTaxablePaise, 15000);
  // 9% CGST on ₹150 = ₹13.50 -> 1350 paise. 9% SGST = 1350 paise. Total shipping tax = 2700 paise (₹27)
  assert.strictEqual(shippingResult.shippingCgstPaise, 1350);
  assert.strictEqual(shippingResult.shippingSgstPaise, 1350);
  assert.strictEqual(shippingResult.shippingTotalTaxPaise, 2700);

  // Total taxable = ₹1,000 + ₹150 = ₹1,150 (115000 paise)
  assert.strictEqual(shippingResult.totalTaxableAmountPaise, 115000);
  // Total tax = 18000 + 2700 = 20700 paise (₹207)
  assert.strictEqual(shippingResult.totalTaxAmountPaise, 20700);
  // Grand total = 115000 + 20700 = 135700 paise (₹1,357)
  assert.strictEqual(shippingResult.grandTotalPaise, 135700);

  // -------------------------------------------------------------
  // Test 5: Multiple HSN Aggregation
  // -------------------------------------------------------------
  console.log("  5. Testing Multiple HSN Code Aggregation...");
  const multiHsnLines = [
    {
      id: "line-wall",
      productId: "prod-w",
      productName: "Wallpaper",
      hsnCode: "4814",
      quantity: 1,
      unitPricePaise: 200000,
      totalPricePaise: 200000,
    },
    {
      id: "line-art",
      productId: "prod-a",
      productName: "Framed Canvas Art",
      hsnCode: "4911",
      quantity: 1,
      unitPricePaise: 100000,
      totalPricePaise: 100000,
    },
  ];

  const hsnResult = calculateGstTaxes({
    lines: multiHsnLines,
    shippingPaise: 10000,
    customerState: "Karnataka", // Inter-state (IGST)
    customGstRatePct: 18,
  });

  assert.strictEqual(hsnResult.hsnSummaries.length, 3); // 4814, 4911, and 9968 (shipping)
  const hsn4814 = hsnResult.hsnSummaries.find((h) => h.hsnCode === "4814");
  const hsn4911 = hsnResult.hsnSummaries.find((h) => h.hsnCode === "4911");
  const hsn9968 = hsnResult.hsnSummaries.find((h) => h.hsnCode === "9968");

  assert.ok(hsn4814 && hsn4814.taxableAmountPaise === 200000);
  assert.ok(hsn4911 && hsn4911.taxableAmountPaise === 100000);
  assert.ok(hsn9968 && hsn9968.taxableAmountPaise === 10000);

  // -------------------------------------------------------------
  // Test 6: Fallback Default HSN and Zero Tax Configuration
  // -------------------------------------------------------------
  console.log("  6. Testing Fallback HSN and Zero Tax Configuration...");
  const noHsnLine = [
    {
      id: "line-nohsn",
      productId: "prod-nohsn",
      productName: "Custom Wallcovering",
      hsnCode: null,
      quantity: 1,
      unitPricePaise: 50000,
      totalPricePaise: 50000,
    },
  ];

  const fallbackResult = calculateGstTaxes({
    lines: noHsnLine,
  });
  assert.strictEqual(fallbackResult.lines[0].hsnCode, DEFAULT_FALLBACK_HSN);

  const zeroTaxResult = calculateGstTaxes({
    lines: noHsnLine,
    customGstRatePct: 0,
  });
  assert.strictEqual(zeroTaxResult.totalTaxAmountPaise, 0);
  assert.strictEqual(zeroTaxResult.grandTotalPaise, 50000);

  console.log("  ✔ All GST & Tax Calculation tests passed successfully!");
}
