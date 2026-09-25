import type { CodConfig } from "./types";

export const DEFAULT_COD_CONFIG: CodConfig = {
  enabled: true,
  minOrderValuePaise: 50000, // ₹500
  maxOrderValuePaise: 5000000, // ₹50,000
  allowedPincodes: [],
  blockedPincodes: [],
};

export function getCodConfig(): CodConfig {
  return {
    ...DEFAULT_COD_CONFIG,
    enabled: process.env.ENABLE_COD !== "false",
  };
}
