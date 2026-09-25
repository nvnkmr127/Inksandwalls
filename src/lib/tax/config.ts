/**
 * GST & Business Tax Configuration.
 * 
 * NOTE ON UNRESOLVED CLIENT INPUTS (PRD §11):
 * 1. Default GST Rate (%): Currently standard 18% for wall coverings (HSN 4814) & printed art (HSN 4911),
 *    configurable via process.env.DEFAULT_GST_RATE_PCT.
 * 2. Seller Business Legal Details:
 *    - Legal Business Name (SELLER_LEGAL_NAME)
 *    - GSTIN (SELLER_GSTIN)
 *    - PAN (SELLER_PAN)
 *    - Registered Business Address (SELLER_ADDRESS)
 *    - Operating State & State Code (SELLER_STATE, SELLER_STATE_CODE)
 *    - Invoice Prefix (INVOICE_PREFIX, default "INV")
 */

export interface SellerTaxProfile {
  legalName: string;
  tradeName: string;
  gstin: string;
  pan: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  stateCode: string;
  postalCode: string;
  country: string;
  email?: string | null;
  phone?: string | null;
}

export const DEFAULT_GST_RATE_PCT = Number(process.env.DEFAULT_GST_RATE_PCT) || 18;
export const DEFAULT_FALLBACK_HSN = "4814"; // HSN 4814: Wallpaper & wall coverings

export const DEFAULT_SELLER_PROFILE: SellerTaxProfile = {
  legalName: process.env.SELLER_LEGAL_NAME || "INKs & Walls Private Limited",
  tradeName: process.env.SELLER_TRADE_NAME || "INKs & Walls",
  gstin: process.env.SELLER_GSTIN || "UNRESOLVED_CLIENT_INPUT_GSTIN",
  pan: process.env.SELLER_PAN || "UNRESOLVED_CLIENT_INPUT_PAN",
  addressLine1: process.env.SELLER_ADDRESS_LINE1 || "Plot No. 42, Hitec City",
  addressLine2: process.env.SELLER_ADDRESS_LINE2 || "Madhapur",
  city: process.env.SELLER_CITY || "Hyderabad",
  state: process.env.SELLER_STATE || "Telangana",
  stateCode: process.env.SELLER_STATE_CODE || "36",
  postalCode: process.env.SELLER_PINCODE || "500081",
  country: "IN",
  email: process.env.SELLER_EMAIL || "support@inksandwalls.com",
  phone: process.env.SELLER_PHONE || "+91 90000 00000",
};

/**
 * Standard Indian State to 2-digit GST State Code mapping.
 */
export const STATE_GST_CODES: Record<string, string> = {
  "jammu and kashmir": "01",
  "himachal pradesh": "02",
  "punjab": "03",
  "chandigarh": "04",
  "uttarakhand": "05",
  "haryana": "06",
  "delhi": "07",
  "rajasthan": "08",
  "uttar pradesh": "09",
  "bihar": "10",
  "sikkim": "11",
  "arunachal pradesh": "12",
  "nagaland": "13",
  "manipur": "14",
  "mizoram": "15",
  "tripura": "16",
  "meghalaya": "17",
  "assam": "18",
  "west bengal": "19",
  "jharkhand": "20",
  "odisha": "21",
  "chhattisgarh": "22",
  "madhya pradesh": "23",
  "gujarat": "24",
  "daman and diu": "25",
  "dadra and nagar haveli": "26",
  "maharashtra": "27",
  "andhra pradesh": "28", // (or 37 post bifurcation)
  "karnataka": "29",
  "goa": "30",
  "lakshadweep": "31",
  "kerala": "32",
  "tamil nadu": "33",
  "puducherry": "34",
  "andaman and nicobar islands": "35",
  "telangana": "36",
};

export function getStateGstCode(stateName: string | null | undefined): string | null {
  if (!stateName) return null;
  const normalized = stateName.toLowerCase().trim();
  return STATE_GST_CODES[normalized] || null;
}
