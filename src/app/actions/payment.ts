"use server";

import { revalidatePath } from "next/cache";
import {
  selectCheckoutPaymentMethod,
  recalculateCheckoutSession,
  type CheckoutSessionSnapshot,
} from "@/lib/checkout/checkout-service";
import {
  validateAndPrepareCodCheckout,
  checkCodEligibility,
} from "@/lib/payment/cod-service";
import type {
  PaymentMethod,
  CodEligibilityResult,
  CodPaymentPreparation,
} from "@/lib/payment/types";
import { ValidationError, UnauthorizedError, NotFoundError } from "@/lib/errors";

export async function selectPaymentMethodAction(
  checkoutId: string,
  method: PaymentMethod
): Promise<{ success: boolean; session?: CheckoutSessionSnapshot; error?: string }> {
  try {
    const session = await selectCheckoutPaymentMethod(checkoutId, method);
    revalidatePath(`/checkout/${checkoutId}`);
    return { success: true, session };
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof UnauthorizedError ||
      error instanceof NotFoundError
    ) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to update payment method." };
  }
}

export async function checkCodEligibilityAction(
  checkoutId: string
): Promise<{
  success: boolean;
  eligibility?: CodEligibilityResult;
  session?: CheckoutSessionSnapshot;
  error?: string;
}> {
  try {
    const session = await recalculateCheckoutSession(checkoutId);
    const eligibility = checkCodEligibility({
      pincode: session.shippingAddress?.postalCode || null,
      totalAmountPaise: session.totals.totalPayablePaise,
      isDeliverable: session.totals.isDeliverable,
    });
    return { success: true, eligibility, session };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function prepareCodCheckoutAction(
  checkoutId: string
): Promise<{
  success: boolean;
  preparation?: CodPaymentPreparation;
  session?: CheckoutSessionSnapshot;
  error?: string;
}> {
  try {
    const result = await validateAndPrepareCodCheckout(checkoutId);
    revalidatePath(`/checkout/${checkoutId}`);
    return {
      success: true,
      preparation: result.preparation,
      session: result.session,
    };
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof UnauthorizedError ||
      error instanceof NotFoundError
    ) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to prepare Cash on Delivery payment." };
  }
}
