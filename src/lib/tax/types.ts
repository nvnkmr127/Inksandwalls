export interface TaxLineItemInput {
  id: string;
  productId: string;
  productName: string;
  hsnCode?: string | null;
  productType?: "PER_AREA" | "FIXED";
  quantity: number;
  unitPricePaise: number;
  totalPricePaise: number;
}

export interface TaxCalculationInput {
  lines: TaxLineItemInput[];
  discountPaise?: number; // Coupon discount applied on subtotal
  shippingPaise?: number; // Shipping fee applied
  customerState?: string | null; // e.g. "Telangana", "Maharashtra", "KA"
  sellerState?: string | null; // e.g. "Telangana"
  customGstRatePct?: number | null; // Configured GST rate override (e.g. 18)
}

export interface LineTaxDetail {
  lineId: string;
  productId: string;
  productName: string;
  hsnCode: string;
  quantity: number;
  grossAmountPaise: number;
  discountPaise: number;
  taxableAmountPaise: number;
  gstRatePct: number;
  isIntraState: boolean;
  cgstRatePct: number;
  cgstAmountPaise: number;
  sgstRatePct: number;
  sgstAmountPaise: number;
  igstRatePct: number;
  igstAmountPaise: number;
  totalTaxPaise: number;
  lineTotalWithTaxPaise: number;
}

export interface HsnTaxSummary {
  hsnCode: string;
  taxableAmountPaise: number;
  gstRatePct: number;
  cgstAmountPaise: number;
  sgstAmountPaise: number;
  igstAmountPaise: number;
  totalTaxPaise: number;
}

export interface TaxCalculationResult {
  isIntraState: boolean;
  sellerState: string;
  customerState: string;
  gstRatePct: number;

  // Item Taxes
  lines: LineTaxDetail[];
  itemsTaxableAmountPaise: number;
  itemsCgstPaise: number;
  itemsSgstPaise: number;
  itemsIgstPaise: number;
  itemsTotalTaxPaise: number;

  // Shipping Taxes
  shippingAmountPaise: number;
  shippingTaxablePaise: number;
  shippingCgstPaise: number;
  shippingSgstPaise: number;
  shippingIgstPaise: number;
  shippingTotalTaxPaise: number;

  // HSN Aggregations
  hsnSummaries: HsnTaxSummary[];

  // Grand Totals
  totalTaxableAmountPaise: number;
  totalCgstPaise: number;
  totalSgstPaise: number;
  totalIgstPaise: number;
  totalTaxAmountPaise: number;
  grandTotalPaise: number;
}
