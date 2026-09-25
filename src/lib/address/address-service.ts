import "server-only";
import { prisma } from "@/lib/prisma";
import { validateAddressInput, type AddressInput } from "./address-schema";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";

export interface AddressRecord {
  id: string;
  customerId: string | null;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function listAddresses(customerId: string): Promise<AddressRecord[]> {
  if (!customerId) return [];
  return prisma.address.findMany({
    where: { customerId },
    orderBy: [{ isDefaultShipping: "desc" }, { createdAt: "desc" }],
  });
}

export async function createAddress(
  data: Partial<AddressInput>,
  customerId?: string | null
): Promise<AddressRecord> {
  const validated = validateAddressInput(data);

  if (customerId && validated.isDefaultShipping) {
    await prisma.address.updateMany({
      where: { customerId },
      data: { isDefaultShipping: false },
    });
  }

  return prisma.address.create({
    data: {
      ...validated,
      customerId: customerId || null,
    },
  });
}

export async function updateAddress(
  id: string,
  data: Partial<AddressInput>,
  customerId: string
): Promise<AddressRecord> {
  const existing = await prisma.address.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError("Address not found.");
  }

  if (existing.customerId !== customerId) {
    throw new UnauthorizedError("Unauthorized access to this address.");
  }

  const validated = validateAddressInput({
    ...existing,
    ...data,
  });

  if (validated.isDefaultShipping) {
    await prisma.address.updateMany({
      where: { customerId, id: { not: id } },
      data: { isDefaultShipping: false },
    });
  }

  return prisma.address.update({
    where: { id },
    data: validated,
  });
}

export async function deleteAddress(id: string, customerId: string): Promise<void> {
  const existing = await prisma.address.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError("Address not found.");
  }

  if (existing.customerId !== customerId) {
    throw new UnauthorizedError("Unauthorized access to this address.");
  }

  await prisma.address.delete({
    where: { id },
  });
}

export async function setDefaultShippingAddress(
  id: string,
  customerId: string
): Promise<AddressRecord> {
  const existing = await prisma.address.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError("Address not found.");
  }

  if (existing.customerId !== customerId) {
    throw new UnauthorizedError("Unauthorized access to this address.");
  }

  await prisma.address.updateMany({
    where: { customerId },
    data: { isDefaultShipping: false },
  });

  return prisma.address.update({
    where: { id },
    data: { isDefaultShipping: true },
  });
}
