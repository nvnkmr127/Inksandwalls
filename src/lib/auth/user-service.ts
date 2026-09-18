import { Role, UserStatus } from "@prisma/client";
import { prisma } from "../prisma";

export const VALID_ROLES = [
  Role.GUEST,
  Role.CUSTOMER,
  Role.STORE_ADMIN,
  Role.SUPER_ADMIN,
] as const;

export type AllowedRole = (typeof VALID_ROLES)[number];

/**
 * Validate if a string represents a valid application Role.
 */
export function isValidRole(role: unknown): role is Role {
  return typeof role === "string" && (VALID_ROLES as readonly string[]).includes(role);
}

/**
 * Sanitize client-supplied input payloads to prevent privilege escalation.
 * Removes role, status, id, and timestamp fields supplied by untrusted clients.
 */
export function sanitizeClientUserInput<T extends Record<string, unknown>>(input: T): Omit<T, "role" | "status" | "id" | "createdAt" | "updatedAt"> {
  const sanitized = { ...input };
  delete sanitized.role;
  delete sanitized.status;
  delete sanitized.id;
  delete sanitized.createdAt;
  delete sanitized.updatedAt;
  return sanitized;
}

export interface UserCreateOrUpdateInput {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  image?: string | null;
  role?: Role;
  status?: UserStatus;
}

/**
 * Server-controlled utility to find or create a user by phone number with linked Customer domain entity.
 */
export async function findOrCreateUserByPhone(phone: string, extraInput?: UserCreateOrUpdateInput) {
  const existingUser = await prisma.user.findUnique({
    where: { phone },
    include: { customer: true },
  });

  if (existingUser) {
    if (!existingUser.customer) {
      await prisma.customer.create({
        data: { userId: existingUser.id },
      });
    }
    return existingUser;
  }

  return prisma.user.create({
    data: {
      phone,
      email: extraInput?.email || null,
      name: extraInput?.name || null,
      image: extraInput?.image || null,
      role: extraInput?.role || Role.CUSTOMER,
      status: extraInput?.status || UserStatus.ACTIVE,
      customer: {
        create: {},
      },
    },
    include: { customer: true },
  });
}

/**
 * Server-controlled utility to find or create a user by email with linked Customer domain entity.
 */
export async function findOrCreateUserByEmail(email: string, extraInput?: UserCreateOrUpdateInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { customer: true },
  });

  if (existingUser) {
    if (!existingUser.customer) {
      await prisma.customer.create({
        data: { userId: existingUser.id },
      });
    }
    return existingUser;
  }

  return prisma.user.create({
    data: {
      email,
      phone: extraInput?.phone || null,
      name: extraInput?.name || null,
      image: extraInput?.image || null,
      role: extraInput?.role || Role.CUSTOMER,
      status: extraInput?.status || UserStatus.ACTIVE,
      customer: {
        create: {},
      },
    },
    include: { customer: true },
  });
}
