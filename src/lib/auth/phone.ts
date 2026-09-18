/**
 * Canonical Phone Normalization Utility
 * Normalizes Indian mobile numbers into standard E.164 format (+91XXXXXXXXXX).
 */

/**
 * Normalizes an Indian phone number input into standard E.164 format (+91XXXXXXXXXX).
 * Returns null if the phone number is invalid.
 */
export function normalizePhoneNumber(rawPhone: string): string | null {
  if (!rawPhone || typeof rawPhone !== "string") {
    return null;
  }

  // Strip whitespace, hyphens, parentheses, and dots
  const sanitized = rawPhone.replace(/[\s\-\(\)\.]/g, "");

  // Match pattern:
  // Option 1: +91 followed by 10 digits starting with 6-9
  // Option 2: 91 followed by 10 digits starting with 6-9
  // Option 3: 0 followed by 10 digits starting with 6-9
  // Option 4: 10 digits starting with 6-9
  const match = sanitized.match(/^(?:\+?91|0)?([6-9]\d{9})$/);

  if (!match) {
    return null;
  }

  const tenDigits = match[1];
  return `+91${tenDigits}`;
}

/**
 * Validates whether a given phone string is a valid Indian mobile number.
 */
export function isValidPhoneNumber(rawPhone: string): boolean {
  return normalizePhoneNumber(rawPhone) !== null;
}
