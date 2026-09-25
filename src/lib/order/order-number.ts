import crypto from "node:crypto";

/**
 * Generates a human-readable, unique, unguessable server-side order number.
 * Format: INW-YYYYMMDD-XXXX (e.g. INW-20260924-A3F8)
 */
export function generateOrderNumber(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars hex
  return `INW-${year}${month}${day}-${randomSuffix}`;
}
