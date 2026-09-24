import { validatePincode } from "@/lib/pincode/pincode-service";
import { ValidationError } from "@/lib/errors";

export interface AddressInput {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  phone?: string | null;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
}

export function validateAddressInput(input: Partial<AddressInput>): AddressInput {
  if (!input.firstName || !input.firstName.trim()) {
    throw new ValidationError("First name is required.");
  }
  if (!input.lastName || !input.lastName.trim()) {
    throw new ValidationError("Last name is required.");
  }
  if (!input.addressLine1 || !input.addressLine1.trim()) {
    throw new ValidationError("Address line 1 is required.");
  }
  if (!input.city || !input.city.trim()) {
    throw new ValidationError("City is required.");
  }
  if (!input.state || !input.state.trim()) {
    throw new ValidationError("State is required.");
  }

  const pincodeResult = validatePincode(input.postalCode);
  if (!pincodeResult.valid) {
    throw new ValidationError(pincodeResult.error || "Invalid PIN code.");
  }

  // Validate phone if provided (10 digit Indian number)
  let validatedPhone: string | null = null;
  if (input.phone) {
    const cleanPhone = input.phone.replace(/[\s+-]/g, "");
    const match = cleanPhone.match(/^(?:91)?([6-9]\d{9})$/);
    if (!match) {
      throw new ValidationError("Please enter a valid 10-digit Indian phone number.");
    }
    validatedPhone = `+91${match[1]}`;
  }

  return {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    addressLine1: input.addressLine1.trim(),
    addressLine2: input.addressLine2 ? input.addressLine2.trim() : null,
    city: input.city.trim(),
    state: input.state.trim(),
    postalCode: pincodeResult.formattedPincode,
    country: input.country?.trim() || "IN",
    phone: validatedPhone,
    isDefaultShipping: Boolean(input.isDefaultShipping),
    isDefaultBilling: Boolean(input.isDefaultBilling),
  };
}
