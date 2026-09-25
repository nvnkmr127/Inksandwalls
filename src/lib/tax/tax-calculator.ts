import {
  DEFAULT_GST_RATE_PCT,
  DEFAULT_FALLBACK_HSN,
  DEFAULT_SELLER_PROFILE,
} from "./config";
import type {
  TaxCalculationInput,
  TaxCalculationResult,
  LineTaxDetail,
  HsnTaxSummary,
} from "./types";

/**
 * Calculates line-level and aggregate GST taxes for cart/order line items.
 * Enforces Indian GST rules:
 * - Intra-State supply (Seller State === Customer State): CGST (50%) + SGST (50%)
 * - Inter-State supply (Seller State !== Customer State): IGST (100%)
 * - Proportional allocation of order-level discounts across taxable line items
 * - All monetary calculations in integer minor units (paise) with deterministic rounding
 */
export function calculateGstTaxes(input: TaxCalculationInput): TaxCalculationResult {
  const {
    lines,
    discountPaise = 0,
    shippingPaise = 0,
    customerState,
    sellerState = DEFAULT_SELLER_PROFILE.state,
    customGstRatePct,
  } = input;

  const gstRatePct = customGstRatePct != null && customGstRatePct >= 0
    ? customGstRatePct
    : DEFAULT_GST_RATE_PCT;

  const cleanCustomerState = (customerState || "").trim();
  const cleanSellerState = (sellerState || DEFAULT_SELLER_PROFILE.state).trim();

  // If customer state is provided, check if intra-state or inter-state
  // If not provided (pending address), default to intra-state breakdown
  const isIntraState = !cleanCustomerState ||
    cleanCustomerState.toLowerCase() === cleanSellerState.toLowerCase();

  const totalGrossPaise = lines.reduce((sum, line) => sum + line.totalPricePaise, 0);
  const effectiveDiscountPaise = Math.min(discountPaise, totalGrossPaise);

  // 1. Proportionally distribute cart-level discount across items
  let allocatedDiscountTotal = 0;
  const lineDiscounts: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (totalGrossPaise <= 0 || effectiveDiscountPaise <= 0) {
      lineDiscounts.push(0);
    } else if (i === lines.length - 1) {
      // Last item gets remaining discount balance to guarantee exact sum
      const remaining = effectiveDiscountPaise - allocatedDiscountTotal;
      lineDiscounts.push(Math.max(0, remaining));
    } else {
      const share = Math.round((lines[i].totalPricePaise / totalGrossPaise) * effectiveDiscountPaise);
      const cappedShare = Math.min(share, lines[i].totalPricePaise);
      lineDiscounts.push(cappedShare);
      allocatedDiscountTotal += cappedShare;
    }
  }

  // 2. Calculate Line-Level Taxes
  const calculatedLines: LineTaxDetail[] = [];
  let itemsTaxableAmountPaise = 0;
  let itemsCgstPaise = 0;
  let itemsSgstPaise = 0;
  let itemsIgstPaise = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineDiscount = lineDiscounts[i] || 0;
    const taxableAmountPaise = Math.max(0, line.totalPricePaise - lineDiscount);
    const hsnCode = line.hsnCode?.trim() || DEFAULT_FALLBACK_HSN;

    let cgstRatePct = 0;
    let cgstAmountPaise = 0;
    let sgstRatePct = 0;
    let sgstAmountPaise = 0;
    let igstRatePct = 0;
    let igstAmountPaise = 0;

    if (gstRatePct > 0 && taxableAmountPaise > 0) {
      if (isIntraState) {
        cgstRatePct = gstRatePct / 2;
        sgstRatePct = gstRatePct / 2;
        cgstAmountPaise = Math.round((taxableAmountPaise * cgstRatePct) / 100);
        sgstAmountPaise = Math.round((taxableAmountPaise * sgstRatePct) / 100);
      } else {
        igstRatePct = gstRatePct;
        igstAmountPaise = Math.round((taxableAmountPaise * igstRatePct) / 100);
      }
    }

    const totalTaxPaise = cgstAmountPaise + sgstAmountPaise + igstAmountPaise;
    const lineTotalWithTaxPaise = taxableAmountPaise + totalTaxPaise;

    itemsTaxableAmountPaise += taxableAmountPaise;
    itemsCgstPaise += cgstAmountPaise;
    itemsSgstPaise += sgstAmountPaise;
    itemsIgstPaise += igstAmountPaise;

    calculatedLines.push({
      lineId: line.id,
      productId: line.productId,
      productName: line.productName,
      hsnCode,
      quantity: line.quantity,
      grossAmountPaise: line.totalPricePaise,
      discountPaise: lineDiscount,
      taxableAmountPaise,
      gstRatePct,
      isIntraState,
      cgstRatePct,
      cgstAmountPaise,
      sgstRatePct,
      sgstAmountPaise,
      igstRatePct,
      igstAmountPaise,
      totalTaxPaise,
      lineTotalWithTaxPaise,
    });
  }

  const itemsTotalTaxPaise = itemsCgstPaise + itemsSgstPaise + itemsIgstPaise;

  // 3. Calculate Shipping Tax
  const shippingTaxablePaise = Math.max(0, shippingPaise);
  let shippingCgstPaise = 0;
  let shippingSgstPaise = 0;
  let shippingIgstPaise = 0;

  if (gstRatePct > 0 && shippingTaxablePaise > 0) {
    if (isIntraState) {
      shippingCgstPaise = Math.round((shippingTaxablePaise * (gstRatePct / 2)) / 100);
      shippingSgstPaise = Math.round((shippingTaxablePaise * (gstRatePct / 2)) / 100);
    } else {
      shippingIgstPaise = Math.round((shippingTaxablePaise * gstRatePct) / 100);
    }
  }

  const shippingTotalTaxPaise = shippingCgstPaise + shippingSgstPaise + shippingIgstPaise;

  // 4. Group by HSN for Tax Summary
  const hsnMap = new Map<string, HsnTaxSummary>();

  for (const line of calculatedLines) {
    const key = `${line.hsnCode}_${line.gstRatePct}`;
    const existing = hsnMap.get(key);
    if (existing) {
      existing.taxableAmountPaise += line.taxableAmountPaise;
      existing.cgstAmountPaise += line.cgstAmountPaise;
      existing.sgstAmountPaise += line.sgstAmountPaise;
      existing.igstAmountPaise += line.igstAmountPaise;
      existing.totalTaxPaise += line.totalTaxPaise;
    } else {
      hsnMap.set(key, {
        hsnCode: line.hsnCode,
        taxableAmountPaise: line.taxableAmountPaise,
        gstRatePct: line.gstRatePct,
        cgstAmountPaise: line.cgstAmountPaise,
        sgstAmountPaise: line.sgstAmountPaise,
        igstAmountPaise: line.igstAmountPaise,
        totalTaxPaise: line.totalTaxPaise,
      });
    }
  }

  // Add shipping HSN 9968 (Postal/Courier services) if shipping is charged
  if (shippingTaxablePaise > 0) {
    const shippingHsn = "9968";
    const key = `${shippingHsn}_${gstRatePct}`;
    const existing = hsnMap.get(key);
    if (existing) {
      existing.taxableAmountPaise += shippingTaxablePaise;
      existing.cgstAmountPaise += shippingCgstPaise;
      existing.sgstAmountPaise += shippingSgstPaise;
      existing.igstAmountPaise += shippingIgstPaise;
      existing.totalTaxPaise += shippingTotalTaxPaise;
    } else {
      hsnMap.set(key, {
        hsnCode: shippingHsn,
        taxableAmountPaise: shippingTaxablePaise,
        gstRatePct,
        cgstAmountPaise: shippingCgstPaise,
        sgstAmountPaise: shippingSgstPaise,
        igstAmountPaise: shippingIgstPaise,
        totalTaxPaise: shippingTotalTaxPaise,
      });
    }
  }

  const hsnSummaries = Array.from(hsnMap.values());

  // 5. Aggregate Grand Totals
  const totalTaxableAmountPaise = itemsTaxableAmountPaise + shippingTaxablePaise;
  const totalCgstPaise = itemsCgstPaise + shippingCgstPaise;
  const totalSgstPaise = itemsSgstPaise + shippingSgstPaise;
  const totalIgstPaise = itemsIgstPaise + shippingIgstPaise;
  const totalTaxAmountPaise = totalCgstPaise + totalSgstPaise + totalIgstPaise;
  const grandTotalPaise = totalTaxableAmountPaise + totalTaxAmountPaise;

  return {
    isIntraState,
    sellerState: cleanSellerState,
    customerState: cleanCustomerState || cleanSellerState,
    gstRatePct,
    lines: calculatedLines,
    itemsTaxableAmountPaise,
    itemsCgstPaise,
    itemsSgstPaise,
    itemsIgstPaise,
    itemsTotalTaxPaise,
    shippingAmountPaise: shippingPaise,
    shippingTaxablePaise,
    shippingCgstPaise,
    shippingSgstPaise,
    shippingIgstPaise,
    shippingTotalTaxPaise,
    hsnSummaries,
    totalTaxableAmountPaise,
    totalCgstPaise,
    totalSgstPaise,
    totalIgstPaise,
    totalTaxAmountPaise,
    grandTotalPaise,
  };
}
