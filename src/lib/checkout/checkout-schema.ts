import { z } from "zod";

export const addressSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  addressLine1: z.string().min(1, "Address is required").max(255),
  addressLine2: z.string().max(255).optional(),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  postalCode: z.string().min(4, "Invalid postal code").max(20),
  country: z.string().default("IN"),
  phone: z.string().min(10, "Invalid phone number").max(20).optional(),
});

export const checkoutContactSchema = z.object({
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Invalid phone number").max(20).optional(),
});

export const updateCheckoutAddressSchema = z.object({
  shippingAddress: addressSchema,
  billingAddress: addressSchema.optional(),
  useShippingAsBilling: z.boolean().default(true),
});

export const selectDeliveryOptionSchema = z.object({
  deliveryOption: z.string().min(1, "Delivery option is required"),
});

export type AddressInput = z.infer<typeof addressSchema>;
export type CheckoutContactInput = z.infer<typeof checkoutContactSchema>;
export type UpdateCheckoutAddressInput = z.infer<typeof updateCheckoutAddressSchema>;
export type SelectDeliveryOptionInput = z.infer<typeof selectDeliveryOptionSchema>;
