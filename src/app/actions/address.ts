"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { resolveCartOwner } from "@/lib/cart/cart-service";
import { UnauthorizedError } from "@/lib/errors";
import {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultShippingAddress,
  type AddressRecord,
} from "@/lib/address/address-service";
import type { AddressInput } from "@/lib/address/address-schema";

export async function fetchUserAddressesAction(): Promise<{
  success: boolean;
  addresses?: AddressRecord[];
  error?: string;
}> {
  try {
    const cookieStore = await cookies();
    const owner = await resolveCartOwner(cookieStore);
    if (owner.type !== "CUSTOMER" || !owner.customerId) {
      return { success: true, addresses: [] };
    }
    const addresses = await listAddresses(owner.customerId);
    return { success: true, addresses };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function createAddressAction(
  data: Partial<AddressInput>
): Promise<{ success: boolean; address?: AddressRecord; error?: string }> {
  try {
    const cookieStore = await cookies();
    const owner = await resolveCartOwner(cookieStore);
    const customerId = owner.type === "CUSTOMER" ? owner.customerId : null;
    const address = await createAddress(data, customerId);
    revalidatePath("/checkout");
    return { success: true, address };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateAddressAction(
  id: string,
  data: Partial<AddressInput>
): Promise<{ success: boolean; address?: AddressRecord; error?: string }> {
  try {
    const cookieStore = await cookies();
    const owner = await resolveCartOwner(cookieStore);
    if (owner.type !== "CUSTOMER" || !owner.customerId) {
      throw new UnauthorizedError("Authentication required to update saved address.");
    }
    const address = await updateAddress(id, data, owner.customerId);
    revalidatePath("/checkout");
    return { success: true, address };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteAddressAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cookieStore = await cookies();
    const owner = await resolveCartOwner(cookieStore);
    if (owner.type !== "CUSTOMER" || !owner.customerId) {
      throw new UnauthorizedError("Authentication required to delete saved address.");
    }
    await deleteAddress(id, owner.customerId);
    revalidatePath("/checkout");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function setDefaultShippingAction(
  id: string
): Promise<{ success: boolean; address?: AddressRecord; error?: string }> {
  try {
    const cookieStore = await cookies();
    const owner = await resolveCartOwner(cookieStore);
    if (owner.type !== "CUSTOMER" || !owner.customerId) {
      throw new UnauthorizedError("Authentication required to set default address.");
    }
    const address = await setDefaultShippingAddress(id, owner.customerId);
    revalidatePath("/checkout");
    return { success: true, address };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
