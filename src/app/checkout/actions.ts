"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  startCheckout,
  updateCheckoutContact,
  updateCheckoutAddress,
  selectDeliveryOption,
  confirmCheckout,
} from "@/lib/checkout/checkout-service";
import {
  checkoutContactSchema,
  updateCheckoutAddressSchema,
  selectDeliveryOptionSchema,
} from "@/lib/checkout/checkout-schema";
import { ValidationError, UnauthorizedError } from "@/lib/errors";

export async function startCheckoutAction() {
  try {
    const session = await startCheckout();
    revalidatePath("/checkout");
    return { success: true, checkoutId: session.id };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error: error.message };
    }
    console.error("Start checkout error:", error);
    return { success: false, error: "Failed to start checkout. Please try again." };
  }
}

export async function updateContactAction(checkoutId: string, formData: FormData) {
  try {
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    
    const validated = checkoutContactSchema.parse({ email, phone });
    await updateCheckoutContact(checkoutId, validated);
    
    revalidatePath("/checkout");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    if (error instanceof ValidationError || error instanceof UnauthorizedError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to update contact info." };
  }
}

export async function updateAddressAction(checkoutId: string, formData: FormData) {
  try {
    // Simplify mapping for this implementation. 
    // In production, robust mapping of form fields to the complex schema is needed.
    const useShippingAsBilling = formData.get("useShippingAsBilling") === "true";
    
    const shippingAddress = {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      addressLine1: formData.get("addressLine1") as string,
      addressLine2: (formData.get("addressLine2") as string) || undefined,
      city: formData.get("city") as string,
      state: formData.get("state") as string,
      postalCode: formData.get("postalCode") as string,
      country: (formData.get("country") as string) || "IN",
      phone: (formData.get("phone") as string) || undefined,
    };
    
    const validated = updateCheckoutAddressSchema.parse({
      shippingAddress,
      billingAddress: useShippingAsBilling ? undefined : shippingAddress, // stub
      useShippingAsBilling,
    });
    
    await updateCheckoutAddress(checkoutId, validated);
    
    revalidatePath("/checkout");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    if (error instanceof ValidationError || error instanceof UnauthorizedError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to update address." };
  }
}

export async function selectDeliveryOptionAction(checkoutId: string, deliveryOption: string) {
  try {
    const validated = selectDeliveryOptionSchema.parse({ deliveryOption });
    await selectDeliveryOption(checkoutId, validated);
    
    revalidatePath("/checkout");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    if (error instanceof ValidationError || error instanceof UnauthorizedError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to select delivery option." };
  }
}

export async function confirmCheckoutAction(checkoutId: string) {
  try {
    await confirmCheckout(checkoutId);
    
    revalidatePath("/checkout");
    // In a real implementation this might redirect to payment processing
    redirect(`/checkout/${checkoutId}/payment`); 
  } catch (error) {
    if (error instanceof ValidationError || error instanceof UnauthorizedError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Failed to confirm checkout." };
  }
}
