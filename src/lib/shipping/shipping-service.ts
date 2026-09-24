import "server-only";
import { prisma } from "@/lib/prisma";
import {
  resolveShippingRule,
  DEFAULT_SHIPPING_RULE,
} from "./shipping-engine";
import type {
  ShippingRuleData,
  ShippingResolutionResult,
} from "./types";

/**
 * Loads all active shipping rules from database or defaults to standard fallback.
 */
export async function getActiveShippingRules(): Promise<ShippingRuleData[]> {
  try {
    // Check if shippingRule model exists on Prisma Client
    const delegate = (prisma as unknown as { shippingRule?: { findMany: (args: unknown) => Promise<ShippingRuleData[]> } }).shippingRule;
    if (delegate && typeof delegate.findMany === "function") {
      const dbRules = await delegate.findMany({
        where: { isActive: true },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      });
      if (dbRules && dbRules.length > 0) {
        return dbRules;
      }
    }
  } catch {
    // Fall back gracefully to default rule if table is not yet migrated
  }

  return [DEFAULT_SHIPPING_RULE];
}

/**
 * Calculates authoritative shipping cost and delivery availability for an address & subtotal.
 */
export async function calculateShippingForAddress(params: {
  pincode: string;
  state?: string | null;
  subtotalPaise: number;
}): Promise<ShippingResolutionResult> {
  const rules = await getActiveShippingRules();
  return resolveShippingRule({
    pincode: params.pincode,
    state: params.state,
    subtotalPaise: params.subtotalPaise,
    rules,
  });
}
