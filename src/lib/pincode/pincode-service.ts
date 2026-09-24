/**
 * Indian PIN Code Validation and Delivery Zone Resolution Service.
 * Standard Indian Postal Codes: 6 digits (range: 110001 - 899999).
 */

export interface PincodeValidationResult {
  valid: boolean;
  pincode: string;
  formattedPincode: string;
  city?: string;
  state?: string;
  isDeliverable: boolean;
  error?: string;
}

// Prefix mappings for prominent delivery zones across India
const PINCODE_PREFIX_MAPPING: Record<string, { state: string; defaultCity: string }> = {
  "11": { state: "Delhi", defaultCity: "New Delhi" },
  "12": { state: "Haryana", defaultCity: "Gurugram" },
  "13": { state: "Haryana", defaultCity: "Faridabad" },
  "14": { state: "Punjab", defaultCity: "Amritsar" },
  "15": { state: "Punjab", defaultCity: "Bathinda" },
  "16": { state: "Chandigarh", defaultCity: "Chandigarh" },
  "17": { state: "Himachal Pradesh", defaultCity: "Shimla" },
  "18": { state: "Jammu and Kashmir", defaultCity: "Jammu" },
  "19": { state: "Jammu and Kashmir", defaultCity: "Srinagar" },
  "20": { state: "Uttar Pradesh", defaultCity: "Noida" },
  "21": { state: "Uttar Pradesh", defaultCity: "Prayagraj" },
  "22": { state: "Uttar Pradesh", defaultCity: "Lucknow" },
  "24": { state: "Uttarakhand", defaultCity: "Dehradun" },
  "28": { state: "Uttar Pradesh", defaultCity: "Agra" },
  "30": { state: "Rajasthan", defaultCity: "Jaipur" },
  "38": { state: "Gujarat", defaultCity: "Ahmedabad" },
  "39": { state: "Gujarat", defaultCity: "Surat" },
  "40": { state: "Maharashtra", defaultCity: "Mumbai" },
  "41": { state: "Maharashtra", defaultCity: "Pune" },
  "42": { state: "Maharashtra", defaultCity: "Nashik" },
  "44": { state: "Maharashtra", defaultCity: "Nagpur" },
  "45": { state: "Madhya Pradesh", defaultCity: "Indore" },
  "46": { state: "Madhya Pradesh", defaultCity: "Bhopal" },
  "50": { state: "Telangana", defaultCity: "Hyderabad" },
  "51": { state: "Andhra Pradesh", defaultCity: "Tirupati" },
  "52": { state: "Andhra Pradesh", defaultCity: "Vijayawada" },
  "53": { state: "Andhra Pradesh", defaultCity: "Visakhapatnam" },
  "56": { state: "Karnataka", defaultCity: "Bengaluru" },
  "57": { state: "Karnataka", defaultCity: "Mangaluru" },
  "58": { state: "Karnataka", defaultCity: "Hubballi" },
  "60": { state: "Tamil Nadu", defaultCity: "Chennai" },
  "62": { state: "Tamil Nadu", defaultCity: "Madurai" },
  "64": { state: "Tamil Nadu", defaultCity: "Coimbatore" },
  "67": { state: "Kerala", defaultCity: "Kozhikode" },
  "68": { state: "Kerala", defaultCity: "Kochi" },
  "69": { state: "Kerala", defaultCity: "Thiruvananthapuram" },
  "70": { state: "West Bengal", defaultCity: "Kolkata" },
  "75": { state: "Odisha", defaultCity: "Bhubaneswar" },
  "78": { state: "Assam", defaultCity: "Guwahati" },
  "80": { state: "Bihar", defaultCity: "Patna" },
  "83": { state: "Jharkhand", defaultCity: "Ranchi" },
};

// Known restricted / unserviceable test pincodes
const RESTRICTED_PINCODES = new Set(["999999", "000000", "111111", "900000"]);

/**
 * Validates PIN code format and deliverability.
 */
export function validatePincode(pincode: string | null | undefined): PincodeValidationResult {
  if (!pincode || typeof pincode !== "string") {
    return {
      valid: false,
      pincode: "",
      formattedPincode: "",
      isDeliverable: false,
      error: "Postal code is required.",
    };
  }

  const sanitized = pincode.replace(/\s+/g, "").trim();

  // Indian postal codes must be 6 digits and start with 1-9
  if (!/^[1-9][0-9]{5}$/.test(sanitized)) {
    return {
      valid: false,
      pincode: sanitized,
      formattedPincode: sanitized,
      isDeliverable: false,
      error: "Invalid PIN code. Must be a 6-digit number starting with 1-9.",
    };
  }

  // Check deliverability against restricted/non-serviceable zones
  if (RESTRICTED_PINCODES.has(sanitized)) {
    return {
      valid: true,
      pincode: sanitized,
      formattedPincode: sanitized,
      isDeliverable: false,
      error: `Delivery is currently not available to PIN code ${sanitized}.`,
    };
  }

  const prefix = sanitized.slice(0, 2);
  const location = PINCODE_PREFIX_MAPPING[prefix];

  return {
    valid: true,
    pincode: sanitized,
    formattedPincode: sanitized,
    isDeliverable: true,
    state: location?.state || "India",
    city: location?.defaultCity || "City",
  };
}

/**
 * Quick boolean deliverability check.
 */
export function isPincodeDeliverable(pincode: string | null | undefined): boolean {
  const result = validatePincode(pincode);
  return result.valid && result.isDeliverable;
}
